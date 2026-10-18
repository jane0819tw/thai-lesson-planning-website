/**
 * 預約系統的資料 API（給靜態網站用，做法同 thaiskr-custom）。
 * 前端用 fetch POST（Content-Type: text/plain）送 {fn, args, key}，回傳 {ok, data|error}。
 * 學生用的函式公開；admin 開頭的函式需要管理密鑰（指令碼屬性 ADMIN_KEY）。
 */

const PUBLIC_API_ = { getStudentView: getStudentView, submitBooking: submitBooking };
const ADMIN_API_ = {
  adminGetState: adminGetState, adminGetWeek: adminGetWeek, adminSaveRules: adminSaveRules,
  adminSetStatus: adminSetStatus, adminCreateStudent: adminCreateStudent, adminRenewLink: adminRenewLink, adminSetRecord: adminSetRecord,
  adminGetRecordSessions: adminGetRecordSessions, adminCancelRecordLesson: adminCancelRecordLesson,
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
    .filter(function (r) { return r[0] === '休假' ? r[2] : (r[0] && r[3] && r[4]); })
    .map(function (r) { return { type: r[0], weekday: r[1] ? Number(r[1]) : '', date: r[2], start: r[3], end: r[4], label: r[5] }; });
}

function writeRules_(rules) {
  const sh = getSheet_(CONFIG.SHEETS.RULES, RULE_HEADERS);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, RULE_HEADERS.length).clearContent();
  if (!rules.length) return;
  const rows = rules.map(function (r) {
    return [r.type, r.type === '每週' ? String(r.weekday) : '', r.type === '每週' ? '' : r.date,
      r.type === '休假' ? '' : r.start, r.type === '休假' ? '' : r.end, r.type === '休假' ? (r.label || '') : ''];
  });
  sh.getRange(2, 1, rows.length, RULE_HEADERS.length).setNumberFormat('@').setValues(rows);
}

function readStudents_() {
  const sh = getSheet_(CONFIG.SHEETS.STUDENTS, STUDENT_HEADERS);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, STUDENT_HEADERS.length).getValues()
    .map(function (r, i) { return { row: i + 2, name: r[0], display: r[1], email: r[2], note: r[3], token: r[4], '課程記錄表': r[5] }; });
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
  return computeOpenSlots_(dates, readRules_(), busyIntervals_(from, to), earliest);
}

// ---------- 學生 API ----------

function getStudentView(token) {
  const s = studentByToken_(token);
  if (token && !s) return { mode: 'invalid' };
  const v = { mode: s ? 'known' : 'generic', name: s ? s.name : '', days: openDays_(), lessons: null, upcoming: [], asOf: Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss') };
  if (s) {
    const rec = s['課程記錄表'] ? readRecordBundle_(s['課程記錄表']) : null;
    v.lessons = rec ? rec.summary : null;
    v.lastLesson = rec ? rec.last : null;
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
    notify_('私下學生新預約：' + studentName,
      studentName + '　' + startStr + '（' + length + ' 分）\n\n請到管理頁或試算表確認／拒絕。\n私下預約成立後，記得到 AmazingTalker 手動關閉同一時段。');
    return { ok: true, id: b['編號'] };
  } finally { lock.releaseLock(); }
}

// ---------- 老師 API ----------

function adminGetState() {
  const pending = readBookings_().filter(function (b) { return b['來源'] === '私下' && b['狀態'] === STATUS.PENDING; })
    .map(function (b) { return { id: b['編號'], name: b['學生'], start: toLocalStr_(b['開始']), length: b['課長'], note: b['備註'] }; });
  const students = readStudents_().map(function (s) {
    return { name: s.name, email: s.email, token: s.token || '', record: s['課程記錄表'] || '' };
  });
  // 所有來源、尚未結束（或一天內剛結束）的預約，供老師頁直接調整狀態
  const since = Date.now() - 86400000;
  const bookings = readBookings_().filter(function (b) { return b['開始'] && new Date(b['實際結束'] || b['開始']).getTime() >= since; })
    .sort(function (a, b) { return new Date(a['開始']) - new Date(b['開始']); })
    .map(function (b) { return { id: b['編號'], source: b['來源'], name: b['學生'], start: toLocalStr_(b['開始']), length: b['課長'], status: b['狀態'] }; });
  return { rules: readRules_(), pending: pending, students: students, bookings: bookings };
}

function adminSaveRules(rules) {
  const clean = rules.map(function (r) {
    if (r.type === '休假') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) throw new Error('休假需要日期');
      return r;
    }
    if (!/^\d{2}:\d{2}$/.test(r.start) || !/^\d{2}:\d{2}$/.test(r.end) || hhmmToMin_(r.start) >= hhmmToMin_(r.end)) throw new Error('時間範圍不正確：' + r.start + '–' + r.end);
    if (r.type !== '每週' && !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) throw new Error('單日設定需要日期');
    return r;
  });
  writeRules_(clean);
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
    return true;
  } finally { lock.releaseLock(); }
}

function adminCreateStudent(name, email) {
  name = String(name || '').trim();
  if (!name) throw new Error('請填姓名');
  if (readStudents_().some(function (s) { return s.name === name; })) throw new Error('已有同名學生，請用「換新連結」');
  getSheet_(CONFIG.SHEETS.STUDENTS, STUDENT_HEADERS).appendRow([name, '', email || '', '', newToken_(), '']);
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

  const bookings = readBookings_().filter(function (b) {
    return b['狀態'] === STATUS.PENDING || b['狀態'] === STATUS.CONFIRMED;
  });
  const own = {};
  bookings.forEach(function (b) { if (b['行事曆事件編號']) own[b['行事曆事件編號']] = true; });

  const events = getCal_().getEvents(parseLocal_(dates[0] + ' 00:00'), parseLocal_(addDaysStr_(dates[6], 1) + ' 00:00'))
    .filter(function (ev) { return !own[ev.getId()]; });
  const open = computeOpenSlots_(dates, readRules_(), [], '2000-01-01 00:00');

  const days = dates.map(function (date, i) {
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
  return { monday: monday, today: today, days: days };
}

/** 綁定學生的課程記錄表（貼網址；留空＝解除綁定）。會先試著打開確認有權限。 */
function adminSetRecord(name, url) {
  url = String(url || '').trim();
  const s = readStudents_().filter(function (x) { return x.name === name; })[0];
  if (!s) throw new Error('找不到學生');
  if (url) {
    // 只檢查格式，不實際開啟（開啟外部試算表要好幾秒）；打不開時學生頁不會顯示課程卡
    if (!/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+/.test(url) && !/^[\w-]{20,}$/.test(url)) throw new Error('請貼上 Google 試算表的網址');
  }
  getSheet_(CONFIG.SHEETS.STUDENTS, STUDENT_HEADERS).getRange(s.row, STUDENT_HEADERS.indexOf('課程記錄表') + 1).setValue(url);
  return true;
}

// ---------- 記錄表裡已排、但不在預約表的課 ----------

/**
 * 各學生記錄表中「還沒上完」的課，扣掉已在預約表（待確認／已確認）的。
 * 用途：新綁定記錄表時，老師之前手寫在裡面的課也能在老師頁看到、取消。
 * 每位學生要開一次記錄表，所以只在老師頁進入「所有預約」時才讀取。
 */
function adminGetRecordSessions() {
  const nowStr = toLocalStr_(new Date());
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

/** 清掉記錄表那一堂的上課日期與會議連結（不會刪 Zoom 會議，因為不是系統建立的） */
function adminCancelRecordLesson(name, start) {
  const s = readStudents_().filter(function (x) { return x.name === name; })[0];
  if (!s || !s['課程記錄表']) throw new Error('找不到學生或尚未綁定課程記錄表');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(start))) throw new Error('時間格式不正確');
  return clearBookingFromRecord_(s['課程記錄表'], start, 30, '');
}
