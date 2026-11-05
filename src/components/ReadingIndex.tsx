import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRepository } from '../data/repository'
import { REVIEW_UNITS, reviewRange, reviewRangeLabel, reviewTitle } from '../reviews'
import type { Lesson } from '../types'

export default function ReadingIndex() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  useEffect(() => { getRepository().listLessons().then(setLessons) }, [])
  return (
    <>
      <p><Link to="/">← 所有課程</Link></p>
      <h1>泰文認字課程</h1>
      <p className="btns"><Link to="/reading/chart" className="btn">子音・母音總表</Link> <Link to="/reading/keyboard" className="btn">泰文鍵盤</Link></p>
      <ul className="lessons">
        {lessons.flatMap(l => {
          const item = (
            <li key={l.id}>
              <Link to={`/reading/lesson/${l.id}`}>
                <span className="num">L{l.number}</span>
                <strong>{l.title}</strong>
                <small>{l.summary.replace(/\n/g, ' ')}</small>
                {l.status === 'draft' && <em className="badge">草稿</em>}
              </Link>
            </li>
          )
          // 單位的最後一課（L5、L10…）後面接「作業複習」
          const unit = REVIEW_UNITS.find(u => reviewRange(u).to === l.number)
          // 單位講義（L1–L5 一份）：認字課的列印按鈕放在單位層級，不放在各課（歌曲、影片的講義維持在各自頁面）
          return unit ? [item, (
            <li key={`review-${unit}`}>
              <Link to={`/reading/review/${unit}`}>
                <span className="num">複習</span>
                <strong>{reviewTitle(unit)}</strong>
                <small>字母、母音聽音選字與聽寫，成績會送給老師</small>
              </Link>
            </li>
          ), (
            <li key={`handout-${unit}`}>
              <Link to={`/reading/handout/${unit}`}>
                <span className="num">講義</span>
                <strong>🖨 {reviewRangeLabel(unit)} 列印講義</strong>
                <small>{reviewRangeLabel(unit)} 的內容與描字、書寫作業，可以印出來或存成 PDF</small>
              </Link>
            </li>
          )] : [item]
        })}
      </ul>
    </>
  )
}
