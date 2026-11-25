import { GHOST_SCALE, getStrokes, ghostText, guideLines, STROKE_VIEWBOX as V } from '../strokes'

// 練字格（列印講義）：四線格＋描字，和筆順播放器的底字一樣：Layiji 點虛線描字字型、同樣的字級與基線（寬的母音用筆順資料的 fs／gy 縮小，格線跟著縮）
// L1 老師：不要筆順圖；L2 老師：描字的字要和筆順那種描寫字體一樣
// 格子的可視範圍 0..285：上面留給上方母音（ิ ี ึ ื）、聲調符號和 ไ ใ 的高頭（點虛線字型比較高，從 0 開始才不會被切掉）
// 母音寫法比較寬（เอือะ），依「不是上下標」的字數縮小字級，才放得進一格
const baseCount = (s: string) => [...s].filter(c => !/[ัิ-ฺ็-๎]/.test(c)).length

// 一格：of＝這一列練的字（決定字級與格線，同一列的空白格格線才對齊），show＝畫出淡色點虛線描字；字級、基線同筆順播放器（沒有筆順資料的字依字數估）
// 寬的母音（好幾個字元，筆順資料縮小過字級）：列印時維持原本字高，改成把格子加寬（L3 老師：字不要變小，格數變少沒關係）
const naturalFs = (of: string) => getStrokes(of)?.fs ?? Math.min(216, Math.floor(520 / Math.max(1, baseCount(of))))
const isWide = (of: string) => baseCount(of) > 1 && naturalFs(of) < 216
/** 這個字一列放幾格（一般 10 格；寬的依縮小的比例減少） */
// 沒有筆順資料的字（作業的單字）：一個字元約佔半格，ใ ไ โ 比較寬
const wordWidth = (of: string) => [...of].filter(c => !/[ัิ-ฺ็-๎]/.test(c)).reduce((a, c) => a + (/[ใไโ]/.test(c) ? 0.7 : 0.5), 0.15)
export const cellsPerRow = (of: string) => {
  if (!isWide(of)) return 10
  return Math.max(2, Math.min(10, Math.floor(10 / needWidth(of))))
}
/** 這個字在原本字高下要幾格寬 */
const needWidth = (of: string) => (getStrokes(of) ? 216 / naturalFs(of) : wordWidth(of))

export function LetterCell({ of, show, w = 1 }: { of: string; show?: boolean; w?: number }) {
  const d = getStrokes(of)
  const wide = isWide(of)
  const W = V * w
  // 很長的詞組（อยากไปเที่ยว）一格放兩格寬還放不下，才縮小字
  const fs = wide ? Math.min(216, Math.floor(216 * w / needWidth(of))) : naturalFs(of)
  return (
    <svg viewBox={`0 0 ${W} 285`} className="hcell">
      {guideLines(fs).map((y, i) => <line key={y} x1={0} x2={W} y1={y} y2={y} className={i === 2 ? 'hg base' : 'hg'} />)}
      {show && <text x={W / 2} y={wide ? 216 : d?.gy ?? 216} textAnchor="middle" fontSize={fs * GHOST_SCALE} className="th htrace">{ghostText(of)}</text>}
    </svg>
  )
}

// 一列練字：描 trace 個淡色字，再空 blank 格自己寫（字母卡在左邊，所以不再放黑字示範格）
// 寬的母音格數變少（每格加寬，整列寬度不變、字高同其他列）
export default function TraceRow({ text, trace = 3, blank = 7 }: { text: string; trace?: number; blank?: number }) {
  const n = cellsPerRow(text)
  if (n < 10) { trace = n >= 6 ? 3 : n >= 3 ? 2 : 1; blank = n - trace }
  const w = 10 / (trace + blank)
  return (
    <div className="h-row" style={{ gridTemplateColumns: `repeat(${trace + blank}, 1fr)` }}>
      {Array.from({ length: trace }, (_, k) => <LetterCell key={'t' + k} of={text} show w={w} />)}
      {Array.from({ length: blank }, (_, k) => <LetterCell key={'b' + k} of={text} w={w} />)}
    </div>
  )
}
