// 聲調符號（่ ้ ๊ ๋）的底字：用字型畫出真正的符號（以不斷行空格當底字，不會出現虛線圓圈），
// 量出實際大小後縮放、置中在上面兩條虛線（y=61、94）之間，讓編輯器與播放器的底完全一致。
import { useEffect, useState } from 'react'

const FONT = '"Noto Sans Thai Looped"'
const BOX_CY = 77.5, BOX_H = 40, BOX_W = 80 // 目標：中心在兩條虛線中間，最高 40、最寬 80

export interface MarkGhost { x: number; y: number; fs: number }
const cache = new Map<string, MarkGhost>()

function measure(mark: string): MarkGhost | null {
  const hit = cache.get(mark)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = c.height = 300
  const x = c.getContext('2d', { willReadFrequently: true })!
  x.font = `216px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'alphabetic'
  x.fillText(' ' + mark, 150, 216)
  const d = x.getImageData(0, 0, 300, 300).data
  let x0 = 999, x1 = -1, y0 = 999, y1 = -1
  for (let y = 0; y < 300; y++) for (let X = 0; X < 300; X++) {
    if (d[(y * 300 + X) * 4 + 3] > 127) { x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  }
  if (x1 < 0) return null // 字型還沒載入
  const k = Math.min(BOX_H / (y1 - y0 + 1), BOX_W / (x1 - x0 + 1))
  const g = { x: 150 - ((x0 + x1) / 2 - 150) * k, y: BOX_CY - ((y0 + y1) / 2 - 216) * k, fs: 216 * k }
  cache.set(mark, g)
  return g
}

export function useMarkGhost(mark: string | null): MarkGhost | null {
  const [g, setG] = useState<MarkGhost | null>(null)
  useEffect(() => {
    if (!mark) { setG(null); return }
    let alive = true
    document.fonts.load(`216px ${FONT}`, ' ' + mark).then(() => document.fonts.ready).then(() => { if (alive) setG(measure(mark)) })
    return () => { alive = false }
  }, [mark])
  return g
}
