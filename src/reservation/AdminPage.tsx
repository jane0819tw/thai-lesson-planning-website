import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAdminKey, getApi, setAdminKey } from './api'
import { CATEGORIES } from '../categories'
import ScheduleGrid from './ScheduleGrid'
import { WHOLE_COURSES, readingUnits, unitLabel, useLessons } from './access'
import { REVIEW_UNITS, reviewRange, reviewTitle, homeworkLessonLabel } from '../reviews'
import type { Unit } from './access'
import { buildDraft, paintCells, serialize, setHoliday } from './schedule'
import type { Draft } from './schedule'
import type { AdminState, HomeworkRow, RecSession, StudentRow, Week } from './types'
import './booking.css'

const SECS = [['sched', '開放時段'], ['pending', '待確認'], ['bookings', '所有預約'], ['students', '學生'], ['homework', '學生作業'], ['links', '課程入口']] as const
type Sec = (typeof SECS)[number][0]
const SEC_KEY = 'thaiskr_admin_sec'
const secGet = (): Sec => { try { const v = localStorage.getItem(SEC_KEY); return SECS.find(x => x[0] === v)?.[0] ?? 'sched' } catch { return 'sched' } }
const STATUSES = ['待確認', '已確認', '已拒絕', '已過期', '已取消']
const BASE_TITLE = typeof document === 'undefined' ? '' : document.title
const todayStr = () => new Date().toISOString().slice(0, 10)
// 學生預約頁就在同一個網站：<網站>/#/book?t=<代碼>
const linkOf = (s: StudentRow) => `${location.origin}${location.pathname}#/book?t=${s.token}`

export default function AdminPage() {
  const [sp] = useSearchParams()
  const mock = sp.get('mock') === '1'
  const api = useMemo(() => getApi(mock), [mock])

  const [needKey, setNeedKey] = useState(!mock && !getAdminKey())
  const [keyMsg, setKeyMsg] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [st, setSt] = useState<AdminState | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [dirty, setDirty] = useState(false)
  const [wk, setWk] = useState<Week | null>(null)
  const [weekErr, setWeekErr] = useState('')
  const [tab, setTab] = useState<'cal' | 'reg'>('cal')
  const [sec, setSec] = useState<Sec>(secGet)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [rec, setRec] = useState<RecSession[] | null>(null)
  const [hw, setHw] = useState<HomeworkRow[] | null>(null)
  const [onlyActive, setOnlyActive] = useState(false)
  const [who, setWho] = useState<'all' | 'private' | 'at'>('all')
  const [newBar, setNewBar] = useState('')
  const [busy, setBusy] = useState({ n: 0, text: '' })
  const seen = useRef<Set<string> | null>(null)
  // 診斷資訊：載入每一步的狀態與任何未捕捉的錯誤，直接顯示在頁面上（排查「畫面空白」用）
  const [diag, setDiag] = useState<string[]>([])
  const [fatal, setFatal] = useState('')
  const step = useCallback((t: string) => setDiag(d => [...d, t]), [])
  useEffect(() => {
    const onErr = (e: ErrorEvent) => setFatal(e.message || String(e.error))
    const onRej = (e: PromiseRejectionEvent) => setFatal('Promise：' + (e.reason?.message ?? String(e.reason)))
    window.addEventListener('error', onErr); window.addEventListener('unhandledrejection', onRej)
    return () => { window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onRej) }
  }, [])
  const lessons = useLessons()
  const units = readingUnits(lessons.map(l => l.number))

  // 讀取／儲存期間：蓋一層遮罩＋轉圈圈（太快完成的操作 0.3 秒內不顯示，見 CSS）
  const run = useCallback(async <T,>(text: string, f: () => Promise<T>): Promise<T> => {
    setBusy(b => ({ n: b.n + 1, text }))
    try { return await f() } finally { setBusy(b => ({ ...b, n: b.n - 1 })) }
  }, [])
  const flash = (ok: boolean, text: string) => setMsg({ ok, text })

  const loadWeek = useCallback(async (date: string) => {
    setWk(null); setWeekErr('')
    try { const w = await run('載入課表中…', () => api.adminGetWeek(date)); step(`4 課表已收到：${w.days?.length} 天`); setWk(w) } catch (e) { step('✗ 課表失敗：' + (e as Error).message); setWeekErr((e as Error).message) }
  }, [api, run, step])

  const init = useCallback(async () => {
    try {
      step('1 讀取管理資料…')
      const s = await run('載入中…', () => api.adminGetState())
      step(`2 已收到：規則 ${s.rules?.length} 筆、待確認 ${s.pending?.length} 筆、預約 ${s.bookings?.length} 筆、學生 ${s.students?.length} 位`)
      const d = buildDraft(s.rules)
      setSt(s); setDraft(d); setDirty(false)
      seen.current = new Set(s.pending.map(p => p.id))
      step('3 草稿建立完成，讀取本週課表…')
      loadWeek('')
    } catch (e) {
      const m = (e as Error).message || String(e)
      step('✗ 失敗：' + m)
      if (/密鑰/.test(m)) { setAdminKey(''); setKeyMsg(m); setNeedKey(true) } else setKeyMsg(m || '（沒有錯誤訊息）')
    }
  }, [api, run, loadWeek, step])
  useEffect(() => { if (!needKey) init() }, [needKey, init])

  // 進入「學生作業」時才讀「作業」分頁
  useEffect(() => {
    if (sec !== 'homework' || hw || !st) return
    run('讀取作業中…', () => api.adminGetHomework()).then(setHw).catch(e => flash(false, e.message))
  }, [sec, hw, st, api, run])

  // 進入「所有預約」時才讀各學生的記錄表（每位要開一次檔，比較慢）
  useEffect(() => {
    if (sec !== 'bookings' || rec || !st) return
    run('讀取學生記錄表中…', () => api.adminGetRecordSessions()).then(setRec).catch(e => flash(false, e.message))
  }, [sec, rec, st, api, run])

  // 新預約通知：頁面開著時每 45 秒靜默檢查一次（不跳遮罩）
  useEffect(() => {
    if (!st) return
    const ask = () => { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission() } catch { /* 部分瀏覽器不支援 */ } }
    document.addEventListener('click', ask, { once: true })
    const focus = () => { document.title = BASE_TITLE }
    window.addEventListener('focus', focus)
    let busyWatch = false
    const timer = setInterval(async () => {
      if (busyWatch || !seen.current) return
      busyWatch = true
      try {
        const s = await api.adminGetState()
        const fresh = s.pending.filter(p => !seen.current!.has(p.id))
        s.pending.forEach(p => seen.current!.add(p.id))
        if (!fresh.length) return
        const text = fresh.map(p => `${p.name} ${p.start}（${p.length} 分）`).join('、')
        document.title = `(${s.pending.length}) ${BASE_TITLE}`
        try { if ('Notification' in window && Notification.permission === 'granted') new Notification('泰時刻：有新的預約', { body: text }) } catch { /* 忽略 */ }
        setNewBar(text)
      } catch { /* 網路暫時不通就等下一輪 */ } finally { busyWatch = false }
    }, 45000)
    return () => { clearInterval(timer); document.removeEventListener('click', ask); window.removeEventListener('focus', focus) }
  }, [st !== null, api]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = async <T,>(label: string, f: () => Promise<T>, okText: string | ((r: T) => string), keepWeek = false) => {
    try {
      const res = await run(label, f)
      const ok = typeof okText === 'function' ? okText(res) : okText
      // 動作已經成功；之後重新載入失敗只是畫面沒更新，不要講成動作失敗
      try {
        await run('重新載入中…', async () => {
          // 一個一個讀：同時送好幾個請求比較容易遇到 Google 的 404 錯誤頁
          const s = await api.adminGetState()
          const w = keepWeek ? wk : await api.adminGetWeek(wk?.monday ?? '')
          const r = rec ? await api.adminGetRecordSessions() : null
          setSt(s); setWk(w); if (r) setRec(r)
        })
        flash(true, ok)
      } catch (e) { flash(false, `${ok}，但重新載入畫面失敗，請重新整理頁面。（${(e as Error).message}）`) }
    } catch (e) { flash(false, (e as Error).message) }
  }

  const save = async () => {
    if (!draft) return
    try {
      const s = await run('儲存開放時段中…', async () => { await api.adminSaveRules(serialize(draft, wk?.today ?? todayStr())); return api.adminGetState() })
      setSt(s); setDraft(buildDraft(s.rules)); setDirty(false); flash(true, '已儲存開放時段')
    } catch (e) { flash(false, (e as Error).message) }
  }
  const goSec = (k: Sec) => { setSec(k); setMsg(null); try { localStorage.setItem(SEC_KEY, k) } catch { /* 存不了就算了 */ } window.scrollTo(0, 0) }

  if (needKey) {
    return (
      <div className="bk">
        <h1>老師管理</h1>
        <p className="bk-sub">請輸入管理密鑰（在 Apps Script 執行 createAdminKey 取得）。密鑰只會存在這個瀏覽器。</p>
        {keyMsg && <div className="bk-msg err">{keyMsg}</div>}
        <div className="bk-card">
          <input className="full" type="password" autoComplete="off" placeholder="管理密鑰" value={keyInput} onChange={e => setKeyInput(e.target.value)} />
          <button className="primary" onClick={() => { setAdminKey(keyInput.trim()); setKeyMsg(''); setNeedKey(false) }}>進入</button>
        </div>
      </div>
    )
  }
  if (!st || !draft) return <div className="bk"><h1>老師管理</h1>{keyMsg ? <div className="bk-msg err">{keyMsg}</div> : <p className="bk-muted">載入中…</p>}<Diag lines={diag} fatal={fatal} />{busy.n > 0 && <Busy text={busy.text} />}</div>

  return (
    <div className="bk wide">
      <h1>老師管理</h1>
      <Diag lines={diag} fatal={fatal} />
      {msg && <div className={`bk-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="mgr-shell">
        <nav className="mgr-side">
          {SECS.map(([k, n]) => (
            <button key={k} className={sec === k ? 'sel' : ''} onClick={() => goSec(k)}>{n}{k === 'pending' && st.pending.length > 0 && <span className="mgr-badge">{st.pending.length}</span>}</button>
          ))}
          {/* 其他工具：另開分頁，不影響這頁尚未儲存的開放時段 */}
          <a className="mgr-tool" href="#/reading/stroke-editor" target="_blank" rel="noopener noreferrer">✏️ 筆順錄製工具</a>
          <a className="mgr-tool" href="#/reading/dictation-review" target="_blank" rel="noopener noreferrer">🎧 聽寫片段審查</a>
        </nav>
        <div className="mgr-content">
          {sec === 'sched' && (
            <>
              <div className="bk-card">
                <div className="mgr-tabs">
                  <button className={tab === 'cal' ? 'sel' : ''} onClick={() => { setTab('cal'); setMsg(null) }}>行事曆</button>
                  <button className={tab === 'reg' ? 'sel' : ''} onClick={() => { setTab('reg'); setMsg(null) }}>固定時間</button>
                </div>
                <p className="bk-muted" style={{ marginTop: 0 }}>{tab === 'cal' ? '某一週的實際日期。改動只影響那一天（單日設定），不會改到固定時間。' : '每週固定開放的時段，套用到每一個星期。'} 時間為台北時間。</p>
                {tab === 'cal' && weekErr ? <div className="bk-msg err">{weekErr}</div> : (
                  <ScheduleGrid
                    tab={tab} draft={draft} wk={wk}
                    onPaint={(key, mins, on) => { setDraft(d => paintCells(d!, tab, key, mins, on)); setDirty(true) }}
                    onHoliday={date => {
                      if (draft.ov[date]?.closed) setDraft(setHoliday(draft, date, null))
                      else { const label = prompt('休假說明（學生會在日期上看到）', '休假'); if (label === null) return; setDraft(setHoliday(draft, date, label)) }
                      setDirty(true)
                    }}
                    onWeek={loadWeek}
                  />
                )}
                <div className="mgr-legend">
                  <span><i style={{ background: 'color-mix(in srgb, var(--bk-ok) 38%, var(--card))' }} />開放預約</span>
                  {tab === 'cal' && <>
                    <span><i style={{ background: 'color-mix(in srgb, var(--accent) 28%, var(--card))', borderColor: 'var(--accent)' }} />私下學生</span>
                    <span><i style={{ background: 'color-mix(in srgb, #2563eb 24%, var(--card))', borderColor: '#2563eb' }} />AmazingTalker</span>
                    <span><i style={{ borderStyle: 'dashed' }} />虛線＝待確認</span>
                    <span><i style={{ background: 'var(--accent-soft)' }} />其他行程</span>
                  </>}
                </div>
                {dirty && (
                  <div className="mgr-savebar">
                    <span>有尚未儲存的變更</span>
                    <span className="bk-row"><button onClick={() => { setDraft(buildDraft(st.rules)); setDirty(false); setMsg(null) }}>還原</button><button className="primary" onClick={save}>儲存</button></span>
                  </div>
                )}
              </div>
              <p className="bk-muted">點格子就能開放或取消開放（滑鼠可拖曳多格）。學生只會在綠色格子中、扣掉行事曆已有行程後，看到可預約的時段。</p>
            </>
          )}

          {sec === 'pending' && (
            <div className="bk-card">
              <h2>待確認的私下預約</h2>
              {st.pending.length ? st.pending.map(p => (
                <div className="bk-item" key={p.id}>
                  <div>{p.name}　{p.start}（{p.length} 分）<div className="bk-muted">{p.note}</div></div>
                  <div className="bk-row">
                    <button className="primary" onClick={() => act('處理預約中（建立 Zoom、寫入記錄表、更新行事曆），約需數秒…', () => api.adminSetStatus(p.id, '已確認'), '已確認')}>確認</button>
                    <button className="danger" onClick={() => act('處理預約中…', () => api.adminSetStatus(p.id, '已拒絕'), '已拒絕')}>拒絕</button>
                  </div>
                </div>
              )) : <p className="bk-muted">目前沒有待確認的預約。</p>}
              <p className="bk-muted">確認後，記得到 AmazingTalker 手動關閉同一時段。</p>
            </div>
          )}

          {sec === 'bookings' && (
            <div className="bk-card">
              <h2>所有預約（可直接改狀態）</h2>
              <label className="mgr-check"><input type="checkbox" checked={onlyActive} onChange={e => setOnlyActive(e.target.checked)} />只看有效預約（待確認／已確認）</label>
              {(() => {
                const list = st.bookings.filter(b => !onlyActive || ['待確認', '已確認'].includes(b.status))
                return list.length ? list.map(b => (
                  <div className="bk-item" key={b.id}>
                    <div>{b.start}・{b.length} 分<div className="bk-muted">{b.name}　{b.source}</div></div>
                    <div className="bk-row">
                      {['待確認', '已確認'].includes(b.status) && (
                        <button className="danger" onClick={() => { if (confirm('確定取消這堂課？時段會釋放，也請記得到 AmazingTalker 取消。')) act('處理中…', () => api.adminSetStatus(b.id, '已取消'), '已取消這堂課') }}>取消這堂課</button>
                      )}
                      <select value={b.status} onChange={e => { const v = e.target.value; if (v !== b.status && confirm(`把這筆預約改成「${v}」？`)) act('處理中…', () => api.adminSetStatus(b.id, v), `已更新為${v}`) }}>
                        {[...STATUSES, ...(STATUSES.includes(b.status) ? [] : [b.status])].map(x => <option key={x}>{x}</option>)}
                      </select>
                    </div>
                  </div>
                )) : <p className="bk-muted">沒有預約。</p>
              })()}
              {rec && rec.length > 0 && (
                <>
                  <h2 style={{ marginTop: 20 }}>記錄表中已排的課</h2>
                  <p className="bk-muted">這些課寫在學生的課程記錄表裡（例如之前手寫的），不在預約表。取消會清掉記錄表那一堂的上課日期與會議連結，並刪除行事曆上同一時間、標題含學生名字的事件；Zoom 會議本身不會被刪除。</p>
                  {rec.map(r => (
                    <div className="bk-item" key={r.name + r.start}>
                      <div>{r.start.slice(0, 10).replace(/-/g, '/')} {r.start.slice(11)}–{r.end.slice(11)}<div className="bk-muted">{r.name}　記錄表</div></div>
                      <button className="danger" onClick={() => { if (confirm(`取消 ${r.name} ${r.start} 這堂課？會清掉記錄表那一堂的日期與連結，並刪除行事曆上同一時間、標題含學生名字的事件。`)) act('清除記錄表中…', () => api.adminCancelRecordLesson(r.name, r.start), '已從記錄表取消這堂課') }}>取消這堂課</button>
                    </div>
                  ))}
                </>
              )}
              <p className="bk-muted">改成「已確認／待確認」會把時段放回行事曆；改成其他狀態會移除行事曆事件。私下預約改成已確認時會建立 Zoom 並寫入記錄表。</p>
            </div>
          )}

          {sec === 'homework' && (
            <div className="bk-card">
              <div className="bk-row between">
                <h2 style={{ margin: 0 }}>學生作業</h2>
                <button onClick={() => { setHw(null) }}>重新整理</button>
              </div>
              <p className="bk-muted">學生在作業頁按「送出作業」後出現在這裡（最近 300 筆，新的在上面）。同一課重做會多一筆，學生頁顯示最近一次。資料也存在試算表的「作業」分頁。</p>
              {!hw ? <p className="bk-muted">載入中…</p> : hw.length === 0 ? <p className="bk-muted">還沒有學生送出作業。</p> : (
                <div className="mgr-scroll">
                  <table className="mgr-table">
                    <thead><tr><th>繳交時間</th><th>學生</th><th>課別</th><th>聽音選字</th><th>聽寫</th></tr></thead>
                    <tbody>{hw.map((r, i) => <tr key={i}><td>{r.time.slice(5).replace('-', '/')}</td><td>{r.name}</td><td>{homeworkLessonLabel(r.lesson)}</td><td>{r.listen}</td><td>{r.typing}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {sec === 'links' && (
            <div className="bk-card">
              <h2>課程入口</h2>
              <p className="bk-muted" style={{ marginTop: 0 }}>都會另開新分頁，不影響這頁尚未儲存的內容。</p>
              <ul className="bk-courses">
                {CATEGORIES.map(c => (
                  <li key={c.key}>
                    {c.to
                      ? <a className="bk-course" href={`#${c.to}`} target="_blank" rel="noopener noreferrer"><strong>{c.title}</strong><small>{c.desc}</small><span className="bk-go">開啟 →</span></a>
                      : <div className="bk-course off"><strong>{c.title}</strong><small>{c.desc}</small><span className="bk-muted">即將推出</span></div>}
                  </li>
                ))}
              </ul>
              <h2 style={{ marginTop: 20 }}>認字課程工具</h2>
              <div className="bk-row">
                <a className="mgr-link" href="#/reading/chart" target="_blank" rel="noopener noreferrer">子音・母音總表</a>
                <a className="mgr-link" href="#/reading/keyboard" target="_blank" rel="noopener noreferrer">泰文鍵盤</a>
                <a className="mgr-link" href="#/reading/stroke-editor" target="_blank" rel="noopener noreferrer">✏️ 筆順錄製工具</a>
                <a className="mgr-link" href="#/reading/dictation-review" target="_blank" rel="noopener noreferrer">🎧 聽寫片段審查</a>
              </div>
              <h2 style={{ marginTop: 20 }}>各課連結</h2>
              <p className="bk-muted" style={{ marginTop: 0 }}>「作業」是給學生做練習的頁面，可以直接把連結傳給學生（課程頁上有「複製指派連結」，能帶學生姓名）。</p>
              {lessons.flatMap(l => {
                const item = (
                  <div className="bk-item" key={l.id}>
                    <div><b>L{l.number}</b>　{l.title}</div>
                    <div className="bk-row">
                      <a className="mgr-link" href={`#/reading/lesson/${l.id}`} target="_blank" rel="noopener noreferrer">課程頁</a>
                    </div>
                  </div>
                )
                const unit = REVIEW_UNITS.find(u => reviewRange(u).to === l.number)
                return unit ? [item, (
                  <div className="bk-item" key={`review-${unit}`}>
                    <div><b>複習</b>　{reviewTitle(unit)}</div>
                    <div className="bk-row">
                      <a className="mgr-link" href={`#/reading/review/${unit}`} target="_blank" rel="noopener noreferrer">作業複習頁</a>
                    </div>
                  </div>
                )] : [item]
              })}
            </div>
          )}

          {sec === 'students' && (
            <div className="bk-card">
              <h2>學生預約連結</h2>
              {(() => { const n = st.students.filter(s => s.display).length; return (
                <div className="tabs" role="tablist" style={{ marginBottom: 8 }}>
                  {([['all', `全部 ${st.students.length}`], ['private', `私下 ${st.students.length - n}`], ['at', `AmazingTalker ${n}`]] as const).map(([k, label]) => (
                    <button key={k} role="tab" aria-selected={who === k} className={who === k ? 'on' : ''} onClick={() => setWho(k)}>{label}</button>
                  ))}
                </div>
              ) })()}
              {st.students.length ? st.students.filter(s => who === 'all' || (who === 'at') === !!s.display).map(s => (
                <StudentItem key={s.name} s={s} units={units}
                  onDelete={() => { if (confirm(`確定刪除學生「${s.name}」？他們的連結會立刻失效（預約與作業紀錄會保留）。`)) act('刪除學生中…', () => api.adminDeleteStudent(s.name), `已刪除 ${s.name}`, true) }}
                  onSaveDisplay={d => act('儲存平台名稱中…', () => api.adminSetDisplay(s.name, d), `已儲存 ${s.name} 的平台名稱`, true)}
                  onSaveCourses={list => act('儲存開放課程中…', () => api.adminSetCourses(s.name, list), `已儲存 ${s.name} 的開放課程`, true)}
                  onRenew={() => { if (confirm('舊連結會立刻失效，確定嗎？')) act('產生新連結中…', () => api.adminRenewLink(s.name), '已產生新連結') }}
                  onSaveRec={url => act('儲存課程記錄表中…', () => api.adminSetRecord(s.name, url), '已儲存課程記錄表', true)} />
              )) : <p className="bk-muted">還沒有學生。</p>}
              {who === 'at' && (
                <p className="bk-row" style={{ marginTop: 12 }}>
                  <button onClick={() => act('從預約紀錄列入中…', () => api.adminImportPlatformStudents(),
                    r => r.added.length || r.linked.length
                      ? [r.added.length && `新增 ${r.added.length} 位：${r.added.join('、')}`, r.linked.length && `補上平台名稱 ${r.linked.length} 位：${r.linked.join('、')}`].filter(Boolean).join('；')
                      : '預約紀錄裡的 AmazingTalker 學生都已經在列表裡了', true)}>從預約紀錄列入 AmazingTalker 學生</button>
                  <span className="bk-muted">之後收到新的平台預約信，也會自動列入。</span>
                </p>
              )}
              <NewStudent at={who === 'at'} onAdd={(n, e, d) => act('新增學生中…', () => api.adminCreateStudent(n, e, d), d ? '已新增 AmazingTalker 學生' : '已新增學生')} />
              <p className="bk-muted">有填「AmazingTalker 名稱」的學生在平台上預約，他們的連結只會看到「我的課程與作業」，看不到預約。</p>
              <p className="bk-muted">貼上學生的「課程記錄表」網址後，學生頁會顯示剩餘堂數，確認預約時會自動把日期與 Zoom 連結填進下一堂。</p>
              <p className="bk-muted">新學生也可以用沒有代碼的通用連結（<code>#/book</code>）自己填姓名與 Email，送出後你確認時會自動建檔。</p>
            </div>
          )}
        </div>
      </div>

      {newBar && (
        <div className="mgr-newbar">
          <span>🔔 新預約：{newBar}</span>
          <button className="primary" onClick={async () => {
            try { const s = await run('載入中…', () => api.adminGetState()); setSt(s); if (!dirty) setDraft(buildDraft(s.rules)) } catch (e) { flash(false, (e as Error).message) }
            setNewBar(''); goSec('pending'); document.title = BASE_TITLE
          }}>查看</button>
        </div>
      )}
      {busy.n > 0 && <Busy text={busy.text} />}
    </div>
  )
}

const Diag = ({ lines, fatal, always }: { lines: string[]; fatal: string; always?: boolean }) => (fatal || always || lines.some(l => l.includes('✗'))) ? (
  <pre className="mgr-diag">{fatal && `頁面錯誤：${fatal}\n`}{lines.join('\n')}</pre>
) : null

const Busy = ({ text }: { text: string }) => <div className="mgr-busy"><div><i /><span>{text}</span></div></div>

function StudentItem({ s, units, onRenew, onSaveRec, onSaveCourses, onSaveDisplay, onDelete }: { s: StudentRow; units: Unit[]; onRenew: () => void; onDelete: () => void; onSaveRec: (url: string) => void; onSaveCourses: (list: string[]) => void; onSaveDisplay: (display: string) => void }) {
  const [url, setUrl] = useState(s.record ?? '')
  const [display, setDisplay] = useState(s.display ?? '')
  const [courses, setCourses] = useState<string[]>(s.courses)
  const [copied, setCopied] = useState(false)
  return (
    <div className="bk-item">
      <div>{s.name}{s.display && <span className="mgr-at">AT・{s.display}</span>}<div className="bk-muted">{s.email}</div>{s.token && <div className="mgr-link">{linkOf(s)}</div>}</div>
      <div className="bk-row">
        {s.token && <button onClick={() => navigator.clipboard.writeText(linkOf(s)).then(() => setCopied(true))}>{copied ? '已複製' : '複製連結'}</button>}
        <button onClick={onRenew}>{s.token ? '換新連結' : '產生連結'}</button>
        <button className="danger" onClick={onDelete}>刪除</button>
      </div>
      <div className="mgr-courses">
        <span className="bk-muted">開放課程</span>
        {[...units.map(u => ({ id: u.id, label: `認字 ${unitLabel(u)}` })), ...WHOLE_COURSES.map(c => ({ id: c.key, label: c.title }))].map(o => (
          <label key={o.id}><input type="checkbox" checked={courses.includes(o.id)} onChange={e => setCourses(c => (e.target.checked ? [...c, o.id] : c.filter(x => x !== o.id)))} />{o.label}</label>
        ))}
        <button disabled={sameSet(courses, s.courses)} onClick={() => onSaveCourses(courses)}>儲存</button>
      </div>
      <div className="bk-row" style={{ flexBasis: '100%' }}>
        <input style={{ flex: 1, minWidth: 200 }} placeholder="課程記錄表（試算表網址）" value={url} onChange={e => setUrl(e.target.value)} />
        <button onClick={() => onSaveRec(url)}>儲存</button>
      </div>
      <div className="bk-row" style={{ flexBasis: '100%' }}>
        <input style={{ flex: 1, minWidth: 200 }} placeholder="AmazingTalker 名稱（平台學生才填）" value={display} onChange={e => setDisplay(e.target.value)} />
        <button disabled={display.trim() === (s.display ?? '')} onClick={() => onSaveDisplay(display)}>儲存</button>
      </div>
    </div>
  )
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x))

// 在「AmazingTalker」分頁新增時填平台名稱（必填），新學生直接歸在平台學生
function NewStudent({ at, onAdd }: { at: boolean; onAdd: (name: string, email: string, display: string) => void }) {
  const [n, setN] = useState(''), [e, setE] = useState(''), [d, setD] = useState('')
  return (
    <div className="bk-row" style={{ marginTop: 12 }}>
      <input placeholder="姓名" value={n} onChange={x => setN(x.target.value)} />
      {at
        ? <input placeholder="AmazingTalker 名稱（和平台上一字不差）" value={d} onChange={x => setD(x.target.value)} />
        : <input type="email" placeholder="Email" value={e} onChange={x => setE(x.target.value)} />}
      <button disabled={at && !d.trim()} onClick={() => { onAdd(n, at ? '' : e, at ? d : ''); setN(''); setE(''); setD('') }}>{at ? '新增 AmazingTalker 學生' : '新增學生'}</button>
    </div>
  )
}
