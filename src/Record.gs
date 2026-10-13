/** 每位學生各有一份「課程記錄表」（分頁：上課記錄／買課紀錄／基本資訊）。這裡讀剩餘堂數、把預約寫進下一堂。 */

const RECORD_TABS_ = { lessons: ['上課記錄', '上課紀錄'], buys: ['買課紀錄', '買課記錄'], info: ['基本資訊'] };

// ---- 純函式（可在 Node 測試）----

/**
 * @param buyRows    買課紀錄的資料列 [匯款日期, 課程類型, 金額, 已收到]
 * @param lessonRows 上課記錄的資料列 [第幾堂, 上課日期, ...]
 * 已購＝「已收到」有標記的列，課程類型裡「N堂」的 N 相加（課程類型寫「50分」或「25分」即為該課長的課程包）；已上＝第幾堂≥1 且上課日期有填的列數
 */
function summarizeLessons_(buyRows, lessonRows) {
  let bought = 0, used = 0;
  const lens = {};
  buyRows.forEach(function (r) {
    if (!String(r[3] || '').trim()) return;
    const type = String(r[1] || '');
    const m = type.match(/(\d+)\s*堂/);
    if (!m) return;
    bought += Number(m[1]);
    const l = type.match(/(25|50)\s*分/);
    lens[l ? l[1] : '?'] = true;
  });
  lessonRows.forEach(function (r) { if (Number(r[0]) >= 1 && String(r[1] || '').trim()) used++; });
  // 課程類型寫了「25分」或「50分」，且所有已購課程包課長一致時，才限定課長；否則 len 為 null（兩種都能約）
  const keys = Object.keys(lens);
  const len = keys.length === 1 && keys[0] !== '?' ? Number(keys[0]) : null;
  return { bought: bought, used: used, left: bought - used, len: len, leftMinutes: len ? (bought - used) * len : null };
}

/** 下一個要填的列：第幾堂≥1 且上課日期還空白的第一列；沒有回傳 -1 */
function nextLessonIndex_(lessonRows) {
  for (let i = 0; i < lessonRows.length; i++) {
    if (Number(lessonRows[i][0]) >= 1 && !String(lessonRows[i][1] || '').trim()) return i;
  }
  return -1;
}

/** 'yyyy-MM-dd HH:mm' + 分鐘 → '2026/09/29 20:30-21:30'（記錄表既有的格式） */
function recordDateText_(startStr, minutes) {
  const end = addMinutesStr_(startStr, minutes);
  return startStr.slice(0, 10).replace(/-/g, '/') + ' ' + startStr.slice(11) + '-' + end.slice(11);
}

/**
 * 取消時要清掉哪一列：會議連結相同，或「上課日期」文字完全等於我們當初寫入的格式。
 * rows 為每列的 [上課日期, 會議連結]；找不到回傳 -1（不會碰手寫的其他列）
 */
function findRecordRowToClear_(rows, dateText, joinUrl) {
  for (let i = 0; i < rows.length; i++) {
    if (joinUrl && String(rows[i][1] || '').indexOf(joinUrl) >= 0) return i;
  }
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim() === dateText) return i;
  }
  return -1;
}

// ---- Google 試算表存取 ----

function openRecord_(url) {
  if (!url) return null;
  return /^https?:/.test(url) ? SpreadsheetApp.openByUrl(url) : SpreadsheetApp.openById(url);
}
function tabOf_(ss, names) {
  for (let i = 0; i < names.length; i++) { const t = ss.getSheetByName(names[i]); if (t) return t; }
  return null;
}
function displayRows_(sh) {
  const last = sh ? sh.getLastRow() : 0;
  return last < 2 ? [] : sh.getRange(2, 1, last - 1, sh.getLastColumn()).getDisplayValues();
}

/** 剩餘堂數；打不開或格式不符回傳 null（不影響預約頁其他功能） */
function readLessonSummary_(recordUrl) {
  try {
    const ss = openRecord_(recordUrl); if (!ss) return null;
    return summarizeLessons_(displayRows_(tabOf_(ss, RECORD_TABS_.buys)), displayRows_(tabOf_(ss, RECORD_TABS_.lessons)));
  } catch (e) { return null; }
}

function readRecordEmail_(recordUrl) {
  try {
    const t = tabOf_(openRecord_(recordUrl), RECORD_TABS_.info);
    const v = t ? t.getRange(2, 1).getDisplayValue() : '';
    return /\S+@\S+/.test(v) ? v.trim() : '';
  } catch (e) { return ''; }
}

/**
 * 把預約寫進下一堂（上課日期＋會議連結）。已經有同一個連結就不重寫。
 * @return {string} 結果說明（寫入第幾堂／原因）
 */
function writeBookingToRecord_(recordUrl, startStr, minutes, joinUrl) {
  const ss = openRecord_(recordUrl);
  const sh = tabOf_(ss, RECORD_TABS_.lessons);
  if (!sh) throw new Error('記錄表找不到「上課記錄」分頁');
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const colDate = head.indexOf('上課日期') + 1, colLink = head.indexOf('會議連結') + 1;
  if (!colDate || !colLink) throw new Error('記錄表缺少「上課日期」或「會議連結」欄');
  const rows = displayRows_(sh);
  if (joinUrl && rows.some(function (r) { return String(r[colLink - 1]).indexOf(joinUrl) >= 0; })) return '記錄表已有這個連結';
  const i = nextLessonIndex_(rows.map(function (r) { return [r[0], r[colDate - 1]]; }));
  if (i < 0) return '課程包已用完，沒有空白的堂數可以填';
  const row = i + 2;
  sh.getRange(row, colDate).setValue(recordDateText_(startStr, minutes));
  if (joinUrl) sh.getRange(row, colLink).setValue(joinUrl);
  return '已寫入第 ' + rows[i][0] + ' 堂';
}

/**
 * 取消／拒絕時：把當初寫進記錄表的那一堂清空（只清「上課日期」與「會議連結」兩格），剩餘堂數會自動加回來。
 * @return {string} 結果說明
 */
function clearBookingFromRecord_(recordUrl, startStr, minutes, joinUrl) {
  const ss = openRecord_(recordUrl);
  const sh = tabOf_(ss, RECORD_TABS_.lessons);
  if (!sh) throw new Error('記錄表找不到「上課記錄」分頁');
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const colDate = head.indexOf('上課日期') + 1, colLink = head.indexOf('會議連結') + 1;
  if (!colDate || !colLink) throw new Error('記錄表缺少「上課日期」或「會議連結」欄');
  const rows = displayRows_(sh);
  const i = findRecordRowToClear_(rows.map(function (r) { return [r[colDate - 1], r[colLink - 1]]; }), recordDateText_(startStr, minutes), joinUrl);
  if (i < 0) return '記錄表找不到這一堂，未清除';
  sh.getRange(i + 2, colDate).clearContent();
  sh.getRange(i + 2, colLink).clearContent();
  return '已從記錄表清除第 ' + rows[i][0] + ' 堂';
}
