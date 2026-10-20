// 筆順資料：data/strokes/strokes.json（由 data/strokes/chars/*.json 合併產生，請改 chars/ 底下的單字檔，再跑 npm run strokes）
// 格式：{ "ก": { "strokes": ["M x y L x y ...", "M ..."] } }，座標以 300×300 的 viewBox 為準，陣列順序＝筆順。
// 用 /reading/stroke-editor 在字形上描一遍就能錄製並匯出。
import raw from '../data/strokes/strokes.json'
import marks from '../data/strokes/marks.json' // 聲調符號（่ ้ ๊ ๋）的筆順草稿

// fs / gy：底字字級與基線（聲調符號比較小，要放大顯示才看得清楚）
export interface StrokeData { strokes: string[]; draft?: boolean; fs?: number; gy?: number; ghost?: 'path'; scale?: 'mark' }
export const STROKE_VIEWBOX = 300
// 四線格（以字級 216、基線 216 為準）。底字被縮小時（寬的母音），格線以基線為中心跟著縮，字與格線的比例才會一致。
// 底字（Layiji 點虛線字型）比四線格設計時的字型小，字級要乘上這個倍率，字高才會貼合格線（ก 的本體高度 123 ÷ 89）
export const GHOST_SCALE = 1.38
const GUIDES_216 = [61, 94, 215, 258]
export const guideLines = (fs = 216): number[] => GUIDES_216.map(y => Math.round((216 - (216 - y) * (fs / 216)) * 10) / 10)
const data = { ...(marks as Record<string, StrokeData>), ...(raw as Record<string, StrokeData>) }

// 聲調符號（่ ้ ๊ ๋）是組合字元，單獨顯示時有些裝置（如部分 Android）會出現虛線圓圈或缺字，
// 所以一律不用字型顯示，而是用筆畫資料自己畫出形狀。
export const isToneMark = (char: string): boolean => /^[\u0e48-\u0e4b]$/.test(char)

// 母音在課程資料裡用「-」代表 อ 的位置（例：เ-ะ）；筆順資料與底字一律用補上 อ 的樣子（เอะ、อา）
// 底字顯示用：Layiji 字型的 ำ（U+0E33）字形沒有上面的圈圈，所以拆成 ํ（U+0E4D）+ า 來畫。
// 兩者中間要插零寬不連字元（U+200C），否則字型會把 ํ+า 又合併回沒有圈圈的 ำ；資料名稱仍用原字
export const ghostText = (s: string): string => s.replace(/\u0e33/g, '\u0e4d\u200c\u0e32')
export const vowelForm = (v: string): string => v.replace('-', 'อ')
/** 母音單獨發音用的文字：單一符號（ะ า ิ）直接念符號本身；多個符號（เะ）會被拆成兩個母音，所以補上 อ 寫成「เอะ」。
 *  對應的預錄音檔（gTTS）由 scripts/gen-audio.py 以同樣規則產生。 */
export const vowelSpeech = (v: string): string => {
  const bare = v.replace('-', '')
  // 單獨一個 อ 會被念成子音名稱（ออ อ่าง），所以 -อ 也補成 ออ
  return bare.length > 1 || bare === 'อ' ? vowelForm(v) : bare
}

export function getStrokes(char: string): StrokeData | undefined {
  const s = data[char]
  if (!s || !s.strokes.length) return undefined
  return isToneMark(char) ? { ...s, ghost: 'path', scale: 'mark' } : s
}
export function strokeCount(): number { return Object.keys(data).filter(k => data[k].strokes.length).length }
