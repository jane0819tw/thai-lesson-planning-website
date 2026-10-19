/**
 * 學生可進入的課程（存在「學生」分頁的「可進入課程」欄，逗號分隔）。
 * 開放單位：
 *   reading:<n>  泰文認字課程，每 5 課一個單位（reading:1 ＝ L1–L5、reading:2 ＝ L6–L10 …）
 *   video 等     其他課程整門開放（代號對應網站 categories.ts 的 key）
 * 後端只檢查格式；有哪些單位由網站依課程數量決定。
 */
const COURSE_ID_RE = /^[a-z][a-z0-9-]*(:\d+)?$/;

function parseCourses_(v) {
  return String(v == null ? '' : v).split(/[,，\s]+/).filter(function (x) { return x; });
}

/** 檢查並去除重複；格式不對就丟錯 */
function cleanCourses_(list) {
  const seen = {}, out = [];
  (list || []).forEach(function (x) {
    x = String(x).trim();
    if (!COURSE_ID_RE.test(x)) throw new Error('課程代號格式不正確：' + x);
    if (!seen[x]) { seen[x] = true; out.push(x); }
  });
  return out;
}
