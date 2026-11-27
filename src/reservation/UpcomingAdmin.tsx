import { useEffect, useState } from 'react'
import type { Booking, RecSession, StudentRow } from './types'
import { baseMs, fromBase, msIn, wdName } from './tz'

// 學生預約頁就在同一個網站：<網站>/#/book?t=<代碼>
export const linkOf = (s: StudentRow) => `${location.origin}${location.pathname}#/book?t=${s.token}`

/** 一堂（前後相連、同一位學生、同一個 Zoom 的課合成一筆）。start／end 是台北時間字串 */
export interface UpSession { name: string; source: string; status: string; start: string; end: string; zoom: string; count: number }

const GRACE = 15 // 下課後 15 分鐘內還列著（跟學生頁「進入教室」一樣）
const toStr = (ms: number) => msIn(ms, 'Asia/Taipei')

/** 預約表（待確認／已確認）＋記錄表裡另外排的課 → 還沒結束的課，由近到遠 */
export function upcomingSessions(bookings: Booking[], rec: RecSession[] | null, now: number): UpSession[] {
  const list: UpSession[] = []
  bookings.forEach(b => {
    if (b.status !== '待確認' && b.status !== '已確認') return
    list.push({ name: b.name, source: b.source, status: b.status, start: b.start, end: toStr(baseMs(b.start) + Number(b.length) * 60000), zoom: b.zoom || '', count: 1 })
  })
  rec?.forEach(r => list.push({ name: r.name, source: '記錄表', status: '已確認', start: r.start, end: r.end, zoom: r.zoom || '', count: 1 }))
  list.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
  const out: UpSession[] = []
  list.forEach(x => {
    if (baseMs(x.end) + GRACE * 60000 < now) return
    const last = out.find(o => o.name === x.name && o.status === x.status && baseMs(x.start) >= baseMs(o.end) - 60000 && baseMs(x.start) - baseMs(o.end) <= 5 * 60000 && (!o.zoom || !x.zoom || o.zoom === x.zoom))
    if (last) { if (x.end > last.end) last.end = x.end; if (!last.zoom) last.zoom = x.zoom; last.count++ } else out.push({ ...x })
  })
  return out
}

const dayLabel = (date: string, today: string, tomorrow: string) =>
  `${date === today ? '今天　' : date === tomorrow ? '明天　' : ''}${date.slice(5).replace('-', '/')}（${wdName(date)}）`

function until(now: number, s: UpSession) {
  const a = baseMs(s.start), b = baseMs(s.end)
  if (now >= a && now <= b) return { text: '上課中', hot: true }
  if (now > b) return { text: '剛下課', hot: false }
  const m = Math.round((a - now) / 60000)
  if (m < 60) return { text: `${m} 分鐘後`, hot: m <= 10 }
  if (m < 24 * 60) return { text: `${Math.floor(m / 60)} 小時 ${m % 60 ? `${m % 60} 分` : ''}後`, hot: false }
  return null
}

export default function UpcomingAdmin({ sessions, recLoading, students, tz, now, onRefresh }: { sessions: UpSession[]; recLoading: boolean; students: StudentRow[]; tz: string; now: number; onRefresh: () => void }) {
  const today = msIn(now, tz).slice(0, 10), tomorrow = msIn(now + 864e5, tz).slice(0, 10)
  const groups: [string, UpSession[]][] = []
  sessions.forEach(s => {
    const d = fromBase(s.start, tz).slice(0, 10)
    const g = groups[groups.length - 1]
    if (g && g[0] === d) g[1].push(s); else groups.push([d, [s]])
  })
  const noZoomYet = sessions.length > 0 && sessions.every(s => !s.zoom) // 舊版後端不回傳 Zoom 連結
  return (
    <div className="bk-card">
      <div className="bk-row between">
        <h2 style={{ margin: 0 }}>即將上課</h2>
        <button onClick={onRefresh}>重新整理</button>
      </div>
      <p className="bk-muted">預約表裡待確認／已確認的課，加上學生記錄表裡另外排的課（前後相連的課合成一筆）。按「進入教室」直接開 Zoom；下課 15 分鐘後從列表消失。</p>
      {recLoading && <p className="bk-muted">讀取學生記錄表中…（記錄表裡另外排的課稍後出現）</p>}
      {!sessions.length ? <p className="bk-muted">目前沒有即將上的課。</p> : groups.map(([d, list]) => (
        <div key={d} className="up-day">
          <h3 className={d === today ? 'today' : ''}>{dayLabel(d, today, tomorrow)}</h3>
          {list.map(s => {
            const st = students.find(x => x.name === s.name)
            const u = until(now, s)
            const at = s.source === 'AmazingTalker'
            return (
              <div className={`bk-item up-item${u?.hot ? ' hot' : ''}`} key={s.name + s.start}>
                <div>
                  <b>{fromBase(s.start, tz).slice(11, 16)}–{fromBase(s.end, tz).slice(11, 16)}</b>　{s.name}
                  {at ? <span className="mgr-at">AT</span> : s.source === '記錄表' && <span className="up-tag">記錄表</span>}
                  {s.status === '待確認' && <span className="up-pend">待確認</span>}
                  {u && <span className={`up-when${u.hot ? ' hot' : ''}`}>{u.text}</span>}
                  <div className="bk-muted">{Math.round((baseMs(s.end) - baseMs(s.start)) / 60000)} 分{s.count > 1 ? `（${s.count} 堂連上）` : ''}</div>
                </div>
                <div className="bk-row">
                  {s.zoom
                    ? <a className={`bk-btn${u?.hot ? ' primary' : ''}`} href={s.zoom} target="_blank" rel="noopener noreferrer">進入教室</a>
                    : <span className="bk-muted">{at ? '在 AmazingTalker 上課' : s.status === '待確認' ? '確認後建立 Zoom' : '沒有 Zoom 連結'}</span>}
                  {st?.token && <a className="bk-btn" href={linkOf(st)} target="_blank" rel="noopener noreferrer">學生頁</a>}
                  {st && /^https?:/.test(st.record ?? '') && <a className="bk-btn" href={st.record} target="_blank" rel="noopener noreferrer">記錄表</a>}
                </div>
              </div>
            )
          })}
        </div>
      ))}
      {noZoomYet && <p className="bk-msg warn">都沒有 Zoom 連結：如果應該要有，後端可能還是舊版，請到 Apps Script「管理部署作業 → 新版本」。</p>}
    </div>
  )
}

/** 每 30 秒更新一次「現在」，讓「幾分鐘後／上課中」跟著走 */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return now
}
