import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getRepository } from '../data/repository'
import type { Consonant, Lesson, Rule } from '../types'
import SpeakButton from './SpeakButton'
import { nameText } from '../audio/speak'
import WordIcon from './WordIcon'
import ToneTableView from './ToneTableView'
import WordList from './WordList'
import LetterDialog from './LetterDialog'
import DiagramView from './DiagramView'
import ZoomImage from './ZoomImage'
import RuleDemo from './RuleDemo'
import ToneIntro from './ToneIntro'
import { RuleBody, conceptItems, lessonTabs, type Tab } from './LessonPage'

// 投影片模式（試做，先支援 L1 用到的區塊）：同一份課程資料，一張卡一頁，內容自動縮放到填滿螢幕
const GROUP_ZH = { mid: '中子音', high: '高子音', lcp: '低子音 LCp', lcs: '低子音 LCs' } as const
interface Slide { section: string; body: ReactNode; letter?: number }  // letter：子音頁是第幾個子音（上方的子音進度圓圈用）
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
const SUPPORTED: Tab[] = ['diagram', 'rules', 'consonants', 'vocab', 'extras', 'games']

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
    <article className="card">{r.title && <h3>{r.title}</h3>}<SlideBody body={r.body} />{r.demo && <RuleDemo tiles={r.demo} />}{r.toneTable && <ToneTableView table={r.toneTable} />}</article>
  ) })
  for (const [k, label] of lessonTabs(l)) {
    if (k === 'diagram' && l.diagram) {
      if (l.rules.some(r => r.at === 'concept')) for (const x of conceptItems(l)) s.push('tiles' in x ? { section: label, body: <DiagramView d={x} showTitle /> } : ruleSlide(x, label))
      else s.push({ section: label, body: <DiagramView d={l.diagram} /> })
    }
    if (k === 'rules') {
      if (l.finalsIntro || l.vowelShifts?.length || (l.clusters && !l.clusters.unit)) s.push({ section: label, body: <div className="pt-todo">「{label}」裡的總表（尾音總表、母音變形表、組合表）還沒做成投影片</div> })
      for (const r of l.rules.filter(r => !r.unit && !r.at)) s.push(ruleSlide(r, label))
      if (l.toneIntro) s.push({ section: label, body: <ToneIntro part="marks" /> }, { section: `${label}・對照`, body: <ToneIntro part="compare" /> })
      for (const t of l.toneTables) s.push({ section: `${label}・規則`, body: <ToneTableView table={t} /> })
    }
    if (k === 'consonants') {
      for (const r of l.rules.filter(r => r.at === 'consonants')) s.push(ruleSlide(r, label))
      // 一個字母一頁，字母放大，點字母看筆順
      l.consonants.forEach((c, i) => s.push({ section: `${label} ${i + 1}/${l.consonants.length}`, letter: i, body: (
        <article className="pt-letter">
          <button className="pt-char th" onClick={() => v.openLetter(c)} aria-label={`查看 ${c.char} 的筆順`}>{c.char}</button>
          <div className="pt-letter-info">
            <WordIcon char={c.char} label={c.zh} size={96} />
            <div className="th pt-name">{c.name} <SpeakButton text={nameText(c.name)} audioUrl={c.audioUrl} /></div>
            <div className={v.showRoman ? 'muted pt-sub' : 'muted pt-sub pt-hidden'}>{c.roman}</div>
            <div className={v.showZh ? 'pt-sub' : 'pt-sub pt-hidden'}>{c.zh}</div>
            <div className="muted">{GROUP_ZH[c.group]}｜發音 {c.sound}</div>
          </div>
        </article>
      ) }))
    }
    if (!SUPPORTED.includes(k)) s.push({ section: label, body: <div className="pt-todo">「{label}」區塊還沒做成投影片</div> })
    if (k === 'vocab') s.push({ section: label, body: <WordList compact="wide" words={l.vocab} showZh={v.showZh} showRoman={v.showRoman} /> })
    if (k === 'extras') for (const x of l.extras) s.push({ section: label, body: (
      <article className="card">
        <h3>{x.title}</h3>
        {x.lines.map((t, i) => <p className="th big2" key={i}>{t}</p>)}
        {x.toneTables?.map(t => <ToneTableView key={t.title} table={t} />)}
        {x.images?.map(im => <ZoomImage key={im.src} src={`${import.meta.env.BASE_URL}${im.src}`} alt={im.alt} className="pt-img" />)}
      </article>
    ) })
  }
  return s
}

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
  const [showZh, setShowZh] = useState(true)
  const [showRoman, setShowRoman] = useState(true)
  const [letter, setLetter] = useState<Consonant | null>(null)
  const [side, setSide] = useState(false)  // 左側縮圖列：滑到畫面最左邊或按 ☰ 打開
  const stage = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)

  useEffect(() => { getRepository().getLesson(id ?? '').then(l => setLesson(l ?? null)) }, [id])
  const slides = lesson ? buildSlides(lesson, { showZh, showRoman, openLetter: setLetter }) : []
  const n = slides.length
  const go = useCallback((d: number) => setI(k => Math.min(Math.max(k + d, 0), Math.max(n - 1, 0))), [n])
  const exit = useCallback(() => { if (document.fullscreenElement) document.exitFullscreen(); nav(`/reading/lesson/${id}`) }, [id, nav])

  // 鍵盤：← → 空白鍵／翻頁筆的 PageUp PageDown 換頁，Z 中文、R 拼音，F 全螢幕，Esc 離開
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (letter || document.querySelector('.zoom-overlay')) return  // 筆順視窗、放大圖片開著時不換頁
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(1) }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(-1) }
      else if (e.key === 'Home') setI(0)
      else if (e.key === 'End') setI(n - 1)
      else if (e.key === 'z' || e.key === 'Z') setShowZh(x => !x)
      else if (e.key === 'r' || e.key === 'R') setShowRoman(x => !x)
      else if (e.key === 'f' || e.key === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.() }
      else if (e.key === 'Escape' && !document.fullscreenElement) exit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, n, exit, letter])

  // 放大到填滿畫面（最多放大 2.6 倍，避免字少的頁面大得誇張）
  const fit = useCallback(() => { if (stage.current && inner.current) fitInto(stage.current, inner.current, 2.6) }, [])
  useLayoutEffect(fit, [fit, i, lesson, showZh, showRoman])
  useEffect(() => {
    const ro = new ResizeObserver(fit)
    if (stage.current) ro.observe(stage.current)
    if (inner.current) ro.observe(inner.current)  // 圖片載入後高度會變
    return () => ro.disconnect()
  }, [fit, lesson])

  if (lesson === undefined) return <p>載入中…</p>
  if (lesson === null) return <p>找不到這一課。</p>
  const cur = slides[Math.min(i, n - 1)]
  const firstLetter = slides.findIndex(x => x.letter === 0)
  const jump = (k: number) => { setI(k); setSide(false) }

  return (
    <div className="present">
      <div className="pt-top">
        <span className="pt-where">L{lesson.number}{cur.section && `｜${cur.section}`}</span>
        <span className="pt-tools">
          <button className={showZh ? 'on' : undefined} onClick={() => setShowZh(x => !x)} title="Z">中文</button>
          <button className={showRoman ? 'on' : undefined} onClick={() => setShowRoman(x => !x)} title="R">拼音</button>
          <button onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()} title="F">全螢幕</button>
          <button onClick={exit} title="Esc">離開</button>
        </span>
      </div>
      {/* 子音頁：上方一排小圓圈列出這課的子音，目前這個變色、講過的淡色，點了直接跳過去 */}
      <div className="pt-rail">
        {cur.letter !== undefined && lesson.consonants.map((c, k) => (
          <button key={c.id} className={`th${k === cur.letter ? ' on' : k < cur.letter! ? ' done' : ''}`} onClick={() => setI(firstLetter + k)} aria-label={`跳到 ${c.char}`}>{c.char}</button>
        ))}
      </div>
      <div className="pt-stage" ref={stage}>
        <div className="pt-inner" ref={inner} key={i}>{cur.body}</div>
      </div>
      <div className="pt-bottom">
        <button onClick={() => go(-1)} disabled={i === 0} aria-label="上一頁">‹</button>
        <span>{i + 1} / {n}</span>
        <button onClick={() => go(1)} disabled={i >= n - 1} aria-label="下一頁">›</button>
      </div>
      <button className="pt-sidebtn" onClick={() => setSide(x => !x)} aria-label="投影片列表">☰</button>
      <div className="pt-edge" onMouseEnter={() => setSide(true)} />
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
