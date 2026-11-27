/** 行事曆：待確認=暫定佔位，已確認=正式課程，其餘釋放（刪除事件）。 */

function getCal_() {
  const cal = CONFIG.CALENDAR_ID ? CalendarApp.getCalendarById(CONFIG.CALENDAR_ID) : CalendarApp.getDefaultCalendar();
  if (!cal) throw new Error('找不到行事曆');
  return cal;
}

function eventTitle_(b) {
  const base = b['學生'] + ' 泰語課（' + b['課長'] + '分）';
  return b['狀態'] === STATUS.CONFIRMED ? base : '【待確認】' + base;
}

/**
 * 讓行事曆符合這筆預約的狀態；可重複呼叫。會修改 b['行事曆事件編號']，呼叫端負責寫回。
 * 私下預約確認後（有 Zoom 連結、查得到學生 email）會把學生加為邀請對象：Google 寄邀請信，
 * 之後改時間、取消也經由 Calendar API 寄更新／取消信給學生（CalendarApp 不會通知受邀者）。
 */
function syncCalendarEvent_(b) {
  const cal = getCal_();
  const evId = b['行事曆事件編號'];
  const ev = evId ? cal.getEventById(evId) : null;
  const active = b['狀態'] === STATUS.PENDING || b['狀態'] === STATUS.CONFIRMED;
  const hasGuests = !!(ev && ev.getGuestList().length);

  if (!active) {
    if (ev) {
      if (hasGuests) {
        try { Calendar.Events.remove(calApiId_(), apiEventId_(evId), { sendUpdates: 'all' }); }
        catch (e) { addNote_(b, '行事曆取消通知失敗：' + e.message); ev.deleteEvent(); }
      } else ev.deleteEvent();
    }
    b['行事曆事件編號'] = '';
    return;
  }
  const start = new Date(b['開始']);
  const end = new Date(b['佔用結束']);
  const guest = guestEmailFor_(b);
  if (guest || hasGuests) {
    try { syncGuestEvent_(b, ev, guest, start, end); return; }
    catch (e) { addNote_(b, '行事曆邀請失敗：' + e.message); }
  }
  syncPlainEvent_(cal, b, ev, start, end);
}

/** 沒有受邀者的事件（老師自己看）：用 CalendarApp 直接改 */
function syncPlainEvent_(cal, b, ev, start, end) {
  if (ev) {
    ev.setTitle(eventTitle_(b));
    ev.setTime(start, end);
  } else {
    const created = cal.createEvent(eventTitle_(b), start, end, {
      description: eventDescription_(b),
    });
    b['行事曆事件編號'] = created.getId();
  }
  const e2 = cal.getEventById(b['行事曆事件編號']);
  e2.setDescription(eventDescription_(b));
  e2.setColor(b['狀態'] === STATUS.CONFIRMED ? CalendarApp.EventColor.GREEN : CalendarApp.EventColor.GRAY);
}

/** 有學生受邀的事件：只在內容真的變了才 patch，並寄通知給學生（避免每次同步都寄信） */
function syncGuestEvent_(b, ev, guest, start, end) {
  const calId = calApiId_();
  const want = {
    summary: eventTitle_(b),
    description: guestDescription_(b),
    start: { dateTime: start.toISOString(), timeZone: CONFIG.TZ },
    end: { dateTime: end.toISOString(), timeZone: CONFIG.TZ },
    colorId: b['狀態'] === STATUS.CONFIRMED ? '10' : '8', // 10＝綠、8＝灰，同 CalendarApp.EventColor
    attendees: guest ? [{ email: guest }] : [],
  };
  if (!ev) {
    const created = Calendar.Events.insert(want, calId, { sendUpdates: 'all' });
    b['行事曆事件編號'] = created.iCalUID;
    return;
  }
  const cur = Calendar.Events.get(calId, apiEventId_(ev.getId()));
  const patch = {};
  if (cur.summary !== want.summary) patch.summary = want.summary;
  if ((cur.description || '') !== want.description) patch.description = want.description;
  if (!sameTime_(cur.start, start) || !sameTime_(cur.end, end)) { patch.start = want.start; patch.end = want.end; }
  if (cur.colorId !== want.colorId) patch.colorId = want.colorId;
  const curEmails = (cur.attendees || []).map(function (a) { return String(a.email).toLowerCase(); }).sort().join(',');
  const wantEmails = want.attendees.map(function (a) { return a.email.toLowerCase(); }).join(',');
  if (curEmails !== wantEmails) patch.attendees = want.attendees;
  if (Object.keys(patch).length) Calendar.Events.patch(patch, calId, apiEventId_(ev.getId()), { sendUpdates: 'all' });
}

function sameTime_(t, date) { return !!(t && t.dateTime) && new Date(t.dateTime).getTime() === date.getTime(); }
function calApiId_() { return CONFIG.CALENDAR_ID || 'primary'; }
/** CalendarApp 的事件編號是 iCalUID（xxx@google.com），Calendar API 要用 @ 前面那段 */
function apiEventId_(icalId) { return String(icalId).split('@')[0]; }

/** 私下預約、已確認、已有 Zoom 連結，且查得到學生 email → 要邀請的 email；否則空字串 */
function guestEmailFor_(b) {
  if (b['來源'] !== '私下' || b['狀態'] !== STATUS.CONFIRMED || !b['Zoom連結']) return '';
  return studentEmailFor_(b);
}

/** 學生收到的邀請信會看到這段：不放來源、編號等內部資訊；行事曆時段含課後預留，寫清楚實際下課時間 */
function guestDescription_(b) {
  const startStr = toLocalStr_(b['開始']);
  const endHm = toLocalStr_(b['實際結束']).slice(11);
  const occupiedHm = toLocalStr_(b['佔用結束']).slice(11);
  return '泰語課 ' + b['課長'] + ' 分鐘\n上課時間：' + startStr + '–' + endHm +
    (occupiedHm !== endHm ? '\n（行事曆上的時段包含課後預留時間，實際 ' + endHm + ' 下課）' : '') +
    (b['Zoom連結'] ? '\n\nZoom 連結：' + b['Zoom連結'] : '');
}

function eventDescription_(b) {
  return '來源：' + b['來源'] + '\n實際上課：' + b['課長'] + ' 分鐘\n編號：' + b['編號'] + (b['Zoom連結'] ? '\nZoom：' + b['Zoom連結'] : '');
}
