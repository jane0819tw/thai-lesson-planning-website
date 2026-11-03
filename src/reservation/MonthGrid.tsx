import { hm, shiftDate } from './schedule'
import type { Draft } from './schedule'
import type { Month } from './types'
import { diffOn, msIn } from './tz'

const WD = ['一', '二', '三', '四', '五', '六', '日']
// 某月加減 n 個月，回傳那個月 1 號
const shiftMonth = (m: string, n: number) => { const [y, mm] = m.split('-').map(Number); return new Date(Date.UTC(y, mm - 1 + n, 1)).toISOString().slice(0, 10) }

interface Props {
  mo: Month | null
  draft: Draft
  onMonth: (date: string) => void
  onDay: (date: string) => void
  /** 顯示用的時區（老師所在地）；月曆資料是台北時間，這裡換算後依所在地日期重新分組 */
  tz: string
}
interface Item { key: string; start: number; cls: string; text: string; title: string }

/** 老師頁月曆：每天列出當天的課與行事曆其他行程（只看，不能改開放時段）。點某一天切到那一週。 */
export default function MonthGrid({ mo, draft, onMonth, onDay, tz }: Props) {
  if (!mo) return <p className="bk-muted">載入中…</p>
  const today = msIn(Date.now(), tz).slice(0, 10)
  // 預約表的課和行事曆上的其他行程（例如記錄表手寫的課）換成所在地時間，依日期分組
  const items = new Map<string, Item[]>()
  let total = 0 // 只算預約表的課
  const put = (bd: string, m: number, it: Omit<Item, 'start'>) => {
    const t = m + diffOn(tz, bd), n = Math.floor(t / 1440), date = shiftDate(bd, n), start = t - n * 1440
    if (it.key[0] !== 'e' && date.startsWith(mo.month)) total++
    items.set(date, [...(items.get(date) ?? []), { ...it, start }])
  }
  mo.days.forEach(d => {
    const lm = (m: number) => hm(((m + diffOn(tz, d.date)) % 1440 + 1440) % 1440)
    d.lessons.forEach(l => put(d.date, l.start, { key: 'l' + l.id, cls: `${l.source === '私下' ? 'priv' : 'at'}${l.status === '待確認' ? ' pend' : ''}`, text: l.name, title: `${l.name} ${lm(l.start)} ${l.len}分 ${l.status}` }))
    d.events.forEach((e, i) => put(d.date, e.start, { key: `ev${d.date}${i}`, cls: 'ev', text: e.title, title: `${e.title} ${lm(e.start)}–${lm(e.end)}` }))
  })
  return (
    <>
      <div className="bk-row" style={{ marginBottom: 10 }}>
        <button onClick={() => onMonth(shiftMonth(mo.month, -1))}>‹ 上個月</button>
        <button onClick={() => onMonth('')}>本月</button>
        <button onClick={() => onMonth(shiftMonth(mo.month, 1))}>下個月 ›</button>
        <strong>{mo.month.slice(0, 4)} 年 {+mo.month.slice(5)} 月</strong>
        <span className="bk-muted">共 {total} 堂</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div className="mgr-m">
          {WD.map(w => <div className="mgr-mh" key={w}>週{w}</div>)}
          {mo.days.map(d => {
            const o = draft.ov[d.date]
            const cls = ['mgr-md', d.date.startsWith(mo.month) ? '' : 'other', d.date < today ? 'past' : '', d.date === today ? 'today' : '', o?.closed ? 'closed' : ''].filter(Boolean).join(' ')
            return (
              <button className={cls} key={d.date} onClick={() => onDay(d.date)} title="切到這一週">
                <span className="mgr-mn">{+d.date.slice(8)}</span>
                {draft.notes[d.date] && <span className="mgr-tag mgr-note">{draft.notes[d.date]}</span>}
                {d.allDay.map(t => <span className="mgr-tag" key={t}>{t}</span>)}
                {/* 依時間排在一起 */}
                {[...(items.get(d.date) ?? [])].sort((a, b) => a.start - b.start).map(x => (
                  <span key={x.key} className={`mgr-ml ${x.cls}`} title={x.title}>{hm(x.start)} {x.text}</span>
                ))}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
