/**
 * 每天午夜（CONFIG.DAILY_REMINDER_HOUR）用 LINE 推播當天的課給老師，例如：
 *   10/29 週四上課
 *   10:00-12:00
 *   ・10:00-10:50 Jenny
 *   ・11:00-12:00 王小明
 * 觸發器由 setup() 建立（Sync.gs）。沒設定 LINE 或當天沒課就不推。
 */

const WEEKDAY_ZH_ = ['', '一', '二', '三', '四', '五', '六', '日'];

// ---- 純函式（可在 Node 測試）----

/**
 * @param date    'yyyy-MM-dd'
 * @param lessons [{start, end, name, pending}]（'yyyy-MM-dd HH:mm'；pending＝還沒確認）
 * 同一位學生連續的課（相隔≤5分）合成一行；課與課相隔≤10分鐘的算同一個時段區塊。沒有課回傳空字串。
 */
function dayLessonsText_(date, lessons) {
  if (!lessons.length) return '';
  const sorted = lessons.slice().sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
  const items = [];
  sorted.forEach(function (x) {
    const last = items[items.length - 1];
    if (last && last.name === x.name && last.pending === !!x.pending &&
        wallMinutes_(x.start) - wallMinutes_(last.end) <= 5 && x.start >= last.start) {
      if (x.end > last.end) last.end = x.end;
    } else items.push({ start: x.start, end: x.end, name: x.name, pending: !!x.pending });
  });
  const blocks = [];
  items.forEach(function (x) {
    const b = blocks[blocks.length - 1];
    if (b && wallMinutes_(x.start) - wallMinutes_(b.end) <= 10) {
      if (x.end > b.end) b.end = x.end;
      b.items.push(x);
    } else blocks.push({ start: x.start, end: x.end, items: [x] });
  });
  const p = date.split('-');
  const lines = [(+p[1]) + '/' + (+p[2]) + ' 週' + WEEKDAY_ZH_[weekdayOf_(date)] + '上課'];
  blocks.forEach(function (b) {
    lines.push(b.start.slice(11) + '-' + b.end.slice(11));
    b.items.forEach(function (x) { lines.push('・' + x.start.slice(11) + '-' + x.end.slice(11) + ' ' + x.name + (x.pending ? '（待確認）' : '')); });
  });
  return lines.join('\n');
}

/**
 * 這次推播是哪一天的課：觸發時間有 ±15 分鐘誤差，午夜觸發可能在 23:45 或 00:15 執行，都要算成「剛開始的那一天」。
 * 做法：把現在往回推到「提醒時刻」再加 12 小時取日期；提醒時刻在中午以後（例如 21 點推隔天）再加一天。
 */
function reminderDate_(nowStr, hour) {
  const d = addMinutesStr_(nowStr, (12 - hour) * 60).slice(0, 10);
  return hour >= 12 ? addDaysStr_(d, 1) : d;
}

// ---- Apps Script ----

/** 某一天所有的課：預約表的待確認／已確認，加上記錄表裡手寫、不在預約表的課 */
function lessonsOn_(date) {
  const out = readBookings_().filter(function (b) {
    return (b['狀態'] === STATUS.PENDING || b['狀態'] === STATUS.CONFIRMED) && b['開始'] && toLocalStr_(b['開始']).slice(0, 10) === date;
  }).map(function (b) {
    return { start: toLocalStr_(b['開始']), end: toLocalStr_(b['實際結束'] || b['開始']), name: b['學生'], pending: b['狀態'] === STATUS.PENDING };
  });
  recordOnlySessions_(date + ' 00:00').forEach(function (x) {
    if (x.start.slice(0, 10) === date) out.push({ start: x.start, end: x.end, name: x.name, pending: false });
  });
  return out;
}

/** 觸發器每天呼叫。同一天只推一次（重跑 setup 產生多個觸發器也不會重複）。 */
function sendDailyLessons() {
  if (!lineConfigured_()) return;
  const date = reminderDate_(toLocalStr_(new Date()), CONFIG.DAILY_REMINDER_HOUR);
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('DAILY_REMINDER_SENT') === date) return;
  const text = dayLessonsText_(date, lessonsOn_(date));
  if (text) notifyTeacher_(text);
  props.setProperty('DAILY_REMINDER_SENT', date);
}

/** 在 Apps Script 手動執行：立刻把「明天」的課推到 LINE（不影響每天的推播紀錄），沒有課也會推一則說明 */
function testDailyLessons() {
  if (!lineConfigured_()) throw new Error('請先在指令碼屬性設定 LINE_CHANNEL_TOKEN 與 LINE_USER_ID');
  const date = addDaysStr_(Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd'), 1);
  notifyTeacher_(dayLessonsText_(date, lessonsOn_(date)) || date + ' 沒有課（測試訊息）');
}

/**
 * 排查用：某天的課為什麼沒出現在推播裡。到「執行記錄」看三個來源各找到什麼。
 * 在 Apps Script 選這個函式執行即可（預設查明天；要查別天把 date 改成 '2026-10-27' 這種格式）。
 */
function debugDailyLessons(date) {
  date = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : addDaysStr_(Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd'), 1);
  const log = ['查詢日期：' + date, '', '【1. 預約分頁（所有狀態；只有待確認／已確認會推）】'];
  readBookings_().forEach(function (b) {
    if (b['開始'] && toLocalStr_(b['開始']).slice(0, 10) === date) {
      log.push('  ' + toLocalStr_(b['開始']).slice(11) + '　' + b['學生'] + '　來源：' + b['來源'] + '　狀態：' + b['狀態'] + '　編號：' + b['編號']);
    }
  });
  log.push('', '【2. 學生記錄表（上課記錄的上課日期）】');
  readStudents_().forEach(function (s) {
    if (!s['課程記錄表']) return;
    const rec = readRecordBundle_(s['課程記錄表']);
    if (!rec) { log.push('  ' + s.name + '：記錄表打不開'); return; }
    rec.sessions.forEach(function (x) { if (x.start.slice(0, 10) === date) log.push('  ' + x.start.slice(11) + '-' + x.end.slice(11) + '　' + s.name); });
  });
  log.push('', '【3. Google 行事曆（推播不會讀這裡，只列出來對照）】');
  getCal_().getEvents(parseLocal_(date + ' 00:00'), parseLocal_(addDaysStr_(date, 1) + ' 00:00')).forEach(function (ev) {
    log.push('  ' + (ev.isAllDayEvent() ? '整天' : toLocalStr_(ev.getStartTime()).slice(11) + '-' + toLocalStr_(ev.getEndTime()).slice(11)) + '　' + ev.getTitle());
  });
  log.push('', '【推播內容】', dayLessonsText_(date, lessonsOn_(date)) || '（沒有課，不會推）');
  Logger.log(log.join('\n'));
}
