import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { WHOLE_COURSES, readingUnits, unitLabel, useLessons } from './access'
import { setSession } from './session'
import { getApi } from './api'
import { REVIEW_UNITS, reviewKey, reviewTitle } from '../reviews'
import { dictClipsOf, videoKey } from '../dictationClips'
import type { HomeworkRecord, OpenDays, StudentInfo, VideoItem } from './types'
import './booking.css'

// 時間皆為台北時間
const toMs = (s: string) => new Date(s.replace(' ', 'T') + ':00+08:00').getTime()
const hm = (s: string) => s.slice(11, 16)
const WD = ['日', '一', '二', '三', '四', '五', '六']
const dayLabel = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return { md: `${m}/${dd}`, wd: `週${WD[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]}` } }
const addMin = (t: string, n: number) => { const m = +t.slice(0, 2) * 60 + +t.slice(3) + n; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') }
// 進入教室：上課前 10 分鐘才出現按鈕，結束後 15 分鐘消失
const canJoin = (now: number, start: string, end: string) => now >= toMs(start) - 10 * 60000 && now <= toMs(end) + 15 * 60000
// 只開放 24 小時之後的時段（後端 Config.gs 的 MIN_NOTICE_HOURS 也是 24；前端再濾一次，頁面開著放久了也不會露出 24 小時內的格子）
const NOTICE_HOURS = 24

function HomeworkButton({ to, rec }: { to: string; rec?: HomeworkRecord }) {
  return (
    <Link to={to} className={`bk-hw${rec ? ' done' : ''}`}>
      {rec
        ? <>📝 作業 <b>✅ 已完成</b>　聽音 {rec.listen}・聽寫 {rec.typing}{rec.parse && `・斷句 ${rec.parse}`}　<u>再做一次</u></>
        : <>📝 作業 <b>尚未完成</b>　<u>開始</u></>}
    </Link>
  )
}

// 每個作業按鈕下方的「延伸影片挑戰」：課程 JSON 有設 videoChallenge 就連過去；沒設但有審查過的聽寫片段就進影片聽寫；都沒有顯示「即將開放」
function VideoChallenge({ to, rec }: { to?: string; rec?: HomeworkRecord }) {
  return to
    ? <Link to={to} className="bk-video">🎬 延伸影片挑戰{rec ? <> <b>✅ 已完成 {rec.typing}</b> <u>再做一次</u></> : ' →'}<small>（題目持續更新）</small></Link>
    : <span className="bk-video off">🎬 延伸影片挑戰（即將開放）</span>
}

// 「課後錄影」：記錄表有影片連結的課可以點進去看；需要錄影的學生（since 有值）從那天起還沒上傳的課顯示「影片整理中」
const VIDEO_SHOW = 10
const videoList = (videos: VideoItem[], since: string) => videos.filter(v => v.video || (since && v.start.slice(0, 10) >= since))
function VideoCard({ list }: { list: VideoItem[] }) {
  const [all, setAll] = useState(false)
  const shown = all ? list : list.slice(0, VIDEO_SHOW)
  return (
    <div className="bk-card">
      <h2>課後錄影</h2>
      {shown.map(v => {
        const lb = dayLabel(v.start.slice(0, 10))
        return (
          <div className="bk-item" key={v.start}>
            <div>
              {lb.md}（{lb.wd.slice(1)}）{v.dateOnly ? '' : ` ${hm(v.start)}–${hm(v.end)}`}・第 {v.no} 堂
              {v.progress && <div className="bk-muted">{v.progress}</div>}
            </div>
            {v.video
              ? <a className="bk-watch" href={v.video} target="_blank" rel="noopener noreferrer">▶ 觀看錄影</a>
              : <span className="bk-muted">影片整理中，上傳後會出現在這裡</span>}
          </div>
        )
      })}
      {list.length > shown.length && <button onClick={() => setAll(true)}>顯示更早的 {list.length - shown.length} 堂</button>}
    </div>
  )
}

// 上次載入的結果先顯示，背景再更新：從課程頁回到預約頁時不用重新等後端（過期資料只會短暫出現）
const cacheKey = (t: string) => `thaiskr_bk:${t}`
function readCache(t: string): { info?: StudentInfo; open?: OpenDays } {
  if (!t) return {}
  try { return JSON.parse(localStorage.getItem(cacheKey(t)) || '{}') } catch { return {} }
}
function writeCache(t: string, patch: { info?: StudentInfo; open?: OpenDays }) {
  if (!t) return
  try { localStorage.setItem(cacheKey(t), JSON.stringify({ ...readCache(t), ...patch })) } catch { /* 存不了就算了 */ }
}

// 從「我的課程」點進課程或作業頁，按返回時要回到「我的課程」分頁；平常打開一律是「預約」
const TAB_KEY = 'thaiskr_bk_tab'

export default function BookingPage() {
  const [sp] = useSearchParams()
  const token = sp.get('t') ?? ''
  const api = getApi(sp.get('mock') === '1')

  const [view, setView] = useState<StudentInfo | null>(() => readCache(token).info ?? null)
  const [open, setOpen] = useState<OpenDays | null>(() => readCache(token).open ?? null) // 時段比較慢，獨立載入，頁面其他部分不用等
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
  const [tab, setTab] = useState<'book' | 'courses' | 'records'>(() => { try { return sessionStorage.getItem(TAB_KEY) === 'courses' ? 'courses' : 'book' } catch { return 'book' } })
  useEffect(() => { try { sessionStorage.removeItem(TAB_KEY) } catch { /* 存不了就算了 */ } }, [])
  const lessons = useLessons()

  const loadInfo = useCallback(async () => { const v = await api.getStudentInfo(token); setView(v); if (v.mode !== 'invalid') writeCache(token, { info: v }) }, [token]) // eslint-disable-line react-hooks/exhaustive-deps
  const loadDays = useCallback(async (force = false) => { const d = await api.getOpenDays(force); setOpen(d); writeCache(token, { open: d }) }, [token]) // eslint-disable-line react-hooks/exhaustive-deps
  // 平台學生用不到時段；上次載入已知是平台學生就不抓（第一次還是會抓，抓完不顯示）
  useEffect(() => { loadInfo().catch(e => setError(e.message)); if (!readCache(token).info?.platform) loadDays().catch(e => setError(e.message)) }, [loadInfo, loadDays]) // eslint-disable-line react-hooks/exhaustive-deps
  // 記住這位學生，讓其他頁面的頁首能回到「我的預約」
  useEffect(() => { if (token && view && view.mode === 'known') setSession({ token, name: view.name }) }, [token, view])
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(i) }, [])

  if (error) return <div className="bk"><div className="bk-msg err">{error}</div></div>
  if (!view) return <div className="bk"><p className="bk-muted">載入中…</p></div>
  if (view.mode === 'invalid') return <div className="bk"><h1>預約連結已失效</h1><p className="bk-sub">請向老師索取新的預約連結。</p></div>

  const fixed = view.lessons?.len
  const L = fixed === 25 || fixed === 50 ? fixed : len
  const ok = (s: { can25: boolean; can50: boolean }) => (L === 25 ? s.can25 : s.can50)
  const earliest = now + NOTICE_HOURS * 3600000
  const days = (open?.days ?? [])
    .map(d => ({ ...d, slots: d.slots.filter(s => toMs(`${d.date} ${s.time}`) >= earliest) }))
    .filter(d => d.closed || d.slots.length)
    .map(d => ({ ...d, free: d.slots.some(ok) }))
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
  const platform = view.mode === 'known' && !!view.platform
  // 可進入的課程：老師在「學生」分頁勾選（存在試算表）。認字課每 5 課一個單位
  const allowed = view.courses ?? []
  const myUnits = readingUnits(lessons.map(x => x.number)).filter(u => allowed.includes(u.id))
  const myWhole = WHOLE_COURSES.filter(c => allowed.includes(c.key))
  const hasCourses = myUnits.length > 0 || myWhole.length > 0
  // 「課程紀錄」分頁：有課後錄影（或影片整理中）才出現。平台學生沒有預約分頁，預設看課程
  const videos = view.mode === 'known' ? videoList(view.videos ?? [], view.recording ?? '') : []
  const curTab = tab === 'records' && !videos.length ? 'courses' : platform && tab === 'book' ? 'courses' : tab
  const tabs: [typeof tab, string][] = [['book', '預約'], ['courses', '我的課程與作業'], ['records', '課程紀錄']]
  const myTabs = tabs.filter(([k]) => (k !== 'book' || !platform) && (k !== 'records' || videos.length > 0))

  const refresh = async () => { try { await Promise.all([loadInfo(), loadDays(true)]); setMsg(null) } catch (e) { setMsg({ ok: false, text: (e as Error).message }) } }
  const submit = async () => {
    if (!curDate || !curTime) return
    setBusy(true)
    try {
      await api.submitBooking(token, name, email, `${curDate} ${curTime}`, L)
      setMsg({ ok: true, text: '已送出！老師確認後，這個頁面的「我的預約」會出現 Zoom 連結。' }); setTime(null)
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
    setBusy(false)
    try { await Promise.all([loadInfo(), loadDays(true)]) } catch { /* 送出已成功，重讀失敗不影響 */ }
  }

  return (
    <div className="bk">
      <h1>{platform ? '我的課程與作業' : '預約泰語課'}</h1>
      <p className="bk-sub">{view.name ? `${view.name}，你好！` : ''}{platform ? '這裡可以進入課程、寫作業。' : '選擇課長與時段，送出後等老師確認，確認後可在這個頁面看到 Zoom 連結。時間皆為台北時間。'}</p>

      {view.mode === 'known' && myTabs.length > 1 && (
        <div className="tabs bk-tabs" role="tablist">
          {myTabs.map(([k, label]) => <button key={k} role="tab" aria-selected={curTab === k} className={curTab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>)}
        </div>
      )}

      {view.mode === 'known' && curTab === 'records' && <VideoCard list={videos} />}

      {view.mode === 'known' && curTab === 'courses' && (
        <div className="bk-card" onClickCapture={e => { if ((e.target as HTMLElement).closest('a')) { try { sessionStorage.setItem(TAB_KEY, 'courses') } catch { /* 存不了就算了 */ } } }}>
          {!platform && <h2>我的課程與作業</h2>}
          {hasCourses ? (
            <>
              {myUnits.length > 0 && (
                <div className="bk-unit-group">
                  <strong>泰文認字課程</strong>
                  {myUnits.map(u => (
                    <div className="bk-unit" key={u.id}>
                      <span className="bk-unit-h">{unitLabel(u)}</span>
                      <ul className="bk-lessons">
                        {lessons.filter(x => x.number >= u.from && x.number <= u.to).map(x => (
                          <li key={x.id}><Link to={`/reading/lesson/${x.id}`}><b>L{x.number}</b> {x.title}</Link>{' '}<HomeworkButton to={`/reading/lesson/${x.id}/homework?t=${encodeURIComponent(token)}`} rec={view.homework?.[String(x.number)]} /><VideoChallenge to={x.videoChallenge ?? (dictClipsOf(x.number).length ? `/reading/lesson/${x.id}/video?t=${encodeURIComponent(token)}` : undefined)} rec={view.homework?.[videoKey(x.number)]} /></li>
                        ))}
                        {REVIEW_UNITS.includes(u.n) && u.to - u.from === 4 && (
                          <li key={`review-${u.n}`}><b>複習</b> {reviewTitle(u.n)}{' '}<HomeworkButton to={`/reading/review/${u.n}?t=${encodeURIComponent(token)}`} rec={view.homework?.[reviewKey(u.n)]} /></li>
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              {myWhole.length > 0 && (
                <ul className="bk-courses">
                  {myWhole.map(c => (
                    <li key={c.key}><Link to={c.to!} className="bk-course"><strong>{c.title}</strong><small>{c.desc}</small><span className="bk-go">進入 →</span></Link></li>
                  ))}
                </ul>
              )}
            </>
          ) : <p className="bk-muted" style={{ margin: 0 }}>目前還沒有開放的課程，請聯絡老師。</p>}
        </div>
      )}


      {!platform && (view.mode !== 'known' || curTab === 'book') && (
        <>
        {l && (
          <div className="bk-card">
            <h2>堂數</h2>
            <p style={{ margin: 0 }}>
              <strong className="bk-big">剩餘 {l.left} 堂</strong><br />
              <span className="bk-muted">{fixed ? `${fixed} 分鐘課程包・` : ''}已購 {l.bought} 堂・已上 {l.used} 堂{l.booked ? `・已預約 ${l.booked} 堂（尚未上課）` : ''}</span>
            </p>
            {l.left <= 0 && <p className="bk-msg warn">課程堂數已用完，預約前請先和老師聯絡。</p>}
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
            <span className="bk-row"><span className="bk-muted">{open ? `最後更新 ${open.asOf.slice(5, 16).replace('-', '/')}` : ''}</span><button onClick={refresh}>重新整理時段</button></span>
          </div>
          <p className="bk-note bk-notice">⏰ 只開放 <b>{NOTICE_HOURS} 小時之後</b>的時段。想約 {NOTICE_HOURS} 小時內的課，或想約的時間沒有開放，請直接傳訊息詢問老師。</p>
          {months.length > 1 && (
            <div className="bk-row" style={{ marginBottom: 10 }}>
              {months.map(m => <button key={m} className={m === curMonth ? 'sel' : ''} onClick={() => { setMonth(m); setTime(null); setMsg(null) }}>{monthLabel(m)}</button>)}
            </div>
          )}
          {!open ? <p className="bk-muted">時段載入中…</p> : days.length ? (
            <>
              <div className="bk-days">
                {monthDays.map(d => {
                  const lb = dayLabel(d.date)
                  return (
                    <button key={d.date} className={d.date === curDate ? 'sel' : ''} disabled={!d.free} onClick={() => { setDate(d.date); setTime(null) }}>
                      {lb.md}<br /><span className="bk-muted">{lb.wd}</span>{!d.free && <><br />{d.closed ? <span className="bk-tag off">不開放</span> : <span className="bk-tag">已滿</span>}</>}
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
        </>
      )}
    </div>
  )
}
