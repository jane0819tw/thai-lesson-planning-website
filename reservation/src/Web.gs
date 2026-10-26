/**
 * 預約系統的資料 API（給靜態網站用，做法同 thaiskr-custom）。
 * 前端用 fetch POST（Content-Type: text/plain）送 {fn, args, key}，回傳 {ok, data|error}。
 * 學生用的函式公開；admin 開頭的函式需要管理密鑰（指令碼屬性 ADMIN_KEY）。
 */

const PUBLIC_API_ = { getStudentView: getStudentView, getStudentInfo: getStudentInfo, getOpenDays: getOpenDays, submitBooking: submitBooking, getHomeworkInfo: getHomeworkInfo, submitHomework: submitHomework };
const ADMIN_API_ = {
  adminGetState: adminGetState, adminGetWeek: adminGetWeek, adminGetMonth: adminGetMonth, adminSaveRules: adminSaveRules,
  adminSetStatus: adminSetStatus, adminCreateStudent: adminCreateStudent, adminRenewLink: adminRenewLink, adminSetRecord: adminSetRecord, adminSetDisplay: adminSetDisplay, adminImportPlatformStudents: adminImportPlatformStudents, adminDeleteStudent: adminDeleteStudent, adminSetCourses: adminSetCourses,
  adminGetRecordSessions: adminGetRecordSessions, adminCancelRecordLesson: adminCancelRecordLesson, adminGetHomework: adminGetHomework,
  adminSetRecording: adminSetRecording, adminGetPendingVideos: adminGetPendingVideos, adminSetVideoLink: adminSetVideoLink,
  adminDismissNote: adminDismissNote,
};

function doGet() { return json_({ ok: true, service: 'thaiskr-reservation' }); }

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    let fn = PUBLIC_API_[req.fn];
    if (!fn) {
      fn = ADMIN_API_[req.fn];
      if (!fn) throw new Error('未知的操作');
      checkAdminKey_(req.key);
    }
    return json_({ ok: true, data: fn.apply(null, req.args || []) });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** 只需執行一次：產生管理密鑰，到「執行記錄」複製起來，貼到老師頁。重跑會換新密鑰（舊的立刻失效）。 */
function createAdminKey() {
  const key = newToken_();
  PropertiesService.getScriptProperties().setProperty('ADMIN_KEY', key);
  Logger.log('管理密鑰（請複製，不要分享）：' + key);
}

function checkAdminKey_(key) {
  const real = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!real) throw new Error('尚未設定管理密鑰，請在 Apps Script 執行 createAdminKey');
  if (!key || key !== real) { Utilities.sleep(1000); throw new Error('管理密鑰不正確'); }
}

// ---------- 規則與學生 ----------

function readRules_() {
  const sh = getSheet_(CONFIG.SHEETS.RULES, RULE_HEADERS);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, RULE_HEADERS.length).getDisplayValues()
    .filter(function (r) { return r[0] === '休假' || r[0] === '備註' ? r[2] : (r[0] && r[3] && r[4]); })
    .map(function (r) { return { type: r[0], weekday: r[1] ? Number(r[1]) : '', date: r[2], start: r[3], end: r[4], label: r[5] }; });
}

function writeRules_(rules) {
  const sh = getSheet_(CONFIG.SHEETS.RULES, RULE_HEADERS);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, RULE_HEADERS.length).clearContent();
  if (!rules.length) return;
  const rows = rules.map(function (r) {
    const dayOnly = r.type === '休假' || r.type === '備註'; // 只有日期與說明，沒有時間
    return [r.type, r.type === '每週' ? String(r.weekday) : '', r.type === '每週' ? '' : r.date,
      dayOnly ? '' : r.start, dayOnly ? '' : r.end, dayOnly ? (r.label || '') : ''];
  });
  sh.getRange(2, 1, rows.length, RULE_HEADERS.length).setNumberFormat('@').setValues(rows);
}

function readStudents_() {
  const sh = getSheet_(CONFIG.SHEETS.STUDENTS, STUDENT_HEADERS);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, STUDENT_HEADERS.length).getValues()
    .map(function (r, i) { return { row: i + 2, name: r[0], display: r[1], email: r[2], note: r[3], token: r[4], '課程記錄表': r[5], courses: parseCourses_(r[6]), recording: recordingSince_(r[7]) }; });
}

/** 「課後錄影」欄 → 開始日期 'yyyy-MM-dd'；空白＝不需要錄影。手動打「是」或日期格式不對時，當成從很久以前就開始（全部的課都算） */
function recordingSince_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.TZ, 'yyyy-MM-dd');
  const t = String(v || '').trim();
  if (!t) return '';
  const m = t.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  return m ? m[1] + '-' + pad2_(+m[2]) + '-' + pad2_(+m[3]) : '2000-01-01';
}

function newToken_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }

function studentByToken_(token) {
  if (!token) return null;
  const list = readStudents_();
  for (let i = 0; i < list.length; i++) if (list[i].token && list[i].token === token) return list[i];
  return null;
}

/** 確認私下預約時，若學生資料表沒有這個人就建檔並產生預約代碼 */
function ensureStudent_(name, email) {
  const exists = readStudents_().some(function (s) { return s.name === name; });
  if (exists) return;
  getSheet_(CONFIG.SHEETS.STUDENTS, STUDENT_HEADERS).appendRow([name, '', email || '', '', newToken_(), '']);
}

/**
 * AmazingTalker 預約裡出現的學生，學生表沒有就建檔（姓名＝預約裡的學生、平台顯示名稱＝平台上的名字、附預約代碼）；
 * 已有同名學生但平台名稱是空的就補上。回傳 { added: [...], linked: [...] }
 */
function ensurePlatformStudents_(pairs) {
  const sh = getSheet_(CONFIG.SHEETS.STUDENTS, STUDENT_HEADERS);
  const list = readStudents_();
  const out = { added: [], linked: [] };
  const seen = {};
  pairs.forEach(function (p) {
    const display = String(p.display || '').trim(), name = String(p.name || '').trim() || display;
    if (!display || seen[display]) return;
    seen[display] = true;
    if (list.some(function (s) { return String(s.display).trim() === display; })) return;
    const same = list.filter(function (s) { return s.name === name; })[0];
    if (same) {
      if (String(same.display).trim()) return; // 同名但已對應到別的平台名稱，不動
      sh.getRange(same.row, STUDENT_HEADERS.indexOf('平台顯示名稱') + 1).setValue(display);
      same.display = display;
      out.linked.push(name);
      return;
    }
    sh.appendRow([name, display, '', '', newToken_(), '', '']);
    list.push({ name: name, display: display });
    out.added.push(name);
  });
  if (out.added.length || out.linked.length) bustCaches_();
  return out;
}

/** 老師頁按鈕：把「預約」分頁裡所有 AmazingTalker 預約的學生列入學生表 */
function adminImportPlatformStudents() {
  return ensurePlatformStudents_(readBookings_().filter(function (b) { return b['來源'] === 'AmazingTalker'; })
    .map(function (b) { return { name: b['學生'], display: b['平台顯示名稱'] }; }));
}

function emailFromNote_(note) {
  const m = String(note || '').match(/Email[:：]\s*(\S+)/);
  return m ? m[1] : '';
}

// ---------- 可預約時段 ----------

function busyIntervals_(fromDate, toDate) {
  return getCal_().getEvents(fromDate, toDate).map(function (ev) {
    return { start: toLocalStr_(ev.getStartTime()), end: toLocalStr_(ev.getEndTime()), allDay: ev.isAllDayEvent() };
  });
}

function openDays_() {
  const now = new Date();
  const dates = [];
  for (let i = 0; i <= CONFIG.BOOKING_DAYS_AHEAD; i++) {
    dates.push(Utilities.formatDate(new Date(now.getTime() + i * 86400000), CONFIG.TZ, 'yyyy-MM-dd'));
  }
  const from = parseLocal_(dates[0] + ' 00:00');
  const to = new Date(parseLocal_(dates[dates.length - 1] + ' 00:00').getTime() + 2 * 86400000);
  const earliest = toLocalStr_(new Date(now.getTime() + CONFIG.MIN_NOTICE_HOURS * 3600000));
  // 休假說明只給老師看：學生端不帶說明文字
  return computeOpenSlots_(dates, readRules_(), busyIntervals_(from, to), earliest)
    .map(function (d) { d.label = ''; return d; });
}

// ---------- 快取（CacheService）----------
// 所有快取 key 都帶一個「世代號」；任何會改變資料的操作呼叫 bustCaches_()，換新世代號＝舊快取全部作廢。

function cacheGen_() {
  const c = CacheService.getScriptCache();
  let g = c.get('gen');
  if (!g) { g = String(Date.now()); c.put('gen', g, 21600); }
  return g;
}

function bustCaches_() {
  try { CacheService.getScriptCache().put('gen', String(Date.now()), 21600); } catch (e) { /* 快取壞了也不影響功能 */ }
}

/** 取快取（JSON＋gzip＋base64，單筆上限 100KB）；沒有或 force 時重算並寫回。compute 回傳 null 時不快取。 */
function cached_(key, ttlSec, force, compute) {
  const c = CacheService.getScriptCache();
  const k = cacheGen_() + ':' + key;
  if (!force) {
    try {
      const hit = c.get(k);
      if (hit) return JSON.parse(Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(hit), 'application/x-gzip')).getDataAsString());
    } catch (e) { /* 讀不到就重算 */ }
  }
  const v = compute();
  if (v != null) {
    try {
      const enc = Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(v))).getBytes());
      if (enc.length < 100000) c.put(k, enc, ttlSec);
    } catch (e) { /* 寫不進去就算了 */ }
  }
  return v;
}

// ---------- 學生 API ----------

/** 可預約時段（快取 2 分鐘；force＝學生按「重新整理時段」時略過快取） */
function getOpenDays(force) {
  return cached_('openDays', 120, !!force, function () {
    return { days: openDays_(), asOf: Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss') };
  });
}

/** 學生頁不含時段的部分（姓名、課程、堂數、我的預約）。記錄表摘要快取 5 分鐘，其餘是本試算表的分頁，很快。 */
function getStudentInfo(token) {
  const s = studentByToken_(token);
  if (token && !s) return { mode: 'invalid' };
  const v = { mode: s ? 'known' : 'generic', name: s ? s.name : '', lessons: null, upcoming: [] };
  if (s) {
    const rec = s['課程記錄表'] ? cached_('rec:' + s.token, 300, false, function () { return readRecordBundle_(s['課程記錄表']); }) : null;
    v.courses = s.courses;
    v.platform = String(s.display || '').trim() !== ''; // 學生表有填「平台顯示名稱」＝在 AmazingTalker 預約，學生頁只顯示課程與作業
    v.homework = homeworkOf_(s.name);
    v.lessons = rec ? rec.summary : null;
    v.lastLesson = rec ? rec.last : null;
    v.videos = rec && rec.videos ? rec.videos : [];
    v.recording = s.recording; // 有值＝這位學生需要課後錄影，從這天起還沒上傳的課顯示「影片整理中」
    const bks = readBookings_().filter(function (b) {
      return b['學生'] === s.name && (b['狀態'] === STATUS.PENDING || b['狀態'] === STATUS.CONFIRMED) && b['開始'];
    }).map(function (b) {
      return { start: toLocalStr_(b['開始']), end: toLocalStr_(b['實際結束']), zoom: b['Zoom連結'] || '', status: b['狀態'], length: b['課長'] };
    });
    // 記錄表（含老師手寫的未來課）與預約表合併；前後相連的課合成一筆、共用同一個 Zoom
    v.upcoming = buildSessions_(rec ? rec.sessions : [], bks, toLocalStr_(new Date()));
  }
  return v;
}

/** 舊的一次回傳全部（前端已改成分兩次呼叫，保留給舊版頁面） */
function getStudentView(token) {
  const v = getStudentInfo(token);
  if (v.mode === 'invalid') return v;
  const d = getOpenDays(false);
  v.days = d.days; v.asOf = d.asOf;
  return v;
}

// ---------- 作業 ----------

/** 「作業」分頁全部紀錄（舊→新）。分數欄是文字（例 8/9），讀 DisplayValues 才不會被當成日期。 */
function readHomework_() {
  const sh = getSheet_(CONFIG.SHEETS.HOMEWORK, HOMEWORK_HEADERS);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, HOMEWORK_HEADERS.length).getValues()
    .filter(function (r) { return r[0] && r[1]; })
    .map(function (r) { return { time: toLocalStr_(r[0]), name: String(r[1]), lesson: String(r[2]), listen: String(r[3]), typing: String(r[4]) }; });
}

/** 某位學生每一課「最近一次」的成績：{ '1': { time, listen, typing, count } } */
function homeworkOf_(name, rows) {
  const out = {};
  (rows || readHomework_()).forEach(function (r) {
    if (r.name !== name) return;
    const n = r.lesson.replace(/^L/, '');
    const prev = out[n];
    out[n] = { time: r.time, listen: r.listen, typing: r.typing, count: (prev ? prev.count : 0) + 1 };
  });
  return out;
}

/** 作業頁用：用預約代碼找出是哪位學生，以及這課上一次送出的成績（代碼無效時回傳空姓名） */
function getHomeworkInfo(token, lessonNumber) {
  const s = studentByToken_(token);
  if (!s) return { name: '', last: null };
  return { name: s.name, last: homeworkOf_(s.name)[homeworkKey_(lessonNumber)] || null };
}

/** 作業的課別代號：一般課是數字（3 → '3'）；作業複習是 'R<單位>'（R1 ＝ L1–L5）；延伸影片挑戰是 'V<課>'（V3 ＝ L3 影片挑戰，成績記在「聽寫」欄）。不合法回傳空字串 */
function homeworkKey_(lessonNumber) {
  const t = String(lessonNumber).trim();
  if (/^[RV][1-9]\d*$/i.test(t)) return t.toUpperCase();
  const n = Number(t);
  return n > 0 && n === Math.floor(n) ? String(n) : '';
}

/** 學生在作業頁按「送出作業」：寫進「作業」分頁一列（可重複送出，每次一列；學生頁顯示最近一次）。result = { listen: [對, 總], typing: [對, 總] }（沒做的欄位省略） */
function submitHomework(token, lessonNumber, result) {
  const s = studentByToken_(token);
  if (!s) throw new Error('作業連結已失效，請向老師索取新的連結');
  const key = homeworkKey_(lessonNumber);
  if (!key) throw new Error('課別不正確');
  const fmt = function (r) { return r && r.length === 2 ? Number(r[0]) + '/' + Number(r[1]) : '未做'; };
  result = result || {};
  const sh = getSheet_(CONFIG.SHEETS.HOMEWORK, HOMEWORK_HEADERS);
  const row = sh.getLastRow() + 1;
  sh.getRange(row, 3, 1, 3).setNumberFormat('@'); // 「8/9」要存成文字，不然會被轉成日期
  sh.getRange(row, 1, 1, HOMEWORK_HEADERS.length).setValues([[new Date(), s.name, (/^[RV]/.test(key) ? key : 'L' + key), fmt(result.listen), fmt(result.typing), '']]);
  return { ok: true, name: s.name };
}

/** 老師頁：最近 300 筆作業（新→舊） */
function adminGetHomework() {
  return readHomework_().reverse().slice(0, 300);
}

function submitBooking(token, name, email, startStr, length) {
  length = Number(length);
  if (CONFIG.ALLOWED_LENGTHS.indexOf(length) < 0) throw new Error('課長不正確');
  const s = studentByToken_(token);
  if (token && !s) throw new Error('預約連結已失效，請向老師索取新的連結');
  const studentName = s ? s.name : String(name || '').trim();
  const studentEmail = s ? s.email : String(email || '').trim();
  if (s && s['課程記錄表']) {
    const ls = readLessonSummary_(s['課程記錄表']);
    if (ls && ls.len && ls.len !== length) throw new Error('你的課程包是 ' + ls.len + ' 分鐘的課，請選 ' + ls.len + ' 分鐘');
  }
  if (!studentName) throw new Error('請填姓名');
  if (!s && !/^\S+@\S+\.\S+$/.test(studentEmail)) throw new Error('請填正確的 Email');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(startStr)) throw new Error('時間格式不正確');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('系統忙碌中，請稍後再試');
  try {
    // 送出時再檢查一次這一格是否仍空
    const date = startStr.slice(0, 10), time = startStr.slice(11);
    const day = openDays_().filter(function (d) { return d.date === date; })[0];
    const slot = day && day.slots.filter(function (x) { return x.time === time; })[0];
    if (!day || day.closed || !slot || !slot.can25 || (length === 50 && !slot.can50)) throw new Error('這個時段剛剛被預約了，請重新選擇');

    const b = {
      '編號': nextBookingId_(), '來源': '私下', '學生': studentName, '平台顯示名稱': '',
      '開始': parseLocal_(startStr), '實際結束': parseLocal_(addMinutesStr_(startStr, length)),
      '佔用結束': parseLocal_(addMinutesStr_(startStr, occupiedMinutes_(length, CONFIG.SLOT_MINUTES))),
      '課長': length, '狀態': STATUS.PENDING, '備註': s ? '' : 'Email: ' + studentEmail, '建立時間': new Date(),
    };
    syncCalendarEvent_(b);
    writeBooking_(b);
    bustCaches_();
    notify_('私下學生新預約：' + studentName,
      studentName + '　' + startStr + '（' + length + ' 分）\n\n請到管理頁或試算表確認／拒絕。\n私下預約成立後，記得到 AmazingTalker 手動關閉同一時段。');
    notifyTeacher_('📚 新預約：' + studentName + '\n' + startStr + '（' + length + ' 分）\n\n管理頁：' + CONFIG.ADMIN_URL +
      '\n管理密鑰：' + (PropertiesService.getScriptProperties().getProperty('ADMIN_KEY') || '（尚未建立，請執行 createAdminKey）'));
    return { ok: true, id: b['編號'] };
  } finally { lock.releaseLock(); }
}

// ---------- 老師 API ----------

function adminGetState() {
  const pending = readBookings_().filter(function (b) { return b['來源'] === '私下' && b['狀態'] === STATUS.PENDING; })
    .map(function (b) { return { id: b['編號'], name: b['學生'], start: toLocalStr_(b['開始']), length: b['課長'], note: b['備註'] }; });
  const students = readStudents_().map(function (s) {
    return { name: s.name, display: String(s.display || ''), email: s.email, token: s.token || '', record: s['課程記錄表'] || '', courses: s.courses, recording: s.recording };
  });
  // 所有來源、尚未結束（或一天內剛結束）的預約，供老師頁直接調整狀態
  const since = Date.now() - 86400000;
  const bookings = readBookings_().filter(function (b) { return b['開始'] && new Date(b['實際結束'] || b['開始']).getTime() >= since; })
    .sort(function (a, b) { return new Date(a['開始']) - new Date(b['開始']); })
    .map(function (b) { return { id: b['編號'], source: b['來源'], name: b['學生'], start: toLocalStr_(b['開始']), length: b['課長'], status: b['狀態'] }; });
  // 備註裡還沒按 × 的錯誤（Zoom、記錄表失敗等），新的在前
  const issues = readBookings_().map(function (b) { return { b: b, items: noteIssues_(b['備註'], b['備註已讀']) }; })
    .filter(function (x) { return x.items.length; })
    .sort(function (x, y) { return new Date(y.b['建立時間'] || y.b['開始']) - new Date(x.b['建立時間'] || x.b['開始']); })
    .map(function (x) { const b = x.b; return { id: b['編號'], source: b['來源'], name: b['學生'], start: b['開始'] ? toLocalStr_(b['開始']) : '', status: b['狀態'], items: x.items }; });
  // sheetUrl／scriptUrl：這支程式所在的試算表（後台紀錄都寫在這裡）與 Apps Script 專案，給老師頁放開啟按鈕
  return { rules: readRules_(), pending: pending, students: students, bookings: bookings, issues: issues,
    sheetUrl: getSs_().getUrl(), scriptUrl: 'https://script.google.com/home/projects/' + ScriptApp.getScriptId() + '/edit' };
}

/** 備註用「；」串起好幾段（見 Sync.gs addNote_），挑出錯誤的段落，扣掉老師已讀過的 */
function noteIssues_(note, read) {
  const seen = {};
  String(read || '').split('；').forEach(function (t) { seen[t.trim()] = true; });
  return String(note || '').split('；').map(function (t) { return t.trim(); })
    .filter(function (t) { return t && !seen[t] && /失敗|尚未|請人工確認|已用完|找不到/.test(t); });
}

/** 老師按 ×：把目前的備註記成已讀，備註本身不動 */
function adminDismissNote(id) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const b = readBookings_().filter(function (x) { return x['編號'] === id; })[0];
    if (!b) throw new Error('找不到預約 ' + id);
    b['備註已讀'] = b['備註'];
    writeBooking_(b);
    return true;
  } finally { lock.releaseLock(); }
}

function adminSaveRules(rules) {
  const clean = rules.map(function (r) {
    if (r.type === '休假' || r.type === '備註') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) throw new Error(r.type + '需要日期');
      return r;
    }
    if (!/^\d{2}:\d{2}$/.test(r.start) || !/^\d{2}:\d{2}$/.test(r.end) || hhmmToMin_(r.start) >= hhmmToMin_(r.end)) throw new Error('時間範圍不正確：' + r.start + '–' + r.end);
    if (r.type !== '每週' && !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) throw new Error('單日設定需要日期');
    return r;
  });
  writeRules_(clean);
  bustCaches_();
  return true;
}

function adminSetStatus(id, status) {
  if ([STATUS.PENDING, STATUS.CONFIRMED, STATUS.REJECTED, STATUS.EXPIRED, STATUS.CANCELLED].indexOf(status) < 0) throw new Error('不支援的狀態');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const b = readBookings_().filter(function (x) { return x['編號'] === id; })[0];
    if (!b) throw new Error('找不到預約 ' + id);
    b['狀態'] = status;
    applyStatusChange_(b);
    bustCaches_();
    return true;
  } finally { lock.releaseLock(); }
}

function adminCreateStudent(name, email, display) {
  name = String(name || '').trim();
  display = String(display || '').trim();
  if (!name) throw new Error('請填姓名');
  if (readStudents_().some(function (s) { return s.name === name; })) throw new Error('已有同名學生，請用「換新連結」');
  if (display && readStudents_().some(function (s) { return String(s.display).trim() === display; })) throw new Error('這個平台名稱已經綁定其他學生');
  getSheet_(CONFIG.SHEETS.STUDENTS, STUDENT_HEADERS).appendRow([name, display, email || '', '', newToken_(), '']);
  bustCaches_();
  return true;
}

/** 從學生表刪除這位學生（連結立刻失效）；預約與作業紀錄不刪 */
function adminDeleteStudent(name) {
  const s = readStudents_().filter(function (x) { return x.name === name; })[0];
  if (!s) throw new Error('找不到學生');
  getSheet_(CONFIG.SHEETS.STUDENTS, STUDENT_HEADERS).deleteRow(s.row);
  bustCaches_();
  return true;
}

/** 作廢舊連結並產生新的 */
function adminRenewLink(name) {
  const s = readStudents_().filter(function (x) { return x.name === name; })[0];
  if (!s) throw new Error('找不到學生');
  getSheet_(CONFIG.SHEETS.STUDENTS, STUDENT_HEADERS).getRange(s.row, STUDENT_HEADERS.indexOf('預約代碼') + 1).setValue(newToken_());
  return true;
}

// ---------- 老師週課表 ----------

function addDaysStr_(dateStr, n) {
  const p = dateStr.split('-');
  const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * 86400000);
  return d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1) + '-' + pad2_(d.getUTCDate());
}

/** 回傳這一週（週一～週日）的課、行事曆其他行程與開放時段，供老師頁畫課表 */
function adminGetWeek(anyDate) {
  const today = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd');
  const base = /^\d{4}-\d{2}-\d{2}$/.test(anyDate || '') ? anyDate : today;
  const monday = addDaysStr_(base, -(weekdayOf_(base) - 1));
  const dates = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return addDaysStr_(monday, i); });
  return { monday: monday, today: today, days: scheduleDays_(dates) };
}

/** 老師頁月曆：這個月所在的完整週（第一週的週一～最後一週的週日），每天的資料格式同 adminGetWeek */
function adminGetMonth(anyDate) {
  const today = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd');
  const base = /^\d{4}-\d{2}-\d{2}$/.test(anyDate || '') ? anyDate : today;
  const first = base.slice(0, 8) + '01';
  const y = +base.slice(0, 4), m = +base.slice(5, 7);
  const last = addDaysStr_(m === 12 ? (y + 1) + '-01-01' : y + '-' + pad2_(m + 1) + '-01', -1);
  const start = addDaysStr_(first, -(weekdayOf_(first) - 1));
  const end = addDaysStr_(last, 7 - weekdayOf_(last));
  const dates = [];
  for (let d = start; d <= end; d = addDaysStr_(d, 1)) dates.push(d);
  return { month: first.slice(0, 7), today: today, days: scheduleDays_(dates) };
}

/** 連續幾天的課（待確認／已確認）、行事曆其他行程與開放時段 */
function scheduleDays_(dates) {
  const bookings = readBookings_().filter(function (b) {
    return b['狀態'] === STATUS.PENDING || b['狀態'] === STATUS.CONFIRMED;
  });
  const own = {};
  bookings.forEach(function (b) { if (b['行事曆事件編號']) own[b['行事曆事件編號']] = true; });

  const events = getCal_().getEvents(parseLocal_(dates[0] + ' 00:00'), parseLocal_(addDaysStr_(dates[dates.length - 1], 1) + ' 00:00'))
    .filter(function (ev) { return !own[ev.getId()]; });
  const open = computeOpenSlots_(dates, readRules_(), [], '2000-01-01 00:00');

  return dates.map(function (date) {
    const day0 = wallMinutes_(date + ' 00:00');
    const o = open.filter(function (d) { return d.date === date; })[0];
    const day = { date: date, closed: o && o.closed ? o.label : '', open: [], allDay: [], lessons: [], events: [] };
    if (o) day.open = o.slots.map(function (s) { return hhmmToMin_(s.time); });

    bookings.forEach(function (b) {
      const s = toLocalStr_(b['開始']);
      if (s.slice(0, 10) !== date) return;
      const start = hhmmToMin_(s.slice(11));
      day.lessons.push({
        id: b['編號'], name: b['學生'], source: b['來源'], status: b['狀態'], len: b['課長'],
        start: start, end: start + (wallMinutes_(toLocalStr_(b['佔用結束'])) - wallMinutes_(s)),
      });
    });
    events.forEach(function (ev) {
      if (ev.isAllDayEvent()) {
        const a = wallMinutes_(toLocalStr_(ev.getStartTime())), z = wallMinutes_(toLocalStr_(ev.getEndTime()));
        if (a < day0 + 1440 && z > day0) day.allDay.push(ev.getTitle());
        return;
      }
      const a = Math.max(wallMinutes_(toLocalStr_(ev.getStartTime())), day0);
      const z = Math.min(wallMinutes_(toLocalStr_(ev.getEndTime())), day0 + 1440);
      if (z > a) day.events.push({ title: ev.getTitle(), start: a - day0, end: z - day0 });
    });
    return day;
  });
}

/** 綁定學生的課程記錄表（貼網址；留空＝解除綁定）。會先試著打開確認有權限。 */
/** 平台顯示名稱（AmazingTalker 上的名字）：有填＝平台學生，學生頁只顯示課程與作業；也用來對應平台預約信 */
function adminSetDisplay(name, display) {
  display = String(display || '').trim();
  const list = readStudents_();
  const s = list.filter(function (x) { return x.name === name; })[0];
  if (!s) throw new Error('找不到學生');
  if (display && list.some(function (x) { return x.name !== name && String(x.display).trim() === display; })) throw new Error('這個平台名稱已經綁定其他學生');
  getSheet_(CONFIG.SHEETS.STUDENTS, STUDENT_HEADERS).getRange(s.row, STUDENT_HEADERS.indexOf('平台顯示名稱') + 1).setValue(String(display || '').trim());
  bustCaches_();
  return true;
}

function adminSetRecord(name, url) {
  url = String(url || '').trim();
  const s = readStudents_().filter(function (x) { return x.name === name; })[0];
  if (!s) throw new Error('找不到學生');
  if (url) {
    // 只檢查格式，不實際開啟（開啟外部試算表要好幾秒）；打不開時學生頁不會顯示課程卡
    if (!/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+/.test(url) && !/^[\w-]{20,}$/.test(url)) throw new Error('請貼上 Google 試算表的網址');
  }
  getSheet_(CONFIG.SHEETS.STUDENTS, STUDENT_HEADERS).getRange(s.row, STUDENT_HEADERS.indexOf('課程記錄表') + 1).setValue(url);
  bustCaches_();
  return true;
}

/** 設定學生可進入的課程（課程代號清單，見 Courses.gs；空陣列＝都不開放） */
function adminSetCourses(name, courses) {
  const s = readStudents_().filter(function (x) { return x.name === name; })[0];
  if (!s) throw new Error('找不到學生');
  const clean = cleanCourses_(courses);
  getSheet_(CONFIG.SHEETS.STUDENTS, STUDENT_HEADERS).getRange(s.row, STUDENT_HEADERS.indexOf('可進入課程') + 1).setValue(clean.join(','));
  return true;
}

// ---------- 課後錄影 ----------

/** 設定學生需不需要課後錄影：on＝寫入今天的日期（從今天起的課才列入「待補錄影」），off＝清空 */
function adminSetRecording(name, on) {
  const s = readStudents_().filter(function (x) { return x.name === name; })[0];
  if (!s) throw new Error('找不到學生');
  const cell = getSheet_(CONFIG.SHEETS.STUDENTS, STUDENT_HEADERS).getRange(s.row, STUDENT_HEADERS.indexOf('課後錄影') + 1);
  if (!on) cell.setValue('');
  else if (!s.recording) cell.setNumberFormat('@').setValue(Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd'));
  bustCaches_();
  return true;
}

/**
 * 待補錄影：需要錄影的學生裡，開始錄影那天以後、已經上完但「影片連結」還空白的課（舊→新）。
 * 只打開需要錄影的學生的記錄表。沒綁記錄表、或記錄表沒有「影片連結」欄的學生放在 problems，讓老師知道要處理。
 */
function adminGetPendingVideos() {
  const items = [], problems = [];
  readStudents_().forEach(function (s) {
    if (!s.recording) return;
    if (!s['課程記錄表']) { problems.push({ name: s.name, reason: '尚未綁定課程記錄表' }); return; }
    const rec = readRecordBundle_(s['課程記錄表']);
    if (!rec) { problems.push({ name: s.name, reason: '記錄表打不開' }); return; }
    if (!rec.hasVideoCol) { problems.push({ name: s.name, reason: '記錄表「上課記錄」分頁沒有「影片連結」欄' }); return; }
    rec.videos.forEach(function (v) {
      if (!v.video && v.start.slice(0, 10) >= s.recording) items.push({ name: s.name, record: s['課程記錄表'], no: v.no, start: v.start, end: v.end, dateOnly: v.dateOnly, progress: v.progress });
    });
  });
  items.sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
  return { items: items, problems: problems };
}

/** 把影片連結填進學生記錄表那一堂（start＝那一堂的開始時間 'yyyy-MM-dd HH:mm'） */
function adminSetVideoLink(name, start, url) {
  url = String(url || '').trim();
  if (url && !/^https?:\/\/\S+$/.test(url)) throw new Error('請貼上完整的影片網址（https:// 開頭）');
  const s = readStudents_().filter(function (x) { return x.name === name; })[0];
  if (!s || !s['課程記錄表']) throw new Error('找不到學生或尚未綁定課程記錄表');
  const msg = writeVideoToRecord_(s['課程記錄表'], String(start), url);
  bustCaches_();
  return msg;
}

// ---------- 記錄表裡已排、但不在預約表的課 ----------

/**
 * 各學生記錄表中「還沒上完」的課，扣掉已在預約表（待確認／已確認）的。
 * 用途：新綁定記錄表時，老師之前手寫在裡面的課也能在老師頁看到、取消。
 * 每位學生要開一次記錄表，所以只在老師頁進入「所有預約」時才讀取。
 */
function adminGetRecordSessions() {
  return recordOnlySessions_(toLocalStr_(new Date()));
}

/** 各學生記錄表中結束時間在 fromStr 之後、而且不在預約表（待確認／已確認）的課（老師頁與每日 LINE 推播共用） */
function recordOnlySessions_(nowStr) {
  const bookings = readBookings_();
  const out = [];
  readStudents_().forEach(function (s) {
    if (!s['課程記錄表']) return;
    const rec = readRecordBundle_(s['課程記錄表']);
    if (!rec) return;
    const known = {};
    bookings.forEach(function (b) {
      if (b['學生'] === s.name && b['開始'] && (b['狀態'] === STATUS.PENDING || b['狀態'] === STATUS.CONFIRMED)) known[toLocalStr_(b['開始'])] = true;
    });
    rec.sessions.forEach(function (x) { if (x.end > nowStr && !known[x.start]) out.push({ name: s.name, start: x.start, end: x.end }); });
  });
  return out.sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
}

/**
 * 取消記錄表裡的一堂課：清掉上課日期與會議連結，並刪除行事曆上「開始時間完全相同、標題含學生名字
 * （或平台顯示名稱）」的事件，讓時段釋放。不會刪 Zoom 會議（不是系統建立的）。
 * 為了不誤刪，只刪符合上述條件的；標題沒有學生名字的事件要自己到行事曆刪。
 */
function adminCancelRecordLesson(name, start) {
  const s = readStudents_().filter(function (x) { return x.name === name; })[0];
  if (!s || !s['課程記錄表']) throw new Error('找不到學生或尚未綁定課程記錄表');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(start))) throw new Error('時間格式不正確');
  const msg = clearBookingFromRecord_(s['課程記錄表'], start, 30, '');
  const n = deleteCalendarEventsFor_([s.name, s.display], start);
  bustCaches_();
  return msg + (n ? '；已刪除行事曆事件 ' + n + ' 個' : '；行事曆上沒有符合的事件');
}

/** 刪除開始時間等於 startStr、標題含任一名字（不分大小寫）的行事曆事件，回傳刪除數量 */
function deleteCalendarEventsFor_(names, startStr) {
  const from = parseLocal_(startStr);
  const keys = names.map(function (x) { return String(x || '').trim().toLowerCase(); }).filter(Boolean);
  if (!keys.length) return 0;
  let n = 0;
  getCal_().getEvents(from, new Date(from.getTime() + 30 * 60000)).forEach(function (ev) {
    if (ev.isAllDayEvent() || toLocalStr_(ev.getStartTime()) !== startStr) return;
    const t = ev.getTitle().toLowerCase();
    if (keys.some(function (k) { return t.indexOf(k) >= 0; })) { ev.deleteEvent(); n++; }
  });
  return n;
}
