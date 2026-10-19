/**
 * Sheets.gs — 試算表的讀寫。試算表就是這個系統的資料庫。
 * 欄位照未來資料庫的結構設計，之後搬到 Postgres 時可以一一對應。
 */

var SHEET_BOOKINGS = '預約';
var SHEET_STUDENTS = '學生';
var SHEET_LOG = '信件紀錄';

var BOOKING_HEADERS = [
  '編號', '來源', '學生', '平台顯示名稱', '開始', '實際結束', '佔用結束', '課長(分鐘)',
  '狀態', 'Zoom連結', '行事曆事件編號', '信件編號', '請求過期時間', '提醒已寄',
  '取消原因', '備註', '建立時間'
];
var STUDENT_HEADERS = ['姓名', '平台顯示名稱', 'Email', '預約代碼', '備註'];
var LOG_HEADERS = ['信件編號', '信件時間', '標題', '類型', '處理結果'];
var DATETIME_FORMAT = 'yyyy/MM/dd HH:mm';

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet_(name, headers) {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** 建立三個分頁、狀態下拉選單與日期格式；重複執行不會破壞資料。 */
function initSheets_() {
  var sh = getSheet_(SHEET_BOOKINGS, BOOKING_HEADERS);
  getSheet_(SHEET_STUDENTS, STUDENT_HEADERS);
  getSheet_(SHEET_LOG, LOG_HEADERS);

  var statuses = Object.keys(STATUS).map(function (k) { return STATUS[k]; });
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(statuses, true).setAllowInvalid(false).build();
  var statusCol = BOOKING_HEADERS.indexOf('狀態') + 1;
  sh.getRange(2, statusCol, sh.getMaxRows() - 1, 1).setDataValidation(rule);

  ['開始', '實際結束', '佔用結束', '請求過期時間', '建立時間'].forEach(function (h) {
    var c = BOOKING_HEADERS.indexOf(h) + 1;
    sh.getRange(2, c, sh.getMaxRows() - 1, 1).setNumberFormat(DATETIME_FORMAT);
  });
  var remindCol = BOOKING_HEADERS.indexOf('提醒已寄') + 1;
  sh.getRange(2, remindCol, sh.getMaxRows() - 1, 1).insertCheckboxes();
}

function toMs_(v) {
  return v instanceof Date ? v.getTime() : null;
}

/** 讀出所有預約。每筆是以欄位名稱為鍵的物件，另外附上 rowIndex 與 startMs 等毫秒欄位。 */
function readBookings_() {
  var sh = getSheet_(SHEET_BOOKINGS, BOOKING_HEADERS);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, BOOKING_HEADERS.length).getValues();
  return values.map(function (r, i) {
    var o = { rowIndex: i + 2 };
    BOOKING_HEADERS.forEach(function (h, c) { o[h] = r[c]; });
    o.student = o['學生'];
    o.platformName = o['平台顯示名稱'];
    o.source = o['來源'];
    o.status = o['狀態'];
    o.startMs = toMs_(o['開始']);
    o.endMs = toMs_(o['實際結束']);
    o.occEndMs = toMs_(o['佔用結束']);
    o.expiresMs = toMs_(o['請求過期時間']);
    return o;
  });
}

/** 新增一筆預約，回傳它的列號。 */
function appendBooking_(fields) {
  var sh = getSheet_(SHEET_BOOKINGS, BOOKING_HEADERS);
  var row = BOOKING_HEADERS.map(function (h) { return fields[h] === undefined ? '' : fields[h]; });
  sh.appendRow(row);
  return sh.getLastRow();
}

/** 更新某一列的部分欄位。 */
function updateBooking_(rowIndex, fields) {
  var sh = getSheet_(SHEET_BOOKINGS, BOOKING_HEADERS);
  Object.keys(fields).forEach(function (h) {
    var c = BOOKING_HEADERS.indexOf(h);
    if (c >= 0) sh.getRange(rowIndex, c + 1).setValue(fields[h]);
  });
}

function newBookingId_() {
  return 'B-' + Utilities.getUuid().slice(0, 8);
}

/** 用平台顯示名稱在「學生」分頁找對應的人；找不到回傳 null。 */
function lookupStudent_(platformName) {
  var sh = getSheet_(SHEET_STUDENTS, STUDENT_HEADERS);
  var last = sh.getLastRow();
  if (last < 2) return null;
  var values = sh.getRange(2, 1, last - 1, STUDENT_HEADERS.length).getValues();
  for (var i = 0; i < values.length; i++) {
    if (nameKey_(values[i][1]) === nameKey_(platformName)) {
      return { '姓名': values[i][0], '平台顯示名稱': values[i][1], 'Email': values[i][2] };
    }
  }
  return null;
}

function loadProcessedIds_() {
  var sh = getSheet_(SHEET_LOG, LOG_HEADERS);
  var last = sh.getLastRow();
  var ids = {};
  if (last < 2) return ids;
  sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r) { ids[r[0]] = true; });
  return ids;
}

function appendLog_(messageId, messageDate, subject, type, result) {
  getSheet_(SHEET_LOG, LOG_HEADERS).appendRow([messageId, messageDate, subject, type, result]);
}

function formatMs_(ms) {
  return Utilities.formatDate(new Date(ms), TZ, DATETIME_FORMAT);
}
