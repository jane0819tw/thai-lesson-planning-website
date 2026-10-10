import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { STROKE_VIEWBOX as V } from '../strokes'

// 筆順錄製工具：在淡色字形上用滑鼠／手指依筆順描一遍，匯出 JSON 貼進 data/strokes/strokes.json
export default function StrokeEditor() {
  const [char, setChar] = useState('ก')
  const [strokes, setStrokes] = useState<string[]>([])
  const [live, setLive] = useState<[number, number][]>([])
  const [out, setOut] = useState('')
  const svg = useRef<SVGSVGElement>(null)
  const drawing = useRef(false)

  const pt = (e: React.PointerEvent): [number, number] => {
    const r = svg.current!.getBoundingClientRect()
    return [Math.round(((e.clientX - r.left) / r.width) * V), Math.round(((e.clientY - r.top) / r.height) * V)]
  }
  const toPath = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' ')
  const down = (e: React.PointerEvent) => { drawing.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); setLive([pt(e)]) }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const p = pt(e)
    setLive(l => { const last = l[l.length - 1]; return !last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= 3 ? [...l, p] : l })
  }
  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    if (live.length > 1) setStrokes(s => [...s, toPath(live)])
    setLive([])
  }
  const exportJson = () => setOut(JSON.stringify({ [char]: { strokes } }, null, 2))

  return (
    <>
      <p><Link to="/reading">← 認字課程</Link></p>
      <h1>筆順錄製工具</h1>
      <p className="muted">在字形上依正確筆順一筆一筆描過去（每次放開算一筆），完成後按「匯出」，把結果貼進 <code>data/strokes/strokes.json</code>。</p>
      <div className="toolbar">
        <label>字母 <input className="th charinput" value={char} maxLength={2} onChange={e => { setChar(e.target.value); setStrokes([]); setOut('') }} /></label>
        <button onClick={() => setStrokes(s => s.slice(0, -1))} disabled={!strokes.length}>復原一筆</button>
        <button onClick={() => { setStrokes([]); setOut('') }}>清除</button>
        <button onClick={exportJson} disabled={!strokes.length}>匯出（{strokes.length} 筆）</button>
      </div>
      <div className="stroke">
        <svg ref={svg} viewBox={`0 0 ${V} ${V}`} className="canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <text x={V / 2} y={V * 0.72} textAnchor="middle" fontSize={V * 0.72} className="th ghost">{char}</text>
          {strokes.map((d, i) => <path key={i} d={d} className="pen" pathLength={1} />)}
          {live.length > 1 && <path d={toPath(live)} className="pen live" />}
        </svg>
      </div>
      {out && <textarea className="export" readOnly value={out} onFocus={e => e.currentTarget.select()} rows={8} />}
    </>
  )
}
