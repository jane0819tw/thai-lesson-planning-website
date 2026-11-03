import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { HI0, LO0, STEP, effective, hm, shiftDate, wdOf } from './schedule'
import type { Draft } from './schedule'
import type { Week, WeekDay } from './types'
import { diffOn, msIn, tzLabel } from './tz'

const WD = ['', '一', '二', '三', '四', '五', '六', '日']
const H = 22 // 每個半小時格的高度（px）

// 畫面用「老師所在地」的時間，草稿／後端是台北時間。
// 一欄＝所在地的一天（或星期幾），一格＝所在地的半小時；換回台北時可能落在前一天或後一天。
type Key = string | number
interface Block { id: string; start: number; end: number; cls: string; title: string; label: ReactNode }
interface Col { key: Key; head: ReactNode; set: Set<number>; base: Map<number, [Key, number]>; blocks: Block[]; note: string; past: boolean; today: boolean; allDay: string[] }

interface Props {
  tab: 'cal' | 'reg'
  draft: Draft
  wk: Week | null
  tz: string
  onPaint: (key: string | number, mins: number[], on: boolean) => void
  onNote: (date: string) => void
  onWeek: (date: string) => void
}

const wrapWd = (w: number, n: number) => ((w - 1 + n) % 7 + 7) % 7 + 1

export default function ScheduleGrid({ tab, draft, wk, tz: viewTz, onPaint, onNote, onWeek }: Props) {
  const reg = tab === 'reg'
  const paint = useRef<{ on: boolean; last?: { k: string; m: number } } | null>(null)
  useEffect(() => { const up = () => { paint.current = null }; window.addEventListener('pointerup', up); return () => window.removeEventListener('pointerup', up) }, [])

  if (!reg && !wk) return <p className="bk-muted">載入中…</p>
  const localToday = msIn(Date.now(), viewTz).slice(0, 10)
  // 時差不是半小時的倍數（例如尼泊爾 +5:45）就沒辦法對齊格子，改用台北時間
  const dates = reg ? [localToday] : wk!.days.map(d => d.date)
  const tz = dates.every(d => diffOn(viewTz, d) % STEP === 0) ? viewTz : 'Asia/Taipei'
  const shift = (key: Key, n: number): Key => (reg ? wrapWd(+key, n) : shiftDate(String(key), n))
  const diff = (key: Key) => diffOn(tz, reg ? localToday : String(key))
  // 所在地 (key, 分鐘) → 台北 (key, 分鐘)
  const toBase = (key: Key, m: number): [Key, number] => { const t = m - diff(key), n = Math.floor(t / 1440); return [n ? shift(key, n) : key, t - n * 1440] }
  const baseSet = (key: Key) => (reg ? draft.reg[+key] : effective(draft, String(key)))

  const byDate = new Map<string, WeekDay>()
  if (wk) [...(wk.more ?? []), ...wk.days].forEach(d => byDate.set(d.date, d))
  // 某一天（所在地）的課與行程：台北的前一天、當天、後一天都可能落進來
  const blocksOf = (date: string): Block[] => {
    const out: Block[] = []
    ;[-1, 0, 1].forEach(n => {
      const bd = shiftDate(date, n), day = byDate.get(bd)
      if (!day) return
      const d = diffOn(tz, bd)
      const put = (s: number, e: number, b: Omit<Block, 'start' | 'end'>) => {
        const ls = s + d + n * 1440, le = e + d + n * 1440 // 換到「date 這一天」的分鐘
        if (le <= 0 || ls >= 1440) return
        out.push({ ...b, start: Math.max(0, ls), end: Math.min(1440, le) })
      }
      day.events.forEach((e, i) => put(e.start, e.end, { id: `ev${bd}${i}`, cls: 'ev', title: e.title, label: e.title }))
      day.lessons.forEach(l => {
        const t = hm(((l.start + d) % 1440 + 1440) % 1440)
        const short = l.end - l.start <= 30
        put(l.start, l.end, {
          id: l.id, cls: `${l.source === '私下' ? 'priv' : 'at'}${l.status === '待確認' ? ' pend' : ''}`, title: `${l.name} ${t} ${l.len}分 ${l.status}`,
          label: <><b>{l.name}</b>{short ? ' ' : <br />}{t}{!short && `・${l.len}分${l.status === '待確認' ? '・待確認' : ''}`}</>,
        })
      })
    })
    return out
  }

  const mkCol = (key: Key, head: ReactNode, extra: Partial<Col>): Col => {
    const set = new Set<number>(), base = new Map<number, [Key, number]>()
    for (let m = 0; m < HI0; m += STEP) { const b = toBase(key, m); base.set(m, b); if (baseSet(b[0]).has(b[1])) set.add(m) }
    return { key, head, set, base, blocks: [], note: '', past: false, today: false, allDay: [], ...extra }
  }
  const cols: Col[] = reg
    ? [1, 2, 3, 4, 5, 6, 7].map(w => mkCol(w, `週${WD[w]}`, {}))
    : wk!.days.map(d => mkCol(d.date, <>週{WD[wdOf(d.date)]}<br />{+d.date.slice(5, 7)}/{+d.date.slice(8)}</>, {
        blocks: blocksOf(d.date), note: draft.notes[d.date] ?? '', past: d.date < localToday, today: d.date === localToday, allDay: byDate.get(d.date)?.allDay ?? [],
      }))

  let lo = LO0
  const hi = HI0
  cols.forEach(c => { c.blocks.forEach(b => { lo = Math.min(lo, Math.floor(b.start / 60) * 60) }); c.set.forEach(t => { lo = Math.min(lo, Math.floor(t / 60) * 60) }) })
  const n = (hi - lo) / STEP, y = (m: number) => (m - lo) / STEP * H
  const baseToday = wk?.today ?? ''

  const cellOf = (t: EventTarget) => ((t as HTMLElement).closest?.('.cell:not(.off)') as HTMLElement | null)
  // 補齊同一欄內，上一個格子到這一格之間被滑鼠跳過的格子；換回台北時間後依台北的日期（星期）分批送出
  const apply = (c: HTMLElement) => {
    const p = paint.current!, k = c.dataset.k!, m = +c.dataset.m!
    const from = p.last && p.last.k === k ? p.last.m : m
    p.last = { k, m }
    const col = cols.find(x => String(x.key) === k)!
    const groups = new Map<Key, number[]>()
    for (let t = Math.min(from, m); t <= Math.max(from, m); t += STEP) {
      if (t < lo || t >= hi || col.set.has(t) === p.on) continue
      const [bk, bm] = col.base.get(t)!
      if (!reg && String(bk) < baseToday) continue // 台北已經過去的格子不能改
      groups.set(bk, [...(groups.get(bk) ?? []), bm])
    }
    groups.forEach((mins, bk) => onPaint(bk, mins, p.on))
  }

  return (
    <>
      {tz !== viewTz && <p className="bk-msg warn">{tzLabel(viewTz)}和台北的時差不是半小時的倍數，表格先用台北時間顯示。</p>}
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
              {c.note && <span className="mgr-tag mgr-note">{c.note}</span>}
              {c.allDay.map(t => <span className="mgr-tag" key={t}>{t}</span>)}
              {!reg && !c.past && <button className="mini" onClick={() => onNote(String(c.key))}>{c.note ? '改說明' : '休假說明'}</button>}
            </div>
          ))}
          <div className="mgr-gt" style={{ height: n * H }}>
            {Array.from({ length: (hi - lo) / 60 + 1 }, (_, i) => <span key={i} style={{ top: i * 2 * H }}>{hm(lo + i * 60)}</span>)}
          </div>
          {cols.map(c => (
            <div className="mgr-gc" key={c.key}>
              {Array.from({ length: n }, (_, i) => {
                const m = lo + i * STEP, [bk] = c.base.get(m)!
                const off = !reg && String(bk) < baseToday, x = !reg && !!draft.ov[String(bk)]?.closed
                return <div key={m} className={`cell${c.set.has(m) ? ' on' : ''}${off ? ' off' : ''}${x ? ' x' : ''}`} data-k={c.key} data-m={m} />
              })}
              {c.blocks.map(b => <div key={b.id} className={`mgr-gb ${b.cls}`} style={{ top: y(b.start), height: y(b.end) - y(b.start) - 2 }} title={b.title}>{b.label}</div>)}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
