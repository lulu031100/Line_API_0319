'use strict';

const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
const request = require('request');
require('date-utils');

/*************************************************************************/
/* Confidential information
/*************************************************************************/
const LINE_CHANNEL_ACCESS_TOKEN = 'uv4R96Em5p7FM1AmJ8nbOOtflV4vBwkjniv486rqh5PMwpJ4mFWzlLjzdNg9R8UFQuF7RVqVd4W1fnSxguiNAzyBriCBHSOtQD39GfPGPlOrwv6j9Nedl4DWKqf/0akD+l0SNfy9fTOpUSr64bUtjQdB04t89/1O/w1cDnyilFU=';    // LINE Botのアクセストークン
const LINE_CHANNEL_SECRET = '39209d57c9e7a541b97d2cc81c3d079d';          // LINE BotのChannel Secret
const GURUNAVI_API_KEY = 'c1c3fe93b008f5cac7d7efb8f157b475';             // ぐるなびAPI用：APIキー
/****************************************************************/
const PORT = process.env.PORT || 3000;
const LINE_MESSAGE_MAX_LENGTH = 2000;

const NEW_LINE = '\n';
const GURUNAVI_LUNCH_HOUR = 13;
const GURUNAVI_DRINKING_HOUR = 17;

const config = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET
};

const app = express();

app.post('/webhook', line.middleware(config), (req, res) => {
// 先行してLINE側にステータスコード200を返す
  res.sendStatus(200);

  console.log(req.body.events);
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => {
      console.log('event processed.');
    });
});

const client = new line.Client(config);

function handleEvent(event) {

  console.log('handleEvent()');

  if (event.type !== 'message') {
    return Promise.resolve(null);
  }

  if ((event.message.type !== 'text') && (event.message.type !== 'location')) {
    return Promise.resolve(null);
  }

  let message = '';

  
  /***** type：location *****/
  const latitude = (event.message.type === 'location') ? event.message.latitude : '';
  const longitude = (event.message.type === 'location') ? event.message.longitude : '';
  if ((latitude != '') && (longitude != '')) {
    // ぐるなび検索
    gurunaviSearch(event.source.userId, latitude, longitude);

    message = 'ちょっと待ってね';
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: message
  });
}

const gurunaviSearch = async (userId, latitude, longitude) => {

  //情報提供元：ぐるなびのAPI
  //https://api.gnavi.co.jp/api/
  //https://api.gnavi.co.jp/api/manual/

  console.log('gurunaviSearch()');

  const url = 'https://api.gnavi.co.jp/RestSearchAPI/v3/';
  const format = 'json';
  const range = 3;              // 緯度/経度からの検索範囲(半径)。3は、1000m
  const hit_per_page = 20;       // 検索結果の最大取得件数

  let options;
  const nowHour = new Date().toFormat("HH24");
  if (nowHour < GURUNAVI_LUNCH_HOUR) {
    // ランチ検索
    options = {
      url: url,
      qs: {
        keyid: GURUNAVI_API_KEY,
        // format: format,
        latitude: latitude,
        longitude: longitude,
        range: range,
        hit_per_page: hit_per_page,
        lunch: 1    // ランチ営業有無　0:絞込みなし(デフォルト)、1：絞込みあり
      }
    };
  } else {
    const category = RSFST09000; 
      options = {
      url: url,
      qs: {
        keyid: GURUNAVI_API_KEY,
        // format: format,
        category_l: category,   // 大業態コード
        latitude: latitude,
        longitude: longitude,
        range: range,
        hit_per_page: hit_per_page
      }
    };
  }

  request(options, function(err, response, result) {
    let message = '';

    if(!err && response.statusCode == 200) {
      const json = JSON.parse(result);

      if (json.rest) {
        const list = json.rest;

        const title = '[検索結果]' + NEW_LINE;
        message = title;

        let number = 1;
        Object.keys(list).some(function(key) {
          if (message != title) {
            message += NEW_LINE;
          }

          const item = list[key];

          const name = item.name;
          if (name) {
            message += 'No.' + number + NEW_LINE;
            message += '◆店舗名：' + NEW_LINE;
            message += name + NEW_LINE;

            let opentime = item.opentime;
            if (opentime && (typeof opentime == 'string')) {
              message += '◆営業時間：' + NEW_LINE;
              opentime = opentime.replace(/<BR>/g, NEW_LINE);
              message += opentime + NEW_LINE;
            }

            let holiday = item.holiday;
            if (holiday && (typeof holiday == 'string')) {
              message += '◆休業日：' + NEW_LINE;
              holiday = holiday.replace(/<BR>/g, NEW_LINE);
              message += holiday + NEW_LINE;
            }

            const url = item.url_mobile;
            if (url) {
              message += url + NEW_LINE;
            }

            number++;
          }
        });

        if (message == title) {
          message = 'ごめんなさい。' + NEW_LINE;
          message += '検索結果はありません。';
        }

        console.log('message=' + NEW_LINE);
        console.log(message);

      } else {
        message = 'ごめんなさい。' + NEW_LINE;
        message += '検索結果はありません。';
      }

    } else {
      message = 'ごめんなさい。' + NEW_LINE;
      message += 'エラーが発生しました。';
      console.log('error!');
      console.log('err:' + err + ', response.statusCode:' + response.statusCode);
    }

    client.pushMessage(userId, {
      type: 'text',
      text: message
    });
  }).setMaxListeners(10);
}

app.listen(PORT);
console.log(`Server running at ${PORT}`);