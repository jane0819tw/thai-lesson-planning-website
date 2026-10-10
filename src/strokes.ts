// 筆順資料：data/strokes/strokes.json
// 格式：{ "ก": { "strokes": ["M x y L x y ...", "M ..."] } }，座標以 300×300 的 viewBox 為準，陣列順序＝筆順。
// 用 /reading/stroke-editor 在字形上描一遍就能錄製並匯出。
import raw from '../data/strokes/strokes.json'

export interface StrokeData { strokes: string[]; draft?: boolean }
export const STROKE_VIEWBOX = 300
const data = raw as Record<string, StrokeData>

export function getStrokes(char: string): StrokeData | undefined {
  const s = data[char]
  return s && s.strokes.length ? s : undefined
}
export function strokeCount(): number { return Object.keys(data).filter(k => data[k].strokes.length).length }
