import { ghostText } from '../strokes'

// 母音在課程資料裡用「-」代表 อ 的位置（例：เ-ะ）。顯示時把「-」換成 อ，
// 用灰色標示 อ（只是占位），母音符號本身用主色，一眼看出哪裡是母音。
//
// 上下方的符號（ิ ี ึ ื ั ุ ู ็ ํ）會和 อ 黏成同一個字，瀏覽器沒辦法分開上色，
// 所以這種情況改用「上下分帶」的漸層：符號所在的上方／下方用主色，อ 本體用灰色（見 styles.css 的 .vmix）。
const MARKS = /[ัิ-ฺ็-๎]/

export default function VowelText({ form: raw }: { form: string }) {
  const form = ghostText(raw) // ำ 拆成 ํ＋า，上方的 ํ 才能和 อ 分開上色
  const i = form.indexOf('-')
  if (i < 0) return <span className="vpart">{form}</span>
  let j = i + 1
  while (j < form.length && MARKS.test(form[j])) j++ // 黏在 อ 上的符號
  const before = form.slice(0, i), after = form.slice(j), marks = form.slice(i + 1, j)
  return (
    <>
      {before && <span className="vpart">{before}</span>}
      {marks ? <span className="vmix">อ{marks}</span> : <span className="vbase">อ</span>}
      {after && <span className="vpart">{after}</span>}
    </>
  )
}
