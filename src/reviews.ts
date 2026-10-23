// 作業複習：每 5 課（一個課程單位）一份，複習那 5 課的字母、母音與單字。
// 成績記在作業紀錄的課別欄，代號是 R<單位>（R1＝L1–L5），後端 Web.gs 的 homeworkKey_ 也用同一個格式。
import { UNIT_SIZE } from './reservation/access'

/** 目前開放作業複習的單位（先只開 L1–L5） */
export const REVIEW_UNITS = [1]

export const reviewKey = (unit: number) => `R${unit}`
export const reviewRange = (unit: number) => ({ from: (unit - 1) * UNIT_SIZE + 1, to: unit * UNIT_SIZE })
export const reviewRangeLabel = (unit: number) => { const r = reviewRange(unit); return `L${r.from}–L${r.to}` }
export const reviewTitle = (unit: number) => `${reviewRangeLabel(unit)} 作業複習`
/** 作業紀錄的課別欄顯示文字：L3 → L3、R1 → 複習 L1–L5 */
export const homeworkLessonLabel = (s: string) => {
  const m = /^R(\d+)$/.exec(s), v = /^V(\d+)$/.exec(s)
  return m ? `複習 ${reviewRangeLabel(Number(m[1]))}` : v ? `L${v[1]} 影片挑戰` : s
}
