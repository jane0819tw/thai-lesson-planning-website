const vm = require('vm'), fs = require('fs'), assert = require('assert');
const ctx = {}; vm.createContext(ctx);
for (const f of ['Config.gs', 'Parser.gs', 'Slots.gs', 'Web.gs', 'Reminder.gs'])
  vm.runInContext(fs.readFileSync(__dirname + '/../src/' + f, 'utf8').replace(/^const /gm, 'var '), ctx);

// 連續的課合成一個時段區塊；同一位學生連續兩堂合成一行
const text = ctx.dayLessonsText_('2026-10-29', [
  { start: '2026-10-29 18:00', end: '2026-10-29 18:50', name: 'Amy' },
  { start: '2026-10-29 10:00', end: '2026-10-29 10:25', name: 'Jenny' },
  { start: '2026-10-29 10:30', end: '2026-10-29 10:55', name: 'Jenny' },
  { start: '2026-10-29 11:00', end: '2026-10-29 12:00', name: '王小明' },
  { start: '2026-10-29 19:00', end: '2026-10-29 21:00', name: 'Karen', pending: true },
]);
assert.strictEqual(text, [
  '10/29 週四上課',
  '10:00-12:00', '・10:00-10:55 Jenny', '・11:00-12:00 王小明',
  '18:00-21:00', '・18:00-18:50 Amy', '・19:00-21:00 Karen（待確認）',
].join('\n'));
assert.strictEqual(ctx.dayLessonsText_('2026-10-29', []), '');

// 午夜觸發有 ±15 分鐘誤差：23:45 和 00:15 都算「剛開始的那一天」
assert.strictEqual(ctx.reminderDate_('2026-10-28 23:45', 0), '2026-10-29');
assert.strictEqual(ctx.reminderDate_('2026-10-29 00:15', 0), '2026-10-29');
// 改成晚上 21 點推隔天
assert.strictEqual(ctx.reminderDate_('2026-10-28 20:45', 21), '2026-10-29');
assert.strictEqual(ctx.reminderDate_('2026-10-28 21:15', 21), '2026-10-29');
console.log('reminder tests ok');
