import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGs, tpe } from './load.js';

const gs = loadGs();
const S = gs.STATUS;
const AT = 'AmazingTalker';

test('課長判斷：25、50 以外不猜', () => {
  assert.equal(gs.classifyDuration_(25), 'short');
  assert.equal(gs.classifyDuration_(50), 'long');
  assert.equal(gs.classifyDuration_(30), null);
  assert.equal(gs.classifyDuration_(55), null);
});

test('行事曆佔用往上取整到 30 分鐘倍數', () => {
  assert.equal(gs.occupiedMinutes_(25), 30);
  assert.equal(gs.occupiedMinutes_(50), 60);
  assert.equal(gs.occupiedMinutes_(30), 30);
  assert.equal(gs.occupiedEndMs_(tpe(2026, 10, 15, 9, 30), 25), tpe(2026, 10, 15, 10, 0));
  assert.equal(gs.occupiedEndMs_(tpe(2026, 10, 15, 9, 30), 50), tpe(2026, 10, 15, 10, 30));
});

test('時間重疊：相接不算重疊', () => {
  const a0 = tpe(2026, 10, 15, 9, 30), a1 = tpe(2026, 10, 15, 10, 0);
  const b0 = tpe(2026, 10, 15, 10, 0), b1 = tpe(2026, 10, 15, 10, 30);
  assert.equal(gs.rangesOverlap_(a0, a1, b0, b1), false);
  assert.equal(gs.rangesOverlap_(a0, tpe(2026, 10, 15, 10, 1), b0, b1), true);
});

const start = tpe(2026, 10, 12, 22, 0);
const rows = () => [
  { student: '王小明', platformName: '學生A', source: AT, startMs: start, status: S.PENDING },
  { student: '王小明', platformName: '學生A', source: AT, startMs: start, status: S.CONFIRMED },
  { student: '李小華', platformName: '學生B', source: AT, startMs: start, status: S.CONFIRMED },
  { student: '學生A', platformName: '', source: '私下', startMs: start, status: S.CONFIRMED }
];

test('取消對應：用平台顯示名稱 + 開始時間，已確認優先', () => {
  assert.equal(gs.findCancelTarget_(rows(), '學生A', start), 1);
  assert.equal(gs.findCancelTarget_(rows(), ' 學生a ', start), 1); // 空白與大小寫不影響
});

test('取消對應：不同時間、已取消、私下來源都不算；找不到回傳 -1', () => {
  assert.equal(gs.findCancelTarget_(rows(), '學生A', start + 1800000), -1);
  const r = rows();
  r[0].status = S.CANCELLED; r[1].status = S.CANCELLED;
  assert.equal(gs.findCancelTarget_(r, '學生A', start), -1);
  assert.equal(gs.findCancelTarget_(rows(), '不存在的學生', start), -1);
});

test('重複請求偵測', () => {
  assert.equal(gs.findDuplicateRequest_(rows(), '學生A', start), 0);
  assert.equal(gs.findDuplicateRequest_(rows(), '學生A', start + 1), -1);
});

test('狀態 → 行事曆動作', () => {
  assert.equal(gs.statusAction_(S.PENDING), 'tentative');
  assert.equal(gs.statusAction_(S.CONFIRMED), 'confirmed');
  assert.equal(gs.statusAction_(S.REJECTED), 'remove');
  assert.equal(gs.statusAction_(S.EXPIRED), 'remove');
  assert.equal(gs.statusAction_(S.CANCELLED), 'remove');
  assert.equal(gs.statusAction_(S.MANUAL), 'keep');
});

test('過期與提醒時間', () => {
  const now = tpe(2026, 10, 12, 20, 0);
  const exp = tpe(2026, 10, 12, 23, 20);
  assert.equal(gs.isExpired_(now, exp), false);
  assert.equal(gs.isExpired_(exp, exp), true);
  assert.equal(gs.isExpired_(now, null), false);
  assert.equal(gs.needsReminder_(now, exp, 4, false), true);   // 剩 3 小時 20 分
  assert.equal(gs.needsReminder_(now, exp, 3, false), false);  // 還沒到 3 小時內
  assert.equal(gs.needsReminder_(now, exp, 4, true), false);   // 已寄過
  assert.equal(gs.needsReminder_(exp + 1, exp, 4, false), false); // 已過期不提醒
  assert.equal(gs.needsReminder_(now, null, 4, false), false);
});
