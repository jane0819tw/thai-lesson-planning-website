import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getVideoRepository } from '../data/videoRepository'
import type { VideoLesson } from '../video/types'

export default function VideoIndex() {
  const [videos, setVideos] = useState<VideoLesson[]>([])
  useEffect(() => { getVideoRepository().listVideos().then(setVideos) }, [])
  return (
    <>
      <p><Link to="/">← 所有課程</Link></p>
      <h1>影片教學</h1>
      <p className="muted">跟著影片逐句精讀：點句子跳播、自動跟隨、單句循環。</p>
      <ul className="lessons">
        {videos.map(v => (
          <li key={v.id}>
            <Link to={`/video/${v.id}`}>
              <span className="num">{v.topic}</span>
              <strong className="th">{v.title}</strong>
              <small>{v.titleZh}・{v.level}</small>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
