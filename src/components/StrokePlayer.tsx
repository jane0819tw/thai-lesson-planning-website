import { useEffect, useRef, useState } from 'react'
import { STROKE_VIEWBOX as V, type StrokeData } from '../strokes'

// 以 SVG 路徑動畫呈現筆順：講義風格的四線格＋灰色字形當底，筆尖圓點帶著筆畫「寫出來」。
// 速度以「每秒走多少座標單位」計算，並設最短時間，短筆畫也不會一閃而過。
const SPEEDS = { normal: { pps: 55, min: 1.4 }, slow: { pps: 24, min: 3 } } as const
type Mode = keyof typeof SPEEDS
const PAUSE_MS = 500
// 四線格（對應 Noto Sans Thai Looped、字級 216、基線 216 時的位置）
const GUIDES = [61, 94, 215, 258]

export default function StrokePlayer({ char, data }: { char: string; data: StrokeData }) {
  const total = data.strokes.length
  const [pos, setPos] = useState(0)          // 0..total；整數部分＝已完成筆數，小數＝目前這筆的進度
  const [mode, setMode] = useState<Mode | null>(null) // null＝未播放
  const posRef = useRef(0)
  const pathRefs = useRef<(SVGPathElement | null)[]>([])
  const lens = useRef<number[]>([])

  const set = (p: number) => { posRef.current = p; setPos(p) }
  useEffect(() => { set(0); setMode(null) }, [char])

  useEffect(() => {
    if (!mode) return
    let raf = 0, last = performance.now(), pause = 0
    const tick = (now: number) => {
      const dt = now - last; last = now
      if (pause > 0) { pause -= dt }
      else {
        const i = Math.floor(posRef.current)
        if (i >= total) { setMode(null); return }
        const len = lens.current[i] ?? 100
        const { pps, min } = SPEEDS[mode]
        const dur = Math.max(min, len / pps) * 1000
        let next = posRef.current + dt / dur
        if (Math.floor(next) > i) { next = i + 1; pause = PAUSE_MS }
        set(next)
        if (next >= total) { setMode(null); return }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [mode, total])

  const measure = () => { lens.current = pathRefs.current.map(p => p?.getTotalLength() ?? 100) }
  useEffect(measure, [char, data])

  const play = (m: Mode) => { measure(); set(0); setMode(m) }
  const done = Math.floor(pos)
  const frac = pos - done
  const active = done < total && (mode !== null || frac > 0)
  let dot: { x: number; y: number } | null = null
  if (active) {
    const p = pathRefs.current[done]
    if (p) { const pt = p.getPointAtLength((lens.current[done] ?? p.getTotalLength()) * frac); dot = { x: pt.x, y: pt.y } }
  }
  const stop = () => setMode(null)

  return (
    <div className={`stroke${data.scale === 'mark' ? ' mark' : ''}`}>
      <svg viewBox={`0 0 ${V} ${V}`} role="img" aria-label={`${char} 的筆順`}>
        {(data.scale === 'mark' ? GUIDES.slice(0, 2) : GUIDES).map((y, i) => <line key={y} x1={8} x2={V - 8} y1={y} y2={y} className={i === 2 ? 'guide base' : 'guide'} />)}
        <line x1={V / 2} x2={V / 2} y1={30} y2={V - 20} className="guide v" />
        {data.ghost === 'path'
          ? data.strokes.map((d, i) => <path key={'g' + i} d={d} className="ghostpath" />)
          : <text x={V / 2} y={data.gy ?? 216} textAnchor="middle" fontSize={data.fs ?? 216} className="th ghost">{/[\u0e48-\u0e4b]/.test(char) ? '\u00A0' + char : char}</text>}
        {data.strokes.map((d, i) => (
          <path key={i} ref={el => { pathRefs.current[i] = el }} d={d} pathLength={1} className="pen"
            strokeDasharray="1 1"
            strokeDashoffset={i < done ? 0 : i === done && frac > 0 ? 1 - frac : 1}
            opacity={i < done || (i === done && frac > 0) ? 1 : 0} />
        ))}
        {data.strokes.slice(0, done + (active ? 1 : 0)).map((d, i) => {
          const m = /M\s*([\d.]+)\s+([\d.]+)/.exec(d)
          return m ? <text key={'n' + i} x={+m[1]} y={+m[2]} className="strokeno" dx="-8" dy="-8">{i + 1}</text> : null
        })}
        {dot && <circle cx={dot.x} cy={dot.y} r={7} className="penTip" />}
      </svg>
      <div className="strokebar">
        <button onClick={() => play('normal')}>▶ 播放</button>
        <button onClick={() => play('slow')}>🐢 慢速播放</button>
        {mode && <button onClick={stop}>⏸ 暫停</button>}
        <button onClick={() => { stop(); set(Math.max(0, Math.ceil(posRef.current) - 1)) }} disabled={pos === 0}>上一筆</button>
        <button onClick={() => { stop(); set(Math.min(total, Math.floor(posRef.current) + 1)) }} disabled={done >= total}>下一筆</button>
        <button onClick={() => { stop(); set(total) }}>全部</button>
        <span className="muted small">{Math.min(total, done + (active ? 1 : 0))} / {total}</span>
      </div>
      {data.draft && <p className="small muted">※ 筆順為自動產生的草稿，待老師確認。</p>}
    </div>
  )
}
