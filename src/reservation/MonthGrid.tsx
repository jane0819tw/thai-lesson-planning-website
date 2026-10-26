import { hm } from './schedule'
import type { Draft } from './schedule'
import type { Month } from './types'

const WD = ['一', '二', '三', '四', '五', '六', '日']
// 某月加減 n 個月，回傳那個月 1 號
const shiftMonth = (m: string, n: number) => { const [y, mm] = m.split('-').map(Number); return new Date(Date.UTC(y, mm - 1 + n, 1)).toISOString().slice(0, 10) }

interface Props {
  mo: Month | null
  draft: Draft
  onMonth: (date: string) => void
  onDay: (date: string) => void
}

/** 老師頁月曆：每天列出當天的課與行事曆其他行程（只看，不能改開放時段）。點某一天切到那一週。 */
export default function MonthGrid({ mo, draft, onMonth, onDay }: Props) {
  if (!mo) return <p className="bk-muted">載入中…</p>
  const total = mo.days.filter(d => d.date.startsWith(mo.month)).reduce((n, d) => n + d.lessons.length, 0) // 只算預約表的課
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
            const cls = ['mgr-md', d.date.startsWith(mo.month) ? '' : 'other', d.date < mo.today ? 'past' : '', d.date === mo.today ? 'today' : '', o?.closed ? 'closed' : ''].filter(Boolean).join(' ')
            return (
              <button className={cls} key={d.date} onClick={() => onDay(d.date)} title="切到這一週">
                <span className="mgr-mn">{+d.date.slice(8)}</span>
                {draft.notes[d.date] && <span className="mgr-tag mgr-note">{draft.notes[d.date]}</span>}
                {d.allDay.map(t => <span className="mgr-tag" key={t}>{t}</span>)}
                {/* 預約表的課和行事曆上的其他行程（例如記錄表手寫的課）依時間排在一起 */}
                {[
                  ...d.lessons.map(l => ({ key: l.id, start: l.start, cls: `${l.source === '私下' ? 'priv' : 'at'}${l.status === '待確認' ? ' pend' : ''}`, text: l.name, title: `${l.name} ${hm(l.start)} ${l.len}分 ${l.status}` })),
                  ...d.events.map((e, i) => ({ key: 'ev' + i, start: e.start, cls: 'ev', text: e.title, title: `${e.title} ${hm(e.start)}–${hm(e.end)}` })),
                ].sort((a, b) => a.start - b.start).map(x => (
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
