import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import BackLink from '../reservation/BackLink'
import { Line, Rich } from '../conversation/Parts'
import SpeakButton from '../components/SpeakButton'
import { Rom } from '../video/Rom'
import { ToggleBar, toggleClass, useConvToggles } from '../conversation/toggles'
import { SlideShow, type Slide } from '../conversation/ConvPages'
import type { ReadArticle, ReadPattern, ReadQuestion, ReadWord } from './types'
import { readArticle, readList } from './data'
import '../conversation/conv.css'
import '../news/news.css'
import './newsreading.css'

// 短文時事閱讀：版面沿用時事補充（news.css：關掉拼音／中文就收起來補位）

const BASE = import.meta.env.BASE_URL
const ROOT = '/news-reading'
const KIND = '短文時事閱讀'
const fmt = (d: string) => d.replace(/^(\d+)-0?(\d+)-0?(\d+)$/, '$1/$2/$3')

export function ReadIndex() {
  return (
    <>
      <p><BackLink to="/" label="所有課程" /></p>
      <h1>{KIND}</h1>
      <p className="muted">讀真實的泰文短文（貼文、廣告、短新聞）：原文、逐句解析、單字、句型、閱讀理解。</p>
      <ul className="lessons">
        {readList().map((a, i, all) => (
          <li key={a.id}>
            <Link to={`${ROOT}/${a.id}`}>
              <span className="num">第 {all.length - i} 篇</span>
              <strong className="th">{a.title}</strong>
              <small>{a.titleZh}・{fmt(a.date)}</small>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

// 卡片：課程頁、投影片、列印講義共用

const IntroCard = ({ a }: { a: ReadArticle }) => <article className="card n-intro">{a.intro.map((p, i) => <p key={i}><Rich text={p} /></p>)}</article>

function ImageCard({ a }: { a: ReadArticle }) {
  if (!a.image) return null
  return (
    <article className="card n-imgcard">
      <figure className="n-fig">
        <img src={BASE + a.image.src} alt={a.title} />
        <figcaption className="muted">{a.image.credit}</figcaption>
      </figure>
      <div className="r-imglines">{a.image.lines.map(l => <Line key={l.th} t={l} />)}</div>
    </article>
  )
}

/** 原文：只有泰文，學生先自己讀 */
function OriginalCard({ a }: { a: ReadArticle }) {
  return (
    <article className="card r-orig">
      <h3>原文　<small className="muted">先自己讀讀看</small></h3>
      {a.original.map((p, i) => <p key={i} className="th">{p}</p>)}
    </article>
  )
}

function ParagraphCard({ p, num }: { p: ReadArticle['paragraphs'][number]; num: number }) {
  return (
    <article className="card">
      <h3>第 {num} 段{p.label && <>　<span className="n-tag">{p.label}</span></>}</h3>
      <div className="r-lines">{p.lines.map(l => <Line key={l.th} t={l} />)}</div>
    </article>
  )
}

function WordItem({ w }: { w: ReadWord }) {
  return <>
    <div className="n-vword">
      <span className="th c-th">{w.th}<SpeakButton text={w.th} /></span>
      <span className="c-rom"><Rom text={w.rom} /></span>
      <span className="c-zh">{w.zh}{w.note && <small className="muted">（{w.note}）</small>}</span>
    </div>
    {w.ex && <div className="n-vex"><span className="n-exlabel">例句</span><Line t={w.ex} /></div>}
  </>
}

function WordsCard({ words, start = 1 }: { words: ReadWord[]; start?: number }) {
  return (
    <article className="card">
      <h3>單字</h3>
      <ol className="n-vlist" start={start}>{words.map(w => <li key={w.th}><WordItem w={w} /></li>)}</ol>
    </article>
  )
}

function PatternCard({ p, num }: { p: ReadPattern; num: number }) {
  return (
    <article className="card r-pat">
      <div className="n-qhead"><b className="n-qnum">{num}</b><span className="th r-patth">{p.th}</span></div>
      <div className="r-patsub"><span className="c-rom"><Rom text={p.rom} /></span>　<span className="c-zh">{p.zh}</span></div>
      <div className="n-explain"><Rich text={p.explain} /></div>
      <div className="r-lines">{p.examples.map(e => <Line key={e.th} t={e} />)}</div>
    </article>
  )
}

/** 閱讀理解：答案按了才顯示；講義不印答案，留作答空間 */
function QuestionsCard({ qs, start = 0, print }: { qs: ReadQuestion[]; start?: number; print?: boolean }) {
  const [shown, setShown] = useState<Record<number, boolean>>({})
  return (
    <article className="card">
      <h3>閱讀理解</h3>
      <ol className="r-qs" start={start + 1}>
        {qs.map((q, i) => (
          <li key={q.q}>
            <div><Rich text={q.q} /></div>
            {print ? <div className="r-blank" />
              : shown[i] ? <div className="r-ans"><Rich text={q.a} /></div>
                : <button className="btn r-showans" onClick={() => setShown(s => ({ ...s, [i]: true }))}>看答案</button>}
          </li>
        ))}
      </ol>
    </article>
  )
}

interface Section { key: string; label: string; cards: ReactNode[] }
function sectionsOf(a: ReadArticle, print?: boolean): Section[] {
  const out: Section[] = []
  if (a.image) out.push({ key: 'image', label: '圖片文字', cards: [<ImageCard a={a} key="img" />] })
  out.push({ key: 'text', label: '短文', cards: [<OriginalCard a={a} key="o" />, ...a.paragraphs.map((p, i) => <ParagraphCard p={p} num={i + 1} key={i} />)] })
  out.push({ key: 'words', label: '單字', cards: [<WordsCard words={a.words} key="w" />] })
  if (a.patterns?.length) out.push({ key: 'patterns', label: '句型', cards: a.patterns.map((p, i) => <PatternCard p={p} num={i + 1} key={p.th} />) })
  out.push({ key: 'questions', label: '閱讀理解', cards: [<QuestionsCard qs={a.questions} print={print} key="q" />] })
  return out
}

const Src = ({ a }: { a: ReadArticle }) => <p className="muted n-src">資料來源：<a href={a.source.url} target="_blank" rel="noreferrer">{a.source.label}</a></p>

function useArticle() {
  const { id = '' } = useParams()
  return readArticle(id)
}
const notFound = <p>找不到這篇短文。<Link to={ROOT}>回{KIND}</Link></p>

export function ReadPage() {
  const a = useArticle()
  const [t, flip] = useConvToggles()
  if (!a) return notFound
  const secs = sectionsOf(a)
  return (
    <div className={`cpage npage rpage ${toggleClass(t)}`}>
      <p><BackLink to={ROOT} label={KIND} /></p>
      <div className="c-num">{KIND}・{fmt(a.date)}</div>
      <h1><span className="th">{a.title}</span>　{a.titleZh}</h1>
      <p className="c-bar">
        <Link className="vtog" to={`${ROOT}/${a.id}/present`}>▶ 投影片模式</Link>
        <Link className="vtog" to={`${ROOT}/${a.id}/handout`}>🖨 列印講義（PDF）</Link>
        <ToggleBar t={t} flip={flip} />
      </p>
      <nav className="c-toc">{secs.map(s => <a key={s.key} href={`#r-${s.key}`} onClick={e => { e.preventDefault(); document.getElementById(`r-${s.key}`)?.scrollIntoView({ behavior: 'smooth' }) }}>{s.label}</a>)}</nav>
      <IntroCard a={a} />
      {secs.map(s => (
        <section key={s.key} id={`r-${s.key}`} className="c-sec">
          <h2>{s.label}</h2>
          <div className="c-cards-col">{s.cards}</div>
        </section>
      ))}
      <Src a={a} />
    </div>
  )
}

/** 投影片：封面 → 圖片文字 → 原文 → 逐段（一段一頁）→ 單字（一頁 2 個）→ 句型（一個一頁）→ 閱讀理解（一頁 3 題） */
function buildSlides(a: ReadArticle): { slides: Slide[]; chapters: string[] } {
  const slides: Slide[] = [], chapters: string[] = []
  const add = (label: string, bodies: ReactNode[]) => { if (!bodies.length) return; chapters.push(label); bodies.forEach((b, k) => slides.push({ section: bodies.length > 1 ? `${label} ${k + 1}/${bodies.length}` : label, chapter: chapters.length - 1, body: b })) }
  const chunk = <T,>(xs: T[], size: number) => Array.from({ length: Math.ceil(xs.length / size) }, (_, k) => xs.slice(k * size, k * size + size))
  add('封面', [(
    <div className="pt-title c-cover" key="cover">
      <div className="pt-num">{KIND}・{fmt(a.date)}</div>
      <h1><span className="th">{a.title}</span></h1>
      <h2>{a.titleZh}</h2>
      <IntroCard a={a} />
    </div>
  )])
  if (a.image) add('圖片文字', [<ImageCard a={a} key="img" />])
  add('原文', [<OriginalCard a={a} key="o" />])
  add('逐句解析', a.paragraphs.map((p, i) => <ParagraphCard p={p} num={i + 1} key={i} />))
  add('單字', chunk(a.words, 2).map((ws, k) => <WordsCard words={ws} start={k * 2 + 1} key={k} />))
  add('句型', (a.patterns ?? []).map((p, i) => <PatternCard p={p} num={i + 1} key={p.th} />))
  add('閱讀理解', chunk(a.questions, 3).map((qs, k) => <QuestionsCard qs={qs} start={k * 3} key={k} />))
  return { slides, chapters }
}

export function ReadPresent() {
  const a = useArticle()
  const nav = useNavigate()
  const [t, flip] = useConvToggles()
  if (!a) return notFound
  const { slides, chapters } = buildSlides(a)
  return (
    <div className="npage rpage">
      <SlideShow slides={slides} chapters={chapters} where="短文" storeKey={`news-reading-${a.id}`} onExit={() => nav(`${ROOT}/${a.id}`)} t={t} flip={flip} />
    </div>
  )
}

/** 列印講義（A4）：照目前的拼音／中文開關印，喇叭不印，閱讀理解不印答案 */
export function ReadHandout() {
  const a = useArticle()
  const [t, flip] = useConvToggles()
  useEffect(() => { if (a) document.title = `${KIND} ${a.titleZh} 講義` }, [a])
  if (!a) return notFound
  return (
    <div className={`chandout npage nhandout rpage ${toggleClass(t)}`}>
      <p className="noprint c-bar"><BackLink to={`${ROOT}/${a.id}`} label={a.titleZh} />　<button className="btn" onClick={() => window.print()}>列印／存成 PDF</button>　<ToggleBar t={t} flip={flip} /><span className="small muted">照開關的狀態印</span></p>
      <div className="c-num">{KIND}・{fmt(a.date)}</div>
      <h1><span className="th">{a.title}</span>　{a.titleZh}</h1>
      <IntroCard a={a} />
      {sectionsOf(a, true).map(s => (
        <section key={s.key} className="c-sec">
          <h2>{s.label}</h2>
          <div className="c-cards-col">{s.cards}</div>
        </section>
      ))}
      <Src a={a} />
    </div>
  )
}
