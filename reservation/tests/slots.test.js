const vm = require('vm'), fs = require('fs'), assert = require('assert');
const ctx = {}; vm.createContext(ctx);
for (const f of ['Config.gs', 'Parser.gs', 'Slots.gs'])
  vm.runInContext(fs.readFileSync(__dirname + '/../src/' + f, 'utf8').replace(/^const /gm, 'var '), ctx);

const rules = [{ type: '每週', weekday: 2, start: '19:00', end: '21:00' }, { type: '單次', date: '2026-10-24', start: '10:00', end: '11:00' }];
const t = r => Array.from(r.slots, s => s.time);
const open = r => Array.from(r.slots.filter(s => s.can25), s => s.time);
// 2026-10-20 是週二
let r = ctx.computeOpenSlots_(['2026-10-20', '2026-10-21', '2026-10-24'], rules, [], '2026-10-13 00:00');
assert.strictEqual(r.length, 2); // 10/21 沒有任何開放窗口，不回傳
assert.deepStrictEqual(t(r[0]), ['19:00', '19:30', '20:00', '20:30']);
assert.deepStrictEqual(Array.from(r[0].slots, s => s.can50), [true, true, true, false]);
assert.deepStrictEqual(t(r[1]), ['10:00', '10:30']);

// 行事曆 19:30–20:00 被佔：該格仍顯示但不可選；19:00 只能 25 分鐘
r = ctx.computeOpenSlots_(['2026-10-20'], rules, [{ start: '2026-10-20 19:30', end: '2026-10-20 20:00' }], '2026-10-13 00:00');
assert.deepStrictEqual(Array.from(r[0].slots, s => [s.time, s.can25, s.can50]),
  [['19:00', true, false], ['19:30', false, false], ['20:00', true, true], ['20:30', true, false]]);

// 佔用跨格（19:45–20:15 → 19:30、20:00 都不能選）
r = ctx.computeOpenSlots_(['2026-10-20'], rules, [{ start: '2026-10-20 19:45', end: '2026-10-20 20:15' }], '2026-10-13 00:00');
assert.deepStrictEqual(open(r[0]), ['19:00', '20:30']);

// 最短提前時間：已過的格子不顯示
r = ctx.computeOpenSlots_(['2026-10-20'], rules, [], '2026-10-20 20:00');
assert.deepStrictEqual(t(r[0]), ['20:00', '20:30']);

// 休假：整天關閉並顯示說明；行事曆整天行程也視為休假
r = ctx.computeOpenSlots_(['2026-10-20'], rules.concat({ type: '休假', date: '2026-10-20', label: '出國' }), [], '2026-10-13 00:00');
assert.deepStrictEqual([r[0].closed, r[0].label, r[0].slots.length], ['休假', '出國', 0]);
r = ctx.computeOpenSlots_(['2026-10-20'], rules, [{ start: '2026-10-20 00:00', end: '2026-10-21 00:00', allDay: true }], '2026-10-13 00:00');
assert.deepStrictEqual([r[0].closed, r[0].label], ['休假', '休假']);
// 限定：該日忽略每週常規，只開指定時段
r = ctx.computeOpenSlots_(['2026-10-20'], rules.concat({ type: '限定', date: '2026-10-20', start: '20:00', end: '21:00' }), [], '2026-10-13 00:00');
assert.deepStrictEqual(t(r[0]), ['20:00', '20:30']);
console.log('slots tests passed');
