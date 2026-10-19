const vm = require('vm'), fs = require('fs'), assert = require('assert');
const ctx = {};
vm.createContext(ctx);
for (const f of ['Config.gs', 'Parser.gs']) {
  // const/let 不會掛到 context 上，改成 var 後在同一 context 執行
  vm.runInContext(fs.readFileSync(__dirname + '/../src/' + f, 'utf8').replace(/^const /gm, 'var '), ctx);
}
const parse = ctx.parseAmazingTalkerMail;

// 真實樣本（2026/10 兩封 PDF）
const REQ_BODY = '親愛的 Jane เจน 🌟 Teach Thai in Chinese 🌟 Thai\nLanguage Interview with Thai Band Experiences 🌟 ,\nJenny 發送一筆課時請求，時間為 2026/10/15 上午\n09:30-上午09:55(GMT+08:00)\n此請求將會在2026/10/12 下午11:20過期，請盡快至\nAmazingTalker 網站查看';
let r = parse('你有一筆課時請求 2026/10/15 上午09:30-上午09:55(GMT+08:00) 尚未確認', REQ_BODY);
assert.strictEqual(r.student, 'Jenny');
assert.strictEqual(r.expires, '2026-10-12 23:20');
r = parse('你有一筆課時請求 2026/10/15 上午09:30-上午09:55(GMT+08:00) 尚未確認', 'Jenny 發送一筆課時請求\n');
assert.deepStrictEqual([r.type, r.student, r.start, r.end, r.durationMin, r.occupiedMin, r.lengthOk],
  ['request', 'Jenny', '2026-10-15 09:30', '2026-10-15 09:55', 25, 30, true]);

r = parse('你有一筆課時請求 2026/10/15 下午02:00-下午02:50(GMT+08:00) 尚未確認', 'Amy 發送一筆課時請求');
assert.deepStrictEqual([r.start, r.durationMin, r.occupiedMin], ['2026-10-15 14:00', 50, 60]);

r = parse('你有一筆課時請求 2026/10/15 上午09:30-上午10:20(GMT+08:00) 尚未確認', 'Jenny 發送一筆課時請求');
assert.strictEqual(r.occupiedMin, 60); // 09:30–10:20 佔用 09:30–10:30

r = parse('你有一筆課時請求 2026/10/15 上午09:30-上午10:00(GMT+08:00) 尚未確認', 'Jenny 發送一筆課時請求');
assert.strictEqual(r.lengthOk, false); // 30 分鐘 → 人工確認

r = parse('您的學生Jenny取消了與您的預約課程', '親愛的Jane เจน 🌟 Thai\nLanguage Interview 🌟 ,\nJenny取消了與您在2026/10/12 下午10:00的課程\n取消原因:\nwanna have 1 hr lesson, so cancel to have another\ntime slot with 1 hour\n');
assert.deepStrictEqual([r.type, r.student, r.start], ['cancel', 'Jenny', '2026-10-12 22:00']);
assert.ok(r.reason.startsWith('wanna have 1 hr lesson'));

assert.strictEqual(parse('你有一筆課時請求 壞格式', 'x').type, 'error');
assert.strictEqual(parse('Hello', 'x').type, 'ignore');
assert.strictEqual(ctx.addMinutesStr_('2026-10-15 23:30', 60), '2026-10-16 00:30');
console.log('parser tests passed');
