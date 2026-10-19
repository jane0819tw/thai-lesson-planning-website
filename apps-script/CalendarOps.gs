/**
 * CalendarOps.gs — 專用行事曆的事件建立、更新、刪除。
 * 待確認 = 灰色、標題有【待確認】；已確認 = 綠色。
 */

function getCalendar_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('CALENDAR_ID');
  var cal = id ? CalendarApp.getCalendarById(id) : null;
  if (!cal) {
    var found = CalendarApp.getCalendarsByName(CALENDAR_NAME);
    cal = found.length ? found[0] : CalendarApp.createCalendar(CALENDAR_NAME, { timeZone: TZ });
    props.setProperty('CALENDAR_ID', cal.getId());
  }
  return cal;
}

function eventTitle_(b, action) {
  var who = b['學生'] || b['平台顯示名稱'] || '（未命名）';
  var len = b['課長(分鐘)'] ? ' ' + b['課長(分鐘)'] + '分' : '';
  if (action === 'tentative') return '【待確認】' + who + len;
  return who + len + '（' + b['來源'] + '）';
}

function eventDescription_(b) {
  return '編號：' + b['編號'] + '\n來源：' + b['來源'] + '\n由「泰時刻約課」試算表自動建立，請在試算表修改狀態。';
}

/**
 * 讓某筆預約在行事曆上的事件符合 action（'tentative' 或 'confirmed'）。
 * 沒有事件就建立，有就更新。回傳事件編號。
 */
function syncEvent_(b, action) {
  var cal = getCalendar_();
  var start = new Date(b.startMs);
  var end = new Date(b.occEndMs);
  var title = eventTitle_(b, action);
  var color = action === 'confirmed' ? CalendarApp.EventColor.PALE_GREEN : CalendarApp.EventColor.GRAY;
  var ev = b['行事曆事件編號'] ? cal.getEventById(b['行事曆事件編號']) : null;

  if (!ev) {
    ev = cal.createEvent(title, start, end, { description: eventDescription_(b) });
  } else {
    if (ev.getTitle() !== title) ev.setTitle(title);
    if (ev.getStartTime().getTime() !== start.getTime() || ev.getEndTime().getTime() !== end.getTime()) {
      ev.setTime(start, end);
    }
  }
  ev.setColor(color);
  return ev.getId();
}

function removeEvent_(eventId) {
  if (!eventId) return;
  try {
    var ev = getCalendar_().getEventById(eventId);
    if (ev) ev.deleteEvent();
  } catch (e) {
    // 事件已被手動刪除時忽略
  }
}
