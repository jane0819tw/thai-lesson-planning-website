// 自動產生筆畫草稿。底字是點虛線字型時：找出每顆點的中心 → 把相鄰的點依序連成線（connectDots）。
// 找不到點（實線字型）時退回：畫成點陣 → 細線化（Zhang-Suen）→ 沿骨架描成路徑。
// 若這個字已經有筆畫，會參考它的順序與起筆方向重新排列（orderLike），讓新舊筆順連貫。
// 母音（多字元，例如 เอียะ）會先扣掉底字 อ 的形狀，只對母音符號產生筆畫。
// 產生的是草稿：起筆位置與方向是演算法的猜測，不一定符合書寫筆順，請在編輯器裡檢查修改。
import { STROKE_VIEWBOX as W, GHOST_SCALE, ghostText, getStrokes } from './strokes'
import { fitFs } from './ghostFit'

const FONT = '"LayijiTrace"'
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
  x.font = `${fs * GHOST_SCALE}px ${FONT}`
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

// ---- 點虛線字型專用：找出每顆點的中心，再把相鄰的點依序連成線 ----
const SS = 2 // 取點中心時用 2 倍解析度，中心比較準
interface Dot { x: number; y: number }

function dotCenters(text: string, x0: number, fs: number): Dot[] {
  const N = W * SS
  const c = document.createElement('canvas')
  c.width = c.height = N
  const x = c.getContext('2d', { willReadFrequently: true })!
  x.scale(SS, SS)
  x.font = `${fs * GHOST_SCALE}px ${FONT}`
  x.textBaseline = 'alphabetic'; x.textAlign = 'left'; x.fillStyle = '#000'
  x.fillText(text, x0, BASE)
  const d = x.getImageData(0, 0, N, N).data
  const on = (p: number) => d[p * 4 + 3] > 127
  const seen = new Uint8Array(N * N), out: (Dot & { area: number })[] = []
  for (let p = 0; p < N * N; p++) {
    if (!on(p) || seen[p]) continue
    const st = [p]; seen[p] = 1
    let sx = 0, sy = 0, n = 0
    while (st.length) {
      const q = st.pop()!
      const qx = q % N, qy = (q / N) | 0
      sx += qx; sy += qy; n++
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = qx + dx, Y = qy + dy
        if (X < 0 || Y < 0 || X >= N || Y >= N) continue
        const r = Y * N + X
        if (on(r) && !seen[r]) { seen[r] = 1; st.push(r) }
      }
    }
    out.push({ x: sx / n / SS, y: sy / n / SS, area: n })
  }
  if (!out.length) return []
  const areas = out.map(o => o.area).sort((a, b) => a - b), med = areas[areas.length >> 1]
  return out.filter(o => o.area >= med * 0.3).map(({ x, y }) => ({ x, y })) // 去掉雜點
}

// 把點連成幾筆：相鄰的點（距離 < 平均間距 × 1.6）相連，從端點出發，遇到岔路選方向最一致的
function connectDots(dots: Dot[]): Pt[][] {
  const n = dots.length
  if (n < 3) return []
  const dist = (a: number, b: number) => Math.hypot(dots[a].x - dots[b].x, dots[a].y - dots[b].y)
  const nn = dots.map((_, i) => { let m = 1e9; for (let j = 0; j < n; j++) if (j !== i) m = Math.min(m, dist(i, j)); return m }).sort((a, b) => a - b)
  const R = nn[n >> 1] * 1.6
  const adj = dots.map((_, i) => { const r: number[] = []; for (let j = 0; j < n; j++) if (j !== i && dist(i, j) <= R) r.push(j); return r })
  const comp = new Int32Array(n).fill(-1), comps: number[][] = []
  for (let i = 0; i < n; i++) {
    if (comp[i] >= 0) continue
    const st = [i], list: number[] = []
    comp[i] = comps.length
    while (st.length) { const q = st.pop()!; list.push(q); for (const r of adj[q]) if (comp[r] < 0) { comp[r] = comps.length; st.push(r) } }
    comps.push(list)
  }
  const meanX = (l: number[]) => l.reduce((a, i) => a + dots[i].x, 0) / l.length
  comps.sort((a, b) => meanX(a) - meanX(b)) // 由左到右：前置母音（เ แ โ ไ ใ）排在最前面
  const vis = new Uint8Array(n), strokes: Pt[][] = []
  const walk = (s: number): number[] => {
    const path = [s]; vis[s] = 1
    let cur = s
    for (;;) {
      const c = adj[cur].filter(q => !vis[q])
      if (!c.length) break
      let nx = c[0]
      if (c.length > 1) {
        const back = path[Math.max(0, path.length - 4)]
        const dx = dots[cur].x - dots[back].x, dy = dots[cur].y - dots[back].y
        let bs = -9
        for (const q of c) {
          const ex = dots[q].x - dots[cur].x, ey = dots[q].y - dots[cur].y, dl = Math.hypot(ex, ey) || 1
          const sc = path.length > 1 ? (ex * dx + ey * dy) / (dl * (Math.hypot(dx, dy) || 1)) - 0.3 * (dl / R) : -dl
          if (sc > bs) { bs = sc; nx = q }
        }
      }
      vis[nx] = 1; path.push(nx); cur = nx
    }
    return path
  }
  for (const list of comps) {
    let first = true
    for (;;) {
      let best = -1, bs = 1e9
      for (const i of list) {
        if (vis[i]) continue
        const free = adj[i].filter(q => !vis[q]).length
        const sc = (free <= 1 ? 0 : 1e5) + (first ? dots[i].y + dots[i].x * 0.3 : dots[i].y)
        if (sc < bs) { bs = sc; best = i }
      }
      if (best < 0) break
      const path = walk(best)
      const fresh = path.length
      if (!first) { // 接回已經畫過的點，筆畫才會連在一起
        const back = adj[path[path.length - 1]].find(q => vis[q] && !path.includes(q))
        if (back !== undefined) path.push(back)
      }
      first = false
      if (fresh >= 3) strokes.push(rdp(path.map(i => [dots[i].x, dots[i].y] as Pt), 0.9))
    }
  }
  return strokes
}

// ---- 參考現有筆畫：照它的順序與方向排列新筆畫 ----
const parsePath = (d: string): Pt[] => {
  const n = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number), out: Pt[] = []
  for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]])
  return out
}
// 沿著折線等距取 k 個點
function resample(pts: Pt[], k: number): Pt[] {
  if (pts.length < 2) return pts.length ? Array(k).fill(pts[0]) : []
  const seg: number[] = [0]
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const total = seg[seg.length - 1] || 1, out: Pt[] = []
  let j = 1
  for (let i = 0; i < k; i++) {
    const t = (total * i) / (k - 1)
    while (j < pts.length - 1 && seg[j] < t) j++
    const f = (t - seg[j - 1]) / ((seg[j] - seg[j - 1]) || 1)
    out.push([pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * f, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * f])
  }
  return out
}
const bounds = (all: Pt[][]) => {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
  for (const s of all) for (const p of s) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]) }
  return { x0, y0, w: x1 - x0 || 1, h: y1 - y0 || 1 }
}

// 現有筆畫的字形可能和現在的底字略有差異（字型不同），所以先把兩組筆畫的範圍對齊，再比對形狀：
// 每筆新筆畫歸到最像的現有筆畫，依現有筆畫的順序排列；起點離現有筆畫起點較遠就整筆反向。
function orderLike(paths: Pt[][], refD: string[]): Pt[][] {
  const refRaw = refD.map(parsePath).filter(r => r.length > 1)
  if (!refRaw.length || paths.length < 1) return paths
  const nb = bounds(paths), rb = bounds(refRaw)
  const ref = refRaw.map(r => resample(r.map(p => [nb.x0 + ((p[0] - rb.x0) / rb.w) * nb.w, nb.y0 + ((p[1] - rb.y0) / rb.h) * nb.h] as Pt), 24))
  const near = (p: Pt, r: Pt[]) => { let bi = 0, bd = 1e9; r.forEach((q, i) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < bd) { bd = d; bi = i } }); return { i: bi, d: bd }}
  const scored = paths.map(path => {
    const s = resample(path, 16)
    let bj = 0, bc = 1e9
    ref.forEach((r, j) => { const c = s.reduce((a, p) => a + near(p, r).d, 0) / s.length; if (c < bc) { bc = c; bj = j } })
    const a = near(s[0], ref[bj]).i, b = near(s[s.length - 1], ref[bj]).i
    const out = a > b ? path.slice().reverse() : path
    return { path: out, j: bj, pos: Math.min(a, b) }
  })
  return scored.sort((x, y) => x.j - y.j || x.pos - y.pos).map(x => x.path)
}

export interface GenResult { strokes: string[]; fs: number }

// form：子音（單一字元）或補上 อ 的母音（例如 เอียะ）。多字元＝母音，只描 อ 以外的部分。
export async function generateStrokes(form: string, reference?: string[]): Promise<GenResult> {
  await document.fonts.load(`${FS}px ${FONT}`, form)
  await document.fonts.ready
  const c = ctx2d()
  c.font = `${FS * GHOST_SCALE}px ${FONT}`
  const saved = getStrokes(form)
  const fs = saved ? saved.fs ?? 216 : fitFs(form) // 已有筆畫的字沿用存檔的字級
  c.font = `${fs * GHOST_SCALE}px ${FONT}`
  const tot = c.measureText(ghostText(form)).width, left = W / 2 - tot / 2
  const idx = form.length > 1 ? form.indexOf('อ') : -1 // 取代課程資料裡「-」的那個 อ
  // 底字是點虛線：先找每顆點的中心再連線；找不到點（換了實線字型）才退回「細線化」做法
  let dots = dotCenters(ghostText(form), left, fs)
  if (idx >= 0) {
    const ao = dotCenters('อ', left + c.measureText(form.slice(0, idx)).width, fs) // 底字 อ 自己的點，不描
    dots = dots.filter(d => !ao.some(a => Math.hypot(a.x - d.x, a.y - d.y) < 3.5))
  }
  const linked = connectDots(dots)
  const toD = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'} ${Math.round(p[0])} ${Math.round(p[1])}`).join(' ')
  if (linked.length) return { strokes: orderLike(linked, reference ?? []).map(toD), fs }
  const full = dilate(drawMask(ghostText(form), left, fs), 3)
  const m = new Uint8Array(W * W)
  if (idx >= 0) {
    const ao = dilate(drawMask('อ', left + c.measureText(form.slice(0, idx)).width, fs), 6)
    for (let i = 0; i < W * W; i++) m[i] = full[i] && !ao[i] ? 1 : 0
  } else m.set(full)
  for (const comp of components(m)) if (comp.length < 40) for (const p of comp) m[p] = 0
  thin(m); prune(m, 10)
  const comps = components(m).map(pix => {
    let sx = 0
    for (const p of pix) sx += p % W
    return { pix, cx: sx / pix.length }
  }).sort((a, b) => a.cx - b.cx) // 由左到右：前置母音（เ แ โ ไ ใ）自然排在最前面
  const paths: Pt[][] = []
  for (const cp of comps) for (const path of trace(m, cp.pix)) {
    if (path.length < 6) continue
    const pts = rdp(path.map(p => [p % W, (p / W) | 0] as Pt), 1.6)
    if (pts.length >= 2) paths.push(pts)
  }
  return { strokes: orderLike(paths, reference ?? []).map(toD), fs }
}
