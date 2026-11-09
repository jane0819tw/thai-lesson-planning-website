import { Fragment, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getRepository } from '../data/repository'
import type { Lesson } from '../types'
import { reviewRange, reviewRangeLabel } from '../reviews'
import LessonPage from './LessonPage'
import MarkGlyph from './MarkGlyph'
import BackLink from '../reservation/BackLink'
import { ReviewSheet } from './ReviewFill'

// 可列印講義（A4）：一個單元一份（L1–L5、L6–L10…，和學生開放的權限單位一樣），學生不用自己彙整各課。
// 封面之後先放複習作業（ReviewSheet：鍵盤、子母音、拼讀規則填空），再來每一課：課程內容（直接用課程頁的排版，LessonPage printLesson）→ 這課的作業（聲調填空）。描字與書寫改放在課程內容裡：字母卡左邊、練字格右邊（LessonPage 的 printLesson，TraceRow）。
// 用瀏覽器「列印 → 存成 PDF」，或 scripts/gen-handout.sh 1 直接輸出 public/handouts/reading-1.pdf
const TONE_NAMES = ['第一聲', '第二聲', '第三聲', '第四聲', '第五聲']
const TONE_MARKS = ['', '่', '้', '๊', '๋']
function Worksheets({ l }: { l: Lesson }) {
  // 聲調填空：只有中子音（L1）。高、低子音的聲調規則不同，之後的課要加再問老師
  const toneFill = l.consonants.length > 0 && l.consonants.every(c => c.group === 'mid') && l.toneTables.length > 0
  return (
    <>
      {toneFill && (
        <section className="h-sheet">
          <h2>L{l.number} 作業　聲調填空</h2>
          <p className="small">每一列的子音加上長母音 อ，再依序加上聲調符號，寫出第二聲到第五聲。</p>
          <table className="h-tones">
            <thead>
              <tr><th />{TONE_NAMES.map((n, k) => <th key={n}>{n}<div className="th h-mark">{k ? <MarkGlyph char={TONE_MARKS[k]} size={26} /> : <small>不加符號</small>}</div></th>)}</tr>
            </thead>
            <tbody>
              {l.consonants.map(c => (
                <tr key={c.id}>
                  <th className="th">{c.char}</th>
                  <td className="th h-given">{c.char}อ</td>
                  {[1, 2, 3, 4].map(k => <td key={k} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}

export default function HandoutPage() {
  const unit = Number(useParams().unit)
  const [lessons, setLessons] = useState<Lesson[] | undefined>(undefined)
  const r = reviewRange(unit)
  useEffect(() => { getRepository().listLessons().then(ls => setLessons(ls.filter(l => l.number >= r.from && l.number <= r.to).sort((a, b) => a.number - b.number))) }, [r.from, r.to])
  useEffect(() => { document.title = `泰文認字 ${reviewRangeLabel(unit)} 講義` }, [unit])
  if (!lessons) return <p>載入中…</p>
  if (!lessons.length) return <p>這個單元還沒有課程。<Link to="/reading">回認字課程</Link></p>

  return (
    <div className="handout">
      <p className="noprint"><BackLink to="/reading" label="認字課程" />　<button className="btn" onClick={() => window.print()}>列印／存成 PDF</button></p>
      <header className="h-cover">
        <div className="h-num">泰文認字課程</div>
        <h1>{reviewRangeLabel(unit)} 講義</h1>
        <ol>{lessons.map(l => <li key={l.id}>L{l.number}　{l.title}</li>)}</ol>
      </header>
      {/* 複習作業放在 L1 前面：鍵盤＋子母音填空、拼讀規則填空 */}
      <ReviewSheet from={r.from} to={r.to} title={reviewRangeLabel(unit)} />
      {lessons.map(l => (
        <Fragment key={l.id}>
          <LessonPage printLesson={l} />
          <Worksheets l={l} />
        </Fragment>
      ))}
    </div>
  )
}
