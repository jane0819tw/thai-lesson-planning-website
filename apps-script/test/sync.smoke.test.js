// 冒煙測試：用記憶體裡的假 Gmail / 試算表 / 行事曆跑完整流程，確認各檔案接得起來。
// 這不能取代在真實 Google 帳號上的第一次測試，只能抓到明顯的接線錯誤。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { fixture, tpe } from './load.js';

const dir = path.dirname(fileURLToPath(import.meta.url));

function makeWorld(now) {
  const sheets = {};
  const events = {};
  const mails = [];
  let nextEvent = 1;
  const messages = [];

  const makeSheet = (name) => {
    const rows = []; // rows[0] = header
    const sh = {
      name, rows,
      getLastRow: () => rows.length,
      getMaxRows: () => 1000,
      setFrozenRows() {},
      getRange(r, c, nr = 1, nc = 1) {
        const rng = {
          setValues(v) { v.forEach((row, i) => { rows[r - 1 + i] = rows[r - 1 + i] || []; row.forEach((x, j) => { rows[r - 1 + i][c - 1 + j] = x; }); }); return rng; },
          setValue(x) { rows[r - 1] = rows[r - 1] || []; rows[r - 1][c - 1] = x; return rng; },
          getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push((rows[r - 1 + i] || [])[c - 1 + j] ?? ''); out.push(row); } return out; },
          setFontWeight() { return rng; }, setDataValidation() { return rng; }, setNumberFormat() { return rng; }, insertCheckboxes() { return rng; },
          getSheet: () => sh, getColumn: () => c, getLastColumn: () => c + nc - 1
        };
        return rng;
      },
      appendRow(arr) { rows.push(arr); }
    };
    return sh;
  };

  const ctx = vm.createContext({
    console,
    Date, Math, JSON, Object, Array, String, Number, RegExp,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n) => sheets[n] || null,
        insertSheet: (n) => (sheets[n] = makeSheet(n))
      }),
      newDataValidation: () => { const b = { requireValueInList: () => b, setAllowInvalid: () => b, build: () => ({}) }; return b; }
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => { const p = {}; return { getProperty: (k) => p[k] || null, setProperty: (k, v) => { p[k] = v; } }; } },
    Utilities: {
      getUuid: () => 'abcdef12-0000-0000-0000-000000000000',
      formatDate: (d) => new Date(d.getTime() + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ')
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'jane@example.com' }) },
    MailApp: { sendEmail: (to, subject, body) => mails.push({ to, subject, body }) },
    CalendarApp: {
      EventColor: { GRAY: 'GRAY', PALE_GREEN: 'PALE_GREEN' },
      getCalendarById: () => null,
      getCalendarsByName: () => [],
      createCalendar: () => cal
    },
    GmailApp: {
      search: () => [{}],
      getMessagesForThreads: () => [messages]
    }
  });

  const cal = {
    getId: () => 'cal-1',
    createEvent(title, start, end) {
      const id = 'ev-' + nextEvent++;
      const ev = { id, title, start, end, color: null,
        getId: () => id, getTitle: () => ev.title, setTitle(t) { ev.title = t; },
        getStartTime: () => ev.start, getEndTime: () => ev.end, setTime(s, e) { ev.start = s; ev.end = e; },
        setColor(c) { ev.color = c; }, deleteEvent() { delete events[id]; } };
      events[id] = ev; return ev;
    },
    getEventById: (id) => events[id] || null
  };

  for (const f of ['Config.gs', 'Parser.gs', 'Logic.gs', 'Sheets.gs', 'CalendarOps.gs', 'Sync.gs']) {
    vm.runInContext(fs.readFileSync(path.join(dir, '..', f), 'utf8'), ctx, { filename: f });
  }
  vm.runInContext(`Date.now = () => ${now};`, ctx);

  const addMail = (fx, id, from = 'AmazingTalker <amazingtalker@mailer.amazingtalker.com>') => {
    const f = fixture(fx);
    messages.push({ getId: () => id, getSubject: () => f.subject, getPlainBody: () => f.body, getBody: () => f.body, getFrom: () => from, getDate: () => new Date(now) });
  };
  return { ctx, sheets, events, mails, addMail };
}

const now = tpe(2026, 10, 12, 20, 0);

test('請求信 → 試算表一列 + 行事曆暫定事件（佔 30 分鐘）', () => {
  const w = makeWorld(now);
  w.addMail('request-short.txt', 'm1');
  const s = w.ctx.syncAll();
  assert.equal(s.newRequests, 1);
  const booking = w.sheets['預約'].rows[1];
  const H = w.ctx.BOOKING_HEADERS;
  assert.equal(booking[H.indexOf('狀態')], '待確認');
  assert.equal(booking[H.indexOf('課長(分鐘)')], 25);
  const ev = Object.values(w.events)[0];
  assert.match(ev.title, /待確認/);
  assert.equal(ev.end.getTime() - ev.start.getTime(), 30 * 60000);
  assert.equal(ev.start.getTime(), tpe(2026, 10, 15, 9, 30));
});

test('同一封信重複同步，不會建立重複的課', () => {
  const w = makeWorld(now);
  w.addMail('request-short.txt', 'm1');
  w.ctx.syncAll();
  w.ctx.syncAll();
  assert.equal(w.sheets['預約'].rows.length, 2); // 標題列 + 1 筆
  assert.equal(Object.keys(w.events).length, 1);
});

test('長課請求佔 60 分鐘', () => {
  const w = makeWorld(now);
  w.addMail('request-long.txt', 'm1');
  w.ctx.syncAll();
  const ev = Object.values(w.events)[0];
  assert.equal(ev.end.getTime() - ev.start.getTime(), 60 * 60000);
});

test('Jane 把狀態改成已確認 → 事件變正式課程；改成已拒絕 → 事件被刪除', () => {
  const w = makeWorld(now);
  w.addMail('request-short.txt', 'm1');
  w.ctx.syncAll();
  const H = w.ctx.BOOKING_HEADERS;
  const row = w.sheets['預約'].rows[1];
  row[H.indexOf('狀態')] = '已確認';
  w.ctx.reconcileAll_();
  const ev = Object.values(w.events)[0];
  assert.doesNotMatch(ev.title, /待確認/);
  assert.equal(ev.color, 'PALE_GREEN');
  row[H.indexOf('狀態')] = '已拒絕';
  w.ctx.reconcileAll_();
  assert.equal(Object.keys(w.events).length, 0);
});

test('取消信對得到原預約 → 已取消、事件刪除、記下原因', () => {
  const w = makeWorld(now);
  // 先建立一筆 10/12 22:00 的已確認預約
  w.ctx.initSheets_();
  w.ctx.appendBooking_({
    '編號': 'B-old', '來源': 'AmazingTalker', '學生': '學生A', '平台顯示名稱': '學生A',
    '開始': new Date(tpe(2026, 10, 12, 22, 0)), '實際結束': new Date(tpe(2026, 10, 12, 22, 25)),
    '佔用結束': new Date(tpe(2026, 10, 12, 22, 30)), '課長(分鐘)': 25, '狀態': '已確認'
  });
  w.ctx.reconcileAll_();
  assert.equal(Object.keys(w.events).length, 1);
  w.addMail('cancel.txt', 'm2');
  const s = w.ctx.syncAll();
  assert.equal(s.cancels, 1);
  const H = w.ctx.BOOKING_HEADERS;
  const row = w.sheets['預約'].rows[1];
  assert.equal(row[H.indexOf('狀態')], '已取消');
  assert.match(row[H.indexOf('取消原因')], /1 hr lesson/);
  assert.equal(Object.keys(w.events).length, 0);
});

test('取消信找不到原預約 → 建立「請人工確認」並寄通知，不動行事曆', () => {
  const w = makeWorld(now);
  w.addMail('cancel.txt', 'm2');
  const s = w.ctx.syncAll();
  assert.equal(s.manual, 1);
  const H = w.ctx.BOOKING_HEADERS;
  assert.equal(w.sheets['預約'].rows[1][H.indexOf('狀態')], '請人工確認');
  assert.equal(w.mails.length, 1);
});

test('超過請求過期時間仍未處理 → 已過期、釋放時段', () => {
  const w = makeWorld(tpe(2026, 10, 12, 20, 0));
  w.addMail('request-short.txt', 'm1');
  w.ctx.syncAll();
  vm.runInContext(`Date.now = () => ${tpe(2026, 10, 12, 23, 30)};`, w.ctx);
  const s = w.ctx.syncAll();
  assert.equal(s.expired, 1);
  assert.equal(Object.keys(w.events).length, 0);
});

test('過期前 4 小時內寄一次提醒信，不重複寄', () => {
  const w = makeWorld(tpe(2026, 10, 12, 20, 0)); // 距 23:20 過期 3 小時 20 分
  w.addMail('request-short.txt', 'm1');
  w.ctx.syncAll();
  assert.equal(w.mails.length, 1);
  assert.match(w.mails[0].subject, /即將過期/);
  w.ctx.syncAll();
  assert.equal(w.mails.length, 1);
});

test('不是 AmazingTalker 寄的信會被略過', () => {
  const w = makeWorld(now);
  w.addMail('request-short.txt', 'm1', 'someone@example.com');
  const s = w.ctx.syncAll();
  assert.equal(s.newRequests, 0);
});

test('課長不是 25 / 50 → 請人工確認並寄通知', () => {
  const w = makeWorld(now);
  w.addMail('request-manual.txt', 'm1');
  const s = w.ctx.syncAll();
  assert.equal(s.manual, 1);
  const H = w.ctx.BOOKING_HEADERS;
  assert.equal(w.sheets['預約'].rows[1][H.indexOf('狀態')], '請人工確認');
  assert.ok(w.mails.length >= 1);
});
