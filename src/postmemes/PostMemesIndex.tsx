import BackLink from '../reservation/BackLink'
import posts from '../../data/post-memes.json'
import { byCreated } from '../data/byCreated'

/** 貼文文字梗：只列外部貼文的連結（IG 等），圖片不轉存，點了開原貼文。新增一篇＝在 data/post-memes.json 加一筆 */
interface PostMeme { id: string; createdAt?: string; date: string; title: string; titleZh: string; account: string; url: string }

const fmt = (d: string) => d.replace(/^(\d+)-0?(\d+)-0?(\d+)$/, '$1/$2/$3')

export default function PostMemesIndex() {
  const list = [...(posts as PostMeme[])].sort(byCreated)
  return (
    <>
      <p><BackLink to="/" label="所有課程" /></p>
      <h1>貼文文字梗</h1>
      <p className="muted">泰國社群貼文裡的文字梗，點了開原貼文。</p>
      <ul className="lessons">
        {list.map(p => (
          <li key={p.id}>
            <a href={p.url} target="_blank" rel="noopener noreferrer">
              <span className="num">{fmt(p.date)}</span>
              <strong className="th">{p.title}</strong>
              <small>{p.titleZh}・@{p.account} ↗</small>
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}
