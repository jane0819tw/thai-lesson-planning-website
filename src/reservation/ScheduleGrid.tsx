import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { HI0, LO0, STEP, effective, hm, shiftDate, wdOf } from './schedule'
import type { Draft } from './schedule'
import type { Week, WeekEvent, WeekLesson } from './types'

const WD = ['', '一', '二', '三', '四', '五', '六', '日']
const H = 22 // 每個半小時格的高度（px）

interface Col { key: string | number; head: ReactNode; set: Set<number>; lessons: WeekLesson[]; events: WeekEvent[]; closed: boolean; label: string; past: boolean; today: boolean; allDay: string[] }

interface Props {
  tab: 'cal' | 'reg'
  draft: Draft
  wk: Week | null
  onPaint: (key: string | number, mins: number[], on: boolean) => void
  onHoliday: (date: string) => void
  onWeek: (date: string) => void
}

export default function ScheduleGrid({ tab, draft, wk, onPaint, onHoliday, onWeek }: Props) {
  const reg = tab === 'reg'
  const paint = useRef<{ on: boolean; last?: { k: string; m: number } } | null>(null)
  useEffect(() => { const up = () => { paint.current = null }; window.addEventListener('pointerup', up); return () => window.removeEventListener('pointerup', up) }, [])

  if (!reg && !wk) return <p className="bk-muted">載入中…</p>
  const cols: Col[] = reg
    ? [1, 2, 3, 4, 5, 6, 7].map(w => ({ key: w, head: `週${WD[w]}`, set: draft.reg[w], lessons: [], events: [], closed: false, label: '', past: false, today: false, allDay: [] }))
    : wk!.days.map(d => ({
        key: d.date, head: <>週{WD[wdOf(d.date)]}<br />{+d.date.slice(5, 7)}/{+d.date.slice(8)}</>, set: effective(draft, d.date), lessons: d.lessons, events: d.events,
        closed: !!draft.ov[d.date]?.closed, label: draft.ov[d.date]?.label ?? '', past: d.date < wk!.today, today: d.date === wk!.today, allDay: d.allDay,
      }))

  let lo = LO0
  const hi = HI0
  cols.forEach(c => { [...c.lessons, ...c.events].forEach(b => { lo = Math.min(lo, Math.floor(b.start / 60) * 60) }); c.set.forEach(t => { lo = Math.min(lo, Math.floor(t / 60) * 60) }) })
  const n = (hi - lo) / STEP, y = (m: number) => (m - lo) / STEP * H

  const cellOf = (t: EventTarget) => ((t as HTMLElement).closest?.('.cell:not(.off)') as HTMLElement | null)
  // 補齊同一欄內，上一個格子到這一格之間被滑鼠跳過的格子
  const apply = (c: HTMLElement) => {
    const p = paint.current!, k = c.dataset.k!, m = +c.dataset.m!
    const from = p.last && p.last.k === k ? p.last.m : m
    p.last = { k, m }
    const col = cols.find(x => String(x.key) === k)!
    const mins: number[] = []
    for (let t = Math.min(from, m); t <= Math.max(from, m); t += STEP) if (t >= lo && t < hi && col.set.has(t) !== p.on) mins.push(t)
    if (mins.length) onPaint(reg ? +k : k, mins, p.on)
  }

  return (
    <>
      {!reg && wk && (
        <div className="bk-row" style={{ marginBottom: 10 }}>
          <button onClick={() => onWeek(shiftDate(wk.monday, -7))}>‹ 上週</button>
          <button onClick={() => onWeek('')}>本週</button>
          <button onClick={() => onWeek(shiftDate(wk.monday, 7))}>下週 ›</button>
          <strong>{wk.days[0].date.replace(/-/g, '/')} – {wk.days[6].date.replace(/-/g, '/')}</strong>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <div
          className="mgr-g"
          onPointerDown={e => {
            if (e.pointerType !== 'mouse') return
            const c = cellOf(e.target); if (!c) return
            e.preventDefault(); paint.current = { on: !c.classList.contains('on') }; apply(c)
          }}
          onPointerOver={e => { if (paint.current) { const c = cellOf(e.target); if (c) apply(c) } }}
          onClick={e => {
            if ((e.nativeEvent as PointerEvent).pointerType === 'mouse') return // 滑鼠已在 pointerdown 處理
            const c = cellOf(e.target); if (!c) return
            paint.current = { on: !c.classList.contains('on') }; apply(c); paint.current = null
          }}
        >
          <div className="mgr-gh" style={{ borderLeft: 0 }} />
          {cols.map(c => (
            <div className={`mgr-gh${c.today ? ' today' : ''}`} key={c.key}>
              {c.head}
              {c.closed && <span className="mgr-tag">{c.label}</span>}
              {c.allDay.map(t => <span className="mgr-tag" key={t}>{t}</span>)}
              {!reg && !c.past && <button className="mini" onClick={() => onHoliday(String(c.key))}>{c.closed ? '取消休假' : '休假'}</button>}
            </div>
          ))}
          <div className="mgr-gt" style={{ height: n * H }}>
            {Array.from({ length: (hi - lo) / 60 + 1 }, (_, i) => <span key={i} style={{ top: i * 2 * H }}>{hm(lo + i * 60)}</span>)}
          </div>
          {cols.map(c => (
            <div className={`mgr-gc${c.closed ? ' closed' : ''}`} key={c.key}>
              {Array.from({ length: n }, (_, i) => { const m = lo + i * STEP; return <div key={m} className={`cell${c.set.has(m) ? ' on' : ''}${c.past ? ' off' : ''}`} data-k={c.key} data-m={m} /> })}
              {c.events.map((e, i) => <div key={i} className="mgr-gb ev" style={{ top: y(e.start), height: y(e.end) - y(e.start) - 2 }}>{e.title}</div>)}
              {c.lessons.map(l => {
                const short = l.end - l.start <= 30
                return (
                  <div key={l.id} className={`mgr-gb ${l.source === '私下' ? 'priv' : 'at'}${l.status === '待確認' ? ' pend' : ''}`} style={{ top: y(l.start), height: y(l.end) - y(l.start) - 2 }} title={`${l.name} ${hm(l.start)} ${l.len}分 ${l.status}`}>
                    <b>{l.name}</b>{short ? ' ' : <br />}{hm(l.start)}{!short && `・${l.len}分${l.status === '待確認' ? '・待確認' : ''}`}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

