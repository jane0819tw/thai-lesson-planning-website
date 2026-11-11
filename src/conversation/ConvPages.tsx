import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import BackLink from '../reservation/BackLink'
import { convUnits, unitLabel } from '../reservation/access'
import Annotator, { type Stroke } from '../components/Annotator'
import { Thumb, fitInto } from '../components/PresentPage'
import { convLesson, convLessons, convLevels, levelTitle } from './data'
import { BlockCard, DialogueCard, ExtraCard, GoalsCard, PracticeCard, RecapCard, ReviewCard, sectionsOf } from './Parts'
import { ToggleBar, toggleClass, useConvToggles, type ConvToggles } from './toggles'
import type { ConvLesson } from './types'
import './conv.css'

// 會話課程：列表、課程頁、投影片、單元講義。資料與卡片見 data.ts、Parts.tsx

const lessonPath = (l: ConvLesson) => `/conversation/${l.level}/lesson/${l.number}`

/** /conversation：每一級一組，每 5 課一個單元，單元後面接「列印講義」 */
export function ConvIndex() {
  return (
    <>
      <p><BackLink to="/" label="所有課程" /></p>
      <h1>泰語會話課程</h1>
      {convLevels().map(lv => (
        <section key={lv}>
          <h2>{levelTitle(lv)}</h2>
          {convUnits(lv).map(u => (
            <Fragment key={u.id}>
              <h3 className="c-unit-h">第 {u.n} 單元　{unitLabel(u)}</h3>
              <ul className="lessons">
                {convLessons(lv).filter(l => l.number >= u.from && l.number <= u.to).map(l => (
                  <li key={l.id}>
                    <Link to={lessonPath(l)}>
                      <span className="num">L{l.number}</span>
                      <strong>{l.title}</strong>
                      <small>{l.goals.join('；')}</small>
                      {l.status !== 'ready' && <em className="badge">草稿</em>}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link to={`/conversation/${lv}/handout/${u.n}`}>
                    <span className="num">講義</span>
                    <strong>🖨 {unitLabel(u)} 列印講義</strong>
                    <small>這個單元的句型、對話串、練習，可以印出來或存成 PDF</small>
                  </Link>
                </li>
              </ul>
            </Fragment>
          ))}
        </section>
      ))}
    </>
  )
}

function useLessonParam(): ConvLesson | undefined {
  const { level, n } = useParams()
  return convLesson(Number(level), Number(n))
}

/** 課程頁：區塊照順序往下排，上方一排跳到各區塊 */
export function ConvLessonPage() {
  const l = useLessonParam()
  const [t, flip] = useConvToggles()
  if (!l) return <p>找不到這一課。<Link to="/conversation">回會話課程</Link></p>
  const secs = sectionsOf(l)
  return (
    <div className={`cpage ${toggleClass(t)}`}>
      <p><BackLink to="/conversation" label="會話課程" /></p>
      <div className="c-num">{levelTitle(l.level)}・L{l.number}</div>
      <h1>{l.title}</h1>
      <p className="c-bar">
        <Link className="vtog" to={`${lessonPath(l)}/present`}>▶ 投影片模式</Link>
        <ToggleBar t={t} flip={flip} />
      </p>
      <nav className="c-toc">{secs.map(s => <a key={s.key} href={`#c-${s.key}`} onClick={e => { e.preventDefault(); document.getElementById(`c-${s.key}`)?.scrollIntoView({ behavior: 'smooth' }) }}>{s.label}</a>)}</nav>
      {secs.map(s => (
        <section key={s.key} id={`c-${s.key}`} className={`c-sec sec-${s.key}`}>
          <h2>{s.label}</h2>
          <div className="c-cards-col">{s.cards}</div>
        </section>
      ))}
    </div>
  )
}

/** 投影片：一張卡一頁（句型一個一頁、練習一個一頁），縮放、章節列、筆、補充筆記同認字課投影片 */
export interface Slide { section: string; chapter: number; body: ReactNode }
function buildSlides(l: ConvLesson): { slides: Slide[]; chapters: string[] } {
  const slides: Slide[] = []
  const chapters: string[] = []
  const add = (label: string, bodies: ReactNode[]) => { if (!bodies.length) return; chapters.push(label); bodies.forEach((b, k) => slides.push({ section: bodies.length > 1 ? `${label} ${k + 1}/${bodies.length}` : label, chapter: chapters.length - 1, body: b })) }
  add('今日目標', [(
    <div className="pt-title c-cover" key="cover">
      <div className="pt-num">{levelTitle(l.level)}・L{l.number}</div>
      <h1>{l.title}</h1>
      <GoalsCard l={l} />
    </div>
  )])
  if (l.review?.length) add('複習', [<ReviewCard l={l} key="r" />])
  add('句型', l.blocks.map(b => <BlockCard b={b} key={b.id} />))
  // 對話串整段太長、縮得太小：資料有 newSlide 就照老師指定的分頁；沒有就一頁最多 4 段話（一則訊息不拆開）
  if (l.dialogue) {
    const d = l.dialogue, pages: [number, number][] = []
    const manual = d.lines.some(x => x.newSlide)
    d.lines.forEach((x, k) => {
      const last = pages[pages.length - 1]
      const segs = last ? d.lines.slice(last[0], k).reduce((n, y) => n + y.segs.length, 0) : 0
      const fits = manual ? !x.newSlide : segs + x.segs.length <= SEGS_PER_SLIDE
      if (last && fits) last[1] = k + 1
      else pages.push([k, k + 1])
    })
    add('對話串', pages.map(([a, b]) => <DialogueCard d={d} from={a} to={b} key={a} />))
  }
  add('練習', l.practice.map((p, i) => <PracticeCard p={p} key={i} />))
  add('補充', (l.extras ?? []).map((x, i) => <ExtraCard x={x} key={i} />))
  if (l.recap?.length) add('總結', [<RecapCard l={l} key="c" />])
  return { slides, chapters }
}

const PEN_COLORS = ['#e11d48', '#2563eb', '#16a34a']
const SEGS_PER_SLIDE = 4

export function ConvPresent() {
  const l = useLessonParam()
  const nav = useNavigate()
  const [t, flip] = useConvToggles()
  if (!l) return <p>找不到這一課。<Link to="/conversation">回會話課程</Link></p>
  const { slides, chapters } = buildSlides(l)
  return <SlideShow slides={slides} chapters={chapters} where={`L${l.number}`} storeKey={l.id} onExit={() => nav(lessonPath(l))} t={t} flip={flip} />
}

/** 投影片外框（會話課、時事補充共用）：換頁、章節列、筆、補充筆記、縮放；筆跡和筆記依 storeKey 存在這台電腦 */
export function SlideShow({ slides, chapters, where, storeKey, onExit, t, flip }: {
  slides: Slide[]; chapters: string[]; where: string; storeKey: string; onExit: () => void
  t: ConvToggles; flip: (k: keyof ConvToggles) => void
}) {
  const [i, setI] = useState(0)
  const [side, setSide] = useState(false)
  const [pen, setPen] = useState(false)
  const [penColor, setPenColor] = useState(PEN_COLORS[0])
  const [notesOpen, setNotesOpen] = useState(false)
  // 筆跡、補充筆記存在這台電腦（每課分開），同認字課投影片
  const inkKey = `present-ink-${storeKey}`, notesKey = `present-notes-${storeKey}`
  const [ink, setInkState] = useState<Record<number, Stroke[]>>({})
  const [notes, setNotes] = useState('')
  useEffect(() => { try { setInkState(JSON.parse(localStorage.getItem(inkKey) ?? '{}')) } catch { setInkState({}) } setNotes(localStorage.getItem(notesKey) ?? '') }, [inkKey, notesKey])
  const setInk = (f: (m: Record<number, Stroke[]>) => Record<number, Stroke[]>) => setInkState(m => {
    const next = f(m)
    for (const k in next) if (!next[k].length) delete next[k]
    localStorage.setItem(inkKey, JSON.stringify(next))
    return next
  })
  const saveNotes = (x: string) => { setNotes(x); localStorage.setItem(notesKey, x) }
  const n = slides.length
  const go = useCallback((d: number) => setI(k => Math.min(Math.max(k + d, 0), Math.max(n - 1, 0))), [n])
  const exit = useCallback(() => { if (document.fullscreenElement) document.exitFullscreen(); onExit() }, [onExit])

  // ← → 空白鍵／翻頁筆換頁；Z 中文、R 拼音、S 喇叭、A 藝術字、P 筆、N 補充、F 全螢幕、Esc 離開
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('.zoom-overlay, .overlay')) return
      const tg = e.target as HTMLElement
      if (tg.tagName === 'TEXTAREA' || tg.tagName === 'INPUT') { if (e.key === 'Escape') tg.blur(); return }
      const k = e.key.toLowerCase()
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(1) }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(-1) }
      else if (e.key === 'Home') setI(0)
      else if (e.key === 'End') setI(n - 1)
      else if (k === 'z') flip('zh')
      else if (k === 'r') flip('rom')
      else if (k === 'a') flip('art')
      else if (k === 's') flip('speak')
      else if (k === 'f') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.() }
      else if (k === 'p') setPen(x => !x)
      else if (k === 'n') { e.preventDefault(); setNotesOpen(x => !x) }
      else if (e.key === 'Escape' && pen) setPen(false)
      else if (e.key === 'Escape' && !document.fullscreenElement) exit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, n, exit, pen, flip])

  const stage = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const fit = useCallback(() => { if (stage.current && inner.current) fitInto(stage.current, inner.current, 2.2) }, [])
  useLayoutEffect(fit, [fit, i, t])
  useEffect(() => {
    let raf = 0
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit) })
    if (stage.current) ro.observe(stage.current)
    if (inner.current) ro.observe(inner.current)
    return () => { ro.disconnect(); cancelAnimationFrame(raf) }
  }, [fit, i])

  if (!n) return null
  const cur = slides[Math.min(i, n - 1)]
  const strokes = ink[i] ?? []
  return (
    <div className={`present c-slides ${toggleClass(t)}${notesOpen ? ' notes-open' : ''}`}>
      <div className="pt-top">
        <span className="pt-where">{where}｜{cur.section}</span>
        <nav className="pt-chapters" aria-label="章節">
          {chapters.map((c, j) => (
            <button key={c} className={j === cur.chapter ? 'on' : j < cur.chapter ? 'done' : undefined} onClick={() => setI(slides.findIndex(x => x.chapter === j))}>{c}</button>
          ))}
        </nav>
        <span className="pt-tools">
          <button className={pen ? 'on' : undefined} onClick={() => setPen(x => !x)} title="P">✏️ 筆</button>
          {pen && PEN_COLORS.map(c => <button key={c} className={`pt-color${c === penColor ? ' on' : ''}`} style={{ background: c }} onClick={() => setPenColor(c)} aria-label="筆的顏色" />)}
          {strokes.length > 0 && <button onClick={() => setInk(m => ({ ...m, [i]: [] }))}>清除筆跡</button>}
          <button className={notesOpen ? 'on' : undefined} onClick={() => setNotesOpen(x => !x)} title="N">補充</button>
          <button className={t.rom ? 'on' : undefined} onClick={() => flip('rom')} title="R">拼音</button>
          <button className={t.zh ? 'on' : undefined} onClick={() => flip('zh')} title="Z">中文</button>
          <button className={t.speak ? 'on' : undefined} onClick={() => flip('speak')} title="S">喇叭</button>
          <button className={t.art ? 'on' : undefined} onClick={() => flip('art')} title="A">藝術字</button>
          <button onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()} title="F">全螢幕</button>
          <button onClick={exit} title="Esc">離開</button>
        </span>
      </div>
      <div className="pt-rail" />
      <div className="pt-stage" ref={stage}>
        <div className="pt-inner" ref={inner} key={i}>{cur.body}</div>
        <Annotator key={`ink${i}`} strokes={strokes} drawing={pen} color={penColor} onChange={s => setInk(m => ({ ...m, [i]: s }))} />
      </div>
      {notesOpen && (
        <aside className="pt-notes">
          <div className="pt-notes-head"><b>補充</b><button onClick={() => setNotesOpen(false)} aria-label="關閉補充">✕</button></div>
          <textarea className="th" value={notes} onChange={e => saveNotes(e.target.value)} placeholder="上課時補充的單字、例句…" autoFocus />
          {notes && <button className="pt-notes-clear" onClick={() => saveNotes('')}>清空</button>}
        </aside>
      )}
      <div className="pt-bottom">
        <button onClick={() => go(-1)} disabled={i === 0} aria-label="上一頁">‹</button>
        <span>{i + 1} / {n}</span>
        <button onClick={() => go(1)} disabled={i >= n - 1} aria-label="下一頁">›</button>
      </div>
      <button className="pt-sidebtn" onClick={() => setSide(x => !x)} aria-label="投影片列表">☰</button>
      {!notesOpen && !pen && <div className="pt-edge" onMouseEnter={() => setSide(true)} />}
      {side && (
        <nav className="pt-side" onMouseLeave={() => setSide(false)} aria-label="投影片列表">
          {slides.map((x, k) => (
            <button key={k} className={k === i ? 'on' : undefined} onClick={() => { setI(k); setSide(false) }} ref={k === i ? el => el?.scrollIntoView({ block: 'nearest' }) : undefined}>
              <Thumb body={x.body} />
              <span>{k + 1}　{x.section}</span>
            </button>
          ))}
        </nav>
      )}
      <div className="pt-progress" style={{ width: `${((i + 1) / n) * 100}%` }} />
    </div>
  )
}

/** 單元講義（A4）：封面 → 每一課（每課另起一頁）。照目前的拼音／中文／藝術字開關印 */
export function ConvHandout() {
  const { level, unit } = useParams()
  const lv = Number(level), un = Number(unit)
  const [t, flip] = useConvToggles()
  const u = convUnits(lv).find(x => x.n === un)
  const lessons = u ? convLessons(lv).filter(l => l.number >= u.from && l.number <= u.to) : []
  useEffect(() => { document.title = `${levelTitle(lv)} ${u ? unitLabel(u) : ''} 講義` }, [lv, u])
  if (!u || !lessons.length) return <p>這個單元還沒有課程。<Link to="/conversation">回會話課程</Link></p>
  return (
    <div className={`chandout ${toggleClass(t)}`}>
      <p className="noprint c-bar"><BackLink to="/conversation" label="會話課程" />　<button className="btn" onClick={() => window.print()}>列印／存成 PDF</button>　<ToggleBar t={t} flip={flip} /><span className="small muted">照開關的狀態印</span></p>
      <header className="h-cover">
        <div className="h-num">{levelTitle(lv)}</div>
        <h1>第 {u.n} 單元　{unitLabel(u)} 講義</h1>
        <ol>{lessons.map(l => <li key={l.id}>L{l.number}　{l.title}</li>)}</ol>
      </header>
      {lessons.map(l => (
        <section className="c-hlesson" key={l.id}>
          <h1 className="c-htitle"><span className="c-num">L{l.number}</span> {l.title}</h1>
          {sectionsOf(l, true).map(s => (
            <section key={s.key} className={`c-sec sec-${s.key}`}>
              <h2>{s.label}</h2>
              <div className="c-cards-col">{s.cards}</div>
            </section>
          ))}
        </section>
      ))}
    </div>
  )
}
