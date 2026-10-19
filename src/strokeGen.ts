// 自動產生筆畫草稿：用網站的泰文字型把字畫成點陣 → 細線化（Zhang-Suen）→ 沿骨架描成路徑。
// 母音（多字元，例如 เอียะ）會先扣掉底字 อ 的形狀，只對母音符號產生筆畫。
// 產生的是草稿：起筆位置與方向是演算法的猜測，不一定符合書寫筆順，請在編輯器裡檢查修改。
import { STROKE_VIEWBOX as W } from './strokes'

const FONT = '"Noto Sans Thai Looped"'
const BASE = 216, FS = 216, MAX_W = 250

const nb = (m: Uint8Array, p: number): number[] => {
  const x = p % W, y = (p / W) | 0, r: number[] = []
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue
    const X = x + dx, Y = y + dy
    if (X < 0 || Y < 0 || X >= W || Y >= W) continue
    const q = Y * W + X
    if (m[q]) r.push(q)
  }
  return r
}

function ctx2d(): CanvasRenderingContext2D {
  const c = document.createElement('canvas')
  c.width = c.height = W
  return c.getContext('2d', { willReadFrequently: true })!
}

function drawMask(text: string, x0: number, fs: number): Uint8Array {
  const x = ctx2d()
  x.font = `${fs}px ${FONT}`
  x.textBaseline = 'alphabetic'; x.textAlign = 'left'; x.fillStyle = '#000'
  x.fillText(text, x0, BASE)
  const d = x.getImageData(0, 0, W, W).data, m = new Uint8Array(W * W)
  for (let i = 0; i < W * W; i++) m[i] = d[i * 4 + 3] > 127 ? 1 : 0
  return m
}

function dilate(m: Uint8Array, r: number): Uint8Array {
  const o = new Uint8Array(W * W)
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    if (!m[y * W + x]) continue
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const X = x + dx, Y = y + dy
      if (X >= 0 && Y >= 0 && X < W && Y < W) o[Y * W + X] = 1
    }
  }
  return o
}

function thin(m: Uint8Array) {
  const I = (x: number, y: number) => y * W + x
  let changed = true
  while (changed) {
    changed = false
    for (let s = 0; s < 2; s++) {
      const del: number[] = []
      for (let y = 1; y < W - 1; y++) for (let x = 1; x < W - 1; x++) {
        if (!m[I(x, y)]) continue
        const p2 = m[I(x, y - 1)], p3 = m[I(x + 1, y - 1)], p4 = m[I(x + 1, y)], p5 = m[I(x + 1, y + 1)]
        const p6 = m[I(x, y + 1)], p7 = m[I(x - 1, y + 1)], p8 = m[I(x - 1, y)], p9 = m[I(x - 1, y - 1)]
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
        if (B < 2 || B > 6) continue
        const q = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
        let A = 0
        for (let i = 0; i < 8; i++) if (!q[i] && q[i + 1]) A++
        if (A !== 1) continue
        if (s === 0) { if (p2 * p4 * p6 || p4 * p6 * p8) continue } else { if (p2 * p4 * p8 || p2 * p6 * p8) continue }
        del.push(I(x, y))
      }
      if (del.length) { changed = true; for (const d of del) m[d] = 0 }
    }
  }
}

function components(m: Uint8Array): number[][] {
  const seen = new Uint8Array(W * W), comps: number[][] = []
  for (let p = 0; p < W * W; p++) {
    if (!m[p] || seen[p]) continue
    const st = [p], pix: number[] = []
    seen[p] = 1
    while (st.length) {
      const c = st.pop()!
      pix.push(c)
      for (const q of nb(m, c)) if (!seen[q]) { seen[q] = 1; st.push(q) }
    }
    comps.push(pix)
  }
  return comps
}

// 刪掉骨架上很短的毛刺（細線化在轉角常留下的小尾巴）
function prune(m: Uint8Array, lim: number) {
  for (let it = 0; it < 2; it++) {
    for (let p = 0; p < W * W; p++) {
      if (!m[p] || nb(m, p).length !== 1) continue
      const path = [p]
      let prev = -1, cur = p, hit = false
      while (path.length <= lim) {
        const n = nb(m, cur).filter(q => q !== prev && !path.includes(q))
        if (n.length === 0) break
        if (n.length > 1 || nb(m, n[0]).length > 2) { hit = true; break }
        prev = cur; cur = n[0]; path.push(cur)
      }
      if (hit && path.length <= lim) for (const q of path) m[q] = 0
    }
  }
}

type Pt = [number, number]
function rdp(pts: Pt[], e: number): Pt[] {
  if (pts.length < 3) return pts
  const a = pts[0], b = pts[pts.length - 1]
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy)
  let md = -1, mi = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = L ? Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / L : Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1])
    if (d > md) { md = d; mi = i }
  }
  if (md > e) return rdp(pts.slice(0, mi + 1), e).slice(0, -1).concat(rdp(pts.slice(mi), e))
  return [a, b]
}

// 沿骨架走：從最上面的端點開始，遇到岔路選方向最一致的，走完再接剩下的分支
function trace(m: Uint8Array, pix: number[]): number[][] {
  const vis = new Uint8Array(W * W), out: number[][] = []
  const walk = (s: number) => {
    const path = [s]
    vis[s] = 1
    let cur = s
    for (;;) {
      const c = nb(m, cur).filter(q => !vis[q])
      if (!c.length) break
      let nx = c[0]
      if (c.length > 1) {
        const back = path[Math.max(0, path.length - 6)]
        const dx = cur % W - back % W, dy = ((cur / W) | 0) - ((back / W) | 0)
        let bs = -9
        for (const q of c) {
          const ex = q % W - cur % W, ey = ((q / W) | 0) - ((cur / W) | 0)
          const sc = (ex * dx + ey * dy) / (Math.hypot(ex, ey) || 1)
          if (sc > bs) { bs = sc; nx = q }
        }
      }
      const nn = nb(m, nx)
      for (const q of c) if (q !== nx && nn.includes(q)) vis[q] = 1
      vis[nx] = 1; path.push(nx); cur = nx
    }
    return path
  }
  let first = true
  for (;;) {
    let best = -1, bs = 1e9
    for (const p of pix) {
      if (vis[p]) continue
      const n = nb(m, p).filter(q => !vis[q]).length
      const y = (p / W) | 0, x = p % W
      const sc = (n <= 1 ? 0 : 1e5) + (first ? y + x * 0.3 : y)
      if (sc < bs) { bs = sc; best = p }
    }
    if (best < 0) break
    const path = walk(best)
    if (!first) {
      const last = path[path.length - 1]
      const adj = nb(m, last).find(q => vis[q] && !path.includes(q))
      if (adj !== undefined) path.push(adj)
    }
    first = false
    out.push(path)
  }
  return out
}

export interface GenResult { strokes: string[]; fs: number }

// form：子音（單一字元）或補上 อ 的母音（例如 เอียะ）。多字元＝母音，只描 อ 以外的部分。
export async function generateStrokes(form: string): Promise<GenResult> {
  await document.fonts.load(`${FS}px ${FONT}`, form)
  await document.fonts.ready
  const c = ctx2d()
  c.font = `${FS}px ${FONT}`
  const w0 = c.measureText(form).width
  const fs = w0 > MAX_W ? Math.floor((FS * MAX_W) / w0) : FS
  c.font = `${fs}px ${FONT}`
  const tot = c.measureText(form).width, left = W / 2 - tot / 2
  const full = drawMask(form, left, fs)
  const m = new Uint8Array(W * W)
  const idx = form.length > 1 ? form.indexOf('อ') : -1 // 取代課程資料裡「-」的那個 อ
  if (idx >= 0) {
    const ao = dilate(drawMask('อ', left + c.measureText(form.slice(0, idx)).width, fs), 2)
    for (let i = 0; i < W * W; i++) m[i] = full[i] && !ao[i] ? 1 : 0
  } else m.set(full)
  for (const comp of components(m)) if (comp.length < 40) for (const p of comp) m[p] = 0
  thin(m); prune(m, 10)
  const comps = components(m).map(pix => {
    let sx = 0
    for (const p of pix) sx += p % W
    return { pix, cx: sx / pix.length }
  }).sort((a, b) => a.cx - b.cx) // 由左到右：前置母音（เ แ โ ไ ใ）自然排在最前面
  const strokes: string[] = []
  for (const cp of comps) for (const path of trace(m, cp.pix)) {
    if (path.length < 6) continue
    const pts = rdp(path.map(p => [p % W, (p / W) | 0] as Pt), 1.6)
    if (pts.length < 2) continue
    strokes.push(pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' '))
  }
  return { strokes, fs }
}
