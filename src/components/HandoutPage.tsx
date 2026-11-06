import { Fragment, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getRepository } from '../data/repository'
import type { Lesson } from '../types'
import { ghostText, guideLines, vowelForm, STROKE_VIEWBOX as V } from '../strokes'
import { reviewRange, reviewRangeLabel } from '../reviews'
import LessonPage from './LessonPage'
import MarkGlyph from './MarkGlyph'
import BackLink from '../reservation/BackLink'

// 可列印講義（A4）：一個單元一份（L1–L5、L6–L10…，和學生開放的權限單位一樣），學生不用自己彙整各課。
// 每一課：課程內容（直接用課程頁的排版，LessonPage printLesson）→ 這課的寫字作業（描字與書寫、聲調填空）。
// 用瀏覽器「列印 → 存成 PDF」，或 scripts/gen-handout.sh 1 直接輸出 public/handouts/reading-1.pdf
const TONE_NAMES = ['第一聲', '第二聲', '第三聲', '第四聲', '第五聲']
const TONE_MARKS = ['', '่', '้', '๊', '๋']
const VB = `0 25 ${V} 260`  // 格子的可視範圍：上面留給上方母音（ิ ี ึ ื）和聲調符號

// 四線格（同筆順播放器）：描字格與筆順圖用同一組格線，字的大小才一致
const Guides = () => <>{guideLines().map((y, i) => <line key={y} x1={0} x2={V} y1={y} y2={y} className={i === 2 ? 'hg base' : 'hg'} />)}</>
// 母音寫法比較寬（เอือะ），依「不是上下標」的字數縮小字級，才放得進一格
const baseCount = (s: string) => [...s].filter(c => !/[ัิ-ฺ็-๎]/.test(c)).length
const fontFor = (s: string) => Math.min(196, Math.floor(470 / Math.max(1, baseCount(s))))

// 字放在四線格裡：一般字型（課程頁的 Sarabun）；第一格黑字示範、淡灰色＝描字、不填＝空白格（L1 老師：不要筆順圖）
function LetterCell({ text, trace }: { text?: string; trace?: boolean }) {
  return (
    <svg viewBox={VB} className="hcell">
      <Guides />
      {text && <text x={V / 2} y={215} textAnchor="middle" fontSize={fontFor(text)} className={trace ? 'th htrace' : 'th'}>{ghostText(text)}</text>}
    </svg>
  )
}

// 這課要練寫的字：子音，以及母音（短音、長音各一個，用 อ 補子音位置）
const writeItems = (l: Lesson) => [
  ...l.consonants.map(c => c.char),
  ...l.vowels.flatMap(v => [v.short, v.long]).filter(Boolean).map(vowelForm),
]

function Worksheets({ l }: { l: Lesson }) {
  const items = writeItems(l)
  // 聲調填空：只有中子音（L1）。高、低子音的聲調規則不同，之後的課要加再問老師
  const toneFill = l.consonants.length > 0 && l.consonants.every(c => c.group === 'mid') && l.toneTables.length > 0
  return (
    <>
      {items.length > 0 && (
        <section className="h-sheet">
          <div className="h-name">姓名＿＿＿＿＿＿＿＿　日期＿＿＿＿＿＿</div>
          <h2>L{l.number} 作業　描字與書寫</h2>
          <p className="small">看第一格的字，描三個淡色的字，再自己寫六個。</p>
          <div className="h-trace">
            {items.map(t => (
              <div className="h-row" key={t}>
                <LetterCell text={t} />
                {[0, 1, 2].map(k => <LetterCell key={'t' + k} text={t} trace />)}
                {[0, 1, 2, 3, 4, 5].map(k => <LetterCell key={'b' + k} />)}
              </div>
            ))}
          </div>
        </section>
      )}
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
      {lessons.map(l => (
        <Fragment key={l.id}>
          <LessonPage printLesson={l} />
          <Worksheets l={l} />
        </Fragment>
      ))}
    </div>
  )
}
