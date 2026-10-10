import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRepository } from '../data/repository'
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
        {lessons.map(l => (
          <li key={l.id}>
            <Link to={`/reading/lesson/${l.id}`}>
              <span className="num">L{l.number}</span>
              <strong>{l.title}</strong>
              <small>{l.summary}</small>
              {l.status === 'draft' && <em className="badge">草稿</em>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
