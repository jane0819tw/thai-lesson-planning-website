// 底字的字級：寬的母音（เอียะ）要縮小，高的前置母音（โ ไ ใ 的頂端）也不能超出畫布上緣。
// 回傳「名義字級」（最大 216），實際顯示字級 = 名義字級 × GHOST_SCALE。
// 縮放都是以 (x=150, 基線 y=216) 為中心，所以已存的筆畫可以用同一個比例一起縮放（見 scaleStrokes）。
import { GHOST_SCALE, STROKE_VIEWBOX as V, ghostText } from './strokes'

const FONT = '"LayijiTrace"'
const FS = 216, MAX_W = 250 // 文字進位寬度上限（沿用原規則）
const MARGIN = 8            // 字形（墨跡）離畫布邊緣至少留的空間
const BASE = 216

export function fitFs(form: string): number {
  form = ghostText(form)
  const S = 2, N = 2 * V * S // 畫布開大一點，才量得到超出畫布的墨跡
  const c = document.createElement('canvas')
  c.width = c.height = N
  const x = c.getContext('2d', { willReadFrequently: true })!
  x.scale(S, S)
  x.font = `${FS * GHOST_SCALE}px ${FONT}`
  x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = '#000'
  const adv = x.measureText(form).width
  const cx = V, cy = V + BASE // 畫布中央留白，字形中心放在 (cx, cy)
  x.fillText(form, cx, cy)
  const d = x.getImageData(0, 0, N, N).data
  let l = 0, r = 0, t = 0
  for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
    if (d[(py * N + px) * 4 + 3] <= 60) continue
    l = Math.min(l, px / S - cx); r = Math.max(r, px / S - cx); t = Math.max(t, cy - py / S)
  }
  let k = adv > MAX_W ? MAX_W / adv : 1
  const half = V / 2 - MARGIN
  if (l < 0) k = Math.min(k, half / -l)
  if (r > 0) k = Math.min(k, half / r)
  if (t > 0) k = Math.min(k, (BASE - MARGIN) / t)
  return k >= 1 ? FS : Math.floor(FS * k)
}

// 底字字級從 oldFs 變成 newFs 時，已存筆畫以 (150, 216) 為中心等比例縮放，仍然對得上底字
export function scaleStrokes(strokes: string[], oldFs: number, newFs: number): string[] {
  const k = newFs / oldFs
  return strokes.map(d => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, a, b) =>
    `${Math.round(150 + (parseFloat(a) - 150) * k)} ${Math.round(216 + (parseFloat(b) - 216) * k)}`))
}
