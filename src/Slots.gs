/**
 * 可預約時段計算（純函式，可在 Node 測試）。
 * 時間皆為 Asia/Taipei 的 'yyyy-MM-dd HH:mm' 牆上時間字串。
 */

function wallMinutes_(str) {
  const p = str.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  return Date.UTC(+p[1], +p[2] - 1, +p[3], +p[4], +p[5]) / 60000;
}

function hhmmToMin_(s) { const p = String(s).split(':'); return (+p[0]) * 60 + (+p[1]); }

/** 'yyyy-MM-dd' → 1..7（週一..週日） */
function weekdayOf_(dateStr) {
  const p = dateStr.split('-');
  const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
  return d === 0 ? 7 : d;
}

/**
 * @param dates        ['2026-10-20', ...]
 * @param rules        [{type:'每週', weekday:2, start:'19:00', end:'21:00'}, {type:'單次'(加開)|'限定'(只開放這段，覆蓋常規), date, start, end}, {type:'休假', date, label}]
 * @param busy         [{start, end, allDay?}]  行事曆上已佔用；整天行程視為休假
 * @param earliestWall 現在 + 最短預約提前時間
 * @return [{date, closed:'' | '休假', label, slots:[{time, can25, can50}]}]
 *   slots 含該日所有開放窗口內的格子，已被佔用的 can25=false（前端顯示成灰色）。
 *   整天都沒有開放窗口、也不是休假的日子不回傳。
 */
function computeOpenSlots_(dates, rules, busy, earliestWall) {
  const slot = CONFIG.SLOT_MINUTES;
  const busyM = busy.map(function (b) { return [wallMinutes_(b.start), wallMinutes_(b.end)]; });
  const earliest = wallMinutes_(earliestWall);
  const out = [];

  dates.forEach(function (date) {
    const day0 = wallMinutes_(date + ' 00:00');
    const wd = weekdayOf_(date);
    const holiday = rules.filter(function (r) { return r.type === '休假' && r.date === date; })[0];
    const allDay = busy.some(function (b) { return b.allDay && wallMinutes_(b.start) < day0 + 1440 && wallMinutes_(b.end) > day0; });
    const open = {};
    // 該日有「限定」規則時，只採用單日規則，忽略每週常規
    const limited = rules.some(function (r) { return r.type === '限定' && r.date === date; });
    rules.forEach(function (r) {
      const applies = (r.type === '每週' && !limited && Number(r.weekday) === wd) ||
        ((r.type === '單次' || r.type === '限定') && r.date === date);
      if (!applies) return;
      for (let t = hhmmToMin_(r.start); t + slot <= hhmmToMin_(r.end); t += slot) open[t] = true;
    });
    const isOpen = function (t) {
      if (!open[t]) return false;
      const a = day0 + t, b = a + slot;
      if (a < earliest) return false;
      return !busyM.some(function (x) { return x[0] < b && x[1] > a; });
    };
    const times = Object.keys(open).map(Number).sort(function (a, b) { return a - b; });
    if (holiday || allDay) {
      out.push({ date: date, closed: '休假', label: holiday ? (holiday.label || '休假') : '休假', slots: [] });
      return;
    }
    const slots = times.filter(function (t) { return day0 + t >= earliest; }).map(function (t) {
      return { time: pad2_(Math.floor(t / 60)) + ':' + pad2_(t % 60), can25: isOpen(t), can50: isOpen(t) && isOpen(t + slot) };
    });
    if (slots.length) out.push({ date: date, closed: '', label: '', slots: slots });
  });
  return out;
}
