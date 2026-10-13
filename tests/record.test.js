const vm = require('vm'), fs = require('fs'), assert = require('assert');
const ctx = {}; vm.createContext(ctx);
for (const f of ['Config.gs', 'Parser.gs', 'Record.gs'])
  vm.runInContext(fs.readFileSync(__dirname + '/../src/' + f, 'utf8').replace(/^const /gm, 'var '), ctx);

// 依照 Jane 的真實記錄表（Ariel）：單人10堂、已收到 V，第 1–3 堂已上，第 4 堂有連結但還沒日期
const buys = [['2026/08/22', '單人10堂', '5000', 'V']];
const lessons = [['0', '', '會話L10'], ['1', '2026/09/02 20:00-21:00'], ['2', '2026/09/23 20:00-21:00'], ['3', '2026/09/29 20:30-21:30'],
  ['4', ''], ['5', ''], ['6', ''], ['7', ''], ['8', ''], ['9', ''], ['10', '']];
const sum = ctx.summarizeLessons_(buys, lessons);
assert.deepStrictEqual([sum.bought, sum.used, sum.left], [10, 3, 7]);
assert.strictEqual(ctx.nextLessonIndex_(lessons.map(r => [r[0], r[1]])), 4); // 第 4 堂（index 4）

// 還沒收到款：不算已購
assert.strictEqual(ctx.summarizeLessons_([['2026/10/01', '單人10堂', '5000', '']], lessons).bought, 0);
// 多筆購買、課程包用完
assert.strictEqual(ctx.summarizeLessons_([['', '單人10堂', '', 'V'], ['', '單人5堂', '', 'V']], []).bought, 15);
assert.strictEqual(ctx.nextLessonIndex_([['1', 'x'], ['2', 'y']]), -1);

assert.strictEqual(ctx.recordDateText_('2026-09-29 20:30', 60), '2026/09/29 20:30-21:30');
assert.strictEqual(ctx.recordDateText_('2026-09-29 23:30', 25), '2026/09/29 23:30-23:55');
// 課程包課長：類型寫「50分」→ 限 50；沒寫或混合 → null
const s50 = ctx.summarizeLessons_([['', '單人10堂 50分鐘', '', 'V']], lessons);
assert.deepStrictEqual([s50.len, s50.leftMinutes], [50, 350]);
assert.strictEqual(sum.len, null);
assert.strictEqual(ctx.summarizeLessons_([['', '10堂 50分', '', 'V'], ['', '5堂 25分', '', 'V']], []).len, null);
// 取消時找出要清的列：先比連結，再比我們寫的日期格式；手寫的其他列不碰
const clr = [['2026/09/02 20:00-21:00', ''], ['2026/10/14 09:00-09:50', 'https://us06web.zoom.us/j/1?pwd=a'], ['', '']];
assert.strictEqual(ctx.findRecordRowToClear_(clr, '2026/10/14 09:00-09:50', 'https://us06web.zoom.us/j/1?pwd=a'), 1);
assert.strictEqual(ctx.findRecordRowToClear_([['2026/10/14 09:00-09:50', '']], '2026/10/14 09:00-09:50', ''), 0);
assert.strictEqual(ctx.findRecordRowToClear_(clr, '2026/11/01 09:00-09:50', 'https://zoom.us/j/999'), -1);
console.log('record tests passed');
