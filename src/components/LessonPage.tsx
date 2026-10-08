import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getRepository } from '../data/repository'
import type { Lesson } from '../types'
import SpeakButton from './SpeakButton'

const CLASS_ZH = { mid: '中輩', high: '高輩', low: '低輩' } as const
const TONE_ZH = { mid: '平聲', low: '低聲', falling: '降聲', high: '高聲', rising: '升聲' } as const
type Tab = 'rules' | 'letters' | 'words' | 'sentences' | 'meme'
const TABS: [Tab, string][] = [
  ['rules', '規則'], ['letters', '子音母音'], ['words', '單字'], ['sentences', '例句'], ['meme', '梗圖'],
]

export default function LessonPage() {
  const { id } = useParams()
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined)
  const [tab, setTab] = useState<Tab>('letters')
  const [showZh, setShowZh] = useState(true)
  const [showRoman, setShowRoman] = useState(true)

  useEffect(() => { getRepository().getLesson(id ?? '').then(l => setLesson(l ?? null)) }, [id])

  if (lesson === undefined) return <p>載入中…</p>
  if (lesson === null) return <p>找不到這一課。<Link to="/">回首頁</Link></p>

  return (
    <>
      <p><Link to="/">← 課程列表</Link></p>
      <h1>第 {lesson.number} 課　{lesson.title}</h1>
      <p className="muted">{lesson.summary}</p>

      <div className="toolbar">
        <label><input type="checkbox" checked={showZh} onChange={e => setShowZh(e.target.checked)} /> 顯示中文翻譯</label>
        <label><input type="checkbox" checked={showRoman} onChange={e => setShowRoman(e.target.checked)} /> 顯示拼音</label>
      </div>

      <nav className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>

      {tab === 'rules' && (
        <section className="stack">
          {lesson.rules.map(r => (
            <article className="card" key={r.id}>
              <h3>{r.title}</h3>
              <p>{r.body}</p>
              <p className="muted small">筆順示範：待定（動畫／靜態圖尚未決定）</p>
            </article>
          ))}
        </section>
      )}

      {tab === 'letters' && (
        <>
          <h2>子音</h2>
          <section className="grid">
            {lesson.consonants.map(c => (
              <article className="card letter" key={c.id}>
                <div className="big th">{c.char}</div>
                <div className="th">{c.name} <SpeakButton text={c.name.split(' ').pop() ?? c.char} audioUrl={c.audioUrl} /></div>
                {showRoman && <div className="muted">{c.nameRoman}</div>}
                {showZh && <div>{c.nameZh}</div>}
                <div className="small muted">{CLASS_ZH[c.class]}｜頭音 {c.initial}｜尾音 {c.final}</div>
              </article>
            ))}
          </section>
          <h2>母音</h2>
          <section className="grid">
            {lesson.vowels.map(v => (
              <article className="card letter" key={v.id}>
                <div className="big th">{v.withCarrier}</div>
                <SpeakButton text={v.withCarrier} audioUrl={v.audioUrl} />
                {showRoman && <div className="muted">{v.roman}</div>}
                <div className="small muted">{v.length === 'long' ? '長音' : '短音'}｜{v.position}｜例：<span className="th">{v.example}</span></div>
              </article>
            ))}
          </section>
        </>
      )}

      {tab === 'words' && (
        <section className="list">
          {lesson.words.map(w => (
            <article className="row" key={w.id}>
              <div className="th big2">{w.thai}</div>
              <SpeakButton text={w.thai} audioUrl={w.audioUrl} />
              <div className="meta">
                {showRoman && <span className="muted">{w.roman}</span>}
                <span className="chip">{TONE_ZH[w.tone]}</span>
                {showZh && <span>{w.zh}</span>}
                {w.note && <span className="small muted">{w.note}</span>}
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === 'sentences' && (
        <section className="list">
          {lesson.sentences.map(s => {
            const thai = s.segments.join('')
            return (
              <article className="row" key={s.id}>
                <div className="th big2">{s.segments.join(' ')}</div>
                <SpeakButton text={thai} audioUrl={s.audioUrl} />
                <div className="meta">
                  {showRoman && <span className="muted">{s.roman}</span>}
                  {showZh && <span>{s.zh}</span>}
                </div>
              </article>
            )
          })}
        </section>
      )}

      {tab === 'meme' && (
        <article className="card">
          {lesson.meme.imageUrl
            ? <img src={lesson.meme.imageUrl} alt={lesson.meme.caption} style={{ maxWidth: '100%' }} />
            : <div className="meme-placeholder">梗圖待補</div>}
          <p><strong>{lesson.meme.caption}</strong></p>
          <p className="muted small">構想：{lesson.meme.idea}</p>
        </article>
      )}
    </>
  )
}
