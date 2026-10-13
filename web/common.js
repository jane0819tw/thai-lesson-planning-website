// 共用：呼叫 Apps Script API。ENDPOINT 空白或網址帶 ?mock=1 時改用假資料（mock.js）。
const $app = document.getElementById('app');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const WD = ['', '一', '二', '三', '四', '五', '六', '日'];
const dayLabel = d => { const [y, m, dd] = d.split('-').map(Number); const w = new Date(Date.UTC(y, m - 1, dd)).getUTCDay() || 7; return `${m}/${dd}<br><span class="muted">週${WD[w]}</span>`; };
const QS = new URLSearchParams(location.search);
const ENDPOINT = (window.SITE_CONFIG && SITE_CONFIG.ENDPOINT) || '';
const MOCK = !ENDPOINT || QS.get('mock') === '1';
const KEY_NAME = 'thaiskr_admin_key';
const getKey = () => { try { return localStorage.getItem(KEY_NAME) || ''; } catch (e) { return ''; } };
const setKey = k => { try { k ? localStorage.setItem(KEY_NAME, k) : localStorage.removeItem(KEY_NAME); } catch (e) {} };

// 讀取／儲存期間：畫面正中央蓋一層半透明遮罩＋轉圈圈＋說明文字，並停用按鈕避免重複點擊。
// 所有 API 都經過 run()，所以新增學生、儲存、確認預約、送出預約…都會自動套用。
const BUSY_TEXT = {
  adminSetStatus: '處理預約中（建立 Zoom、寫入記錄表、更新行事曆），約需數秒…',
  submitBooking: '送出預約中…', adminSaveRules: '儲存開放時段中…', adminCreateStudent: '新增學生中…',
  adminSetRecord: '儲存課程記錄表中…', adminRenewLink: '產生新連結中…', adminGetWeek: '載入課表中…',
  getStudentView: '更新時段中…', adminGetState: '載入中…',
};
let pending = 0, busyEl = null, busyTimer = null, busyText = '';
function busy(on, fn) {
  pending += on ? 1 : -1;
  if (on) busyText = BUSY_TEXT[fn] || '處理中…';
  clearTimeout(busyTimer);
  if (pending > 0) {
    document.body.classList.add('is-busy');
    // 太快完成的操作（<0.3 秒）不閃遮罩
    busyTimer = setTimeout(() => {
      if (!busyEl) { busyEl = document.createElement('div'); busyEl.className = 'busy'; busyEl.innerHTML = '<div><i></i><span></span></div>'; document.body.appendChild(busyEl); }
      busyEl.querySelector('span').textContent = busyText; busyEl.style.display = 'flex';
    }, 300);
  } else {
    // 連續的幾個 API 之間不要閃一下消失再出現：稍等 0.1 秒再收起
    busyTimer = setTimeout(() => { document.body.classList.remove('is-busy'); if (busyEl) busyEl.style.display = 'none'; }, 100);
  }
}
async function run(fn, ...args) { busy(true, fn); try { return await runCall(fn, ...args); } finally { busy(false); } }
async function runCall(fn, ...args) {
  if (MOCK) return window.mockRun(fn, args);
  const body = { fn, args }; if (fn.indexOf('admin') === 0) body.key = getKey();
  let r;
  try { r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }); }
  catch (e) { throw new Error('連線失敗，請檢查網路後再試'); }
  let d; try { d = await r.json(); } catch (e) { throw new Error('伺服器回應格式不正確（網址是否為最新部署的 /exec？）'); }
  if (!d.ok) throw new Error(d.error || '發生錯誤');
  return d.data;
}
function fail(e) { $app.innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
