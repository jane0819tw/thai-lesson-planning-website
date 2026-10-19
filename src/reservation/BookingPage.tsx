import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CATEGORIES } from '../categories'
import { setSession } from './session'
import { getApi } from './api'
import type { StudentView } from './types'
import './booking.css'

// 時間皆為台北時間
const toMs = (s: string) => new Date(s.replace(' ', 'T') + ':00+08:00').getTime()
const hm = (s: string) => s.slice(11, 16)
const WD = ['日', '一', '二', '三', '四', '五', '六']
const dayLabel = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return { md: `${m}/${dd}`, wd: `週${WD[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]}` } }
const addMin = (t: string, n: number) => { const m = +t.slice(0, 2) * 60 + +t.slice(3) + n; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') }
// 進入教室：上課前 10 分鐘才出現按鈕，結束後 15 分鐘消失
const canJoin = (now: number, start: string, end: string) => now >= toMs(start) - 10 * 60000 && now <= toMs(end) + 15 * 60000

export default function BookingPage() {
  const [sp] = useSearchParams()
  const token = sp.get('t') ?? ''
  const api = getApi(sp.get('mock') === '1')

  const [view, setView] = useState<StudentView | null>(null)
  const [error, setError] = useState('')
  const [len, setLen] = useState<25 | 50>(25)
  const [month, setMonth] = useState<string | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async () => { setView(await api.getStudentView(token)) }, [token]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch(e => setError(e.message)) }, [load])
  // 記住這位學生，讓其他頁面的頁首能回到「我的預約」
  useEffect(() => { if (token && view && view.mode === 'known') setSession({ token, name: view.name }) }, [token, view])
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(i) }, [])

  if (error) return <div className="bk"><div className="bk-msg err">{error}</div></div>
  if (!view) return <div className="bk"><p className="bk-muted">載入中…</p></div>
  if (view.mode === 'invalid') return <div className="bk"><h1>預約連結已失效</h1><p className="bk-sub">請向老師索取新的預約連結。</p></div>

  const fixed = view.lessons?.len
  const L = fixed === 25 || fixed === 50 ? fixed : len
  const ok = (s: { can25: boolean; can50: boolean }) => (L === 25 ? s.can25 : s.can50)
  const days = view.days.map(d => ({ ...d, free: d.slots.some(ok) }))
  // 日期依月份分頁：月份沒選過就用第一個有空位的日子所在的月份
  const months = [...new Set(days.map(d => d.date.slice(0, 7)))]
  const curMonth = month && months.includes(month) ? month : (days.find(d => d.free) ?? days[0])?.date.slice(0, 7) ?? null
  const monthDays = days.filter(d => d.date.slice(0, 7) === curMonth)
  const curDate = monthDays.some(d => d.date === date && d.free) ? date : monthDays.find(d => d.free)?.date ?? null
  const cur = days.find(d => d.date === curDate)
  const curTime = time && cur?.slots.some(s => s.time === time && ok(s)) ? time : null // 重新整理後這格被約走了
  // 50 分鐘的課佔兩個半小時格：選了一格，下一格一起變色
  const second = L === 50 && curTime ? addMin(curTime, 30) : null
  const monthLabel = (m: string) => (m.slice(0, 4) !== months[0].slice(0, 4) ? m.slice(0, 4) + '年' : '') + +m.slice(5) + '月'
  const l = view.lessons
  // 可進入的課程：後端有給清單就照清單；還沒給時，已建檔的學生先預設可進「泰文認字課程」（權限設計之後再接）
  const allowed = view.courses ?? (view.mode === 'known' ? ['reading'] : [])
  const myCourses = CATEGORIES.filter(c => allowed.includes(c.key))

  const refresh = async () => { try { await load(); setMsg(null) } catch (e) { setMsg({ ok: false, text: (e as Error).message }) } }
  const submit = async () => {
    if (!curDate || !curTime) return
    setBusy(true)
    try {
      await api.submitBooking(token, name, email, `${curDate} ${curTime}`, L)
      setMsg({ ok: true, text: '已送出！老師確認後，這個頁面的「我的預約」會出現 Zoom 連結。' }); setTime(null)
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
    setBusy(false)
    try { await load() } catch { /* 送出已成功，重讀失敗不影響 */ }
  }

  return (
    <div className="bk">
      <h1>預約泰語課</h1>
      <p className="bk-sub">{view.name ? `${view.name}，你好！` : ''}選擇課長與時段，送出後等老師確認，確認後可在這個頁面看到 Zoom 連結。時間皆為台北時間。</p>

      {myCourses.length > 0 && (
        <div className="bk-card">
          <h2>我的課程</h2>
          <ul className="bk-courses">
            {myCourses.map(c => (
              <li key={c.key}>
                {c.to
                  ? <Link to={c.to} className="bk-course"><strong>{c.title}</strong><small>{c.desc}</small><span className="bk-go">進入 →</span></Link>
                  : <div className="bk-course off"><strong>{c.title}</strong><small>{c.desc}</small><span className="bk-muted">即將推出</span></div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {l && (
        <div className="bk-card">
          <h2>堂數</h2>
          <p style={{ margin: 0 }}>
            <strong className="bk-big">剩餘 {l.left} 堂</strong><br />
            <span className="bk-muted">{fixed ? `${fixed} 分鐘課程包・` : ''}已購 {l.bought} 堂・已上 {l.used} 堂{l.booked ? `・已預約 ${l.booked} 堂（尚未上課）` : ''}</span>
          </p>
          {l.left <= 0 && <p className="bk-msg err">課程堂數已用完，預約前請先和老師聯絡。</p>}
        </div>
      )}

      {view.upcoming.length > 0 && (
        <div className="bk-card">
          <h2>我的預約</h2>
          {view.upcoming.map((u, i) => (
            <div className="bk-item" key={u.start}>
              <div>
                {u.start.slice(0, 10).replace(/-/g, '/')} {hm(u.start)}–{hm(u.end)}・{u.count > 1 ? `連續 ${u.count} 堂` : `${u.length} 分`}
                <div className="bk-muted">{u.status === '已確認' ? '已確認' : '等待老師確認'}</div>
              </div>
              {u.status !== '已確認' ? null : u.zoom
                ? (canJoin(now, u.start, u.end) && <button className="primary" onClick={() => window.open(u.zoom, '_blank', 'noopener')}>進入教室</button>)
                : <span className="bk-muted">教室連結老師會另外提供</span>}
              {i === 0 && u.status === '已確認' && view.lastLesson && (view.lastLesson.next || view.lastLesson.progress) && (
                <div className="bk-note">
                  {view.lastLesson.next && <div><strong>這堂課內容</strong>　{view.lastLesson.next}</div>}
                  {view.lastLesson.progress && <div className="bk-muted">上次上到（{view.lastLesson.date.replace(/-/g, '/')}）　{view.lastLesson.progress}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bk-card">
        <h2>1. 課長</h2>
        <div className="bk-row">
          {([25, 50] as const).map(n => (
            <button key={n} className={L === n ? 'sel' : ''} disabled={!!fixed && fixed !== n} onClick={() => { setLen(n); setTime(null); setMsg(null) }}>{n} 分鐘</button>
          ))}
        </div>
      </div>

      <div className="bk-card">
        <div className="bk-row between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>2. 日期與時間</h2>
          <span className="bk-row"><span className="bk-muted">最後更新 {view.asOf.slice(5, 16).replace('-', '/')}</span><button onClick={refresh}>重新整理時段</button></span>
        </div>
        {months.length > 1 && (
          <div className="bk-row" style={{ marginBottom: 10 }}>
            {months.map(m => <button key={m} className={m === curMonth ? 'sel' : ''} onClick={() => { setMonth(m); setTime(null); setMsg(null) }}>{monthLabel(m)}</button>)}
          </div>
        )}
        {days.length ? (
          <>
            <div className="bk-days">
              {monthDays.map(d => {
                const lb = dayLabel(d.date)
                return (
                  <button key={d.date} className={d.date === curDate ? 'sel' : ''} disabled={!d.free} onClick={() => { setDate(d.date); setTime(null) }}>
                    {lb.md}<br /><span className="bk-muted">{lb.wd}</span>{!d.free && <><br /><span className="bk-tag">{d.closed ? d.label : '已滿'}</span></>}
                  </button>
                )
              })}
            </div>
            {cur
              ? <div className="bk-slots">{cur.slots.map(s => <button key={s.time} className={s.time === curTime || s.time === second ? 'sel' : ''} disabled={!ok(s)} onClick={() => { setTime(s.time); setMsg(null) }}>{s.time}</button>)}</div>
              : <p className="bk-muted">這個課長目前沒有可預約的時段，換個課長或稍後再來看看。</p>}
          </>
        ) : <p className="bk-muted">目前沒有開放的時段，請稍後再來看看。</p>}
      </div>

      {curTime && (
        <div className="bk-card">
          <h2>3. 確認送出</h2>
          <p>{curDate} {curTime}，{L} 分鐘</p>
          {view.mode === 'generic' && (
            <>
              <label>姓名</label><input className="full" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
              <label>Email（確認信會寄到這裡）</label><input className="full" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </>
          )}
          <button className="primary" disabled={busy} onClick={submit}>{busy ? '送出中…' : '送出預約'}</button>
        </div>
      )}

      {msg && <div className={`bk-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
    </div>
  )
}
