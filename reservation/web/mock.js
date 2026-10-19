// 假資料：ENDPOINT 空白或網址帶 ?mock=1 時使用，資料只在記憶體裡。
(function () {
// 本機預覽用：假的 google.script.run，資料都在記憶體裡。
  const day = n => { const d = new Date(Date.now() + n * 864e5); return d.toISOString().slice(0, 10); };
  const sl = (...t) => t.map(([x, a, b]) => ({ time: x, can25: a, can50: b }));
  const db = {
    days: [
      { date: day(1), closed: '', label: '', slots: sl(['19:00', true, true], ['19:30', false, false], ['20:00', true, true], ['20:30', true, false]) },
      { date: day(2), closed: '休假', label: '出國', slots: [] },
      { date: day(3), closed: '', label: '', slots: sl(['10:00', false, false], ['10:30', false, false]) },
      { date: day(4), closed: '', label: '', slots: sl(['19:00', true, true], ['19:30', true, false]) },
    ],
    rules: [{ type: '每週', weekday: 2, date: '', start: '19:00', end: '21:00' }, { type: '單次', weekday: '', date: day(5), start: '10:00', end: '12:00' }, { type: '限定', weekday: '', date: day(6), start: '20:00', end: '21:00' }, { type: '休假', weekday: '', date: day(2), start: '', end: '', label: '出國' }],
    bookings: [{ id: 'B0020', source: '私下', name: 'Amy', start: day(1) + ' 19:00', length: 50, status: '待確認' }, { id: 'B0021', source: 'AmazingTalker', name: 'Jenny', start: day(2) + ' 21:00', length: 50, status: '已過期' }],
    pending: [{ id: 'B0020', name: 'Amy', start: day(1) + ' 19:00', length: 50, note: 'Email: amy@example.com' }],
    students: [{ name: 'Jenny', email: 'jenny@example.com', token: 'abc123', record: 'https://docs.google.com/spreadsheets/d/xxx' }],
  };
  const week = d => {
    const mon = new Date(Date.UTC(...(d || day(0)).split('-').map((x, i) => i === 1 ? x - 1 : +x))); mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay() || 7) - 1));
    const days = [0, 1, 2, 3, 4, 5, 6].map(i => { const t = new Date(mon.getTime() + i * 864e5).toISOString().slice(0, 10);
      return { date: t, closed: i === 5 ? '休假' : '', open: i === 1 || i === 3 ? [1140, 1170, 1200, 1230] : [], allDay: [], lessons: [], events: [] }; });
    days[1].lessons.push({ id: 'B1', name: 'Jenny', source: '私下', status: '已確認', len: 50, start: 1140, end: 1200 });
    days[1].lessons.push({ id: 'B2', name: 'Karen Kwok', source: 'AmazingTalker', status: '已確認', len: 25, start: 540, end: 570 });
    days[2].lessons.push({ id: 'B3', name: 'Amy', source: '私下', status: '待確認', len: 25, start: 1200, end: 1230 });
    days[3].lessons.push({ id: 'B4', name: 'Toro hsu', source: 'AmazingTalker', status: '待確認', len: 50, start: 600, end: 660 });
    days[4].events.push({ title: 'Ann-2026101 Zoom', start: 540, end: 600 });
    return { monday: days[0].date, today: day(0), days };
  };
  const api = {
    adminGetWeek: d => week(d),
    getStudentView: t => t === 'bad' ? { mode: 'invalid' } : { mode: t ? 'known' : 'generic', name: t ? 'Jenny' : '', days: db.days, asOf: new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' '),
      lastLesson: t ? { date: '2026-09-25', progress: '會話Level2L3第一頁', next: '會話Level2L3第2頁開始' } : null,
      lessons: t ? { bought: 10, used: 3, booked: 3, left: 7, len: 25, leftMinutes: 175 } : null,
      upcoming: t ? [
        { start: day(0) + ' ' + new Date(Date.now() + 8 * 3600000 + 5 * 60000).toISOString().slice(11, 16), end: day(0) + ' ' + new Date(Date.now() + 8 * 3600000 + 35 * 60000).toISOString().slice(11, 16), length: 25, count: 1, status: '已確認', zoom: 'https://zoom.us/j/123' },
        { start: day(2) + ' 09:00', end: day(2) + ' 10:00', length: 25, count: 2, status: '已確認', zoom: 'https://zoom.us/j/456' },
        { start: day(3) + ' 10:00', end: day(3) + ' 10:25', length: 25, count: 1, status: '待確認', zoom: '' }] : [] },
    submitBooking: (t, n, e, s, l) => { if (!t && !n) throw new Error('請填姓名'); return { ok: true }; },
    adminGetRecordSessions: () => [{ name: 'Ariel', start: day(3) + ' 09:00', end: day(3) + ' 09:30' }, { name: 'Ariel', start: day(3) + ' 09:30', end: day(3) + ' 10:00' }],
    adminCancelRecordLesson: () => true,
    adminGetState: () => JSON.parse(JSON.stringify(db)),
    adminSaveRules: r => { db.rules = r; return true; },
    adminSetStatus: (id, st) => { db.pending = db.pending.filter(p => p.id !== id); db.bookings.forEach(b => { if (b.id === id) b.status = st; }); return true; },
    adminCreateStudent: n => { if (!n) throw new Error('請填姓名'); db.students.push({ name: n, email: '', token: '' }); return true; },
    adminSetRecord: (n, u) => { db.students.forEach(s => { if (s.name === n) s.record = u; }); return true; },
    adminRenewLink: n => { db.students.forEach(s => { if (s.name === n) s.token = Math.random().toString(36).slice(2); }); return true; },
  };
  window.mockRun = (fn, args) => new Promise((res, rej) => setTimeout(() => { try { res(api[fn](...args)); } catch (e) { rej(e); } }, 150));
})();
