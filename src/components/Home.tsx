import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRepository } from '../data/repository'
import type { Lesson } from '../types'

export default function Home() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  useEffect(() => { getRepository().listLessons().then(setLessons) }, [])
  return (
    <>
      <h1>課程列表</h1>
      <ul className="lessons">
        {lessons.map(l => (
          <li key={l.id}>
            <Link to={`/lesson/${l.id}`}>
              <span className="num">第 {l.number} 課</span>
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
