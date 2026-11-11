import { useEffect, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import BackLink from '../reservation/BackLink'
import { Line, Rich } from '../conversation/Parts'
import SpeakButton from '../components/SpeakButton'
import { Rom } from '../video/Rom'
import { ToggleBar, toggleClass, useConvToggles } from '../conversation/toggles'
import { SlideShow, type Slide } from '../conversation/ConvPages'
import type { NewsItem } from './types'
import { newsItem, newsList } from './data'
import '../conversation/conv.css'
import './news.css'

const BASE = import.meta.env.BASE_URL
const fmt = (d: string) => d.replace(/^(\d+)-0?(\d+)-0?(\d+)$/, '$1/$2/$3')

export function NewsIndex() {
  return (
    <>
      <p><BackLink to="/" label="所有課程" /></p>
      <h1>時事補充</h1>
      <p className="muted">節日與時事：單字、簡單句子、泰國網路金句與梗。</p>
      <ul className="lessons">
        {newsList().map(n => (
          <li key={n.id}>
            <Link to={`/news/${n.id}`}>
              <span className="num">{fmt(n.date)}</span>
              <strong className="th">{n.title}</strong>
              <small>{n.titleZh}</small>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

// 卡片：課程頁、投影片、列印講義共用

function IntroCard({ n }: { n: NewsItem }) {
  return <article className="card n-intro">{n.intro.map((p, i) => <p key={i}><Rich text={p} /></p>)}</article>
}

function ImageCard({ n }: { n: NewsItem }) {
  if (!n.image) return null
  return (
    <article className="card n-imgcard">
      <figure className="n-fig">
        <img src={BASE + n.image.src} alt={n.image.lines.map(l => l.th).join(' ')} />
        <figcaption className="muted">{n.image.credit}</figcaption>
      </figure>
      <div className="c-cards-col">{n.image.lines.map(l => <Line key={l.th} t={l} big />)}</div>
    </article>
  )
}

type VWord = NonNullable<NonNullable<NewsItem['image']>['words']>[number]
function VWordItem({ w }: { w: VWord }) {
  return <>
    <div className="n-vword">
      <span className="th c-th">{w.th}<SpeakButton text={w.th} /></span>
      <span className="c-rom"><Rom text={w.rom} /></span>
      <span className="c-zh">{w.zh}{w.note && <small className="muted">（{w.note}）</small>}</span>
    </div>
    {w.ex && <div className="n-vex"><span className="n-exlabel">例句</span><Line t={w.ex} /></div>}
  </>
}

function WordsCard({ words, start = 1 }: { words: VWord[]; start?: number }) {
  return (
    <article className="card">
      <h3>單字說明</h3>
      <ol className="n-vlist" start={start}>{words.map(w => <li key={w.th}><VWordItem w={w} /></li>)}</ol>
    </article>
  )
}

function SentencesCard({ n, from = 0, to }: { n: NewsItem; from?: number; to?: number }) {
  return (
    <article className="card">
      <h3>簡單句子</h3>
      <ol className="c-review" start={from + 1}>{n.sentences.slice(from, to).map(s => <li key={s.th}><Line t={s} /></li>)}</ol>
    </article>
  )
}

function QuoteCard({ q, num }: { q: NewsItem['quotes'][number]; num: number }) {
  return (
    <article className="card n-quote">
      <div className="n-qhead"><b className="n-qnum">{num}</b>{q.tag && <span className="n-tag">{q.tag}</span>}</div>
      <Line t={q} big />
      <div className="n-explain">
        {q.image && <img className="n-qimg" src={BASE + q.image} alt="" />}
        <div><Rich text={q.explain} /></div>
      </div>
    </article>
  )
}

interface Section { key: string; label: string; cards: ReactNode[] }
function sectionsOf(n: NewsItem): Section[] {
  const out: Section[] = []
  if (n.image) out.push({ key: 'image', label: '圖片文字', cards: [<ImageCard n={n} key="img" />, ...(n.image.words?.length ? [<WordsCard words={n.image.words} key="w" />] : [])] })
  out.push({ key: 'sentences', label: '簡單句子', cards: [<SentencesCard n={n} key="s" />] })
  out.push({ key: 'quotes', label: `${n.quotes.length} 個金句`, cards: n.quotes.map((q, i) => <QuoteCard q={q} num={i + 1} key={q.th} />) })
  return out
}

const Src = ({ n }: { n: NewsItem }) => <p className="muted n-src">資料來源：<a href={n.source.url} target="_blank" rel="noreferrer">{n.source.label}</a></p>

function useNews() {
  const { id = '' } = useParams()
  return newsItem(id)
}
const notFound = <p>找不到這則時事。<Link to="/news">回時事補充</Link></p>

export function NewsPage() {
  const n = useNews()
  const [t, flip] = useConvToggles()
  if (!n) return notFound
  const secs = sectionsOf(n)
  return (
    <div className={`cpage npage ${toggleClass(t)}`}>
      <p><BackLink to="/news" label="時事補充" /></p>
      <div className="c-num">時事補充・{fmt(n.date)}</div>
      <h1><span className="th">{n.title}</span>　{n.titleZh}</h1>
      <p className="c-bar">
        <Link className="vtog" to={`/news/${n.id}/present`}>▶ 投影片模式</Link>
        <Link className="vtog" to={`/news/${n.id}/handout`}>🖨 列印講義（PDF）</Link>
        <ToggleBar t={t} flip={flip} />
      </p>
      <nav className="c-toc">{secs.map(s => <a key={s.key} href={`#n-${s.key}`} onClick={e => { e.preventDefault(); document.getElementById(`n-${s.key}`)?.scrollIntoView({ behavior: 'smooth' }) }}>{s.label}</a>)}</nav>
      <IntroCard n={n} />
      {secs.map(s => (
        <section key={s.key} id={`n-${s.key}`} className="c-sec">
          <h2>{s.label}</h2>
          <div className="c-cards-col">{s.cards}</div>
        </section>
      ))}
      <Src n={n} />
    </div>
  )
}

/** 投影片：封面（導言）→ 圖片文字 → 單字說明（一頁 2 個字）→ 簡單句子（一頁 4 句）→ 金句（一句一頁） */
function buildSlides(n: NewsItem): { slides: Slide[]; chapters: string[] } {
  const slides: Slide[] = [], chapters: string[] = []
  const add = (label: string, bodies: ReactNode[]) => { if (!bodies.length) return; chapters.push(label); bodies.forEach((b, k) => slides.push({ section: bodies.length > 1 ? `${label} ${k + 1}/${bodies.length}` : label, chapter: chapters.length - 1, body: b })) }
  const chunk = <T,>(xs: T[], size: number) => Array.from({ length: Math.ceil(xs.length / size) }, (_, k) => xs.slice(k * size, k * size + size))
  add('封面', [(
    <div className="pt-title c-cover" key="cover">
      <div className="pt-num">時事補充・{fmt(n.date)}</div>
      <h1><span className="th">{n.title}</span></h1>
      <h2>{n.titleZh}</h2>
      <IntroCard n={n} />
    </div>
  )])
  if (n.image) add('圖片文字', [<ImageCard n={n} key="img" />])
  const words = n.image?.words ?? []
  add('單字說明', chunk(words, 2).map((ws, k) => <WordsCard words={ws} start={k * 2 + 1} key={k} />))
  add('簡單句子', chunk(n.sentences.map((_, k) => k), 4).map(ks => <SentencesCard n={n} from={ks[0]} to={ks[ks.length - 1] + 1} key={ks[0]} />))
  add('金句', n.quotes.map((q, i) => <QuoteCard q={q} num={i + 1} key={q.th} />))
  return { slides, chapters }
}

export function NewsPresent() {
  const n = useNews()
  const nav = useNavigate()
  const [t, flip] = useConvToggles()
  if (!n) return notFound
  const { slides, chapters } = buildSlides(n)
  return (
    <div className="npage">
      <SlideShow slides={slides} chapters={chapters} where="時事" storeKey={`news-${n.id}`} onExit={() => nav(`/news/${n.id}`)} t={t} flip={flip} />
    </div>
  )
}

/** 列印講義（A4）：照目前的拼音／中文開關印，喇叭不印 */
export function NewsHandout() {
  const n = useNews()
  const [t, flip] = useConvToggles()
  useEffect(() => { if (n) document.title = `時事補充 ${n.titleZh} 講義` }, [n])
  if (!n) return notFound
  return (
    <div className={`chandout npage nhandout ${toggleClass(t)}`}>
      <p className="noprint c-bar"><BackLink to={`/news/${n.id}`} label={n.titleZh} />　<button className="btn" onClick={() => window.print()}>列印／存成 PDF</button>　<ToggleBar t={t} flip={flip} /><span className="small muted">照開關的狀態印</span></p>
      <div className="c-num">時事補充・{fmt(n.date)}</div>
      <h1><span className="th">{n.title}</span>　{n.titleZh}</h1>
      <IntroCard n={n} />
      {sectionsOf(n).map(s => (
        <section key={s.key} className="c-sec">
          <h2>{s.label}</h2>
          <div className="c-cards-col">{s.cards}</div>
        </section>
      ))}
      <Src n={n} />
    </div>
  )
}
