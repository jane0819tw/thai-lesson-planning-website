import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getRepository } from '../data/repository'
import type { Consonant, Lesson, Rule } from '../types'
import SpeakButton from './SpeakButton'
import { nameText } from '../audio/speak'
import WordIcon from './WordIcon'
import ToneTableView from './ToneTableView'
import LetterDialog from './LetterDialog'
import DiagramView from './DiagramView'
import ZoomImage from './ZoomImage'
import RuleExtras from './RuleExtras'
import Annotator, { type Stroke } from './Annotator'
import { soundLabel } from '../consonant'
import ToneIntro from './ToneIntro'
import { Recap, RuleBody, conceptItems, lessonTabs, type Tab } from './LessonPage'

// 投影片模式（試做，先支援 L1 用到的區塊）：同一份課程資料，一張卡一頁，內容自動縮放到填滿螢幕
const GROUP_ZH = { mid: '中子音', high: '高子音', lcp: '低子音 LCp', lcs: '低子音 LCs' } as const
interface Slide { section: string; body: ReactNode; letter?: number; chapter?: number }  // letter：子音頁是第幾個子音（上方的子音進度圓圈用）；chapter：屬於第幾章（上方章節列用，封面沒有）
const PEN_COLORS = ['#e11d48', '#2563eb', '#16a34a']
interface View { showZh: boolean; showRoman: boolean; openLetter: (c: Consonant) => void }

// 投影時說明文字分點：遇到「。」「；」就換一點（括號、引號裡的不算），句尾標點拿掉；原本用 \n 分行的照舊
const points = (body: string) => {
  if (body.includes('\n')) return body.split('\n')
  const out: string[] = []
  let depth = 0, cur = ''
  for (const ch of body) {
    if ('（(「『'.includes(ch)) depth++
    else if ('）)」』'.includes(ch)) depth = Math.max(0, depth - 1)
    if (depth === 0 && (ch === '。' || ch === '；')) { if (cur.trim()) out.push(cur.trim()); cur = '' }
    else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}
const SlideBody = ({ body }: { body: string }) => { const p = points(body); return p.length > 1 ? <RuleBody body={p.join('\n')} /> : <RuleBody body={p[0] ?? ''} /> }

// 已經做成投影片的區塊；games（互動練習）刻意不放。其他區塊先顯示一頁「還沒做成投影片」，不會默默漏掉
const SUPPORTED: Tab[] = ['diagram', 'rules', 'consonants', 'vocab', 'recap', 'extras', 'games']

function buildSlides(l: Lesson, v: View): Slide[] {
  const s: Slide[] = []
  s.push({ section: '', body: (
    <div className="pt-title">
      <div className="pt-num">L{l.number}</div>
      <h1>{l.title}</h1>
      <div className="muted"><SlideBody body={l.summary} /></div>
    </div>
  ) })
  // 區塊順序和課程頁一樣（lessonTabs），區塊內一張卡一頁；目前先支援 L1 用到的區塊
  const ruleSlide = (r: Rule, section: string): Slide => ({ section, body: (
    <article className="card">{r.title && <h3>{r.title}</h3>}<SlideBody body={r.body} /><RuleExtras r={r} Body={SlideBody} /></article>
  ) })
  // 每個區塊＝一章；記下每頁屬於第幾章，上方章節列標出目前進度
  let ci = -1
  for (const [k, label] of lessonTabs(l)) {
    const start = s.length
    if (k === 'diagram' && l.diagram) {
      if (l.rules.some(r => r.at === 'concept')) for (const x of conceptItems(l).filter(x => !('noSlide' in x && x.noSlide))) s.push('tiles' in x ? { section: label, body: <DiagramView d={x} showTitle /> } : ruleSlide(x, label))
      else s.push({ section: label, body: <DiagramView d={l.diagram} /> })
    }
    if (k === 'rules') {
      if (l.finalsIntro || l.vowelShifts?.length || (l.clusters && !l.clusters.unit) || l.readingCases?.some(t => !t.unit)) s.push({ section: label, body: <div className="pt-todo">「{label}」裡的總表（尾音總表、母音變形表、組合表）還沒做成投影片</div> })
      for (const r of l.rules.filter(r => !r.unit && !r.at && !r.noSlide)) s.push(ruleSlide(r, label))
      if (l.toneIntro) s.push({ section: label, body: <ToneIntro /> })  // 聲調符號與漢語對照放同一頁、上下排（L1 老師）
      for (const t of l.toneTables) s.push({ section: `${label}・規則`, body: <ToneTableView table={t} /> })
    }
    if (k === 'consonants') {
      for (const r of l.rules.filter(r => r.at === 'consonants' && !r.afterLetter && !r.noSlide)) s.push(ruleSlide(r, label))
      // 一個字母一頁，字母放大，點字母看筆順
      l.consonants.forEach((c, i) => { s.push({ section: `${label} ${i + 1}/${l.consonants.length}`, letter: i, body: (
        <article className="pt-letter">
          <button className="pt-char th" onClick={() => v.openLetter(c)} aria-label={`查看 ${c.char} 的筆順`}>{c.char}</button>
          <div className="pt-letter-info">
            <WordIcon char={c.char} label={c.zh} size={96} />
            <div className="th pt-name">{c.name} <SpeakButton text={nameText(c.name)} audioUrl={c.audioUrl} /></div>
            <div className={v.showRoman ? 'muted pt-sub' : 'muted pt-sub pt-hidden'}>{c.roman}</div>
            <div className={v.showZh ? 'pt-sub' : 'pt-sub pt-hidden'}>{c.zh}</div>
            <div className="muted">{GROUP_ZH[c.group]}｜{soundLabel(c)}</div>
          </div>
        </article>
      ) })
        // afterLetter：說明卡排在這個字母後面（L1 看完 ก 再解釋子音怎麼念）
        for (const r of l.rules.filter(r => r.at === 'consonants' && r.afterLetter === c.char && !r.noSlide)) s.push(ruleSlide(r, label))
      })
    }
    if (!SUPPORTED.includes(k)) s.push({ section: label, body: <div className="pt-todo">「{label}」區塊還沒做成投影片</div> })
    // 單字一個一頁：大字＋播放鈕＋中文（Z 開關，投影片預設不顯示）；認字課單字不顯示拼音
    if (k === 'vocab') l.vocab.forEach((w, n) => s.push({ section: `${label} ${n + 1}/${l.vocab.length}`, body: (
      <article className="pt-word">
        <div className="th pt-word-th">{w.thai} <SpeakButton text={w.thai} audioUrl={w.audioUrl} /></div>
        <div className={v.showZh ? 'pt-word-zh' : 'pt-word-zh pt-hidden'}>{w.zh}</div>
      </article>
    ) }))
    if (k === 'recap' && l.recap?.length) s.push({ section: label, body: <Recap points={l.recap} /> })
    if (k === 'extras') for (const x of l.extras) s.push({ section: label, body: (
      <article className="card">
        <h3>{x.title}</h3>
        {x.lines.map((t, i) => <p className="th big2" key={i}>{t}</p>)}
        {x.toneTables?.map(t => <ToneTableView key={t.title} table={t} />)}
        {x.images?.map(im => <ZoomImage key={im.src} src={`${import.meta.env.BASE_URL}${im.src}`} alt={im.alt} className="pt-img" />)}
      </article>
    ) })
    if (s.length > start) { ci++; for (let j = start; j < s.length; j++) s[j].chapter = ci }
  }
  return s
}
// 章節列：有投影片的區塊（互動練習不放）
const chaptersOf = (l: Lesson) => lessonTabs(l).filter(([k]) => k !== 'games').map(([, label]) => label)

// 內容先用原本大小排版、量好尺寸（含超出 900px 的表格），再縮放到剛好放進外框的內容區
function fitInto(box: HTMLElement, el: HTMLElement, max: number) {
  el.style.zoom = '1'
  const cs = getComputedStyle(box)
  const w = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  const h = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
  el.style.zoom = String(Math.min(w / Math.max(el.offsetWidth, el.scrollWidth), h / Math.max(el.offsetHeight, el.scrollHeight), max))
}

// 側邊欄的縮圖：同一頁內容縮小顯示，裡面的按鈕不能點（點縮圖＝跳到那一頁）
function Thumb({ body }: { body: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const el = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const f = () => { if (box.current && el.current) fitInto(box.current, el.current, 1) }
    f()
    const ro = new ResizeObserver(f)
    if (el.current) ro.observe(el.current)
    return () => ro.disconnect()
  }, [])
  return <div className="pt-thumb" ref={box} aria-hidden="true"><div className="pt-inner" ref={el}>{body}</div></div>
}

export default function PresentPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined)
  const [i, setI] = useState(0)
  const [showZh, setShowZh] = useState(false)  // 投影片預設不顯示中文（L1 老師），按 Z 或「中文」打開
  const [showRoman, setShowRoman] = useState(true)
  const [letter, setLetter] = useState<Consonant | null>(null)
  const [side, setSide] = useState(false)  // 左側縮圖列：滑到畫面最左邊或按 ☰ 打開
  // 每一頁的筆跡：存在這台電腦（每課分開），離開投影片再回來還在；按「清除筆跡」才清掉
  const inkKey = `present-ink-${id}`
  const [ink, setInkState] = useState<Record<number, Stroke[]>>({})
  useEffect(() => { try { setInkState(JSON.parse(localStorage.getItem(inkKey) ?? '{}')) } catch { setInkState({}) } }, [inkKey])
  const setInk = (f: (m: Record<number, Stroke[]>) => Record<number, Stroke[]>) => setInkState(m => {
    const next = f(m)
    for (const k in next) if (!next[k].length) delete next[k]
    localStorage.setItem(inkKey, JSON.stringify(next))
    return next
  })
  const [pen, setPen] = useState(false)
  const [penColor, setPenColor] = useState(PEN_COLORS[0])
  const [notesOpen, setNotesOpen] = useState(false)  // 左邊的補充單字筆記
  const [notes, setNotes] = useState('')
  const stage = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const notesKey = `present-notes-${id}`
  useEffect(() => { setNotes(localStorage.getItem(notesKey) ?? '') }, [notesKey])
  const saveNotes = (t: string) => { setNotes(t); localStorage.setItem(notesKey, t) }

  useEffect(() => { getRepository().getLesson(id ?? '').then(l => setLesson(l ?? null)) }, [id])
  const slides = lesson ? buildSlides(lesson, { showZh, showRoman, openLetter: setLetter }) : []
  const n = slides.length
  const go = useCallback((d: number) => setI(k => Math.min(Math.max(k + d, 0), Math.max(n - 1, 0))), [n])
  const exit = useCallback(() => { if (document.fullscreenElement) document.exitFullscreen(); nav(`/reading/lesson/${id}`) }, [id, nav])

  // 鍵盤：← → 空白鍵／翻頁筆的 PageUp PageDown 換頁，Z 中文、R 拼音，F 全螢幕，Esc 離開
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (letter || document.querySelector('.zoom-overlay, .overlay')) return  // 筆順視窗（含聲調符號）、放大圖片開著時不換頁、Esc 不離開
      const t = e.target as HTMLElement
      if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT') { if (e.key === 'Escape') t.blur(); return }  // 在筆記裡打字時不換頁
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(1) }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(-1) }
      else if (e.key === 'Home') setI(0)
      else if (e.key === 'End') setI(n - 1)
      else if (e.key === 'z' || e.key === 'Z') setShowZh(x => !x)
      else if (e.key === 'r' || e.key === 'R') setShowRoman(x => !x)
      else if (e.key === 'f' || e.key === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.() }
      else if (e.key === 'p' || e.key === 'P') setPen(x => !x)
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setNotesOpen(x => !x) }
      else if (e.key === 'Escape' && pen) setPen(false)
      else if (e.key === 'Escape' && !document.fullscreenElement) exit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, n, exit, letter, pen])

  // 放大到填滿畫面（最多放大 2.6 倍，避免字少的頁面大得誇張）
  const fit = useCallback(() => { if (stage.current && inner.current) fitInto(stage.current, inner.current, 2.6) }, [])
  useLayoutEffect(fit, [fit, i, lesson, showZh, showRoman])
  useEffect(() => {
    let raf = 0
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit) })  // 下一個 frame 再縮放，避免 ResizeObserver loop 警告
    if (stage.current) ro.observe(stage.current)
    if (inner.current) ro.observe(inner.current)  // 圖片載入後高度會變；內容區每頁重建（key={i}），換頁要重新監看
    return () => { ro.disconnect(); cancelAnimationFrame(raf) }
  }, [fit, lesson, i])

  if (lesson === undefined) return <p>載入中…</p>
  if (lesson === null) return <p>找不到這一課。</p>
  const cur = slides[Math.min(i, n - 1)]
  const strokes = ink[i] ?? []
  const jump = (k: number) => { setI(k); setSide(false) }

  return (
    <div className={notesOpen ? 'present notes-open' : 'present'}>
      <div className="pt-top">
        <span className="pt-where">L{lesson.number}{cur.section && `｜${cur.section}`}</span>
        {/* 章節列：整課章節一排，目前這章主色、講過的變淡，點了跳到那章第一頁 */}
        <nav className="pt-chapters" aria-label="章節">
          {chaptersOf(lesson).map((t, j) => (
            <button key={t + j} className={j === cur.chapter ? 'on' : cur.chapter !== undefined && j < cur.chapter ? 'done' : undefined} onClick={() => setI(slides.findIndex(x => x.chapter === j))}>{t}</button>
          ))}
        </nav>
        <span className="pt-tools">
          {/* 筆：在投影片上畫重點；這頁有筆跡時出現「清除筆跡」 */}
          <button className={pen ? 'on' : undefined} onClick={() => setPen(x => !x)} title="P">✏️ 筆</button>
          {pen && PEN_COLORS.map(c => <button key={c} className={`pt-color${c === penColor ? ' on' : ''}`} style={{ background: c }} onClick={() => setPenColor(c)} aria-label="筆的顏色" />)}
          {strokes.length > 0 && <button onClick={() => setInk(m => ({ ...m, [i]: [] }))}>清除筆跡</button>}
          <button className={notesOpen ? 'on' : undefined} onClick={() => setNotesOpen(x => !x)} title="N">補充</button>
          <button className={showZh ? 'on' : undefined} onClick={() => setShowZh(x => !x)} title="Z">中文</button>
          <button className={showRoman ? 'on' : undefined} onClick={() => setShowRoman(x => !x)} title="R">拼音</button>
          <button onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()} title="F">全螢幕</button>
          <button onClick={exit} title="Esc">離開</button>
        </span>
      </div>
      {/* 子音頁：上方一排小圓圈列出這課的子音，目前這個變色、講過的淡色，點了直接跳過去 */}
      <div className="pt-rail">
        {cur.letter !== undefined && lesson.consonants.map((c, k) => (
          <button key={c.id} className={`th${k === cur.letter ? ' on' : k < cur.letter! ? ' done' : ''}`} onClick={() => setI(slides.findIndex(x => x.letter === k))} aria-label={`跳到 ${c.char}`}>{c.char}</button>
        ))}
      </div>
      <div className="pt-stage" ref={stage}>
        <div className="pt-inner" ref={inner} key={i}>{cur.body}</div>
        <Annotator key={`ink${i}`} strokes={strokes} drawing={pen} color={penColor} onChange={s => setInk(m => ({ ...m, [i]: s }))} />
      </div>
      {/* 補充單字：左邊跳出的筆記，上課時直接打字；內容存在這台電腦（每課分開） */}
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
            <button key={k} className={k === i ? 'on' : undefined} onClick={() => jump(k)} ref={k === i ? el => el?.scrollIntoView({ block: 'nearest' }) : undefined}>
              <Thumb body={x.body} />
              <span>{k + 1}　{x.section || '封面'}</span>
            </button>
          ))}
        </nav>
      )}
      <div className="pt-progress" style={{ width: `${((i + 1) / n) * 100}%` }} />
      {letter && <LetterDialog char={letter.char} info={letter} onClose={() => setLetter(null)} />}
    </div>
  )
}
