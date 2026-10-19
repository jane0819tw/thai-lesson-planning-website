/**
 * Logic.gs — 課長、時段、狀態的判斷規則（純函式，可在 Node 測試）。
 */

var SLOT_MINUTES = 30; // 預約以 30 分鐘為一格

var STATUS = {
  PENDING: '待確認',
  CONFIRMED: '已確認',
  REJECTED: '已拒絕',
  EXPIRED: '已過期',
  CANCELLED: '已取消',
  MANUAL: '請人工確認'
};

/** 25 分鐘 = 短課、50 分鐘 = 長課；其他長度回傳 null（交給人工確認，不猜）。 */
function classifyDuration_(minutes) {
  if (minutes === 25) return 'short';
  if (minutes === 50) return 'long';
  return null;
}

/** 行事曆佔用的長度：往上取整到 30 分鐘的倍數（25→30、50→60）。 */
function occupiedMinutes_(minutes) {
  return Math.ceil(minutes / SLOT_MINUTES) * SLOT_MINUTES;
}

function occupiedEndMs_(startMs, minutes) {
  return startMs + occupiedMinutes_(minutes) * 60000;
}

function rangesOverlap_(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function nameKey_(name) {
  return String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isActiveStatus_(status) {
  return status === STATUS.PENDING || status === STATUS.CONFIRMED;
}

function sameStudent_(row, student) {
  return nameKey_(row.platformName || row.student) === nameKey_(student);
}

/**
 * 取消信只有「學生名 + 開始時間」，用它找原預約。
 * rows: [{ student, platformName, source, startMs, status }]
 * 回傳 rows 的索引；找不到回傳 -1。已確認的優先於待確認。
 */
function findCancelTarget_(rows, student, startMs) {
  var found = -1;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.source !== 'AmazingTalker' || r.startMs !== startMs || !isActiveStatus_(r.status)) continue;
    if (!sameStudent_(r, student)) continue;
    if (r.status === STATUS.CONFIRMED) return i;
    if (found < 0) found = i;
  }
  return found;
}

/** 同一位學生、同一個開始時間、仍有效的請求 = 重複。 */
function findDuplicateRequest_(rows, student, startMs) {
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.source === 'AmazingTalker' && r.startMs === startMs && isActiveStatus_(r.status) && sameStudent_(r, student)) {
      return i;
    }
  }
  return -1;
}

/** 狀態 → 行事曆該怎麼處理。 */
function statusAction_(status) {
  if (status === STATUS.PENDING) return 'tentative';
  if (status === STATUS.CONFIRMED) return 'confirmed';
  if (status === STATUS.REJECTED || status === STATUS.EXPIRED || status === STATUS.CANCELLED) return 'remove';
  return 'keep'; // 請人工確認：不動行事曆，等 Jane 處理
}

function isExpired_(nowMs, expiresMs) {
  return typeof expiresMs === 'number' && expiresMs <= nowMs;
}

function needsReminder_(nowMs, expiresMs, hoursBefore, alreadySent) {
  if (alreadySent || typeof expiresMs !== 'number') return false;
  return expiresMs > nowMs && expiresMs - nowMs <= hoursBefore * 3600000;
}
