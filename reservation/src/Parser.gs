/**
 * AmazingTalker 信件解析（純函式，不呼叫任何 Google 服務，可在 Node 測試）。
 * 時間一律回傳 'yyyy-MM-dd HH:mm' 字串（Asia/Taipei），由呼叫端轉成 Date。
 */

function pad2_(n) { return (n < 10 ? '0' : '') + n; }

/** 「上午/下午 hh:mm」→ 當天分鐘數 */
function to24hMinutes_(ampm, h, m) {
  h = Number(h); m = Number(m);
  if (ampm === '下午' && h < 12) h += 12;
  if (ampm === '上午' && h === 12) h = 0;
  return h * 60 + m;
}

function fmtDateTime_(y, mo, d, minutes) {
  return y + '-' + pad2_(mo) + '-' + pad2_(d) + ' ' + pad2_(Math.floor(minutes / 60)) + ':' + pad2_(minutes % 60);
}

/** 實際長度往上取整到 30 分鐘的倍數 */
function occupiedMinutes_(durationMin, slot) {
  slot = slot || 30;
  return Math.ceil(durationMin / slot) * slot;
}

function addMinutesStr_(dtStr, minutes) {
  const p = dtStr.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  const t = Date.UTC(+p[1], +p[2] - 1, +p[3], +p[4], +p[5]) + minutes * 60000;
  const d = new Date(t);
  return d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1) + '-' + pad2_(d.getUTCDate()) +
    ' ' + pad2_(d.getUTCHours()) + ':' + pad2_(d.getUTCMinutes());
}

const REQUEST_SUBJECT_RE_ = /課時請求\s+(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(上午|下午)\s*(\d{1,2}):(\d{2})\s*-\s*(上午|下午)\s*(\d{1,2}):(\d{2})/;
const CANCEL_SUBJECT_RE_ = /您的學生\s*(.+?)\s*取消了與您的預約課程/;

/**
 * @return {{type:'request'|'cancel'|'ignore'|'error', ...}}
 * request: student, start, end, durationMin, occupiedMin, lengthOk, expires(可為 null)
 * cancel : student, start, reason
 * error  : reason（格式無法解析，需通知 Jane）
 */
function parseAmazingTalkerMail(subject, body) {
  subject = subject || ''; body = body || '';
  try {
    if (subject.indexOf('課時請求') >= 0) return parseRequest_(subject, body);
    if (subject.indexOf('取消了與您的預約課程') >= 0) return parseCancel_(subject, body);
    return { type: 'ignore' };
  } catch (e) {
    return { type: 'error', reason: '解析例外：' + e.message };
  }
}

function parseRequest_(subject, body) {
  const s = subject.match(REQUEST_SUBJECT_RE_);
  if (!s) return { type: 'error', reason: '課時請求標題格式無法解析' };
  const nameM = body.match(/(?:^|[,，\n])\s*([^\n,，]+?)\s*發送一筆課時請求/);
  if (!nameM) return { type: 'error', reason: '內文找不到學生名（「某某 發送一筆課時請求」）' };

  const y = +s[1], mo = +s[2], d = +s[3];
  const startMin = to24hMinutes_(s[4], s[5], s[6]);
  const endMin = to24hMinutes_(s[7], s[8], s[9]);
  const durationMin = endMin - startMin;
  if (durationMin <= 0) return { type: 'error', reason: '結束時間不晚於開始時間' };

  const start = fmtDateTime_(y, mo, d, startMin);
  const lengthOk = CONFIG.ALLOWED_LENGTHS.indexOf(durationMin) >= 0;
  return {
    type: 'request',
    student: nameM[1],
    start: start,
    end: fmtDateTime_(y, mo, d, endMin),
    durationMin: durationMin,
    occupiedMin: occupiedMinutes_(durationMin, CONFIG.SLOT_MINUTES),
    lengthOk: lengthOk,
    expires: parseExpiry_(body),
  };
}

/** 內文「此請求將會在2026/10/12 下午11:20過期」的日期時間；抓不到回傳 null，由呼叫端改用寄信時間 + 24 小時 */
function parseExpiry_(body) {
  const m = body.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s*(上午|下午)?\s*(\d{1,2}):(\d{2})\s*過期/);
  if (!m) return null;
  let min;
  if (m[4]) min = to24hMinutes_(m[4], m[5], m[6]);
  else min = (+m[5]) * 60 + (+m[6]);
  return fmtDateTime_(+m[1], +m[2], +m[3], min);
}

function parseCancel_(subject, body) {
  const s = subject.match(CANCEL_SUBJECT_RE_);
  const nameM = s || body.match(/您的學生\s*(.+?)\s*取消了與您的預約課程/);
  if (!nameM) return { type: 'error', reason: '取消信找不到學生名' };

  // 內文：「Jenny取消了與您在2026/10/12 下午10:00的課程」
  const t = body.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s*(上午|下午)\s*(\d{1,2}):(\d{2})\s*的課程/);
  if (!t) return { type: 'error', reason: '取消信找不到日期或開始時間', student: nameM[1] };

  const start = fmtDateTime_(+t[1], +t[2], +t[3], to24hMinutes_(t[4], t[5], t[6]));
  const reasonM = body.match(/取消原因[:：]?\s*([\s\S]*?)(?:\n\s*\n|$)/);
  return { type: 'cancel', student: nameM[1], start: start, reason: reasonM ? reasonM[1].trim() : '' };
}
