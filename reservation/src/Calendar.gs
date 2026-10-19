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

/** 讓行事曆符合這筆預約的狀態；可重複呼叫。會修改 b['行事曆事件編號']，呼叫端負責寫回。 */
function syncCalendarEvent_(b) {
  const cal = getCal_();
  const evId = b['行事曆事件編號'];
  const ev = evId ? cal.getEventById(evId) : null;
  const active = b['狀態'] === STATUS.PENDING || b['狀態'] === STATUS.CONFIRMED;

  if (!active) {
    if (ev) ev.deleteEvent();
    b['行事曆事件編號'] = '';
    return;
  }
  const start = new Date(b['開始']);
  const end = new Date(b['佔用結束']);
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

function eventDescription_(b) {
  return '來源：' + b['來源'] + '\n實際上課：' + b['課長'] + ' 分鐘\n編號：' + b['編號'] + (b['Zoom連結'] ? '\nZoom：' + b['Zoom連結'] : '');
}
