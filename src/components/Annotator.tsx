import { useEffect, useRef } from 'react'

// 投影片的筆跡：蓋在舞台上的一層 canvas。座標存成舞台寬高的比例，視窗大小改變時筆跡跟著縮放
export interface Stroke { color: string; pts: [number, number][] }

export default function Annotator({ strokes, drawing, color, onChange }: {
  strokes: Stroke[]; drawing: boolean; color: string; onChange: (s: Stroke[]) => void
}) {
  const cv = useRef<HTMLCanvasElement>(null)
  const cur = useRef<Stroke | null>(null)

  const paint = () => {
    const c = cv.current
    if (!c) return
    const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1
    if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr) }
    const g = c.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, r.width, r.height)
    g.lineCap = 'round'; g.lineJoin = 'round'
    g.lineWidth = Math.max(3, r.width / 320)
    for (const s of cur.current ? [...strokes, cur.current] : strokes) {
      g.strokeStyle = s.color
      g.beginPath()
      s.pts.forEach(([x, y], i) => i ? g.lineTo(x * r.width, y * r.height) : g.moveTo(x * r.width, y * r.height))
      if (s.pts.length === 1) g.lineTo(s.pts[0][0] * r.width + .1, s.pts[0][1] * r.height)
      g.stroke()
    }
  }
  useEffect(paint)
  useEffect(() => {
    const ro = new ResizeObserver(paint)
    if (cv.current) ro.observe(cv.current)
    return () => ro.disconnect()
  })

  const at = (e: React.PointerEvent): [number, number] => {
    const r = cv.current!.getBoundingClientRect()
    return [Math.round((e.clientX - r.left) / r.width * 1e4) / 1e4, Math.round((e.clientY - r.top) / r.height * 1e4) / 1e4]  // 存進 localStorage，四位小數就夠
  }
  return (
    <canvas
      ref={cv}
      className={drawing ? 'pt-ink on' : 'pt-ink'}
      onPointerDown={e => { if (!drawing) return; e.currentTarget.setPointerCapture(e.pointerId); cur.current = { color, pts: [at(e)] }; paint() }}
      onPointerMove={e => { if (!cur.current) return; cur.current.pts.push(at(e)); paint() }}
      onPointerUp={() => { if (!cur.current) return; const s = cur.current; cur.current = null; onChange([...strokes, s]) }}
      onPointerCancel={() => { cur.current = null; paint() }}
    />
  )
}
