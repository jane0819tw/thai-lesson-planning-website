/**
 * Sync.gs — 主流程：讀 AmazingTalker 通知信 → 寫入試算表與行事曆 → 處理過期與提醒。
 * 由「泰時刻」選單、每 10 分鐘的定時觸發、以及「狀態」欄被修改時的觸發啟動。
 */

function syncAll() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return null; // 另一個同步正在跑
  var summary = { newRequests: 0, cancels: 0, manual: 0, unknown: 0, expired: 0, reminded: 0, alerts: [] };
  try {
    initSheets_();
    processNewMessages_(summary);
    expirePending_(summary);
    reconcileAll_();
    remindPending_(summary);
    if (summary.alerts.length) {
      mailSelf_('【泰時刻】有 ' + summary.alerts.length + ' 件事需要你看一下', summary.alerts.join('\n\n'));
    }
    return summary;
  } catch (err) {
    mailSelf_('【泰時刻】同步發生錯誤', String(err && err.stack ? err.stack : err));
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/** 「狀態」欄被修改時，立刻讓行事曆跟上（需先用選單安裝觸發）。 */
function onBookingEdit(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== SHEET_BOOKINGS) return;
  var statusCol = BOOKING_HEADERS.indexOf('狀態') + 1;
  if (e.range.getColumn() > statusCol || e.range.getLastColumn() < statusCol) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    reconcileAll_();
  } finally {
    lock.releaseLock();
  }
}

// ---------- 讀信 ----------

function processNewMessages_(summary) {
  var processed = loadProcessedIds_();
  var threads = GmailApp.search('label:' + LABEL_NAME + ' newer_than:' + LOOKBACK_DAYS + 'd', 0, 100);
  var messages = [];
  GmailApp.getMessagesForThreads(threads).forEach(function (arr) {
    arr.forEach(function (m) { messages.push(m); });
  });
  messages.sort(function (a, b) { return a.getDate().getTime() - b.getDate().getTime(); });

  messages.forEach(function (msg) {
    var id = msg.getId();
    if (processed[id]) return;
    var subject = msg.getSubject();

    if (!/amazingtalker/i.test(msg.getFrom())) {
      appendLog_(id, msg.getDate(), subject, 'skip', '寄件者不是 AmazingTalker，略過');
      return;
    }

    var parsed = parseMessage(subject, msg.getPlainBody());
    if (parsed.type === 'unknown') {
      // 純文字版解析不到時，再試一次 HTML 版
      parsed = parseMessage(subject, stripHtml_(msg.getBody()));
    }

    var result;
    if (parsed.type === 'request') {
      result = handleRequest_(parsed, id, summary);
    } else if (parsed.type === 'cancel') {
      result = handleCancel_(parsed, id, summary);
    } else {
      summary.unknown++;
      summary.alerts.push('無法解析這封 AmazingTalker 信件，請手動查看：「' + subject + '」（原因：' + parsed.reason + '）');
      result = '無法解析：' + parsed.reason;
    }
    appendLog_(id, msg.getDate(), subject, parsed.type, result);
  });
}

function stripHtml_(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|td|h\d)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

function handleRequest_(p, messageId, summary) {
  var bookings = readBookings_();
  if (findDuplicateRequest_(bookings, p.student, p.startMs) >= 0) return '重複的請求，略過';

  var notes = [];
  var status = STATUS.PENDING;
  if (!classifyDuration_(p.durationMin)) {
    status = STATUS.MANUAL;
    notes.push('課長 ' + p.durationMin + ' 分鐘，不是 25 或 50，請人工確認');
    summary.manual++;
    summary.alerts.push('「' + p.student + '」' + formatMs_(p.startMs) + ' 的請求課長是 ' + p.durationMin + ' 分鐘（不是 25 或 50），請人工確認。');
  }

  var occEnd = occupiedEndMs_(p.startMs, p.durationMin);
  var clashes = bookings.filter(function (b) {
    return isActiveStatus_(b.status) && b.startMs !== null && b.occEndMs !== null &&
      rangesOverlap_(p.startMs, occEnd, b.startMs, b.occEndMs);
  });
  if (clashes.length) {
    var clashText = clashes.map(function (c) { return c.student + ' ' + formatMs_(c.startMs); }).join('、');
    notes.push('⚠ 與已有預約時間重疊：' + clashText);
    summary.alerts.push('⚠ 「' + p.student + '」' + formatMs_(p.startMs) + ' 的請求，與已有預約重疊：' + clashText);
  }

  var student = lookupStudent_(p.student);
  if (!student) notes.push('「學生」分頁沒有對應「' + p.student + '」，請補上');

  var fields = {
    '編號': newBookingId_(),
    '來源': SOURCE_AT,
    '學生': student ? student['姓名'] : p.student,
    '平台顯示名稱': p.student,
    '開始': new Date(p.startMs),
    '實際結束': new Date(p.endMs),
    '佔用結束': new Date(occEnd),
    '課長(分鐘)': p.durationMin,
    '狀態': status,
    '信件編號': messageId,
    '請求過期時間': p.expiresMs === null ? '' : new Date(p.expiresMs),
    '提醒已寄': false,
    '備註': notes.join('；'),
    '建立時間': new Date()
  };
  var rowIndex = appendBooking_(fields);

  // 不論是否需要人工確認，都先暫時佔位，避免這段時間被別人訂走
  fields.startMs = p.startMs;
  fields.occEndMs = occEnd;
  var eventId = syncEvent_(fields, 'tentative');
  updateBooking_(rowIndex, { '行事曆事件編號': eventId });

  summary.newRequests++;
  return '已建立預約 ' + fields['編號'] + '（' + status + '）';
}

function handleCancel_(p, messageId, summary) {
  var bookings = readBookings_();
  var idx = findCancelTarget_(bookings, p.student, p.startMs);

  if (idx >= 0) {
    var b = bookings[idx];
    removeEvent_(b['行事曆事件編號']);
    updateBooking_(b.rowIndex, { '狀態': STATUS.CANCELLED, '取消原因': p.reason, '行事曆事件編號': '' });
    summary.cancels++;
    return '已取消 ' + b['編號'];
  }

  appendBooking_({
    '編號': newBookingId_(),
    '來源': SOURCE_AT,
    '學生': p.student,
    '平台顯示名稱': p.student,
    '開始': new Date(p.startMs),
    '狀態': STATUS.MANUAL,
    '信件編號': messageId,
    '取消原因': p.reason,
    '備註': '收到取消信，但找不到原本的預約（可能是系統上線前就有的課），請人工確認行事曆',
    '建立時間': new Date()
  });
  summary.manual++;
  summary.alerts.push('「' + p.student + '」取消了 ' + formatMs_(p.startMs) + ' 的課，但試算表找不到這堂課，請確認行事曆。');
  return '找不到原預約，已建立「請人工確認」';
}

// ---------- 過期、對齊行事曆、提醒 ----------

function expirePending_(summary) {
  var now = Date.now();
  readBookings_().forEach(function (b) {
    if (b.status === STATUS.PENDING && isExpired_(now, b.expiresMs)) {
      removeEvent_(b['行事曆事件編號']);
      updateBooking_(b.rowIndex, {
        '狀態': STATUS.EXPIRED,
        '行事曆事件編號': '',
        '備註': (b['備註'] ? b['備註'] + '；' : '') + '請求已過期，未處理'
      });
      summary.expired++;
    }
  });
}

/** 讓行事曆跟「狀態」欄一致。可重複執行；只處理還沒過去的課。 */
function reconcileAll_() {
  var now = Date.now();
  readBookings_().forEach(function (b) {
    var action = statusAction_(b.status);
    var eventId = b['行事曆事件編號'];

    if (action === 'remove') {
      if (eventId) {
        removeEvent_(eventId);
        updateBooking_(b.rowIndex, { '行事曆事件編號': '' });
      }
      return;
    }
    if (action !== 'tentative' && action !== 'confirmed') return;
    if (b.startMs === null || b.occEndMs === null) return;
    if (b.occEndMs < now - 86400000) return; // 已經過去的課不再動

    var newId = syncEvent_(b, action);
    if (newId !== eventId) updateBooking_(b.rowIndex, { '行事曆事件編號': newId });
  });
}

function remindPending_(summary) {
  var now = Date.now();
  var due = readBookings_().filter(function (b) {
    return b.status === STATUS.PENDING &&
      needsReminder_(now, b.expiresMs, REMIND_HOURS_BEFORE_EXPIRY, b['提醒已寄'] === true);
  });
  if (!due.length) return;

  var lines = due.map(function (b) {
    return '・' + b['學生'] + '　上課時間 ' + formatMs_(b.startMs) + '　請求將在 ' + formatMs_(b.expiresMs) + ' 過期';
  });
  mailSelf_(
    '【泰時刻】' + due.length + ' 筆課時請求即將過期',
    '以下請求還沒處理。請到 AmazingTalker 確認或拒絕，再回試算表把「狀態」改成已確認或已拒絕：\n\n' + lines.join('\n')
  );
  due.forEach(function (b) { updateBooking_(b.rowIndex, { '提醒已寄': true }); });
  summary.reminded += due.length;
}

function mailSelf_(subject, body) {
  try {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), subject, body);
  } catch (e) {
    console.error('寄通知信失敗：' + e);
  }
}
