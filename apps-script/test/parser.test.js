import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGs, fixture, tpe } from './load.js';

const gs = loadGs();
const parse = (name) => {
  const f = fixture(name);
  return gs.parseMessage(f.subject, f.body);
};

test('短課請求信：25 分鐘、學生名、過期時間', () => {
  const r = parse('request-short.txt');
  assert.equal(r.type, 'request');
  assert.equal(r.student, '學生A');
  assert.equal(r.startMs, tpe(2026, 10, 15, 9, 30));
  assert.equal(r.endMs, tpe(2026, 10, 15, 9, 55));
  assert.equal(r.durationMin, 25);
  assert.equal(r.expiresMs, tpe(2026, 10, 12, 23, 20));
  assert.equal(r.unconfirmed, true);
});

test('長課請求信：下午 2 點、50 分鐘', () => {
  const r = parse('request-long.txt');
  assert.equal(r.type, 'request');
  assert.equal(r.student, '學生B');
  assert.equal(r.startMs, tpe(2026, 10, 20, 14, 0));
  assert.equal(r.durationMin, 50);
  assert.equal(r.expiresMs, tpe(2026, 10, 19, 8, 5));
});

test('跨中午：上午 11:30 到下午 12:20 = 50 分鐘；學生名可含空格', () => {
  const r = parse('request-across-noon.txt');
  assert.equal(r.type, 'request');
  assert.equal(r.student, 'Lin Mei');
  assert.equal(r.startMs, tpe(2026, 10, 21, 11, 30));
  assert.equal(r.endMs, tpe(2026, 10, 21, 12, 20));
  assert.equal(r.durationMin, 50);
  assert.equal(r.expiresMs, tpe(2026, 10, 20, 12, 10));
});

test('取消信：學生名、只有開始時間、取消原因', () => {
  const r = parse('cancel.txt');
  assert.equal(r.type, 'cancel');
  assert.equal(r.student, '學生A');
  assert.equal(r.startMs, tpe(2026, 10, 12, 22, 0));
  assert.equal(r.reason, 'wanna have 1 hr lesson, so cancel to have another time slot with 1 hour');
});

test('不認得的信回傳 unknown，不亂猜', () => {
  const r = parse('other.txt');
  assert.equal(r.type, 'unknown');
});

test('標題是請求但內容缺時間 → unknown', () => {
  const r = gs.parseMessage('你有一筆課時請求', '學生A 發送一筆課時請求');
  assert.equal(r.type, 'unknown');
});

test('12 小時制換算', () => {
  assert.equal(gs.minutesOfDay_('上午', '12', '00'), 0);
  assert.equal(gs.minutesOfDay_('上午', '09', '30'), 570);
  assert.equal(gs.minutesOfDay_('下午', '12', '00'), 720);
  assert.equal(gs.minutesOfDay_('下午', '01', '05'), 785);
  assert.equal(gs.minutesOfDay_('晚上', '10', '00'), 1320);
  assert.equal(gs.minutesOfDay_(undefined, '14', '00'), 840);
});
