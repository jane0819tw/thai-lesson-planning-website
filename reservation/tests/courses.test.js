const vm = require('vm'), fs = require('fs'), assert = require('assert');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/../src/Courses.gs', 'utf8').replace(/^const /gm, 'var '), ctx);
const arr = x => Array.from(x);

assert.deepStrictEqual(arr(ctx.parseCourses_('reading:1,reading:2, video')), ['reading:1', 'reading:2', 'video']);
assert.deepStrictEqual(arr(ctx.parseCourses_('reading:1，video')), ['reading:1', 'video']); // 全形逗號
assert.deepStrictEqual(arr(ctx.parseCourses_('')), []);
assert.deepStrictEqual(arr(ctx.parseCourses_(null)), []);
assert.deepStrictEqual(arr(ctx.parseCourses_(undefined)), []);
assert.deepStrictEqual(arr(ctx.cleanCourses_(['reading:1', 'reading:1', ' video '])), ['reading:1', 'video']); // 去重、去空白
assert.deepStrictEqual(arr(ctx.cleanCourses_([])), []);
assert.deepStrictEqual(arr(ctx.cleanCourses_(null)), []);
for (const bad of ['Reading:1', 'reading:', 'reading:x', '1reading', 'a b', 'reading:1;drop']) assert.throws(() => ctx.cleanCourses_([bad]), /格式不正確/, bad);
console.log('courses tests passed');
