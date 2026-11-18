import { useState } from 'react'
import type { SongQuiz } from '../song/types'

/** 歌詞頁、影片頁共用的小測驗一題：按選項後顯示對錯，答對再顯示解說 */
export function QuizItem({ q }: { q: SongQuiz }) {
  const [pick, setPick] = useState<number | null>(null)
  return (
    <li className="sq">
      <p className="th sq-q">{q.q}</p>
      <div className="sq-opts">
        {q.options.map((o, i) => (
          <button
            key={i}
            type="button"
            className={`vtog th${pick !== null && i === q.answer ? ' sq-ok' : ''}${pick === i && i !== q.answer ? ' sq-no' : ''}`}
            onClick={() => setPick(i)}
          >{o}</button>
        ))}
      </div>
      {pick !== null && <p className="small" role="status">{pick === q.answer ? '✓ 答對了！' : '✗ 再想想～'}{pick === q.answer && ` ${q.explain}`}</p>}
    </li>
  )
}
