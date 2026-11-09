import { GHOST_SCALE, getStrokes, ghostText, guideLines, STROKE_VIEWBOX as V } from '../strokes'

// 練字格（列印講義）：四線格＋描字，和筆順播放器的底字一樣：Layiji 點虛線描字字型、同樣的字級與基線（寬的母音用筆順資料的 fs／gy 縮小，格線跟著縮）
// L1 老師：不要筆順圖；L2 老師：描字的字要和筆順那種描寫字體一樣
const VB = `0 25 ${V} 260`  // 格子的可視範圍：上面留給上方母音（ิ ี ึ ื）和聲調符號
const Guides = ({ fs }: { fs?: number }) => <>{guideLines(fs).map((y, i) => <line key={y} x1={0} x2={V} y1={y} y2={y} className={i === 2 ? 'hg base' : 'hg'} />)}</>
// 母音寫法比較寬（เอือะ），依「不是上下標」的字數縮小字級，才放得進一格
const baseCount = (s: string) => [...s].filter(c => !/[ัิ-ฺ็-๎]/.test(c)).length

// 一格：of＝這一列練的字（決定字級與格線，同一列的空白格格線才對齊），show＝畫出淡色點虛線描字；字級、基線同筆順播放器（沒有筆順資料的字依字數估）
export function LetterCell({ of, show }: { of: string; show?: boolean }) {
  const d = getStrokes(of)
  const fs = d?.fs ?? Math.min(216, Math.floor(520 / Math.max(1, baseCount(of))))
  return (
    <svg viewBox={VB} className="hcell">
      <Guides fs={fs} />
      {show && <text x={V / 2} y={d?.gy ?? 216} textAnchor="middle" fontSize={fs * GHOST_SCALE} className="th htrace">{ghostText(of)}</text>}
    </svg>
  )
}

// 一列練字：描 trace 個淡色字，再空 blank 格自己寫（字母卡在左邊，所以不再放黑字示範格）
export default function TraceRow({ text, trace = 3, blank = 4 }: { text: string; trace?: number; blank?: number }) {
  return (
    <div className="h-row" style={{ gridTemplateColumns: `repeat(${trace + blank}, 1fr)` }}>
      {Array.from({ length: trace }, (_, k) => <LetterCell key={'t' + k} of={text} show />)}
      {Array.from({ length: blank }, (_, k) => <LetterCell key={'b' + k} of={text} />)}
    </div>
  )
}
