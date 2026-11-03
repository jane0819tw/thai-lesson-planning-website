import type { SongLine } from './types'

/** 每句第一次出現的句號；同樣的句子（如副歌）指回第一次 */
export function firstOfLines(lines: SongLine[]): number[] {
  const seen = new Map<string, number>()
  return lines.map((L, i) => {
    const key = L.th.replace(/\s/g, '')
    if (!seen.has(key)) seen.set(key, i)
    return seen.get(key) as number
  })
}

/** 隱藏的句子（重複的副歌）播放時改標在哪一句：找字最像的顯示句；顯示的句子就是自己，找不到是 -1 */
export function shownAsLines(lines: SongLine[]): number[] {
  const grams = (t: string) => {
    const k = t.replace(/\s/g, '')
    const g = new Set<string>()
    for (let j = 0; j + 1 < k.length; j++) g.add(k.slice(j, j + 2))
    return g
  }
  const all = lines.map(L => grams(L.th))
  return lines.map((L, i) => {
    if (!L.hidden) return i
    let best = -1, score = 0.5
    lines.forEach((M, k) => {
      if (M.hidden) return
      const common = [...all[i]].filter(g => all[k].has(g)).length
      const dice = (2 * common) / (all[i].size + all[k].size || 1)
      if (dice > score) { best = k; score = dice }
    })
    return best
  })
}

/** 每句被哪些隱藏句重唱（依時間順序），有的話就是副歌 */
export function repeatsOfLines(shownAs: number[]): number[][] {
  const m = shownAs.map(() => [] as number[])
  shownAs.forEach((v, i) => { if (v >= 0 && v !== i) m[v].push(i) })
  return m
}

/**
 * 單字、句型第一次出現在哪一句（只看學生看得到的句子），找不到是 -1。
 * 先找斷詞完全相同的字；找不到再看整句是否包含它的泰文片段（句型的「+ 動詞」「…」等不算）。
 */
export function noteLines(
  lines: { th: string; words: { th: string }[]; hidden?: boolean }[],
  notes: { th: string }[],
): number[] {
  const thai = (t: string) => t.match(/[฀-๿]+/g) ?? []
  return notes.map(n => {
    const byWord = lines.findIndex(L => !L.hidden && L.words.some(w => w.th.trim() === n.th))
    if (byWord >= 0) return byWord
    const parts = thai(n.th)
    if (!parts.length) return -1
    return lines.findIndex(L => !L.hidden && parts.every(p => L.th.includes(p)))
  })
}
