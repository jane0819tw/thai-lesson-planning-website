const TOKEN = QS.get('t') || '';
/* ---------------- 學生預約頁 ---------------- */
const S = { len: 25, month: null, date: null, time: null, view: null, msg: null, busy: false };

/* 進入教室：上課前 10 分鐘才出現按鈕，結束後 15 分鐘消失（時間皆為台北時間） */
const toMs = str => new Date(str.replace(' ', 'T') + ':00+08:00').getTime();
const hm = str => str.slice(11, 16);
function joinState(start, end) {
  const now = Date.now();
  return now < toMs(start) - 10 * 60000 ? 'early' : now > toMs(end) + 15 * 60000 ? 'over' : 'open';
}
function tickJoin() {
  document.querySelectorAll('[data-join]').forEach(b => { const st = joinState(b.dataset.start, b.dataset.end); b.hidden = st !== 'open'; });
}
setInterval(tickJoin, 15000);

async function initStudent() {
  try { S.view = await run('getStudentView', TOKEN); } catch (e) { return fail(e); }
  renderStudent();
}

function renderStudent() {
  const v = S.view;
  if (v.mode === 'invalid') return $app.innerHTML = '<h1>預約連結已失效</h1><p class="sub">請向老師索取新的預約連結。</p>';
  const fixed = v.lessons && v.lessons.len;
  if (fixed) S.len = fixed;
  const ok = sl => S.len === 25 ? sl.can25 : sl.can50;
  const days = v.days.map(d => ({ ...d, free: d.slots.some(ok) }));
  // 日期依月份分頁：只顯示選中月份的日期。月份沒選過就用第一個有空位的日子所在的月份
  const months = [...new Set(days.map(d => d.date.slice(0, 7)))];
  if (!months.includes(S.month)) { const f = days.find(d => d.free) || days[0]; S.month = f ? f.date.slice(0, 7) : null; }
  const monthDays = days.filter(d => d.date.slice(0, 7) === S.month);
  if (!monthDays.some(d => d.date === S.date && d.free)) { const f = monthDays.find(d => d.free); S.date = f ? f.date : null; S.time = null; }
  const monthLabel = m => (m.slice(0, 4) !== months[0].slice(0, 4) ? m.slice(0, 4) + '年' : '') + +m.slice(5) + '月';
  const cur = days.find(d => d.date === S.date);
  if (S.time && !(cur && cur.slots.some(sl => sl.time === S.time && ok(sl)))) S.time = null; // 重新整理後這格被約走了
  // 50 分鐘的課佔兩個半小時格：選了一格，下一格一起變色
  const second = S.len === 50 && S.time ? (m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'))(+S.time.slice(0, 2) * 60 + +S.time.slice(3) + 30) : null;
  // 每次點選都會整頁重畫，先記住日期列與頁面的捲動位置，重畫後還原（否則日期列會跳回最前面）
  const keepDays = $app.querySelector('.days'), daysLeft = keepDays ? keepDays.scrollLeft : 0, pageTop = window.scrollY;
  $app.innerHTML = `
    <h1>預約泰語課</h1>
    <p class="sub">${v.name ? `${esc(v.name)}，你好！` : ''}選擇課長與時段，送出後等老師確認，確認後可在這個頁面看到 Zoom 連結。時間皆為台北時間。</p>
    ${v.lessons ? `<div class="card"><h2>我的課程</h2><p style="margin:0"><strong style="font-size:1.4rem">剩餘 ${v.lessons.left} 堂</strong><br><span class="muted">${fixed ? `${fixed} 分鐘課程包・` : ''}已購 ${v.lessons.bought} 堂・已上 ${v.lessons.used} 堂${v.lessons.booked ? `・已預約 ${v.lessons.booked} 堂（尚未上課）` : ''}</span></p>
      ${v.lessons.left <= 0 ? '<p class="msg err" style="margin-bottom:0">課程堂數已用完，預約前請先和老師聯絡。</p>' : ''}</div>` : ''}
    ${(v.upcoming || []).length ? `<div class="card"><h2>我的預約</h2>${v.upcoming.map((u, i) => { const st = joinState(u.start, u.end);
      return `<div class="item"><div>${esc(u.start.slice(0, 10).replace(/-/g, '/'))} ${hm(u.start)}–${hm(u.end)}・${u.count > 1 ? `連續 ${u.count} 堂` : `${u.length} 分`}<div class="muted">${u.status === '已確認' ? '已確認' : '等待老師確認'}</div></div>
      ${u.status !== '已確認' ? '' : u.zoom ? `<button class="primary" data-join data-start="${u.start}" data-end="${u.end}" data-url="${esc(u.zoom)}" ${st === 'open' ? '' : 'hidden'}>進入教室</button>` : '<span class="muted">教室連結老師會另外提供</span>'}
      ${i === 0 && u.status === '已確認' && v.lastLesson && (v.lastLesson.next || v.lastLesson.progress) ? `<div class="lesson-note">
        ${v.lastLesson.next ? `<div><strong>這堂課內容</strong>　${esc(v.lastLesson.next)}</div>` : ''}
        ${v.lastLesson.progress ? `<div class="muted">上次上到（${esc(v.lastLesson.date.replace(/-/g, '/'))}）　${esc(v.lastLesson.progress)}</div>` : ''}</div>` : ''}</div>`; }).join('')}</div>` : ''}
    <div class="card"><h2>1. 課長</h2><div class="row">
      ${[25, 50].map(n => `<button data-len="${n}" class="${S.len === n ? 'sel' : ''}" ${fixed && fixed !== n ? 'disabled' : ''}>${n} 分鐘</button>`).join('')}</div></div>
    <div class="card"><div class="row" style="justify-content:space-between;margin-bottom:12px"><h2 style="margin:0">2. 日期與時間</h2>
      <span class="row"><span class="muted">最後更新 ${esc((v.asOf || S.fetched || '').slice(5, 16).replace('-', '/'))}</span><button id="sync">重新整理時段</button></span></div>
      ${months.length > 1 ? `<div class="row" style="margin-bottom:10px">${months.map(m => `<button data-month="${m}" class="${m === S.month ? 'sel' : ''}">${monthLabel(m)}</button>`).join('')}</div>` : ''}
      ${days.length ? `<div class="days">${monthDays.map(d => `<button data-date="${d.date}" class="${d.date === S.date ? 'sel' : ''}" ${d.free ? '' : 'disabled'}>${dayLabel(d.date)}${d.free ? '' : `<br><span class="tag">${esc(d.closed ? d.label : '已滿')}</span>`}</button>`).join('')}</div>
      ${cur ? `<div class="slots">${cur.slots.map(s => `<button data-time="${s.time}" class="${s.time === S.time || s.time === second ? 'sel' : ''}" ${ok(s) ? '' : 'disabled'}>${s.time}</button>`).join('')}</div>` : '<p class="muted">這個課長目前沒有可預約的時段，換個課長或稍後再來看看。</p>'}`
      : '<p class="muted">目前沒有開放的時段，請稍後再來看看。</p>'}</div>
    ${S.time ? `<div class="card"><h2>3. 確認送出</h2>
      <p>${S.date} ${S.time}，${S.len} 分鐘</p>
      ${v.mode === 'generic' ? `<label>姓名</label><input class="full" id="nm" autocomplete="name"><label>Email（確認信會寄到這裡）</label><input class="full" id="em" type="email" autocomplete="email">` : ''}
      <button class="primary" id="go" ${S.busy ? 'disabled' : ''}>${S.busy ? '送出中…' : '送出預約'}</button></div>` : ''}
    ${S.msg ? `<div class="msg ${S.msg.ok ? 'ok' : 'err'}">${esc(S.msg.text)}</div>` : ''}`;
  const nd = $app.querySelector('.days'); if (nd) nd.scrollLeft = daysLeft;
  window.scrollTo(0, pageTop);
  $app.querySelectorAll('[data-len]').forEach(b => b.onclick = () => { S.len = +b.dataset.len; S.time = null; S.msg = null; renderStudent(); });
  $app.querySelectorAll('[data-month]').forEach(b => b.onclick = () => { S.month = b.dataset.month; S.time = null; S.msg = null; renderStudent(); });
  $app.querySelectorAll('[data-date]').forEach(b => b.onclick = () => { S.date = b.dataset.date; S.time = null; renderStudent(); });
  $app.querySelectorAll('[data-time]').forEach(b => b.onclick = () => { S.time = b.dataset.time; S.msg = null; renderStudent(); });
  $app.querySelectorAll('[data-join]').forEach(b => b.onclick = () => window.open(b.dataset.url, '_blank', 'noopener'));
  document.getElementById('sync').onclick = async () => {
    try { S.view = await run('getStudentView', TOKEN); S.msg = null; } catch (e) { S.msg = { ok: false, text: e.message }; }
    renderStudent();
  };
  const go = document.getElementById('go');
  if (go) go.onclick = async () => {
    const nm = document.getElementById('nm'), em = document.getElementById('em');
    S.busy = true; renderStudent();
    try {
      await run('submitBooking', TOKEN, nm ? nm.value : '', em ? em.value : '', `${S.date} ${S.time}`, S.len);
      S.msg = { ok: true, text: '已送出！老師確認後，這個頁面的「我的預約」會出現 Zoom 連結。' }; S.time = null;
    } catch (e) { S.msg = { ok: false, text: e.message }; }
    S.busy = false;
    try { S.view = await run('getStudentView', TOKEN); } catch (e) {}
    renderStudent();
  };
}


initStudent();
