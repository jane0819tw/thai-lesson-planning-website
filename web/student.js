const TOKEN = QS.get('t') || '';
/* ---------------- 學生預約頁 ---------------- */
const S = { len: 25, date: null, time: null, view: null, msg: null, busy: false };

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
  if (!days.some(d => d.date === S.date && d.free)) { const f = days.find(d => d.free); S.date = f && f.date; S.time = null; }
  const cur = days.find(d => d.date === S.date);
  if (S.time && !(cur && cur.slots.some(sl => sl.time === S.time && ok(sl)))) S.time = null; // 重新整理後這格被約走了
  // 50 分鐘的課佔兩個半小時格：選了一格，下一格一起變色
  const second = S.len === 50 && S.time ? (m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'))(+S.time.slice(0, 2) * 60 + +S.time.slice(3) + 30) : null;
  $app.innerHTML = `
    <h1>預約泰語課</h1>
    <p class="sub">${v.name ? `${esc(v.name)}，你好！` : ''}選擇課長與時段，送出後等老師確認，確認後可在這個頁面看到 Zoom 連結。時間皆為台北時間。</p>
    ${v.lessons ? `<div class="card"><h2>我的課程</h2><p style="margin:0"><strong style="font-size:1.4rem">剩餘 ${v.lessons.left} 堂</strong><br><span class="muted">${fixed ? `${fixed} 分鐘課程包・` : ''}已購 ${v.lessons.bought} 堂・已上 ${v.lessons.used} 堂</span></p>
      ${v.lessons.left <= 0 ? '<p class="msg err" style="margin-bottom:0">課程堂數已用完，預約前請先和老師聯絡。</p>' : ''}</div>` : ''}
    ${(v.upcoming || []).length ? `<div class="card"><h2>我的預約</h2>${v.upcoming.map(u => `<div class="item"><div>${esc(u.start.replace(/-/g, '/'))}・${u.length} 分<div class="muted">${u.status === '已確認' ? '已確認' : '等待老師確認'}</div></div>
      ${u.zoom ? `<a href="${esc(u.zoom)}" target="_blank" rel="noopener"><button class="primary">進入 Zoom</button></a>` : ''}</div>`).join('')}</div>` : ''}
    <div class="card"><h2>1. 課長</h2><div class="row">
      ${[25, 50].map(n => `<button data-len="${n}" class="${S.len === n ? 'sel' : ''}" ${fixed && fixed !== n ? 'disabled' : ''}>${n} 分鐘</button>`).join('')}</div></div>
    <div class="card"><div class="row" style="justify-content:space-between;margin-bottom:12px"><h2 style="margin:0">2. 日期與時間</h2>
      <span class="row"><span class="muted">最後更新 ${esc((v.asOf || S.fetched || '').slice(5, 16).replace('-', '/'))}</span><button id="sync">重新整理時段</button></span></div>
      ${days.length ? `<div class="days">${days.map(d => `<button data-date="${d.date}" class="${d.date === S.date ? 'sel' : ''}" ${d.free ? '' : 'disabled'}>${dayLabel(d.date)}${d.free ? '' : `<br><span class="tag">${esc(d.closed ? d.label : '已滿')}</span>`}</button>`).join('')}</div>
      ${cur ? `<div class="slots">${cur.slots.map(s => `<button data-time="${s.time}" class="${s.time === S.time || s.time === second ? 'sel' : ''}" ${ok(s) ? '' : 'disabled'}>${s.time}</button>`).join('')}</div>` : '<p class="muted">這個課長目前沒有可預約的時段，換個課長或稍後再來看看。</p>'}`
      : '<p class="muted">目前沒有開放的時段，請稍後再來看看。</p>'}</div>
    ${S.time ? `<div class="card"><h2>3. 確認送出</h2>
      <p>${S.date} ${S.time}，${S.len} 分鐘</p>
      ${v.mode === 'generic' ? `<label>姓名</label><input class="full" id="nm" autocomplete="name"><label>Email（確認信會寄到這裡）</label><input class="full" id="em" type="email" autocomplete="email">` : ''}
      <button class="primary" id="go" ${S.busy ? 'disabled' : ''}>${S.busy ? '送出中…' : '送出預約'}</button></div>` : ''}
    ${S.msg ? `<div class="msg ${S.msg.ok ? 'ok' : 'err'}">${esc(S.msg.text)}</div>` : ''}`;
  $app.querySelectorAll('[data-len]').forEach(b => b.onclick = () => { S.len = +b.dataset.len; S.time = null; S.msg = null; renderStudent(); });
  $app.querySelectorAll('[data-date]').forEach(b => b.onclick = () => { S.date = b.dataset.date; S.time = null; renderStudent(); });
  $app.querySelectorAll('[data-time]').forEach(b => b.onclick = () => { S.time = b.dataset.time; S.msg = null; renderStudent(); });
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
