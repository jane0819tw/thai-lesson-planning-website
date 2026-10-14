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
assert.strictEqual(ctx.findRecordRowToClear_(clr, '2026-10-14 09:00', '2026/10/14 09:00-09:50', 'https://us06web.zoom.us/j/1?pwd=a'), 1);
assert.strictEqual(ctx.findRecordRowToClear_([['2026/10/14 09:00-09:50', '']], '2026-10-14 09:00', '2026/10/14 09:00-09:50', ''), 0);
// 老師手寫「09:00-09:30」、我們寫「09:00-09:25」：開始時間相同就算同一堂
assert.strictEqual(ctx.findRecordRowToClear_([['2026/10/17 09:00-09:30', 'u'], ['2026/10/17 09:30-10:00', '']], '2026-10-17 09:30', '2026/10/17 09:30-09:55', 'u'), 1);
assert.strictEqual(ctx.findRecordRowToClear_(clr, '2026-11-01 09:00', '2026/11/01 09:00-09:50', 'https://zoom.us/j/999'), -1);

// ---- 已上 vs 已預約：日期時間還沒到的不算已上 ----
const L = [['0', ''], ['1', '2026/08/08 9:30-10:00'], ['2', '2026/09/25 21:00-21:30'], ['3', '2026/10/14 20:00-20:30'], ['4', '2026/10/17 09:00-09:30'], ['5', '2026/10/17 09:30-10:00'], ['6', '']];
const nowA = ctx.summarizeLessons_([['', '10堂課程包', '', 'V']], L, '2026-10-14 10:00', '10堂課程包/25分鐘');
assert.deepStrictEqual([nowA.bought, nowA.used, nowA.booked, nowA.left, nowA.len], [10, 2, 3, 8, 25]);
// 正在上課（結束時間還沒到）也不算已上；結束後才算
assert.strictEqual(ctx.summarizeLessons_([['', '10堂', '', 'V']], L, '2026-10-14 20:10').used, 2);
assert.strictEqual(ctx.summarizeLessons_([['', '10堂', '', 'V']], L, '2026-10-14 20:30').used, 3);
// 買課紀錄有寫分鐘就以它為準；A1 只是備用
assert.strictEqual(ctx.summarizeLessons_([['', '10堂 50分鐘', '', 'V']], L, '2026-10-14 10:00', '10堂課程包/25分鐘').len, 50);
assert.strictEqual(ctx.summarizeLessons_([['', '10堂', '', 'V']], L, '2026-10-14 10:00', '').len, null);
// 日期解析
assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.parseRecordRange_('2026/08/08 9:30-10:00'))), { start: '2026-08-08 09:30', end: '2026-08-08 10:00', dateOnly: false });
assert.strictEqual(ctx.parseRecordRange_('2026/08/08').dateOnly, true);
assert.strictEqual(ctx.parseRecordRange_('下週'), null);

// ---- 學生頁的我的預約：記錄表＋預約表合併、連續課合成一筆共用連結 ----
const rec = [{ start: '2026-10-17 09:00', end: '2026-10-17 09:30', link: 'https://zoom.us/j/1' }, { start: '2026-10-17 09:30', end: '2026-10-17 10:00', link: '' },
  { start: '2026-10-24 09:00', end: '2026-10-24 09:30', link: 'https://zoom.us/j/2' }, { start: '2026-09-25 21:00', end: '2026-09-25 21:30', link: 'https://zoom.us/j/old' }];
const bk = [{ start: '2026-10-17 09:00', end: '2026-10-17 09:25', zoom: 'https://zoom.us/j/1', status: '已確認', length: 25 },
  { start: '2026-11-01 10:00', end: '2026-11-01 10:25', zoom: '', status: '待確認', length: 25 }];
const ses = JSON.parse(JSON.stringify(ctx.buildSessions_(rec, bk, '2026-10-14 10:00')));
assert.strictEqual(ses.length, 3); // 過去的 9/25 不出現
assert.deepStrictEqual([ses[0].start, ses[0].end, ses[0].count, ses[0].zoom], ['2026-10-17 09:00', '2026-10-17 10:00', 2, 'https://zoom.us/j/1']);
assert.strictEqual(ses[1].zoom, 'https://zoom.us/j/2');
assert.deepStrictEqual([ses[2].status, ses[2].zoom], ['待確認', '']); // 待確認不給連結
// 預約表兩筆 25 分鐘相連（09:00–09:25、09:30–09:55）也合成一筆
const two = ctx.buildSessions_([], [{ start: '2026-10-20 09:00', end: '2026-10-20 09:25', zoom: 'z', status: '已確認', length: 25 }, { start: '2026-10-20 09:30', end: '2026-10-20 09:55', zoom: 'z', status: '已確認', length: 25 }], '2026-10-14 10:00');
assert.deepStrictEqual([two.length, two[0].count, two[0].end], [1, 2, '2026-10-20 09:55']);
// 不同連結、不同狀態不合併；課已結束超過 15 分鐘就不顯示，15 分鐘內仍顯示
assert.strictEqual(ctx.buildSessions_([], [{ start: '2026-10-20 09:00', end: '2026-10-20 09:25', zoom: 'a', status: '已確認', length: 25 }, { start: '2026-10-20 09:30', end: '2026-10-20 09:55', zoom: 'b', status: '已確認', length: 25 }], '2026-10-14 10:00').length, 2);
assert.strictEqual(ctx.buildSessions_(rec, [], '2026-10-17 10:10').length, 2);
assert.strictEqual(ctx.buildSessions_(rec, [], '2026-10-17 10:20').length, 1);
// ---- 最新一堂已上完的課內容（顯示在下一堂的教室區塊）----
const LL = [{ when: '2026/08/22 10:00-10:30', progress: '補充與歌曲', next: 'L3' }, { when: '2026/09/25 21:00-21:30', progress: '會話Level2L3第一頁', next: '會話Level2L3第2頁開始' },
  { when: '2026/10/17 09:00-09:30', progress: '', next: '' }, { when: '2026/10/20 09:00-09:30', progress: '', next: '預先寫的' }];
assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.pickLatestLesson_(LL, '2026-10-14 10:00'))), { date: '2026-09-25', progress: '會話Level2L3第一頁', next: '會話Level2L3第2頁開始' });
assert.strictEqual(ctx.pickLatestLesson_(LL, '2026-08-01 10:00'), null); // 還沒上過任何課
assert.strictEqual(ctx.pickLatestLesson_(LL, '2026-10-21 00:00').next, '預先寫的'); // 上完且有內容的最新一堂
console.log('record tests passed');
