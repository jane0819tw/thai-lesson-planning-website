import { useEffect, type CSSProperties, type ReactNode } from 'react'
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
      <p className="muted">節日與時事：大意、關鍵單字、重點句子、原文，加上泰國網路金句與梗。</p>
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

function ImageCard({ n, from = 0, to, showImg = true }: { n: NewsItem; from?: number; to?: number; showImg?: boolean }) {
  if (!n.image) return null
  return (
    <article className="card n-imgcard">
      {showImg && <figure className="n-fig">
        <img src={BASE + n.image.src} alt={n.image.lines.map(l => l.th).join(' ')} />
        <figcaption className="muted">{n.image.credit}</figcaption>
      </figure>}
      <div className="c-cards-col">{n.image.lines.slice(from, to).map(l => <Line key={l.th} t={l} big />)}</div>
    </article>
  )
}

/** 原文分組：截圖（一張或並排好幾張）＋出現在這些圖上的句子 */
type Group = NonNullable<NonNullable<NewsItem['image']>['groups']>[number]
function GroupCard({ g, credit, from = 0, to, showImg = true, showLines = true }: { g: Group; credit: string; from?: number; to?: number; showImg?: boolean; showLines?: boolean }) {
  return (
    <article className="card n-imgcard">
      <h3>{g.title}</h3>
      {showImg && <figure className={`n-fig n-shots n-shots-${g.images.length}`}>
        <div>{g.images.map(src => <img key={src} src={BASE + src} alt={g.title} />)}</div>
        <figcaption className="muted">{credit}</figcaption>
      </figure>}
      {showLines && <div className="c-cards-col">{g.lines.slice(from, to).map(l => <Line key={l.th} t={l} big />)}</div>}
    </article>
  )
}

type Gloss = NonNullable<NewsItem['glossary']>[number]
function GlossCard({ g }: { g: Gloss }) {
  return (
    <article className="card">
      <h3>{g.th && <span className="th">{g.th}</span>}{g.rom && <span className="c-rom"> <Rom text={g.rom} /></span>} {g.title}</h3>
      <ul className="n-gloss">
        {g.items.map(w => (
          <li key={w.th}>
            {w.image && <img src={BASE + w.image} alt="" />}
            <div>
              <span className="th c-th">{w.th}<SpeakButton text={w.th} /></span>
              <span className="c-rom"><Rom text={w.rom} /></span>
              <span className="c-zh">{w.zh}{w.note && <small className="muted">（{w.note}）</small>}</span>
            </div>
          </li>
        ))}
      </ul>
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
      {w.from?.length ? <span className="n-from">句子 {w.from.join('、')}</span> : null}
    </div>
    {w.ex && <div className="n-vex"><span className="n-exlabel">例句</span><Line t={w.ex} /></div>}
    {w.examples?.map((e, k) => <div className="n-vex" key={e.th}><span className="n-exlabel">例句 {k + 1}</span><Line t={e} /></div>)}
  </>
}

function WordsCard({ words, start = 1 }: { words: VWord[]; start?: number }) {
  return (
    <article className="card">
      <h3>關鍵單字</h3>
      <ol className="n-vlist" start={start}>{words.map(w => <li key={w.th}><VWordItem w={w} /></li>)}</ol>
    </article>
  )
}

function SentencesCard({ list, title, from = 0, to }: { list: NewsItem['sentences']; title: string; from?: number; to?: number }) {
  return (
    <article className="card">
      <h3>{title}</h3>
      <ol className="c-review" start={from + 1} style={{ '--rows': Math.ceil(list.slice(from, to).length / 2) } as CSSProperties}>{list.slice(from, to).map(s => <li key={s.th}><Line t={s} /></li>)}</ol>
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
  // 順序（老師 11/25：學生程度不同，先大意、關鍵單字、重點句子，再讀文章；程度高的再看延伸）
  const out: Section[] = [{ key: 'summary', label: '大意', cards: [<IntroCard n={n} key="i" />] }]
  if (n.image?.words?.length) out.push({ key: 'words', label: '關鍵單字', cards: [<WordsCard words={n.image.words} key="w" />] })
  out.push({ key: 'sentences', label: '重點句子', cards: [<SentencesCard list={n.sentences} title="重點句子" key="s" />] })
  if (n.image) out.push({ key: 'article', label: '文章', cards: n.image.groups?.length ? n.image.groups.map(g => <GroupCard g={g} credit={n.image!.credit} key={g.title} />) : [<ImageCard n={n} key="img" />] })
  if (n.glossary?.length) out.push({ key: 'glossary', label: '延伸單字', cards: n.glossary.map(g => <GlossCard g={g} key={g.title} />) })
  if (n.quotes.length) out.push({ key: 'quotes', label: `${n.quotes.length} 個金句`, cards: n.quotes.map((q, i) => <QuoteCard q={q} num={i + 1} key={q.th} />) })
  if (n.extra?.length) out.push({ key: 'extra', label: '補充句子', cards: [<SentencesCard list={n.extra} title="補充句子" key="x" />] })
  return out
}

const Src = ({ n }: { n: NewsItem }) => <p className="muted n-src">資料來源：{n.source.url ? <a href={n.source.url} target="_blank" rel="noreferrer">{n.source.label}</a> : n.source.label}</p>

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

/** 投影片：大意（封面）→ 關鍵單字（沒例句一頁 6 個；一句例句 2 個；三例句 1 個）→ 重點句子（一頁 4 句）→ 文章 → 延伸單字（一類一頁）→ 金句（一句一頁）→ 補充句子（一頁 4 句） */
function buildSlides(n: NewsItem): { slides: Slide[]; chapters: string[] } {
  const slides: Slide[] = [], chapters: string[] = []
  const add = (label: string, bodies: ReactNode[]) => { if (!bodies.length) return; chapters.push(label); bodies.forEach((b, k) => slides.push({ section: bodies.length > 1 ? `${label} ${k + 1}/${bodies.length}` : label, chapter: chapters.length - 1, body: b })) }
  const chunk = <T,>(xs: T[], size: number) => Array.from({ length: Math.ceil(xs.length / size) }, (_, k) => xs.slice(k * size, k * size + size))
  add('大意', [(
    <div className="pt-title c-cover" key="cover">
      <div className="pt-num">時事補充・{fmt(n.date)}</div>
      <h1><span className="th">{n.title}</span></h1>
      <h2>{n.titleZh}</h2>
      <IntroCard n={n} />
    </div>
  )])
  // 關鍵單字：沒例句一頁 6 個；有一句例句一頁 2 個；三個例句一頁 1 個
  const words = n.image?.words ?? []
  const per = words.some(w => (w.examples?.length ?? 0) > 1) ? 1 : words.some(w => w.ex || w.examples?.length) ? 2 : 6
  add('關鍵單字', chunk(words, per).map((ws, k) => <WordsCard words={ws} start={k * per + 1} key={k} />))
  const sentSlides = (list: NewsItem['sentences'], title: string) => chunk(list.map((_, k) => k), 4).map(ks => <SentencesCard list={list} title={title} from={ks[0]} to={ks[ks.length - 1] + 1} key={ks[0]} />)
  add('重點句子', sentSlides(n.sentences, '重點句子'))
  // 文章：句子少（≤3）圖和句子同一頁；多的話第一頁只放圖，後面一頁 4 句
  if (n.image?.groups?.length) {
    // 分組：一組的圖一頁（句子 ≤2 句就跟圖同一頁），句子一頁 4 句
    const cr = n.image.credit
    add('文章', n.image.groups.flatMap(g => g.lines.length <= 2
      ? [<GroupCard g={g} credit={cr} key={g.title} />]
      : [<GroupCard g={g} credit={cr} showLines={false} key={g.title} />, ...chunk(g.lines.map((_, k) => k), 4).map(ks => <GroupCard g={g} credit={cr} showImg={false} from={ks[0]} to={ks[ks.length - 1] + 1} key={g.title + ks[0]} />)]))
  } else if (n.image) {
    const L = n.image.lines.length, first = L <= 3 ? L : 0
    add('文章', [<ImageCard n={n} to={first} key="img" />, ...chunk(Array.from({ length: Math.max(0, L - first) }, (_, k) => k + first), 4).map(ks => <ImageCard n={n} from={ks[0]} to={ks[ks.length - 1] + 1} showImg={false} key={ks[0]} />)])
  }
  add('延伸單字', (n.glossary ?? []).map(g => <GlossCard g={g} key={g.title} />))
  add('金句', n.quotes.map((q, i) => <QuoteCard q={q} num={i + 1} key={q.th} />))
  add('補充句子', sentSlides(n.extra ?? [], '補充句子'))
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
