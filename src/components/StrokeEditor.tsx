import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { STROKE_VIEWBOX as V, getStrokes, isToneMark } from '../strokes'

const GUIDES = [61, 94, 215, 258] // 與播放器相同的四線格；聲調符號只用上面兩條

// 筆順錄製工具：在淡色字形上用滑鼠／手指依筆順描一遍，匯出 JSON 存成 data/strokes/chars/<字母>.json
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
  const [msg, setMsg] = useState('')
  const save = async () => {
    setMsg('儲存中…')
    try {
      const r = await fetch('/__save-stroke', { method: 'POST', body: JSON.stringify({ char: char.trim(), strokes }) })
      const j = await r.json()
      setMsg(j.ok ? `已儲存到 ${j.file}` : `儲存失敗：${j.error}`)
    } catch {
      setMsg('儲存失敗：只有本機 npm run dev 時能直接存檔，請改用「匯出」手動貼上')
    }
  }
  const exportJson = () => setOut(JSON.stringify({ [char.trim()]: { strokes } }, null, 2))

  return (
    <>
      <p><Link to="/reading">← 認字課程</Link></p>
      <h1>筆順錄製工具</h1>
      <p className="muted">在字形上依正確筆順一筆一筆描過去（每次放開算一筆），聲調符號（่ ้ ๊ ๋）沒有底字，請畫在上面兩條虛線之間。完成後按「儲存」直接寫入資料檔（僅限本機 dev）；也可以按「匯出」，把結果存成 <code>data/strokes/chars/字母.json</code>（例如 ก.json），再執行 <code>npm run strokes</code>（或重開 dev）合併。聲調符號仍放 <code>data/strokes/marks.json</code>。</p>
      <div className="toolbar">
        <label>字母 <input className="th charinput" value={char} maxLength={2} onChange={e => { setChar(e.target.value); setStrokes([]); setOut(''); setMsg('') }} /></label>
        <span className="small muted">聲調符號：</span>
        {['\u0e48', '\u0e49', '\u0e4a', '\u0e4b'].map(m => <button key={m} className="th" onClick={() => { setChar(m); setStrokes([]); setOut('') }}>{'\u00A0' + m}</button>)}
        <button onClick={() => setStrokes(getStrokes(char.trim())?.strokes ?? [])}>載入現有筆順</button>
        <button onClick={() => setStrokes(s => s.slice(0, -1))} disabled={!strokes.length}>復原一筆</button>
        <button onClick={() => { setStrokes([]); setOut('') }}>清除</button>
        <button onClick={exportJson} disabled={!strokes.length}>匯出（{strokes.length} 筆）</button>
        {import.meta.env.DEV && <button onClick={save} disabled={!strokes.length}>儲存（{strokes.length} 筆）</button>}
      </div>
      {msg && <p className="small">{msg}</p>}
      <div className="stroke">
        <svg ref={svg} viewBox={`0 0 ${V} ${V}`} className="canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          {(isToneMark(char.trim()) ? GUIDES.slice(0, 2) : GUIDES).map((y, i) => <line key={y} x1={8} x2={V - 8} y1={y} y2={y} className={i === 2 ? 'guide base' : 'guide'} />)}
          {!isToneMark(char.trim()) && <text x={V / 2} y={216} textAnchor="middle" fontSize={216} className="th ghost">{char}</text>}
          {strokes.map((d, i) => <path key={i} d={d} className="pen" pathLength={1} />)}
          {live.length > 1 && <path d={toPath(live)} className="pen live" />}
        </svg>
      </div>
      {out && <textarea className="export" readOnly value={out} onFocus={e => e.currentTarget.select()} rows={8} />}
    </>
  )
}
