/**
 * Parser.gs — 解析 AmazingTalker 通知信（純函式）。
 *
 * 不呼叫任何 Google 服務，所以可以在本機用 Node 測試：
 *   node --test apps-script/test/
 *
 * 時間一律視為 Asia/Taipei（GMT+8，沒有日光節約時間），結果用 epoch 毫秒表示。
 * 支援的信：課時請求信、學生取消信。其他信回傳 type: 'unknown'。
 */

var TAIPEI_OFFSET_HOURS = 8;
var DATE_PATTERN_ = '(\\d{4})\\/(\\d{1,2})\\/(\\d{1,2})';
var TIME_PATTERN_ = '(上午|下午|凌晨|清晨|中午|晚上)?(\\d{1,2}):(\\d{2})';
var RANGE_RE_ = new RegExp(DATE_PATTERN_ + '\\s*' + TIME_PATTERN_ + '\\s*[-–—~～]\\s*' + TIME_PATTERN_);
var EXPIRY_RE_ = new RegExp('將會在\\s*' + DATE_PATTERN_ + '\\s*' + TIME_PATTERN_ + '\\s*過期');
var CANCEL_TIME_RE_ = new RegExp('取消了與您在\\s*' + DATE_PATTERN_ + '\\s*' + TIME_PATTERN_ + '\\s*的課程');

/** 換行與連續空白變成一個空格；「上午」「下午」與數字之間的空格去掉。 */
function normalizeText_(s) {
  return String(s || '')
    .replace(/[​‌‍﻿]/g, '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(上午|下午|凌晨|清晨|中午|晚上)\s+(?=\d)/g, '$1')
    .trim();
}

/** 中文 12 小時制 → 當天的第幾分鐘（0–1440）。沒有上午/下午字樣時視為 24 小時制。 */
function minutesOfDay_(period, hour, minute) {
  var h = Number(hour);
  if (period === '上午' || period === '凌晨' || period === '清晨') {
    if (h === 12) h = 0;
  } else if (period === '中午') {
    if (h <= 6) h += 12;
  } else if (period === '下午') {
    if (h < 12) h += 12;
  } else if (period === '晚上') {
    if (h < 12) h += 12;
    else if (h === 12) h = 24;
  }
  return h * 60 + Number(minute);
}

function epochMs_(y, m, d, minutes) {
  return Date.UTC(Number(y), Number(m) - 1, Number(d), 0, minutes) - TAIPEI_OFFSET_HOURS * 3600000;
}

function unknown_(reason) {
  return { type: 'unknown', reason: reason };
}

/**
 * 解析一封信。回傳：
 *   { type: 'request', student, startMs, endMs, durationMin, expiresMs, unconfirmed }
 *   { type: 'cancel',  student, startMs, reason }
 *   { type: 'unknown', reason }
 */
function parseMessage(subject, body) {
  var s = normalizeText_(subject);
  var b = normalizeText_(body);
  if (/課時請求/.test(s)) return parseRequest_(s, b);
  if (/取消了與您的預約課程/.test(s) || /取消了與您在/.test(b)) return parseCancel_(s, b);
  return unknown_('標題不是已知的 AmazingTalker 通知類型');
}

function parseRequest_(s, b) {
  var m = RANGE_RE_.exec(s) || RANGE_RE_.exec(b);
  if (!m) return unknown_('課時請求信裡找不到日期與時間');

  var startMin = minutesOfDay_(m[4], m[5], m[6]);
  var endMin = minutesOfDay_(m[7] || m[4], m[8], m[9]); // 結束時間沒寫上下午時，沿用開始時間的
  if (endMin <= startMin) endMin += 24 * 60;

  var nameMatch = /([^,，🌟]+?)\s*發送一筆課時請求/.exec(b);
  var student = nameMatch ? nameMatch[1].trim() : '';
  if (!student) return unknown_('課時請求信裡找不到學生名');

  var e = EXPIRY_RE_.exec(b);
  return {
    type: 'request',
    student: student,
    startMs: epochMs_(m[1], m[2], m[3], startMin),
    endMs: epochMs_(m[1], m[2], m[3], endMin),
    durationMin: endMin - startMin,
    expiresMs: e ? epochMs_(e[1], e[2], e[3], minutesOfDay_(e[4], e[5], e[6])) : null,
    unconfirmed: /尚未確認/.test(s)
  };
}

function parseCancel_(s, b) {
  var t = CANCEL_TIME_RE_.exec(b);
  if (!t) return unknown_('取消信裡找不到課程日期與時間');

  var student = '';
  var fromSubject = /您的學生\s*(.+?)\s*取消了/.exec(s);
  if (fromSubject) {
    student = fromSubject[1].trim();
  } else {
    var fromBody = /([^,，🌟]+?)\s*取消了與您在/.exec(b);
    if (fromBody) student = fromBody[1].trim();
  }
  if (!student) return unknown_('取消信裡找不到學生名');

  var r = /取消原因\s*[:：]\s*(.*?)(?:\s*注意\s*[:：]|$)/.exec(b);
  return {
    type: 'cancel',
    student: student,
    startMs: epochMs_(t[1], t[2], t[3], minutesOfDay_(t[4], t[5], t[6])),
    reason: r ? r[1].trim() : ''
  };
}
