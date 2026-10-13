/** 試算表存取層。欄位照 BOOKING_HEADERS，用欄名取值，不寫死欄號。 */

function getSs_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function getSheet_(name, headers) {
  const ss = getSs_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** 建立分頁、狀態下拉選單。可重複執行。 */
function setupSheets_() {
  const b = getSheet_(CONFIG.SHEETS.BOOKINGS, BOOKING_HEADERS);
  b.getRange(1, 1, 1, BOOKING_HEADERS.length).setValues([BOOKING_HEADERS]).setFontWeight('bold');
  const st = getSheet_(CONFIG.SHEETS.STUDENTS, STUDENT_HEADERS);
  st.getRange(1, 1, 1, STUDENT_HEADERS.length).setValues([STUDENT_HEADERS]).setFontWeight('bold');
  const rl = getSheet_(CONFIG.SHEETS.RULES, RULE_HEADERS);
  rl.getRange(1, 1, 1, RULE_HEADERS.length).setValues([RULE_HEADERS]).setFontWeight('bold');
  rl.getRange(2, 1, rl.getMaxRows() - 1, RULE_HEADERS.length).setNumberFormat('@');
  if (!readRules_().length) seedDefaultRules_();
  getSheet_(CONFIG.SHEETS.LOG, LOG_HEADERS);
  const col = BOOKING_HEADERS.indexOf('狀態') + 1;
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.keys(STATUS).map(function (k) { return STATUS[k]; }), true).build();
  b.getRange(2, col, b.getMaxRows() - 1, 1).setDataValidation(rule);
  b.getRange(2, BOOKING_HEADERS.indexOf('開始') + 1, b.getMaxRows() - 1, 3)
    .setNumberFormat('yyyy/MM/dd HH:mm');
}

function readBookings_() {
  const sh = getSheet_(CONFIG.SHEETS.BOOKINGS, BOOKING_HEADERS);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, BOOKING_HEADERS.length).getValues();
  return values.map(function (v, i) { return rowToObj_(v, i + 2); });
}

function rowToObj_(values, rowNum) {
  const o = { _row: rowNum };
  BOOKING_HEADERS.forEach(function (h, i) { o[h] = values[i]; });
  return o;
}

function writeBooking_(o) {
  const sh = getSheet_(CONFIG.SHEETS.BOOKINGS, BOOKING_HEADERS);
  const arr = BOOKING_HEADERS.map(function (h) { return o[h] === undefined ? '' : o[h]; });
  if (o._row) sh.getRange(o._row, 1, 1, arr.length).setValues([arr]);
  else { sh.appendRow(arr); o._row = sh.getLastRow(); }
  return o;
}

function nextBookingId_() {
  const rows = readBookings_();
  return 'B' + Utilities.formatString('%04d', rows.length + 1);
}

function parseLocal_(str) { return Utilities.parseDate(str, CONFIG.TZ, 'yyyy-MM-dd HH:mm'); }
function toLocalStr_(date) { return Utilities.formatDate(new Date(date), CONFIG.TZ, 'yyyy-MM-dd HH:mm'); }

function processedIds_() {
  const sh = getSheet_(CONFIG.SHEETS.LOG, LOG_HEADERS);
  const last = sh.getLastRow();
  const set = {};
  if (last < 2) return set;
  sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r) { set[r[0]] = true; });
  return set;
}

function logMail_(id, type, result, subject) {
  getSheet_(CONFIG.SHEETS.LOG, LOG_HEADERS).appendRow([id, new Date(), type, result, subject]);
}

/** 平台顯示名稱 → 學生姓名；查不到就用平台名稱本身 */
function resolveStudent_(displayName) {
  const sh = getSheet_(CONFIG.SHEETS.STUDENTS, STUDENT_HEADERS);
  const last = sh.getLastRow();
  if (last >= 2) {
    const rows = sh.getRange(2, 1, last - 1, 2).getValues();
    for (let i = 0; i < rows.length; i++) if (rows[i][1] === displayName) return rows[i][0];
  }
  return displayName;
}

/** 空的時候才寫入預設固定時間；已有任何規則（包含老師調整過的）一律不動 */
function seedDefaultRules_() {
  const rules = [];
  DEFAULT_WEEKLY.forEach(function (g) {
    g.days.forEach(function (d) { rules.push({ type: '每週', weekday: d, date: '', start: g.start, end: g.end, label: '' }); });
  });
  writeRules_(rules);
}
