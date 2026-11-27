const vm = require('vm'), fs = require('fs'), assert = require('assert');
// toLocalStr_ 用 Utilities.formatDate；測試只需要 Asia/Taipei 的 yyyy-MM-dd HH:mm
const Utilities = { formatDate: (d, tz) => new Date(d.getTime() + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ') };
const ctx = { Utilities }; vm.createContext(ctx);
for (const f of ['Config.gs', 'Sheet.gs', 'Calendar.gs'])
  vm.runInContext(fs.readFileSync(__dirname + '/../src/' + f, 'utf8').replace(/^const /gm, 'var '), ctx);

const t = s => new Date(s + ':00+08:00');
const b = { '來源': '私下', '編號': 'B12', '課長': 25, '開始': t('2026-12-01T14:00'), '實際結束': t('2026-12-01T14:25'), '佔用結束': t('2026-12-01T14:30'), 'Zoom連結': 'https://zoom.us/j/1' };
const d = ctx.guestDescription_(b);
assert.strictEqual(d, '泰語課 25 分鐘\n上課時間：2026-12-01 14:00–14:25\n（行事曆上的時段包含課後預留時間，實際 14:25 下課）\n\nZoom 連結：https://zoom.us/j/1');
assert(!/B12|私下/.test(d), '學生看到的說明不能有內部資訊');
// 佔用結束＝實際結束時不加預留說明
assert(!/預留/.test(ctx.guestDescription_(Object.assign({}, b, { '佔用結束': b['實際結束'] }))));

// 只有私下、已確認、有 Zoom 連結才邀請
ctx.studentEmailFor_ = () => 'stu@example.com';
assert.strictEqual(ctx.guestEmailFor_(Object.assign({}, b, { '狀態': '已確認' })), 'stu@example.com');
assert.strictEqual(ctx.guestEmailFor_(Object.assign({}, b, { '狀態': '待確認' })), '');
assert.strictEqual(ctx.guestEmailFor_(Object.assign({}, b, { '狀態': '已確認', 'Zoom連結': '' })), '');
assert.strictEqual(ctx.guestEmailFor_(Object.assign({}, b, { '狀態': '已確認', '來源': 'AmazingTalker' })), '');
assert.strictEqual(ctx.apiEventId_('abc123@google.com'), 'abc123');
console.log('calendar tests ok');
