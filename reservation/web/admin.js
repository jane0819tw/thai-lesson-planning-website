/* ---------------- 老師管理頁 ---------------- */
const linkOf = s => new URL('index.html?t=' + s.token, location.href).href;
const SECS = [['sched', '開放時段'], ['pending', '待確認'], ['bookings', '所有預約'], ['students', '學生']];
const secGet = () => { try { const v = localStorage.getItem('thaiskr_admin_sec'); return SECS.some(x => x[0] === v) ? v : 'sched'; } catch (e) { return 'sched'; } };
const A = { sec: secGet(), rec: null, st: null, msg: null, wk: null, wkDate: '', today: '', tab: 'cal', dirty: false, reg: {}, ov: {} };
const LO0 = 360, HI0 = 1440, H = 22, STEP = 30;
const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const hhmm = x => { const [h, m] = x.split(':').map(Number); return h * 60 + m; };
const wdOf = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).getUTCDay() || 7; };
const shiftDate = (d, n) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10); };
const fill = (set, a, b) => { for (let t = hhmm(a); t + STEP <= hhmm(b); t += STEP) set.add(t); };
const same = (a, b) => a.size === b.size && [...a].every(x => b.has(x));

/* 規則 ⇄ 草稿：每週 → reg[星期]；單日 → ov[日期]（休假＝closed；其餘存成實際開放的格子） */
function buildDraft(rules) {
  A.reg = {}; for (let w = 1; w <= 7; w++) A.reg[w] = new Set();
  A.ov = {};
  rules.filter(r => r.type === '每週').forEach(r => fill(A.reg[+r.weekday], r.start, r.end));
  const by = {};
  rules.filter(r => r.type !== '每週').forEach(r => (by[r.date] = by[r.date] || []).push(r));
  Object.keys(by).forEach(d => {
    const hol = by[d].find(r => r.type === '休假');
    if (hol) { A.ov[d] = { closed: true, label: hol.label || '休假', set: new Set() }; return; }
    const set = new Set(by[d].some(r => r.type === '限定') ? [] : A.reg[wdOf(d)]);
    by[d].forEach(r => fill(set, r.start, r.end));
    A.ov[d] = { closed: false, label: '', set };
  });
  A.dirty = false;
}
const effective = d => { const o = A.ov[d]; return o ? (o.closed ? new Set() : o.set) : A.reg[wdOf(d)]; };
function ranges(set) {
  const out = []; let s = null, p = null;
  [...set].sort((a, b) => a - b).forEach(t => { if (s === null) s = p = t; else if (t === p + STEP) p = t; else { out.push([s, p + STEP]); s = p = t; } });
  if (s !== null) out.push([s, p + STEP]); return out;
}
function serialize() {
  const rules = [], blank = { weekday: '', date: '', start: '', end: '', label: '' };
  for (let w = 1; w <= 7; w++) ranges(A.reg[w]).forEach(([a, b]) => rules.push({ ...blank, type: '每週', weekday: w, start: hm(a), end: hm(b) }));
  Object.keys(A.ov).sort().forEach(d => {
    if (d < (A.today || new Date().toISOString().slice(0, 10))) return; // 過去的單日設定不再保留
    const o = A.ov[d];
    if (o.closed || !o.set.size) rules.push({ ...blank, type: '休假', date: d, label: o.closed ? o.label : '休假' });
    else ranges(o.set).forEach(([a, b]) => rules.push({ ...blank, type: '限定', date: d, start: hm(a), end: hm(b) }));
  });
  return rules;
}

function setCell(key, m, on) {
  if (A.tab === 'reg') A.reg[key][on ? 'add' : 'delete'](m);
  else {
    const wd = wdOf(key);
    let o = A.ov[key];
    if (!o) o = A.ov[key] = { closed: false, label: '', set: new Set(A.reg[wd]) };
    if (o.closed) { o.closed = false; o.set = new Set(); }
    o.set[on ? 'add' : 'delete'](m);
    if (same(o.set, A.reg[wd])) delete A.ov[key];
  }
  A.dirty = true; updateBar();
}

function updateBar() {
  const el = document.getElementById('savebar'); if (!el) return;
  el.style.display = A.dirty ? 'flex' : 'none';
  el.innerHTML = A.dirty ? `<span>有尚未儲存的變更</span><span class="row"><button id="revert">還原</button><button class="primary" id="save">儲存</button></span>` : '';
  if (!A.dirty) return;
  document.getElementById('revert').onclick = () => { buildDraft(A.st.rules); A.msg = null; renderAdmin(); };
  document.getElementById('save').onclick = async () => {
    try { await run('adminSaveRules', serialize()); A.st = await run('adminGetState'); buildDraft(A.st.rules); flash(true, '已儲存開放時段'); }
    catch (e) { flash(false, e.message); }
  };
}

async function loadWeek(date) {
  A.wkDate = date; A.wk = null; renderGrid();
  try { A.wk = await run('adminGetWeek', date); A.wkDate = A.wk.monday; A.today = A.wk.today; }
  catch (e) { const el = document.getElementById('grid'); if (el) el.innerHTML = `<div class="msg err">${esc(e.message)}</div>`; return; }
  renderGrid();
}

function renderGrid() {
  const el = document.getElementById('grid'); if (!el) return;
  const reg = A.tab === 'reg';
  if (!reg && !A.wk) { el.innerHTML = '<p class="muted">載入中…</p>'; return; }
  const cols = reg
    ? [1, 2, 3, 4, 5, 6, 7].map(w => ({ key: w, head: `週${WD[w]}`, set: A.reg[w], lessons: [], events: [], closed: false, past: false }))
    : A.wk.days.map(d => ({ key: d.date, head: `週${WD[wdOf(d.date)]}<br>${+d.date.slice(5, 7)}/${+d.date.slice(8)}`, set: effective(d.date), lessons: d.lessons, events: d.events,
        closed: !!(A.ov[d.date] && A.ov[d.date].closed), label: A.ov[d.date] && A.ov[d.date].label, past: d.date < A.wk.today, today: d.date === A.wk.today, allDay: d.allDay }));
  let lo = LO0, hi = HI0;
  cols.forEach(c => { [...c.lessons, ...c.events].forEach(b => { lo = Math.min(lo, Math.floor(b.start / 60) * 60); }); [...c.set].forEach(t => { lo = Math.min(lo, Math.floor(t / 60) * 60); }); });
  const n = (hi - lo) / STEP, y = m => (m - lo) / STEP * H;
  const nav = reg ? '' : `<div class="row" style="margin-bottom:10px"><button id="wp">‹ 上週</button><button id="wt">本週</button><button id="wn">下週 ›</button><strong>${A.wk.days[0].date.replace(/-/g, '/')} – ${A.wk.days[6].date.replace(/-/g, '/')}</strong></div>`;
  el.innerHTML = `${nav}<div style="overflow-x:auto"><div class="g">
    <div class="gh" style="border-left:0"></div>
    ${cols.map(c => `<div class="gh ${c.today ? 'today' : ''}">${c.head}${c.closed ? `<span class="tag">${esc(c.label)}</span>` : ''}${(c.allDay || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
      ${reg || c.past ? '' : `<button class="mini" data-hol="${c.key}">${c.closed ? '取消休假' : '休假'}</button>`}</div>`).join('')}
    <div class="gt" style="height:${n * H}px">${Array.from({ length: (hi - lo) / 60 + 1 }, (_, i) => `<span style="top:${i * 2 * H}px">${hm(lo + i * 60)}</span>`).join('')}</div>
    ${cols.map(c => `<div class="gc ${c.closed ? 'closed' : ''}">
      ${Array.from({ length: n }, (_, i) => { const m = lo + i * STEP; return `<div class="cell ${c.set.has(m) ? 'on' : ''} ${c.past ? 'off' : ''}" data-k="${c.key}" data-m="${m}"></div>`; }).join('')}
      ${c.events.map(e => `<div class="gb ev" style="top:${y(e.start)}px;height:${y(e.end) - y(e.start) - 2}px">${esc(e.title)}</div>`).join('')}
      ${c.lessons.map(l => `<div class="gb ${l.source === '私下' ? 'priv' : 'at'} ${l.status === '待確認' ? 'pend' : ''}" style="top:${y(l.start)}px;height:${y(l.end) - y(l.start) - 2}px" title="${esc(l.name)} ${hm(l.start)} ${l.len}分 ${esc(l.status)}"><b>${esc(l.name)}</b>${l.end - l.start <= 30 ? ' ' : '<br>'}${hm(l.start)}${l.end - l.start <= 30 ? '' : `・${l.len}分${l.status === '待確認' ? '・待確認' : ''}`}</div>`).join('')}
    </div>`).join('')}
  </div></div>`;

  const colOf = k => cols.find(c => String(c.key) === String(k));
  el.onpointerdown = e => {
    if (e.pointerType !== 'mouse') return;
    const c = cellOf(e.target); if (!c) return;
    e.preventDefault(); paint = { on: !c.classList.contains('on') }; applyCell(c);
  };
  el.onpointerover = e => { if (paint) { const c = cellOf(e.target); if (c) applyCell(c); } };
  el.onclick = e => {
    const h = e.target.closest('[data-hol]');
    if (h) {
      const d = h.dataset.hol;
      if (A.ov[d] && A.ov[d].closed) delete A.ov[d];
      else { const label = prompt('休假說明（學生會在日期上看到）', '休假'); if (label === null) return; A.ov[d] = { closed: true, label: label || '休假', set: new Set() }; }
      A.dirty = true; updateBar(); return renderGrid();
    }
    if (e.pointerType === 'mouse') return; // 滑鼠已在 pointerdown 處理
    const c = cellOf(e.target); if (!c) return;
    paint = { on: !c.classList.contains('on') }; applyCell(c); paint = null;
  };
  function cellOf(t) { const c = t.closest && t.closest('.cell'); return c && !c.classList.contains('off') ? c : null; }
  function applyCell(c) {
    const col = colOf(c.dataset.k), m = +c.dataset.m, key = reg ? +c.dataset.k : c.dataset.k;
    // 補齊同一欄內，上一個格子到這一格之間被滑鼠跳過的格子
    const from = paint.last && paint.last.k === c.dataset.k ? paint.last.m : m;
    paint.last = { k: c.dataset.k, m };
    for (let t = Math.min(from, m); t <= Math.max(from, m); t += STEP) {
      const node = el.querySelector(`.cell[data-k="${c.dataset.k}"][data-m="${t}"]`);
      if (!node || node.classList.contains('off') || node.classList.contains('on') === paint.on) continue;
      setCell(key, t, paint.on);
      node.classList.toggle('on', paint.on);
    }
    if (col.closed) { paint = null; renderGrid(); }
  }
  if (!reg) {
    document.getElementById('wp').onclick = () => loadWeek(shiftDate(A.wk.monday, -7));
    document.getElementById('wn').onclick = () => loadWeek(shiftDate(A.wk.monday, 7));
    document.getElementById('wt').onclick = () => loadWeek('');
  }
}
let paint = null;
document.addEventListener('pointerup', () => { paint = null; });

function askKey(msg) {
  $app.innerHTML = `<h1>老師管理</h1><p class="sub">請輸入管理密鑰（在 Apps Script 執行 createAdminKey 取得）。密鑰只會存在這個瀏覽器。</p>
    ${msg ? `<div class="msg err">${esc(msg)}</div>` : ''}
    <div class="card"><input class="full" id="k" type="password" autocomplete="off" placeholder="管理密鑰"><button class="primary" id="kgo">進入</button></div>`;
  document.getElementById('kgo').onclick = () => { setKey(document.getElementById('k').value.trim()); initAdmin(); };
}
async function initAdmin() {
  if (!MOCK && !getKey()) return askKey('');
  try { A.st = await run('adminGetState'); }
  catch (e) { if (/密鑰/.test(e.message)) { setKey(''); return askKey(e.message); } return fail(e); }
  buildDraft(A.st.rules); renderAdmin(); loadWeek('');
  startWatch(); loadRec();
}

/* ---------- 新預約通知：頁面開著時每 45 秒靜默檢查一次（不跳「處理中」） ---------- */
const BASE_TITLE = document.title;
let seenIds = null, watching = false;
function startWatch() {
  if (watching) return; watching = true;
  seenIds = new Set(A.st.pending.map(p => p.id));
  // 瀏覽器規定通知權限要由使用者操作觸發：第一次點頁面任何地方時詢問
  document.addEventListener('click', () => { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {} }, { once: true });
  setInterval(checkNew, 45000);
  window.addEventListener('focus', () => { document.title = BASE_TITLE; });
}
async function checkNew() {
  if (A.busyWatch) return; A.busyWatch = true;
  try {
    const st = await runCall('adminGetState');
    const fresh = st.pending.filter(p => !seenIds.has(p.id));
    st.pending.forEach(p => seenIds.add(p.id));
    if (!fresh.length) return;
    const text = fresh.map(p => `${p.name} ${p.start}（${p.length} 分）`).join('、');
    document.title = `(${st.pending.length}) ${BASE_TITLE}`;
    try { if ('Notification' in window && Notification.permission === 'granted') new Notification('泰時刻：有新的預約', { body: text }); } catch (e) {}
    showNewBar(text);
  } catch (e) { /* 網路暫時不通就等下一輪 */ } finally { A.busyWatch = false; }
}
function showNewBar(text) {
  let el = document.getElementById('newbar');
  if (!el) { el = document.createElement('div'); el = Object.assign(el, { id: 'newbar', className: 'newbar' }); document.body.appendChild(el); }
  el.innerHTML = `<span>🔔 新預約：${esc(text)}</span><button class="primary" id="newgo">查看</button>`;
  document.getElementById('newgo').onclick = async () => {
    try { A.st = await run('adminGetState'); if (!A.dirty) buildDraft(A.st.rules); renderAdmin(); } catch (e) { flash(false, e.message); }
    el.remove(); A.sec = 'pending'; renderAdmin(); document.title = BASE_TITLE; window.scrollTo(0, 0);
  };
}
/** 進入「所有預約」時才讀各學生的記錄表（每位要開一次檔，比較慢） */
async function loadRec() {
  if (A.sec !== 'bookings' || A.rec) return;
  try { A.rec = await run('adminGetRecordSessions'); renderAdmin(); } catch (e) { flash(false, e.message); }
}
function flash(ok, text) { A.msg = { ok, text }; renderAdmin(); }

function renderAdmin() {
  const st = A.st;
  $app.innerHTML = `
    <h1>老師管理</h1>
    ${A.msg ? `<div class="msg ${A.msg.ok ? 'ok' : 'err'}">${esc(A.msg.text)}</div>` : ''}
    <div class="shell"><nav class="side">${SECS.map(([k, n]) => `<button data-sec="${k}" class="${A.sec === k ? 'sel' : ''}">${n}${k === 'pending' && st.pending.length ? `<span class="badge">${st.pending.length}</span>` : ''}</button>`).join('')}</nav><div class="content">
    ${A.sec === 'sched' ? `<div class="card">
      <div class="tabs"><button data-tab="cal" class="${A.tab === 'cal' ? 'sel' : ''}">行事曆</button><button data-tab="reg" class="${A.tab === 'reg' ? 'sel' : ''}">固定時間</button></div>
      <p class="muted" style="margin-top:0">${A.tab === 'cal' ? '某一週的實際日期。改動只影響那一天（單日設定），不會改到固定時間。' : '每週固定開放的時段，套用到每一個星期。'} 時間為台北時間。</p>
      <div id="grid"></div>
      <div class="legend"><span><i style="background:color-mix(in srgb,var(--ok) 38%,var(--card))"></i>開放預約</span>
        ${A.tab === 'cal' ? `<span><i style="background:color-mix(in srgb,var(--accent) 28%,var(--card));border-color:var(--accent)"></i>私下學生</span><span><i style="background:color-mix(in srgb,#2563eb 24%,var(--card));border-color:#2563eb"></i>AmazingTalker</span><span><i style="border-style:dashed"></i>虛線＝待確認</span><span><i style="background:var(--chip)"></i>其他行程</span>` : ''}</div>
      <div class="savebar" id="savebar" style="display:none"></div></div>
      <p class="muted">點格子就能開放或取消開放（滑鼠可拖曳多格）。學生只會在綠色格子中、扣掉行事曆已有行程後，看到可預約的時段。</p>` : ''}
    ${A.sec === 'pending' ? `<div class="card"><h2>待確認的私下預約</h2>
      ${st.pending.length ? st.pending.map(p => `<div class="item"><div>${esc(p.name)}　${esc(p.start)}（${p.length} 分）<div class="muted">${esc(p.note)}</div></div>
        <div class="row"><button class="primary" data-ok="${p.id}">確認</button><button class="danger" data-no="${p.id}">拒絕</button></div></div>`).join('')
        : '<p class="muted">目前沒有待確認的預約。</p>'}
      <p class="muted">確認後，記得到 AmazingTalker 手動關閉同一時段。</p></div>` : ''}
    ${A.sec === 'bookings' ? `<div class="card"><h2>所有預約（可直接改狀態）</h2>
      <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="onlyAct" ${A.onlyActive ? 'checked' : ''}>只看有效預約（待確認／已確認）</label>
      ${(st.bookings || []).filter(b => !A.onlyActive || ['待確認', '已確認'].includes(b.status)).map(b => `<div class="item"><div>${esc(b.start)}・${b.length} 分<div class="muted">${esc(b.name)}　${esc(b.source)}</div></div>
        <div class="row">${['待確認', '已確認'].includes(b.status) ? `<button class="danger" data-cancel="${esc(b.id)}">取消這堂課</button>` : ''}<select data-bk="${esc(b.id)}" data-old="${esc(b.status)}">${['待確認', '已確認', '已拒絕', '已過期', '已取消'].map(x => `<option ${x === b.status ? 'selected' : ''}>${x}</option>`).join('')}${['待確認', '已確認', '已拒絕', '已過期', '已取消'].includes(b.status) ? '' : `<option selected>${esc(b.status)}</option>`}</select></div></div>`).join('') || '<p class="muted">沒有預約。</p>'}
      ${A.rec && A.rec.length ? `<h2 style="margin-top:20px">記錄表中已排的課</h2>
        <p class="muted">這些課寫在學生的課程記錄表裡（例如之前手寫的），不在預約表。取消會清掉記錄表那一堂的上課日期與會議連結，並刪除行事曆上同一時間、標題含學生名字的事件；Zoom 會議本身不會被刪除。</p>
        ${A.rec.map(r => `<div class="item"><div>${esc(r.start.slice(0, 10).replace(/-/g, '/'))} ${r.start.slice(11)}–${r.end.slice(11)}<div class="muted">${esc(r.name)}　記錄表</div></div>
          <button class="danger" data-reccancel data-name="${esc(r.name)}" data-start="${esc(r.start)}">取消這堂課</button></div>`).join('')}` : ''}
      <p class="muted">改成「已確認／待確認」會把時段放回行事曆；改成其他狀態會移除行事曆事件。私下預約改成已確認時會建立 Zoom 並寫入記錄表。</p></div>` : ''}
    ${A.sec === 'students' ? `<div class="card"><h2>學生預約連結</h2>
      ${st.students.map(s => `<div class="item"><div>${esc(s.name)}<div class="muted">${esc(s.email)}</div>
        ${s.token ? `<div class="link">${esc(linkOf(s))}</div>` : ''}</div>
        <div class="row">${s.token ? `<button data-copy="${esc(linkOf(s))}">複製連結</button>` : ''}<button data-renew="${esc(s.name)}">${s.token ? '換新連結' : '產生連結'}</button></div>
        <div class="row" style="flex-basis:100%"><input class="rec" data-name="${esc(s.name)}" style="flex:1;min-width:200px" placeholder="課程記錄表（試算表網址）" value="${esc(s.record)}"><button data-saverec="${esc(s.name)}">儲存</button></div></div>`).join('') || '<p class="muted">還沒有學生。</p>'}
      <div class="row" style="margin-top:12px"><input id="sn" placeholder="姓名"><input id="se" type="email" placeholder="Email"><button id="addS">新增學生</button></div>
      <p class="muted">貼上學生的「課程記錄表」網址後，學生頁會顯示剩餘堂數，確認預約時會自動把日期與 Zoom 連結填進下一堂。</p>
      <p class="muted">新學生也可以用沒有代碼的通用連結自己填姓名與 Email，送出後你確認時會自動建檔。</p></div>` : ''}
    </div></div>`;

  renderGrid(); updateBar();
  const act = async (fn, okText, ...args) => { try { await run(fn, ...args); const [st, wk, rec] = await Promise.all([run('adminGetState'), fn === 'adminSetRecord' ? A.wk : run('adminGetWeek', A.wkDate), A.rec ? run('adminGetRecordSessions') : null]); A.st = st; A.wk = wk; if (rec) A.rec = rec; flash(true, okText); } catch (e) { flash(false, e.message); } };
  $app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { A.tab = b.dataset.tab; A.msg = null; renderAdmin(); });
  $app.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => act('adminSetStatus', '已確認', b.dataset.ok, '已確認'));
  $app.querySelectorAll('[data-no]').forEach(b => b.onclick = () => act('adminSetStatus', '已拒絕', b.dataset.no, '已拒絕'));
  $app.querySelectorAll('[data-sec]').forEach(b => b.onclick = async () => { A.sec = b.dataset.sec; A.msg = null; try { localStorage.setItem('thaiskr_admin_sec', A.sec); } catch (e) {} renderAdmin(); window.scrollTo(0, 0);  loadRec(); });
  const oa = document.getElementById('onlyAct'); if (oa) oa.onchange = e => { A.onlyActive = e.target.checked; renderAdmin(); };
  $app.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => { if (confirm('確定取消這堂課？時段會釋放，也請記得到 AmazingTalker 取消。')) act('adminSetStatus', '已取消這堂課', b.dataset.cancel, '已取消'); });
  $app.querySelectorAll('[data-reccancel]').forEach(b => b.onclick = () => { if (confirm('取消 ' + b.dataset.name + ' ' + b.dataset.start + ' 這堂課？會清掉記錄表那一堂的日期與連結，並刪除行事曆上同一時間、標題含學生名字的事件。')) act('adminCancelRecordLesson', '已從記錄表取消這堂課', b.dataset.name, b.dataset.start); });
  $app.querySelectorAll('[data-bk]').forEach(sel => sel.onchange = () => {
    if (sel.value === sel.dataset.old) return;
    if (!confirm('把這筆預約改成「' + sel.value + '」？')) { sel.value = sel.dataset.old; return; }
    act('adminSetStatus', '已更新為' + sel.value, sel.dataset.bk, sel.value);
  });
  $app.querySelectorAll('[data-renew]').forEach(b => b.onclick = () => { if (confirm('舊連結會立刻失效，確定嗎？')) act('adminRenewLink', '已產生新連結', b.dataset.renew); });
  $app.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => { b.textContent = '已複製'; }));
  $app.querySelectorAll('[data-saverec]').forEach(b => b.onclick = () => act('adminSetRecord', '已儲存課程記錄表', b.dataset.saverec, [...document.querySelectorAll('.rec')].find(i => i.dataset.name === b.dataset.saverec).value));
  const addS = document.getElementById('addS'); if (addS) addS.onclick = () => act('adminCreateStudent', '已新增學生', document.getElementById('sn').value, document.getElementById('se').value);
}

initAdmin();
