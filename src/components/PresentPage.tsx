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
import { Recap, RuleBody, conceptItems, lessonPractice, lessonTabs, practiceLabel, vowelSections, vowelsOf, type Tab } from './LessonPage'
import VowelIntro from './VowelIntro'
import { MemeCard, VowelCard } from './LessonCards'
import { ReviewSlide, RuleFillSlide, hasRulesBefore } from './ReviewFill'

// 投影片模式（試做，先支援 L1 用到的區塊）：同一份課程資料，一張卡一頁，內容自動縮放到填滿螢幕
const GROUP_ZH = { mid: '中子音', high: '高子音', lcp: '低子音 LCp', lcs: '低子音 LCs' } as const
interface Slide { section: string; body: ReactNode; letter?: number; chapter?: number; uniform?: string }  // uniform：同一組的頁用同一個縮放比例（L2 母音頁寬度一致：以這組最高的那頁來縮）  // letter：子音頁是第幾個子音（上方的子音進度圓圈用）；chapter：屬於第幾章（上方章節列用，封面沒有）
const PEN_COLORS = ['#e11d48', '#2563eb', '#16a34a']
interface View { showZh: boolean; showRoman: boolean; openLetter: (c: Consonant) => void; openVowel: (x: { char: string; ipa: string }) => void }

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
const SUPPORTED: Tab[] = ['review', 'diagram', 'rules', 'vowels', 'consonants', 'vocab', 'practice', 'recap', 'memes', 'extras', 'games']

// 投影片的區塊＝課程頁的區塊；L2 起最前面多一個「複習」（只在投影片，課程頁沒有）
const slideTabs = (l: Lesson): [Tab, string][] => { const t = lessonTabs(l); return l.number >= 2 && !t.some(([k]) => k === 'review') ? [['review', '複習'], ...t] : t }

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
    <article className="card">{r.title && <h3>{r.title}</h3>}{r.body && <SlideBody body={r.body} />}<RuleExtras r={r} Body={SlideBody} /></article>
  ) })
  // 一個詞一頁：大字＋播放鈕＋中文（Z 開關，投影片預設不顯示）＋圖；認字課不顯示拼音（單字、多音節練習共用）
  const wordSlides = (label: string, words: { thai: string; zh?: string; audioUrl?: string | null; image?: { src: string; alt: string } }[]) => words.forEach((w, n) => s.push({ section: `${label} ${n + 1}/${words.length}`, body: (
    <article className={w.image ? 'pt-word has-img' : 'pt-word'}>
      <div className="pt-word-text">
        <div className="th pt-word-th">{w.thai} <SpeakButton text={w.thai} audioUrl={w.audioUrl} /></div>
        <div className={v.showZh ? 'pt-word-zh' : 'pt-word-zh pt-hidden'}>{w.zh}</div>
      </div>
      {/* 有圖的字：圖放在右邊（L2 老師） */}
      {w.image && <ZoomImage src={`${import.meta.env.BASE_URL}${w.image.src}`} alt={w.image.alt} className="pt-word-img" />}
    </article>
  ) }))
  const vocabSlides = (label: string) => wordSlides(label, l.vocab)
  // 每個區塊＝一章；記下每頁屬於第幾章，上方章節列標出目前進度
  let ci = -1
  for (const [k, label] of slideTabs(l)) {
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
      // 有例字的課（L4 起）：例字列在資訊下面（中文跟 Z），整組子音頁用同一個縮放比例，字母大小不會一頁大一頁小
      const hasWords = l.consonants.some(c => c.words.length)
      l.consonants.forEach((c, i) => { s.push({ section: `${label} ${i + 1}/${l.consonants.length}`, letter: i, uniform: hasWords ? 'letter' : undefined, body: (
        <article className="pt-letter">
          <button className="pt-char th" onClick={() => v.openLetter(c)} aria-label={`查看 ${c.char} 的筆順`}>{c.char}</button>
          <div className="pt-letter-info">
            <WordIcon char={c.char} label={c.zh} size={96} />
            <div className="th pt-name">{c.name} <SpeakButton text={nameText(c.name)} audioUrl={c.audioUrl} /></div>
            <div className={v.showRoman ? 'muted pt-sub' : 'muted pt-sub pt-hidden'}>{c.roman}</div>
            <div className={v.showZh ? 'pt-sub' : 'pt-sub pt-hidden'}>{c.zh}</div>
            <div className="muted">{GROUP_ZH[c.group]}｜{soundLabel(c)}{c.sameHigh && <>｜同音高子音：<span className="th">{c.sameHigh}</span></>}</div>
          </div>
          {/* 例字排在右邊（L4 老師） */}
          {c.words.length > 0 && (
              <div className="cwords pt-cwords">
                {c.words.map(w => (
                  <div key={w.thai} className={w.star ? 'cword wstar' : 'cword'}>
                    <span className="th cword-th">{w.thai}</span>
                    <SpeakButton text={w.thai} audioUrl={w.audioUrl} />
                    {w.zh && <span className={v.showZh ? 'cword-zh' : 'cword-zh pt-hidden'}>{w.zh}</span>}
                  </div>
                ))}
              </div>
            )}
        </article>
      ) })
        // afterLetter：說明卡排在這個字母後面（L1 看完 ก 再解釋子音怎麼念）
        for (const r of l.rules.filter(r => r.at === 'consonants' && r.afterLetter === c.char && !r.noSlide)) s.push(ruleSlide(r, label))
      })
    }
    // 母音：總覽一頁、母音前的說明卡（拼讀範例、聲調表）各一頁、一個母音一頁（L2）
    // 母音分段（L5 複合母音、特殊母音）時每段是一章，總覽、說明卡放第一段；章節列已經標出段名，不另做 heading 頁
    if (k === 'vowels' || k.startsWith('vowels-')) {
      if (k === 'vowels') {
      if (l.vowelIntro) s.push({ section: label, body: <VowelIntro config={typeof l.vowelIntro === 'object' ? l.vowelIntro : undefined} /> })
      if (l.sanskritVowels?.length) s.push({ section: label, body: <div className="pt-todo">梵文母音表還沒做成投影片</div> })
      for (const r of l.vowelNotes ?? []) s.push(ruleSlide(r, label))
      }
      for (const vw of vowelsOf(l, k)) {
        if (vw.heading && vowelSections(l).length === 1) s.push({ section: label, body: <div className="pt-title"><h1>{vw.heading}</h1></div> })
        for (const r of vw.preface ?? []) s.push(ruleSlide(r, label))
        s.push({ section: `${label} ${vw.ipa}`, uniform: 'vowel', body: <VowelCard v={vw} showZh={v.showZh} onOpen={v.openVowel} /> })
        for (const r of vw.after ?? []) s.push(ruleSlide(r, label))
        if (l.vocabAfterVowel === vw.id) vocabSlides(label)
      }
    }
    // 練習：一個詞一頁（中文跟著 Z 開關）
    if (k === 'practice') {
      // 一個詞一頁（L2 老師：多音節練習也要一頁一頁顯示）；有好幾組時頁首標上組名
      for (const g of lessonPractice(l)) wordSlides(g.title && g.title !== practiceLabel(l) ? `${label}・${g.title}` : label, g.items)
      if (l.patterns.length) s.push({ section: label, body: <div className="pt-todo">句型還沒做成投影片</div> })
    }
    // 補充（梗圖、影片截圖）：一張卡一頁
    if (k === 'memes') for (const m of l.memes) s.push({ section: label, body: <MemeCard m={m} className="card pt-meme" /> })
    if (!SUPPORTED.includes(k) && !k.startsWith('vowels-')) s.push({ section: label, body: <div className="pt-todo">「{label}」區塊還沒做成投影片</div> })
    // 單字一個一頁：大字＋播放鈕＋中文（Z 開關，投影片預設不顯示）；認字課單字不顯示拼音
    if (k === 'vocab') vocabSlides(label)
    if (k === 'recap' && l.recap?.length) s.push({ section: label, body: <Recap points={l.recap} /> })
    // 複習（L2 起）：鍵盤＋子母音填空一頁、拼讀規則填空一頁；課程資料原本的複習卡接在後面、一張一頁
    if (k === 'review' && l.number >= 2) {
      s.push({ section: `${label}・子母音`, body: <ReviewSlide upTo={l.number} /> })
      if (hasRulesBefore(l.number)) s.push({ section: `${label}・拼讀規則`, body: <RuleFillSlide upTo={l.number} /> })
    }
    if (k === 'extras' || k === 'review') for (const x of (k === 'review' ? l.review ?? [] : l.extras)) s.push({ section: label, body: (
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
const chaptersOf = (l: Lesson) => slideTabs(l).filter(([k]) => k !== 'games').map(([, label]) => label)

// 內容先用原本大小排版、量好尺寸（含超出 900px 的表格），再縮放到剛好放進外框的內容區
// minH／minW：同一組（uniform）裡最大的內容尺寸，讓整組用同一個比例
function fitInto(box: HTMLElement, el: HTMLElement, max: number, minH = 0, minW = 0) {
  el.style.zoom = '1'
  const cs = getComputedStyle(box)
  const w = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  const h = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
  el.style.zoom = String(Math.min(w / Math.max(el.offsetWidth, el.scrollWidth, minW), h / Math.max(el.offsetHeight, el.scrollHeight, minH), max))
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
  const [vowel, setVowel] = useState<{ char: string; ipa: string } | null>(null)  // 母音筆順視窗
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
  const slides = lesson ? buildSlides(lesson, { showZh, showRoman, openLetter: setLetter, openVowel: setVowel }) : []
  const n = slides.length
  const go = useCallback((d: number) => setI(k => Math.min(Math.max(k + d, 0), Math.max(n - 1, 0))), [n])
  const exit = useCallback(() => { if (document.fullscreenElement) document.exitFullscreen(); nav(`/reading/lesson/${id}`) }, [id, nav])

  // 鍵盤：← → 空白鍵／翻頁筆的 PageUp PageDown 換頁，Z 中文、R 拼音，F 全螢幕，Esc 離開
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (letter || vowel || document.querySelector('.zoom-overlay, .overlay')) return  // 筆順視窗（含聲調符號）、放大圖片開著時不換頁、Esc 不離開
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
  }, [go, n, exit, letter, vowel, pen])

  // 放大到填滿畫面（最多放大 2.6 倍，避免字少的頁面大得誇張）
  const measure = useRef<HTMLDivElement>(null)  // 看不見的量尺寸區：放同一組（uniform）的所有頁，找出最大的寬高
  const fit = useCallback(() => {
    if (!stage.current || !inner.current) return
    const kids = [...(measure.current?.children ?? [])] as HTMLElement[]
    const minH = Math.max(0, ...kids.map(k => Math.max(k.offsetHeight, k.scrollHeight)))
    const minW = Math.max(0, ...kids.map(k => Math.max(k.offsetWidth, k.scrollWidth)))
    fitInto(stage.current, inner.current, 2.6, minH, minW)
  }, [])
  useLayoutEffect(fit, [fit, i, lesson, showZh, showRoman])
  useEffect(() => {
    let raf = 0
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit) })  // 下一個 frame 再縮放，避免 ResizeObserver loop 警告
    if (stage.current) ro.observe(stage.current)
    if (inner.current) ro.observe(inner.current)
    for (const k of measure.current?.children ?? []) ro.observe(k)  // 量尺寸區的圖片載入後也要重縮  // 圖片載入後高度會變；內容區每頁重建（key={i}），換頁要重新監看
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
        {cur.uniform && <div className="pt-measure" ref={measure} aria-hidden="true">{slides.filter(x => x.uniform === cur.uniform).map((x, k) => <div className="pt-inner" key={k}>{x.body}</div>)}</div>}
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
      {vowel && <LetterDialog char={vowel.char} caption={vowel.ipa} onClose={() => setVowel(null)} />}
    </div>
  )
}
