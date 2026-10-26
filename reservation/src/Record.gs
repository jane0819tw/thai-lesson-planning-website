/** 每位學生各有一份「課程記錄表」（分頁：上課記錄／買課紀錄／基本資訊）。這裡讀剩餘堂數、把預約寫進下一堂。 */

const RECORD_TABS_ = { lessons: ['上課記錄', '上課紀錄'], buys: ['買課紀錄', '買課記錄'], info: ['基本資訊'] };

// ---- 純函式（可在 Node 測試）----

/**
 * @param buyRows    買課紀錄的資料列 [匯款日期, 課程類型, 金額, 已收到]
 * @param lessonRows 上課記錄的資料列 [第幾堂, 上課日期, ...]
 * @param nowStr     現在（台北時間 'yyyy-MM-dd HH:mm'）；沒給就把所有已填日期的列都當成已上
 * @param headerText 上課記錄 A1 儲存格文字，例如「10堂課程包/25分鐘」（買課紀錄沒寫分鐘時，用來判斷課長）
 * 已購＝「已收到」有標記的列，課程類型裡「N堂」的 N 相加（課程類型寫「50分」或「25分」即為該課長的課程包）。
 * 已上＝第幾堂≥1、上課日期已填，而且課已經結束；日期時間還沒到的算「已預約」(booked)，不算已上。
 * 剩餘＝已購 − 已上（已預約的還沒上，所以仍在剩餘裡）。
 */
function summarizeLessons_(buyRows, lessonRows, nowStr, headerText) {
  let bought = 0, used = 0, booked = 0;
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
  lessonRows.forEach(function (r) {
    if (!(Number(r[0]) >= 1) || !String(r[1] || '').trim()) return;
    const t = nowStr ? parseRecordRange_(r[1]) : null;
    if (t && t.end > nowStr) booked++; else used++;
  });
  // 課程類型寫了「25分」或「50分」，且所有已購課程包課長一致時，才限定課長；
  // 買課紀錄完全沒寫分鐘時，改看上課記錄 A1（例如「10堂課程包/25分鐘」）；都沒有就不限制（兩種都能約）
  const keys = Object.keys(lens);
  let len = keys.length === 1 && keys[0] !== '?' ? Number(keys[0]) : null;
  if (!len && keys.every(function (k) { return k === '?'; })) {
    const h = String(headerText || '').match(/(25|50)\s*分/);
    if (h) len = Number(h[1]);
  }
  return { bought: bought, used: used, booked: booked, left: bought - used, len: len, leftMinutes: len ? (bought - used) * len : null };
}

/**
 * 解析記錄表的「上課日期」文字，例如「2026/08/08 9:30-10:00」。
 * 沒有時間只有日期時 dateOnly 為 true（start 00:00、end 23:59）；解析不出日期回傳 null。
 */
function parseRecordRange_(text) {
  const m = String(text || '').match(/(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?:\s*[-–~～]\s*(\d{1,2}):(\d{2}))?)?/);
  if (!m) return null;
  const d = m[1] + '-' + pad2_(+m[2]) + '-' + pad2_(+m[3]);
  if (m[4] === undefined) return { start: d + ' 00:00', end: d + ' 23:59', dateOnly: true };
  const start = d + ' ' + pad2_(+m[4]) + ':' + m[5];
  let end = m[6] === undefined ? start : d + ' ' + pad2_(+m[6]) + ':' + m[7];
  if (end < start) end = d + ' 23:59';
  return { start: start, end: end, dateOnly: false };
}

/**
 * 最新一堂「已經上完」的課的內容，給學生頁顯示在下一堂課的教室區塊。
 * rows 為 [{when:'上課日期文字', progress:'上課進度', next:'下次上課'}]；上課進度、下次上課都空白的列不算。
 * @return {{date:string, progress:string, next:string}|null}
 */
function pickLatestLesson_(rows, nowStr) {
  let best = null, bestEnd = '';
  rows.forEach(function (r) {
    const t = parseRecordRange_(r.when);
    if (!t || t.end > nowStr) return;
    if (!String(r.progress || '').trim() && !String(r.next || '').trim()) return;
    if (t.end > bestEnd) { bestEnd = t.end; best = { date: t.start.slice(0, 10), progress: String(r.progress || '').trim(), next: String(r.next || '').trim() }; }
  });
  return best;
}

/**
 * 已經上完的課與課後錄影連結（新→舊），給學生頁「課後錄影」與老師頁「待補錄影」用。
 * rows 為 [{no:'第幾堂', when:'上課日期文字', progress:'上課進度', video:'影片連結'}]。
 * 連續的課（相隔≤5分、同一個 Zoom 錄成一支影片）合併成一筆：no 寫成「5–6」，影片取第一個有填的。
 * @return [{no, start, end, dateOnly, progress, video}]
 */
function buildVideoList_(rows, nowStr) {
  const list = [];
  rows.forEach(function (r) {
    const t = parseRecordRange_(r.when);
    if (!t || t.end > nowStr) return;
    list.push({ no: String(r.no), first: String(r.no), start: t.start, end: t.end, dateOnly: t.dateOnly,
      progress: String(r.progress || '').trim(), video: String(r.video || '').trim() });
  });
  list.sort(function (a, b) { return strToMin_(a.start) - strToMin_(b.start); });
  const out = [];
  list.forEach(function (x) {
    const last = out[out.length - 1];
    if (last && !last.dateOnly && !x.dateOnly && strToMin_(x.start) - strToMin_(last.end) <= 5 && strToMin_(x.start) >= strToMin_(last.end) - 1 &&
        (!last.video || !x.video || last.video === x.video)) {
      if (x.end > last.end) last.end = x.end;
      last.no = last.first + '–' + x.no;
      if (x.progress) last.progress = x.progress;
      if (!last.video) last.video = x.video;
    } else out.push(x);
  });
  return out.reverse().map(function (x) { return { no: x.no, start: x.start, end: x.end, dateOnly: x.dateOnly, progress: x.progress, video: x.video }; });
}

function strToMin_(s) {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000 : NaN;
}

/**
 * 學生頁的「我的預約」：把記錄表裡還沒上完的課與預約表的待確認／已確認合併成一份清單。
 * @param recRows  記錄表列 [{start,end,link}]（已解析、非 dateOnly）
 * @param bookings 預約表 [{start,end,zoom,status,length}]
 * 規則：同一開始時間以記錄表為準（連結空白就用預約表的）；前後相連（相隔≤5分）、狀態相同、
 * 連結相同或有一邊空白的課，合併成一筆（count＝堂數），共用同一個 Zoom 連結。
 * 結束後 15 分鐘內仍保留（讓上課中的人還能進教室）。
 */
function buildSessions_(recRows, bookings, nowStr) {
  const nowMin = strToMin_(nowStr), GRACE = 15;
  const list = [];
  recRows.forEach(function (r) {
    if (strToMin_(r.end) + GRACE < nowMin) return;
    list.push({ start: r.start, end: r.end, zoom: r.link || '', status: '已確認', length: strToMin_(r.end) - strToMin_(r.start) });
  });
  bookings.forEach(function (b) {
    if (strToMin_(b.end) + GRACE < nowMin) return;
    const hit = list.filter(function (x) { return x.start === b.start; })[0];
    if (hit) { if (!hit.zoom && b.status === '已確認') hit.zoom = b.zoom || ''; hit.length = b.length || hit.length; return; }
    list.push({ start: b.start, end: b.end, zoom: b.status === '已確認' ? (b.zoom || '') : '', status: b.status, length: b.length });
  });
  list.sort(function (a, b) { return strToMin_(a.start) - strToMin_(b.start); });
  const out = [];
  list.forEach(function (x) {
    const last = out[out.length - 1];
    if (last && last.status === x.status && strToMin_(x.start) - strToMin_(last.end) <= 5 && strToMin_(x.start) >= strToMin_(last.end) - 1 &&
        (!last.zoom || !x.zoom || last.zoom === x.zoom)) {
      if (x.end > last.end) last.end = x.end;
      last.count++;
      if (!last.zoom) last.zoom = x.zoom;
    } else out.push({ start: x.start, end: x.end, zoom: x.zoom, status: x.status, length: x.length, count: 1 });
  });
  return out;
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
 * 取消時要清掉哪一列：開始時間相同 → 日期文字完全相同 → 會議連結相同（依序，後面的只在前面找不到時才用）。
 * rows 為每列的 [上課日期, 會議連結]；找不到回傳 -1（不會碰手寫的其他列）
 */
function findRecordRowToClear_(rows, startStr, dateText, joinUrl) {
  for (let i = 0; i < rows.length; i++) {
    const t = parseRecordRange_(rows[i][0]);
    if (t && !t.dateOnly && t.start === startStr) return i;
  }
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim() === dateText) return i;
  }
  for (let i = 0; i < rows.length; i++) {
    if (joinUrl && String(rows[i][1] || '').indexOf(joinUrl) >= 0) return i;
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

/**
 * 一次打開記錄表，同時算出課程包摘要與「還沒上完的課」清單（開一次檔比較快）。
 * @return {{summary:Object, sessions:Array}|null} 打不開或格式不符回傳 null（不影響預約頁其他功能）
 */
function readRecordBundle_(recordUrl) {
  try {
    const ss = openRecord_(recordUrl); if (!ss) return null;
    const nowStr = toLocalStr_(new Date());
    const lsh = tabOf_(ss, RECORD_TABS_.lessons);
    const lrows = displayRows_(lsh);
    const head = lsh ? lsh.getRange(1, 1, 1, lsh.getLastColumn()).getDisplayValues()[0] : [];
    const cDate = head.indexOf('上課日期') >= 0 ? head.indexOf('上課日期') : 1;
    const cLink = head.indexOf('會議連結');
    const summary = summarizeLessons_(displayRows_(tabOf_(ss, RECORD_TABS_.buys)), lrows.map(function (r) { return [r[0], r[cDate]]; }), nowStr, head[0]);
    const sessions = [];
    lrows.forEach(function (r) {
      if (!(Number(r[0]) >= 1)) return;
      const t = parseRecordRange_(r[cDate]);
      if (!t || t.dateOnly) return;
      sessions.push({ start: t.start, end: t.end, link: cLink >= 0 ? String(r[cLink] || '').trim() : '' });
    });
    const cProg = head.indexOf('上課進度'), cNext = head.indexOf('下次上課'), cVideo = head.indexOf('影片連結');
    const done = lrows.filter(function (r) { return Number(r[0]) >= 1; });
    const last = pickLatestLesson_(done.map(function (r) {
      return { when: r[cDate], progress: cProg >= 0 ? r[cProg] : '', next: cNext >= 0 ? r[cNext] : '' };
    }), nowStr);
    const videos = buildVideoList_(done.map(function (r) {
      return { no: r[0], when: r[cDate], progress: cProg >= 0 ? r[cProg] : '', video: cVideo >= 0 ? r[cVideo] : '' };
    }), nowStr);
    return { summary: summary, sessions: sessions, last: last, videos: videos, hasVideoCol: cVideo >= 0 };
  } catch (e) { return null; }
}

/** 剩餘堂數摘要；打不開或格式不符回傳 null */
function readLessonSummary_(recordUrl) {
  const b = readRecordBundle_(recordUrl);
  return b ? b.summary : null;
}

function readRecordEmail_(recordUrl) {
  try {
    const t = tabOf_(openRecord_(recordUrl), RECORD_TABS_.info);
    const v = t ? t.getRange(2, 1).getDisplayValue() : '';
    return /\S+@\S+/.test(v) ? v.trim() : '';
  } catch (e) { return ''; }
}

/**
 * 把預約寫進下一堂（上課日期＋會議連結）。重複執行不會重複寫：
 * 記錄表已經有同一個開始時間的列（包含老師手寫的）就不再新增，只在連結空白時補上連結。
 * 連續的 25 分鐘課共用同一個 Zoom：連結已經出現在別列時，這一列只填日期、不重複填連結（和老師手寫的習慣一致）。
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
  const hasLink = !!joinUrl && rows.some(function (r) { return String(r[colLink - 1]).indexOf(joinUrl) >= 0; });
  const same = rows.map(function (r) { const t = parseRecordRange_(r[colDate - 1]); return t && !t.dateOnly ? t.start : ''; }).indexOf(startStr);
  if (same >= 0) {
    if (joinUrl && !hasLink && !String(rows[same][colLink - 1]).trim()) sh.getRange(same + 2, colLink).setValue(joinUrl);
    return '記錄表已有這一堂（第 ' + rows[same][0] + ' 堂）';
  }
  const i = nextLessonIndex_(rows.map(function (r) { return [r[0], r[colDate - 1]]; }));
  if (i < 0) return '課程包已用完，沒有空白的堂數可以填';
  const row = i + 2;
  sh.getRange(row, colDate).setValue(recordDateText_(startStr, minutes));
  if (joinUrl && !hasLink) sh.getRange(row, colLink).setValue(joinUrl);
  return '已寫入第 ' + rows[i][0] + ' 堂' + (hasLink ? '（與前後的課共用同一個 Zoom 連結）' : '');
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
  const i = findRecordRowToClear_(rows.map(function (r) { return [r[colDate - 1], r[colLink - 1]]; }), startStr, recordDateText_(startStr, minutes), joinUrl);
  if (i < 0) return '記錄表找不到這一堂，未清除';
  sh.getRange(i + 2, colDate).clearContent();
  sh.getRange(i + 2, colLink).clearContent();
  return '已從記錄表清除第 ' + rows[i][0] + ' 堂';
}

/**
 * 把課後錄影連結填進「影片連結」欄：找開始時間相同的那一堂（連續的課只填第一堂，和會議連結的習慣一致）。
 * url 空白＝清除。@return {string} 結果說明
 */
function writeVideoToRecord_(recordUrl, startStr, url) {
  const ss = openRecord_(recordUrl);
  const sh = tabOf_(ss, RECORD_TABS_.lessons);
  if (!sh) throw new Error('記錄表找不到「上課記錄」分頁');
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const colDate = head.indexOf('上課日期') + 1, colVideo = head.indexOf('影片連結') + 1;
  if (!colDate || !colVideo) throw new Error('記錄表「上課記錄」分頁缺少「上課日期」或「影片連結」欄');
  const rows = displayRows_(sh);
  for (let i = 0; i < rows.length; i++) {
    const t = parseRecordRange_(rows[i][colDate - 1]);
    if (!t || t.start !== startStr) continue;
    sh.getRange(i + 2, colVideo).setValue(url);
    return (url ? '已填入' : '已清除') + '第 ' + rows[i][0] + ' 堂的影片連結';
  }
  throw new Error('記錄表找不到 ' + startStr + ' 這一堂');
}
