/**
 * 班級作業（字幕聽打＋斷句解析）：學生送出後，才看得到同班同學的作業，可以互相留言；老師在管理頁逐份回饋。
 * 班級（見 Web.gs withClass_）：「學生」分頁的「班級」欄有填就用它（同一個字＝同一班）；沒填時，綁同一份課程記錄表的學生自動同一班；都沒有＝一對一，只有自己和老師看得到。
 * 同班與否一律看學生「現在」的班級，不看交作業當時記下的班名（換班、加入新同學都會馬上生效）。
 * 課別代號：S<課>（S20 ＝ L20 字幕聽打）。每位學生每課只有一份，重新送出會覆蓋內容（留言、老師回饋保留）。
 */

const CLASSWORK_HEADERS = ['編號', '繳交時間', '學生', '班級', '課別', '內容', '老師回饋', '回饋時間', '更新時間'];
const CLASSCOMMENT_HEADERS = ['編號', '時間', '作業編號', '留言者', '內容', '老師'];
const CLASSWORK_SHEET_ = '班級作業';
const CLASSCOMMENT_SHEET_ = '作業留言';
const CLASSDRAFT_HEADERS = ['學生', '課別', '內容', '儲存時間'];
const CLASSDRAFT_SHEET_ = '作業草稿'; // 寫到一半先存的草稿（每人每課一列，同學看不到；送出後刪掉）
const CW_MAX_LINES_ = 60, CW_MAX_LEN_ = 1000, CW_MAX_COMMENT_ = 500;

function classKey_(k) {
  const t = String(k || '').trim().toUpperCase();
  if (!/^S[1-9]\d*$/.test(t)) throw new Error('課別不正確');
  return t;
}

/** 同班同學（不含自己）的姓名表；一對一的學生是空的 */
function classmates_(s) {
  const out = {};
  if (s.cls) readStudents_().forEach(function (x) { if (x.name !== s.name && x.cls === s.cls) out[x.name] = true; });
  return out;
}

function readClassWork_() {
  const sh = getSheet_(CLASSWORK_SHEET_, CLASSWORK_HEADERS);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, CLASSWORK_HEADERS.length).getValues()
    .map(function (r, i) {
      let items = [];
      try { items = JSON.parse(r[5] || '[]'); } catch (e) { items = []; }
      return { row: i + 2, id: String(r[0]), time: r[1] ? toLocalStr_(r[1]) : '', name: String(r[2]), cls: String(r[3] || '').trim(), key: String(r[4]),
        items: items, feedback: String(r[6] || ''), feedbackTime: r[7] ? toLocalStr_(r[7]) : '', updated: r[8] ? toLocalStr_(r[8]) : '' };
    })
    .filter(function (w) { return w.id && w.name; });
}

function readClassComments_() {
  const sh = getSheet_(CLASSCOMMENT_SHEET_, CLASSCOMMENT_HEADERS);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, CLASSCOMMENT_HEADERS.length).getValues()
    .filter(function (r) { return r[0] && r[2]; })
    .map(function (r) { return { id: String(r[0]), time: r[1] ? toLocalStr_(r[1]) : '', work: String(r[2]), name: String(r[3]), text: String(r[4]), teacher: r[5] === true || r[5] === '是' }; });
}

/** 給前端的格式（不帶試算表列號），附上這份作業的留言（舊→新） */
function publicWork_(w, comments) {
  return { id: w.id, time: w.time, updated: w.updated, name: w.name, cls: w.cls, key: w.key, items: w.items, feedback: w.feedback, feedbackTime: w.feedbackTime,
    comments: comments.filter(function (c) { return c.work === w.id; }).map(function (c) { return { id: c.id, time: c.time, name: c.name, text: c.text, teacher: c.teacher }; }) };
}

/** 學生頁：我的這份作業；送出過才會帶同班同學的作業（自己排第一個） */
function getClassWork(token, key) {
  const s = studentByToken_(token);
  if (!s) throw new Error('作業連結已失效，請向老師索取新的連結');
  key = classKey_(key);
  const all = readClassWork_().filter(function (w) { return w.key === key; });
  const mine = all.filter(function (w) { return w.name === s.name; })[0] || null;
  const draft = readDraft_(s.name, key);
  if (!mine) return { name: s.name, cls: s.cls, mine: null, works: [], draft: draft };
  const comments = readClassComments_();
  const mates = classmates_(s);
  const works = all.filter(function (w) { return w.name === s.name || mates[w.name]; })
    .sort(function (a, b) { return (a.name === s.name ? -1 : 0) - (b.name === s.name ? -1 : 0) || (a.time < b.time ? -1 : 1); })
    .map(function (w) { return publicWork_(w, comments); });
  return { name: s.name, cls: s.cls, mine: works[0], works: works, draft: draft };
}

// ---------- 草稿 ----------

function cleanItems_(items) {
  if (!Array.isArray(items) || !items.length || items.length > CW_MAX_LINES_) throw new Error('作業內容不正確');
  return items.map(function (x) {
    return { n: Number(x && x.n) || 0, typed: String((x && x.typed) || '').slice(0, CW_MAX_LEN_), zh: String((x && x.zh) || '').slice(0, CW_MAX_LEN_), note: String((x && x.note) || '').slice(0, CW_MAX_LEN_) };
  });
}

function draftRow_(name, key) {
  const sh = getSheet_(CLASSDRAFT_SHEET_, CLASSDRAFT_HEADERS);
  if (sh.getLastRow() < 2) return 0;
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  for (let i = 0; i < rows.length; i++) if (String(rows[i][0]) === name && String(rows[i][1]) === key) return i + 2;
  return 0;
}

/** 這位學生這課的草稿：{ items, time }；沒有是 null */
function readDraft_(name, key) {
  const row = draftRow_(name, key);
  if (!row) return null;
  const r = getSheet_(CLASSDRAFT_SHEET_, CLASSDRAFT_HEADERS).getRange(row, 1, 1, CLASSDRAFT_HEADERS.length).getValues()[0];
  try { return { items: JSON.parse(r[2] || '[]'), time: r[3] ? toLocalStr_(r[3]) : '' }; } catch (e) { return null; }
}

/** 學生按「儲存草稿」：存到「作業草稿」分頁（換手機、換電腦也接得下去）。回傳儲存時間 */
function saveClassDraft(token, key, items) {
  const s = studentByToken_(token);
  if (!s) throw new Error('作業連結已失效，請向老師索取新的連結');
  key = classKey_(key);
  const clean = cleanItems_(items);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('系統忙碌中，請稍後再試');
  try {
    const sh = getSheet_(CLASSDRAFT_SHEET_, CLASSDRAFT_HEADERS);
    const row = draftRow_(s.name, key) || sh.getLastRow() + 1;
    const now = new Date();
    sh.getRange(row, 1, 1, CLASSDRAFT_HEADERS.length).setValues([[s.name, key, JSON.stringify(clean), now]]);
    return { time: toLocalStr_(now) };
  } finally { lock.releaseLock(); }
}

function deleteDraft_(name, key) {
  const row = draftRow_(name, key);
  if (row) getSheet_(CLASSDRAFT_SHEET_, CLASSDRAFT_HEADERS).deleteRow(row);
}

/** 學生送出（或修改）作業。items = [{ n: 句號, typed: 泰文, zh: 中文意思, note: 斷句解析 }] */
function submitClassWork(token, key, items) {
  const s = studentByToken_(token);
  if (!s) throw new Error('作業連結已失效，請向老師索取新的連結');
  key = classKey_(key);
  const clean = cleanItems_(items);
  if (!clean.some(function (x) { return x.typed.trim(); })) throw new Error('還沒有打任何一句');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('系統忙碌中，請稍後再試');
  try {
    const sh = getSheet_(CLASSWORK_SHEET_, CLASSWORK_HEADERS);
    const mine = readClassWork_().filter(function (w) { return w.key === key && w.name === s.name; })[0];
    const now = new Date();
    if (mine) {
      sh.getRange(mine.row, 4).setValue(s.cls);
      sh.getRange(mine.row, 6).setValue(JSON.stringify(clean));
      sh.getRange(mine.row, 9).setValue(now);
    } else {
      sh.appendRow(['W' + now.getTime(), now, s.name, s.cls, key, JSON.stringify(clean), '', '', '']);
      // 也記一筆在「作業」分頁，學生頁的課程列表會顯示已完成
      const hw = getSheet_(CONFIG.SHEETS.HOMEWORK, HOMEWORK_HEADERS);
      const row = hw.getLastRow() + 1;
      hw.getRange(row, 3, 1, 5).setNumberFormat('@');
      hw.getRange(row, 1, 1, HOMEWORK_HEADERS.length).setValues([[now, s.name, key, '', '已交', '字幕聽打', '']]);
    }
    deleteDraft_(s.name, key);
  } finally { lock.releaseLock(); }
  return getClassWork(token, key);
}

/** 學生留言：只能留在自己或同班同學的作業下面，而且自己要先交過這課 */
function addClassComment(token, workId, text) {
  const s = studentByToken_(token);
  if (!s) throw new Error('作業連結已失效，請向老師索取新的連結');
  text = String(text || '').trim().slice(0, CW_MAX_COMMENT_);
  if (!text) throw new Error('請輸入留言');
  const all = readClassWork_();
  const w = all.filter(function (x) { return x.id === String(workId); })[0];
  if (!w) throw new Error('找不到這份作業');
  if (w.name !== s.name && !classmates_(s)[w.name]) throw new Error('只能在同班同學的作業留言');
  if (!all.some(function (x) { return x.key === w.key && x.name === s.name; })) throw new Error('先送出自己的作業，才能留言');
  getSheet_(CLASSCOMMENT_SHEET_, CLASSCOMMENT_HEADERS).appendRow(['C' + Date.now(), new Date(), w.id, s.name, text, '']);
  return getClassWork(token, w.key);
}

// ---------- 老師 ----------

/** 管理頁：全部班級作業（新→舊）與留言 */
function adminGetClassWork() {
  const comments = readClassComments_();
  return readClassWork_().sort(function (a, b) { return (b.updated || b.time) < (a.updated || a.time) ? -1 : 1; })
    .slice(0, 300).map(function (w) { return publicWork_(w, comments); });
}

/** 老師回饋（覆蓋；空字串＝清掉） */
function adminReplyClassWork(workId, text) {
  const w = readClassWork_().filter(function (x) { return x.id === String(workId); })[0];
  if (!w) throw new Error('找不到這份作業');
  text = String(text || '').trim();
  const sh = getSheet_(CLASSWORK_SHEET_, CLASSWORK_HEADERS);
  sh.getRange(w.row, 7).setValue(text);
  sh.getRange(w.row, 8).setValue(text ? new Date() : '');
  return true;
}

/** 老師在作業下面留言（和學生的留言放在一起，標成老師） */
function adminCommentClassWork(workId, text) {
  text = String(text || '').trim().slice(0, CW_MAX_COMMENT_);
  if (!text) throw new Error('請輸入留言');
  if (!readClassWork_().some(function (x) { return x.id === String(workId); })) throw new Error('找不到這份作業');
  getSheet_(CLASSCOMMENT_SHEET_, CLASSCOMMENT_HEADERS).appendRow(['C' + Date.now(), new Date(), String(workId), '老師', text, '是']);
  return true;
}

/** 設定學生的班級（空字串＝不指定：綁同一份記錄表的人自動同一班，否則一對一） */
function adminSetClass(name, cls) {
  const s = readStudents_().filter(function (x) { return x.name === name; })[0];
  if (!s) throw new Error('找不到學生');
  const sh = getSheet_(CONFIG.SHEETS.STUDENTS, STUDENT_HEADERS);
  const col = STUDENT_HEADERS.indexOf('班級') + 1;
  if (!sh.getRange(1, col).getValue()) sh.getRange(1, col).setValue('班級').setFontWeight('bold'); // 舊的學生分頁沒有這欄標題
  sh.getRange(s.row, col).setValue(String(cls || '').trim());
  return true;
}
