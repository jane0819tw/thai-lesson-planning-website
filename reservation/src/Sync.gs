/** 主流程：Gmail 標籤 → 試算表 → 行事曆。 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('泰時刻約課')
    .addItem('立即同步 AmazingTalker 信件', 'syncNow')
    .addItem('初始化（建立分頁與觸發器）', 'setup')
    .addToUi();
}

/** 第一次使用請執行一次。 */
function setup() {
  setupSheets_();
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncNow').timeBased().everyMinutes(CONFIG.SYNC_EVERY_MINUTES).create();
  ScriptApp.newTrigger('onStatusEdit').forSpreadsheet(getSs_()).onEdit().create();
  syncNow();
}

function syncNow() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    setupSheets_();
    const problems = [];
    importMails_(problems);
    expireAndRemind_(problems);
    if (problems.length) notify_('AmazingTalker 同步需要人工確認', problems.join('\n\n'));
  } finally { lock.releaseLock(); }
}

function importMails_(problems) {
  const label = GmailApp.getUserLabelByName(CONFIG.GMAIL_LABEL);
  if (!label) { problems.push('找不到 Gmail 標籤「' + CONFIG.GMAIL_LABEL + '」，請先設定篩選條件。'); return; }
  const done = processedIds_();
  const cutoff = CONFIG.IMPORT_AFTER ? parseLocal_(CONFIG.IMPORT_AFTER + ' 00:00').getTime() : 0;
  const msgs = [];
  label.getThreads(0, 50).forEach(function (th) {
    th.getMessages().forEach(function (m) { if (!done[m.getId()]) msgs.push(m); });
  });
  // 舊到新處理，取消信才找得到先前的請求
  msgs.sort(function (a, b) { return a.getDate().getTime() - b.getDate().getTime(); });
  msgs.forEach(function (m) {
    if (m.getDate().getTime() < cutoff) { logMail_(m.getId(), 'skip', '早於 IMPORT_AFTER，略過', m.getSubject()); return; }
    const result = handleMail_(m, problems);
    logMail_(m.getId(), result.type, result.note, m.getSubject());
  });
}

function handleMail_(m, problems) {
  const p = parseAmazingTalkerMail(m.getSubject(), m.getPlainBody());
  const id = m.getId();
  if (p.type === 'ignore') return { type: 'ignore', note: '非課時請求／取消信' };

  if (p.type === 'error') {
    problems.push('無法解析信件：' + m.getSubject() + '\n原因：' + p.reason);
    return { type: 'error', note: p.reason };
  }

  if (p.type === 'request') {
    const dup = findActive_(p.student, p.start);
    if (dup) return { type: 'request', note: '重複請求，略過（' + dup['編號'] + '）' };
    const b = {
      '編號': nextBookingId_(), '來源': 'AmazingTalker',
      '學生': resolveStudent_(p.student), '平台顯示名稱': p.student,
      '開始': parseLocal_(p.start), '實際結束': parseLocal_(p.end),
      '佔用結束': parseLocal_(addMinutesStr_(p.start, p.occupiedMin)),
      '課長': p.durationMin, '狀態': STATUS.CONFIRMED, '信件編號': id, // 平台請求預設視為已成立；老師主動取消時在管理頁改成「已取消」
      '請求過期時間': p.expires ? parseLocal_(p.expires)
        : new Date(m.getDate().getTime() + CONFIG.REQUEST_VALID_HOURS * 3600000),
      '建立時間': new Date(),
    };
    if (!p.lengthOk) {
      b['狀態'] = STATUS.MANUAL;
      b['備註'] = '課長 ' + p.durationMin + ' 分鐘不是 25／50，請人工確認';
      problems.push(p.student + ' ' + p.start + '：' + b['備註']);
    } else {
      syncCalendarEvent_(b);
    }
    writeBooking_(b);
    return { type: 'request', note: b['編號'] + ' ' + b['狀態'] };
  }

  // cancel
  const hit = findActive_(p.student, p.start);
  if (!hit) {
    problems.push('取消信找不到原預約：' + p.student + ' ' + p.start + '（原因：' + p.reason + '）');
    return { type: 'cancel', note: '找不到原預約，請人工確認' };
  }
  hit['狀態'] = STATUS.CANCELLED;
  hit['取消原因'] = p.reason;
  syncCalendarEvent_(hit);
  writeBooking_(hit);
  return { type: 'cancel', note: hit['編號'] + ' 已取消' };
}

/** 用「平台顯示名稱 + 開始時間」找尚未釋放的預約 */
function findActive_(displayName, startStr) {
  const t = parseLocal_(startStr).getTime();
  const rows = readBookings_();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const active = r['狀態'] === STATUS.PENDING || r['狀態'] === STATUS.CONFIRMED;
    if (active && r['平台顯示名稱'] === displayName && r['開始'] && new Date(r['開始']).getTime() === t) return r;
  }
  return null;
}

/** 到期的改為已過期並釋放；到期前約 4 小時寄提醒（每筆一次，同批合併成一封）。 */
function expireAndRemind_(problems) {
  const now = Date.now();
  const toRemind = [];
  readBookings_().forEach(function (b) {
    if (b['狀態'] !== STATUS.PENDING || !b['請求過期時間']) return;
    const exp = new Date(b['請求過期時間']).getTime();
    if (now >= exp) {
      b['狀態'] = STATUS.EXPIRED;
      syncCalendarEvent_(b);
      writeBooking_(b);
    } else if (!b['提醒已寄'] && now >= exp - CONFIG.REMINDER_HOURS_BEFORE_EXPIRY * 3600000) {
      toRemind.push(b);
    }
  });
  if (!toRemind.length) return;
  const lines = toRemind.map(function (b) {
    return '・' + b['學生'] + '　' + toLocalStr_(b['開始']) + '（' + b['課長'] + '分）　過期：' + toLocalStr_(b['請求過期時間']);
  });
  notify_('有 ' + toRemind.length + ' 筆 AmazingTalker 請求即將過期',
    lines.join('\n') + '\n\n請到 AmazingTalker 處理，並回試算表標記「已確認」或「已拒絕」。');
  toRemind.forEach(function (b) { b['提醒已寄'] = new Date(); writeBooking_(b); });
}

/** 安裝式 onEdit：Jane 改「狀態」下拉選單後，行事曆立刻跟上。 */
function onStatusEdit(e) {
  const sh = e.range.getSheet();
  if (sh.getName() !== CONFIG.SHEETS.BOOKINGS || e.range.getRow() < 2) return;
  if (e.range.getColumn() !== BOOKING_HEADERS.indexOf('狀態') + 1) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const row = e.range.getRow();
    const b = rowToObj_(sh.getRange(row, 1, 1, BOOKING_HEADERS.length).getValues()[0], row);
    applyStatusChange_(b);
  } finally { lock.releaseLock(); }
}

/** 狀態改變後的共同處理：行事曆、私下學生建檔、寫回試算表 */
function applyStatusChange_(b) {
  if (b['來源'] === '私下') {
    if (b['狀態'] === STATUS.CONFIRMED) confirmPrivate_(b);
    else if (b['狀態'] !== STATUS.PENDING) { clearRecordFor_(b); releaseZoom_(b); }
  }
  syncCalendarEvent_(b);
  writeBooking_(b);
}

function addNote_(b, text) { b['備註'] = (b['備註'] ? b['備註'] + '；' : '') + text; }

/**
 * 私下預約確認：建立 Zoom → 填進學生記錄表的下一堂 （不寄信）。
 * 每一步都可重複執行（已有連結不重建、記錄表已有連結不重寫），
 * 任何一步失敗都只記在備註，不會讓確認動作整個失敗。
 */
function confirmPrivate_(b) {
  const start = toLocalStr_(b['開始']);
  ensureStudent_(b['學生'], emailFromNote_(b['備註']));
  const student = readStudents_().filter(function (x) { return x.name === b['學生']; })[0];

  // 25 分鐘的課和同一位學生前後相連時，共用同一個 Zoom（把原本的會議延長），不另外開一場
  const nb = b['Zoom連結'] ? null : adjacentZoomBooking_(b);
  if (nb) {
    b['Zoom連結'] = nb['Zoom連結']; b['會議編號'] = nb['會議編號'];
    try { patchSharedZoom_(b['會議編號'], sharingBookings_(b['會議編號'], b['編號']).concat([b])); addNote_(b, '與前後相連的課共用同一個 Zoom'); }
    catch (e) { addNote_(b, 'Zoom 延長失敗：' + e.message); }
  } else if (!b['Zoom連結']) {
    if (!zoomConfigured_()) {
      addNote_(b, '尚未設定 Zoom 金鑰，未建立會議');
      notify_('尚未建立 Zoom：' + b['學生'], '請在「專案設定 → 指令碼屬性」設定 ZOOM_ACCOUNT_ID、ZOOM_CLIENT_ID、ZOOM_CLIENT_SECRET，再把這筆預約的狀態改一次。');
    } else {
      try {
        const m = zoomCreateMeeting_(zoomTopic_(b['學生'], start), start, b['課長']);
        b['Zoom連結'] = m.joinUrl; b['會議編號'] = m.id;
      } catch (e) {
        addNote_(b, 'Zoom 建立失敗：' + e.message);
        notify_('Zoom 建立失敗：' + b['學生'], e.message);
      }
    }
  }

  if (student && student['課程記錄表']) {
    try { addNote_(b, '記錄表：' + writeBookingToRecord_(student['課程記錄表'], start, b['課長'], b['Zoom連結'])); }
    catch (e) { addNote_(b, '記錄表寫入失敗：' + e.message); notify_('記錄表寫入失敗：' + b['學生'], e.message); }
  } else {
    addNote_(b, '尚未綁定學生的課程記錄表');
  }
}

/** 取消／拒絕／過期：先把記錄表裡那一堂清掉（要在 Zoom 連結被清空之前，才找得到對應的列） */
function clearRecordFor_(b) {
  const student = readStudents_().filter(function (x) { return x.name === b['學生']; })[0];
  if (!student || !student['課程記錄表']) return;
  try { addNote_(b, '記錄表：' + clearBookingFromRecord_(student['課程記錄表'], toLocalStr_(b['開始']), b['課長'], b['Zoom連結'])); }
  catch (e) { addNote_(b, '記錄表清除失敗：' + e.message); }
}

/** Zoom 會議名稱：「名字-日期」，例如 Fah-20261018 */
function zoomTopic_(name, startStr) {
  return String(name).trim() + '-' + startStr.slice(0, 10).replace(/-/g, '');
}

/** 同一場 Zoom 會議上的其他已確認預約（連續課共用會議時會有多筆） */
function sharingBookings_(meetingId, exceptId) {
  return readBookings_().filter(function (o) {
    return o['編號'] !== exceptId && String(o['會議編號']) === String(meetingId) && o['狀態'] === STATUS.CONFIRMED;
  });
}

/** 同一位學生、25 分鐘、前後緊接（佔用時段首尾相接）且已有 Zoom 的另一筆已確認預約；沒有回傳 null */
function adjacentZoomBooking_(b) {
  if (Number(b['課長']) !== 25) return null;
  const s = new Date(b['開始']).getTime(), e = new Date(b['佔用結束']).getTime();
  const rows = readBookings_();
  for (let i = 0; i < rows.length; i++) {
    const o = rows[i];
    if (o['編號'] === b['編號'] || o['來源'] !== '私下' || o['學生'] !== b['學生'] || o['狀態'] !== STATUS.CONFIRMED) continue;
    if (Number(o['課長']) !== 25 || !o['會議編號'] || !o['Zoom連結']) continue;
    if (new Date(o['佔用結束']).getTime() === s || new Date(o['開始']).getTime() === e) return o;
  }
  return null;
}

/** 把共用會議調成涵蓋 list 裡所有預約（從最早開始到最晚的實際結束） */
function patchSharedZoom_(meetingId, list) {
  if (!zoomConfigured_() || !list.length) return;
  let s = Infinity, e = 0;
  list.forEach(function (x) { s = Math.min(s, new Date(x['開始']).getTime()); e = Math.max(e, new Date(x['實際結束']).getTime()); });
  zoomPatchMeeting_(meetingId, toLocalStr_(new Date(s)), Math.round((e - s) / 60000));
}

/** 取消／拒絕／過期：刪除 Zoom 會議並清掉連結；若會議還有別的課共用，就只把會議縮回剩下的課 */
function releaseZoom_(b) {
  if (!b['會議編號']) return;
  try {
    const others = sharingBookings_(b['會議編號'], b['編號']);
    if (others.length) patchSharedZoom_(b['會議編號'], others); else zoomDeleteMeeting_(b['會議編號']);
    b['Zoom連結'] = ''; b['會議編號'] = '';
  } catch (e) { addNote_(b, 'Zoom 刪除失敗：' + e.message); }
}

/** 不寄任何信（確認信、老師通知都已停用）。保留函式讓呼叫處不用改；需要時只看試算表的「備註」與管理頁。 */
function notify_(subject, body) {}

/**
 * 一次性：把還沒上的 AmazingTalker 預約（待確認／已過期）改成已確認並放回行事曆。
 * 在 Apps Script 手動執行一次即可；「已取消」「已拒絕」不會動。
 */
function migrateAtToConfirmed() {
  const now = Date.now();
  let n = 0;
  readBookings_().forEach(function (b) {
    if (b['來源'] !== 'AmazingTalker') return;
    if ([STATUS.PENDING, STATUS.EXPIRED].indexOf(b['狀態']) < 0) return;
    if (!b['開始'] || new Date(b['開始']).getTime() < now) return;
    b['狀態'] = STATUS.CONFIRMED;
    syncCalendarEvent_(b);
    writeBooking_(b);
    n++;
  });
  Logger.log('已改成已確認：' + n + ' 筆');
}
