import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { STROKE_VIEWBOX as V, getStrokes, guideLines, isToneMark, vowelForm } from '../strokes'
import { getRepository } from '../data/repository'
import { generateStrokes } from '../strokeGen'
import { useMarkGhost } from '../markGhost'

const FS = 216, MAX_W = 250 // 底字字級；多字元的母音（เอียะ）太寬時會自動縮小，字級會跟著筆畫一起存

// 筆順錄製工具：在淡色字形上用滑鼠／手指依筆順描一遍，匯出 JSON 存成 data/strokes/chars/<字母>.json
export default function StrokeEditor() {
  const [char, setChar] = useState('ก')
  const [strokes, setStrokes] = useState<string[]>([])
  const [live, setLive] = useState<[number, number][]>([])
  const [out, setOut] = useState('')
  const [fs, setFs] = useState(FS)
  const [vowels, setVowels] = useState<string[]>([])
  const [auto, setAuto] = useState(false) // 目前的筆畫是自動產生且沒改過 → 存檔時標成草稿
  const svg = useRef<SVGSVGElement>(null)
  const ghost = useRef<SVGTextElement>(null)
  const drawing = useRef(false)
  const mark = isToneMark(char.trim())
  const mg = useMarkGhost(mark ? char.trim() : null)

  useEffect(() => {
    getRepository().listLessons().then(ls => {
      const seen = new Set<string>()
      for (const l of ls) for (const v of l.vowels) for (const f of [v.short, v.long]) if (f) seen.add(vowelForm(f))
      setVowels([...seen])
    })
  }, [])
  // 量底字寬度，太寬就縮小字級（字型載入完會再量一次）
  useEffect(() => {
    const measure = () => {
      const t = ghost.current
      if (!t) return setFs(FS)
      const w = (t.getComputedTextLength() * FS) / (Number(t.getAttribute('font-size')) || FS)
      setFs(w > MAX_W ? Math.floor((FS * MAX_W) / w) : FS)
    }
    measure()
    document.fonts.addEventListener('loadingdone', measure)
    return () => document.fonts.removeEventListener('loadingdone', measure)
  }, [char])

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
    if (live.length > 1) { setStrokes(s => [...s, toPath(live)]); setAuto(false) }
    setLive([])
  }
  const [msg, setMsg] = useState('')
  const save = async () => {
    setMsg('儲存中…')
    try {
      const r = await fetch('/__save-stroke', { method: 'POST', body: JSON.stringify({ char: char.trim(), strokes, fs, draft: auto }) })
      const j = await r.json()
      setMsg(j.ok ? `已儲存到 ${j.file}` : `儲存失敗：${j.error}`)
    } catch {
      setMsg('儲存失敗：只有本機 npm run dev 時能直接存檔，請改用「匯出」手動貼上')
    }
  }
  const autogen = async () => {
    setMsg('產生中…')
    const r = await generateStrokes(char.trim())
    setStrokes(r.strokes); setAuto(true); setOut('')
    setMsg(r.strokes.length ? `已自動產生 ${r.strokes.length} 筆草稿（起筆與方向是猜的）：請檢查、修改後按「儲存」` : '沒有產生出筆畫')
  }
  const exportJson = () => setOut(JSON.stringify({ [char.trim()]: { strokes, ...(fs < FS && { fs }) } }, null, 2))

  return (
    <>
      <p><Link to="/reading">← 認字課程</Link></p>
      <h1>筆順錄製工具</h1>
      <p className="muted">可先按「自動產生」得到草稿再修改；或在字形上依正確筆順一筆一筆描過去（每次放開算一筆），聲調符號（่ ้ ๊ ๋）沒有底字，請畫在上面兩條虛線之間。母音只描母音部分（底字裡的 อ 不用描）。完成後按「儲存」直接寫入資料檔（僅限本機 dev）；也可以按「匯出」，把結果存成 <code>data/strokes/chars/字母.json</code>（例如 ก.json），再執行 <code>npm run strokes</code>（或重開 dev）合併。聲調符號仍放 <code>data/strokes/marks.json</code>。</p>
      <div className="toolbar">
        <label>字母 <input className="th charinput" value={char} maxLength={6} onChange={e => { setChar(e.target.value); setStrokes([]); setAuto(false); setOut(''); setMsg('') }} /></label>
        <span className="small muted">聲調符號：</span>
        {['\u0e48', '\u0e49', '\u0e4a', '\u0e4b'].map(m => <button key={m} className="th" onClick={() => { setChar(m); setStrokes([]); setAuto(false); setOut('') }}>{'\u00A0' + m}</button>)}
        <button onClick={() => { setStrokes(getStrokes(char.trim())?.strokes ?? []); setAuto(false) }}>載入現有筆順</button>
        <button onClick={autogen} disabled={!char.trim() || isToneMark(char.trim())}>自動產生</button>
        <button onClick={() => { setStrokes(s => s.slice(0, -1)); setAuto(false) }} disabled={!strokes.length}>復原一筆</button>
        <button onClick={() => { setStrokes([]); setAuto(false); setOut('') }}>清除</button>
        <button onClick={exportJson} disabled={!strokes.length}>匯出（{strokes.length} 筆）</button>
        {import.meta.env.DEV && <button onClick={save} disabled={!strokes.length}>儲存（{strokes.length} 筆）</button>}
      </div>
      {vowels.length > 0 && (
        <div className="toolbar">
          <span className="small muted">母音（✓ 已錄）：</span>
          {vowels.map(f => <button key={f} className="th" onClick={() => { setChar(f); setStrokes([]); setAuto(false); setOut(''); setMsg('') }}>{f}{getStrokes(f) && ' ✓'}</button>)}
        </div>
      )}
      {msg && <p className="small">{msg}</p>}
      <div className={`stroke${mark ? ' mark' : ''}`}>
        <svg ref={svg} viewBox={`0 0 ${V} ${V}`} className="canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          {(mark ? guideLines().slice(0, 2) : guideLines(fs)).map((y, i) => <line key={y} x1={8} x2={V - 8} y1={y} y2={y} className={i === 2 ? 'guide base' : 'guide'} />)}
          {mark && mg && <text x={mg.x} y={mg.y} textAnchor="middle" fontSize={mg.fs} className="th ghost">{'\u00A0' + char.trim()}</text>}
          {!mark && <text ref={ghost} x={V / 2} y={216} textAnchor="middle" fontSize={fs} className="th ghost">{char.trim()}</text>}
          {strokes.map((d, i) => <path key={i} d={d} className="pen" pathLength={1} />)}
          {live.length > 1 && <path d={toPath(live)} className="pen live" />}
        </svg>
      </div>
      {out && <textarea className="export" readOnly value={out} onFocus={e => e.currentTarget.select()} rows={8} />}
    </>
  )
}
