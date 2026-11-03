import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getSong } from '../data/songRepository'
import { getVideoRepository } from '../data/videoRepository'
import type { SongQuiz } from '../song/types'
import { firstOfLines, repeatsOfLines, shownAsLines } from '../song/lines'
import { fromSong, fromVideo } from '../study/adapters'
import { NoteRow } from '../study/NoteRow'
import type { StudyDoc, StudyNote } from '../study/types'
import { loadYouTubeApi, PLAYER_ERRORS, type YTPlayer } from '../video/youtube'
import { Rom } from '../video/Rom'
import { Volume } from '../video/Volume'
import ZoomImage from './ZoomImage'
import '../video.css'
import '../song.css'

/**
 * 歌詞／影片投影片模式（線上一對一分享畫面用）。
 * 一句一頁：左邊影片，右邊大字歌詞或台詞；單字、句型在第一次出現的那句直接講解（一列一則）。
 * 講完接：單字複習 → 句型複習 → 小測驗（一題一頁）→ 補充圖片 → 注意點。
 */

const RATES = [1, 0.75, 0.5]
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

interface Slide {
  section: string
  /** 歌詞頁對應的句號；封面是 -1；其他頁 undefined（不顯示影片） */
  line?: number
  body: ReactNode
}

// 同認字課投影片：內容先用原本大小排版，再縮放到剛好放進外框
function fitInto(box: HTMLElement, el: HTMLElement, max: number) {
  el.style.zoom = '1'
  const cs = getComputedStyle(box)
  const w = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  const h = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
  el.style.zoom = String(Math.min(w / Math.max(el.offsetWidth, el.scrollWidth), h / Math.max(el.offsetHeight, el.scrollHeight), max))
}

export function SongPresent() {
  const { id } = useParams()
  const song = getSong(id ?? '')
  const doc = useMemo(() => (song ? fromSong(song) : null), [song])
  if (!doc) return <p>找不到這首歌。<Link to="/song">回歌曲列表</Link></p>
  return <PresentView key={doc.id} doc={doc} />
}

export function VideoPresent() {
  const { id } = useParams()
  const [doc, setDoc] = useState<StudyDoc | null | undefined>(undefined)
  useEffect(() => { getVideoRepository().getVideo(id ?? '').then(v => setDoc(v ? fromVideo(v) : null)) }, [id])
  if (doc === undefined) return <p className="muted">載入中…</p>
  if (!doc) return <p>找不到這支影片。<Link to="/video">回影片列表</Link></p>
  return <PresentView key={doc.id} doc={doc} />
}

/** 一句底下一頁最多放幾則講解 */
const NOTES_PER_SLIDE = 2

/** 複習頁一頁固定放幾則（單字有解釋＋例句、句型有兩個例句，所以句型放少一點） */
const REVIEW_PER = { word: 4, pattern: 2 } as const

function chunk(list: StudyNote[], per: number) {
  const out: StudyNote[][] = []
  for (let k = 0; k < list.length; k += per) out.push(list.slice(k, k + per))
  return out
}

function PresentView({ doc }: { doc: StudyDoc }) {
  const nav = useNavigate()
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [follow, setFollow] = useState(false)   // 連播：整首播下去，投影片跟著換句
  const [loop, setLoop] = useState(false)       // 循環目前這句
  const [rate, setRate] = useState(1)
  const [showRom, setShowRom] = useState(true)
  const [showZh, setShowZh] = useState(true)
  const [showSeg, setShowSeg] = useState(false)
  const [showNotes, setShowNotes] = useState(true)
  const [art, setArt] = useState(false)
  const [side, setSide] = useState(false)
  const [picks, setPicks] = useState<Record<number, number>>({})
  /** 單句播放：播到這個秒數自動暫停 */
  const stopAt = useRef<number | null>(null)

  const { lines, notes, noteAt } = doc
  const firstOf = useMemo(() => firstOfLines(lines), [lines])
  const shownAs = useMemo(() => shownAsLines(lines), [lines])
  const repeatsOf = useMemo(() => repeatsOfLines(shownAs), [shownAs])
  const isSong = doc.kind === 'song'

  const slides = useMemo<Slide[]>(() => {
    const s: Slide[] = []
    const words = notes.filter(n => n.kind === 'word')
    const pats = notes.filter(n => n.kind === 'pattern')
    s.push({ section: '封面', line: -1, body: (
      <div className="spt-cover">
        <h1 className="th">{doc.title}</h1>
        <p className="muted">{doc.subtitle}</p>
      </div>
    ) })
    const visible = lines.map((L, k) => k).filter(k => !lines[k].hidden)
    visible.forEach((k, n) => {
      const L = lines[k]
      const rep = firstOf[k] !== k
      const here = notes.filter((_, j) => noteAt[j] === k)
      const rom = L.words.map(w => w.rom).filter(Boolean).join(' ')
      // 講解超過 2 則就分成好幾頁，每頁上面都留著這句，字才不會縮到看不清楚
      const groups: StudyNote[][] = []
      if (showNotes) for (let j = 0; j < here.length; j += NOTES_PER_SLIDE) groups.push(here.slice(j, j + NOTES_PER_SLIDE))
      if (!groups.length) groups.push([])
      groups.forEach((part, g) => s.push({ section: `第 ${n + 1} 句${groups.length > 1 ? `（講解 ${g + 1}/${groups.length}）` : ''}`, line: k, body: (
        <div className="spt-line">
          <div className="vlh">
            <span className="small muted">第 {n + 1} / {visible.length} 句・{mmss(L.start)}</span>
            {isSong && repeatsOf[k].length > 0 && <span className="schorus">副歌</span>}
            {rep && <span className="srep">重複第 {visible.indexOf(firstOf[k]) + 1} 句</span>}
          </div>
          {!showSeg ? <>
            <p className="th spt-th">{L.th}</p>
            {showRom && rom && <p className="spt-rom"><Rom text={rom} /></p>}
          </> : (
            <div className="vwords spt-words">
              {L.words.map((w, j) => (
                <span key={j} className="vw">
                  <span className="th vth">{w.th}</span>
                  {showRom && w.rom && <Rom text={w.rom} />}
                  {showZh && w.zh && <span className="vwzh">{w.zh}</span>}
                </span>
              ))}
            </div>
          )}
          {showZh && L.zh && <p className="spt-zh">{L.zh}</p>}
          {part.length > 0 && (
            <div className="nlist spt-notes">{part.map(x => <NoteRow key={x.id} note={x} showRom={showRom} showZh={showZh} />)}</div>
          )}
        </div>
      ) }))
    })
    // 所有複習頁疊在同一格裡、只顯示目前這頁：整組高度一樣，縮放比例就一樣，每頁字和寬度都一致
    const reviewPages = ([['單字複習', words, REVIEW_PER.word], ['句型複習', pats, REVIEW_PER.pattern]] as const)
      .flatMap(([title, list, per]) => {
        const pages = chunk([...list], per)
        return pages.map((part, k) => ({ title, part, label: pages.length > 1 ? `${k + 1} / ${pages.length}` : '' }))
      })
    reviewPages.forEach((_, cur) => s.push({ section: reviewPages[cur].title, body: (
      <div className="spt-stack">
        {reviewPages.map((pg, k) => (
          <div key={k} className={`spt-review${k === cur ? '' : ' spt-off'}`} aria-hidden={k !== cur}>
            <h2>{pg.title}{pg.label && <span className="muted small">　{pg.label}</span>}</h2>
            <div className="nlist">{pg.part.map(x => <NoteRow key={x.id} note={x} showRom={showRom} showZh={showZh} />)}</div>
          </div>
        ))}
      </div>
    ) }))
    doc.quiz?.forEach((q, k) => s.push({ section: `小測驗 ${k + 1}`, body: (
      <Quiz q={q} n={k + 1} total={doc.quiz!.length} pick={picks[k]} onPick={p => setPicks(m => ({ ...m, [k]: p }))} showZh={showZh} />
    ) }))
    doc.images?.forEach(im => s.push({ section: '補充', body: (
      <figure className="spt-img">
        <ZoomImage src={im.src} alt={im.alt} />
        {im.caption && <figcaption className="small muted">{im.caption}</figcaption>}
      </figure>
    ) }))
    if (doc.tips?.length) s.push({ section: '注意點', body: (
      <div className="spt-review">
        <h2>華人學習者的注意點</h2>
        <ul className="plain spt-tips">{doc.tips.map(t => <li key={t.title}><b>{t.title}</b><br />{t.body}</li>)}</ul>
      </div>
    ) })
    return s
  }, [doc, isSong, lines, notes, noteAt, firstOf, repeatsOf, showRom, showZh, showSeg, showNotes, picks])

  const n = slides.length
  const cur = slides[Math.min(i, n - 1)]
  const curLine = cur.line !== undefined && cur.line >= 0 ? cur.line : null
  const slideOfLine = useMemo(() => {
    const m = new Map<number, number>()
    // 連播時跳到這句的第一頁
    slides.forEach((x, k) => { if (x.line !== undefined && x.line >= 0 && !m.has(x.line)) m.set(x.line, k) })
    return m
  }, [slides])

  // 播放器：只建立一次，換頁不重載（非歌詞頁只是藏起來）
  useEffect(() => {
    let cancelled = false
    let player: YTPlayer | null = null
    const host = hostRef.current!
    const mount = document.createElement('div')
    host.appendChild(mount)
    loadYouTubeApi()
      .then(() => {
        if (cancelled || !window.YT) return
        player = new window.YT.Player(mount, {
          videoId: doc.youtubeId, width: '100%', height: '100%',
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => { if (!cancelled) { playerRef.current = player; setStatus('ready') } },
            onError: e => { if (!cancelled) { setStatus('error'); setErrorMsg(PLAYER_ERRORS[e.data] ?? '無法播放這支影片。') } },
          },
        })
      })
      .catch(() => { if (!cancelled) { setStatus('error'); setErrorMsg('無法載入 YouTube 播放器（可能被網路或瀏覽器擋住）。') } })
    return () => {
      cancelled = true
      playerRef.current = null
      try { player?.destroy() } catch { /* 已被移除 */ }
      host.innerHTML = ''
    }
  }, [doc.youtubeId])

  useEffect(() => { if (status === 'ready') playerRef.current?.setPlaybackRate(rate) }, [rate, status])

  // 每 120ms：連播時投影片跟著換句；單句播放到句尾暫停；循環時回到句首
  const live = useRef({ follow, loop, curLine, slideOfLine, slides })
  live.current = { follow, loop, curLine, slideOfLine, slides }
  useEffect(() => {
    if (status !== 'ready') return
    const timer = window.setInterval(() => {
      const p = playerRef.current
      if (!p) return
      const { follow, loop, curLine, slideOfLine, slides } = live.current
      const t = p.getCurrentTime()
      const st = p.getPlayerState()
      if (loop && curLine !== null) {
        if (st === 0 || t >= lines[curLine].end - 0.05 || t < lines[curLine].start - 0.5) {
          p.seekTo(lines[curLine].start, true)
          if (st === 0) p.playVideo()
        }
      } else if (follow) {
        let idx = -1
        for (let k = 0; k < lines.length; k++) if (lines[k].start <= t + 0.05) idx = k
        const v = idx >= 0 ? shownAs[idx] : -1
        const target = v >= 0 ? slideOfLine.get(v) : undefined
        // 已經在這句（可能是講解第 2 頁）就不動
        if (target !== undefined) setI(x => (slides[x]?.line === v ? x : target))
      } else if (stopAt.current !== null && t >= stopAt.current - 0.05) {
        stopAt.current = null
        p.pauseVideo()
      }
      const on = st === 1 || st === 3
      setPlaying(v => (v === on ? v : on))
    }, 120)
    return () => window.clearInterval(timer)
  }, [status, lines, shownAs])

  /** 老師手動換頁：連播中就從那句接著播；否則停在那句開頭等老師按播放 */
  const goto = useCallback((k: number) => {
    const to = Math.min(Math.max(k, 0), n - 1)
    setI(to)
    const p = playerRef.current
    const line = slides[to].line
    if (line !== undefined && line >= 0 && line === slides[i]?.line) return  // 同一句的講解換頁：影片不動
    stopAt.current = null
    if (!p) return
    const st = p.getPlayerState()
    if (line === undefined) { if (st === 1 || st === 3) p.pauseVideo(); return }
    if (line < 0) return
    if (follow) { p.seekTo(lines[line].start, true); p.playVideo(); return }
    // 還沒播過（-1、5）時 seekTo 會直接開播，所以只在播過之後才先跳到句首
    if (st === 1 || st === 2 || st === 3) { p.seekTo(lines[line].start, true); p.pauseVideo() }
  }, [i, n, slides, follow, lines])

  /** 播放／暫停：在歌詞頁就只播這一句（播完自動停）；連播或封面就整首播 */
  const play = useCallback(() => {
    const p = playerRef.current
    if (!p) return
    const st = p.getPlayerState()
    if (st === 1 || st === 3) { p.pauseVideo(); return }
    if (follow || loop || curLine === null) { p.playVideo(); return }
    const L = lines[curLine]
    const t = p.getCurrentTime()
    if (st !== 2 || t < L.start - 0.3 || t >= L.end - 0.1) p.seekTo(L.start, true)
    stopAt.current = L.end
    p.playVideo()
  }, [follow, loop, curLine, lines])

  const toggleFollow = useCallback(() => {
    const p = playerRef.current
    if (!follow && p) {
      setLoop(false)
      stopAt.current = null
      if (curLine !== null && p.getPlayerState() !== 1) p.seekTo(lines[curLine].start, true)
      p.playVideo()
    }
    setFollow(!follow)
  }, [follow, curLine, lines])

  const toggleLoop = useCallback(() => {
    if (curLine === null) return
    const p = playerRef.current
    if (!loop && p) { setFollow(false); stopAt.current = null; p.seekTo(lines[curLine].start, true); p.playVideo() }
    setLoop(!loop)
  }, [loop, curLine, lines])

  const fullscreen = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.() }
  const exit = useCallback(() => { if (document.fullscreenElement) document.exitFullscreen(); nav(doc.pagePath) }, [nav, doc.pagePath])

  // 鍵盤：← → 換頁（翻頁筆 PageUp/PageDown 也可以），空白鍵播放這句，
  // A 連播、L 循環、R 音標、Z 中文、S 斷詞、N 講解、F 全螢幕、Esc 離開
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('.zoom-overlay')) return
      if ((e.target as HTMLElement).closest('input, select, textarea')) return
      const k = e.key.toLowerCase()
      if (['ArrowRight', 'PageDown', 'ArrowDown'].includes(e.key)) { e.preventDefault(); goto(i + 1) }
      else if (['ArrowLeft', 'PageUp', 'ArrowUp'].includes(e.key)) { e.preventDefault(); goto(i - 1) }
      else if (e.key === ' ') { e.preventDefault(); play() }
      else if (e.key === 'Home') goto(0)
      else if (e.key === 'End') goto(n - 1)
      else if (k === 'a') toggleFollow()
      else if (k === 'l') toggleLoop()
      else if (k === 'r') setShowRom(x => !x)
      else if (k === 'z') setShowZh(x => !x)
      else if (k === 's') setShowSeg(x => !x)
      else if (k === 'n') setShowNotes(x => !x)
      else if (k === 'f') fullscreen()
      else if (e.key === 'Escape' && !document.fullscreenElement) exit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [i, n, goto, play, toggleFollow, toggleLoop, exit])

  // 離開這句就關掉循環
  useEffect(() => { setLoop(false) }, [curLine])

  const withVideo = cur.line !== undefined
  const fit = useCallback(() => { if (stage.current && inner.current) fitInto(stage.current, inner.current, 2) }, [])
  useLayoutEffect(fit, [fit, i, slides, withVideo])
  useEffect(() => {
    const ro = new ResizeObserver(fit)
    if (stage.current) ro.observe(stage.current)
    if (inner.current) ro.observe(inner.current)
    return () => ro.disconnect()
  }, [fit, i])

  const tog = (on: boolean, set: (f: (x: boolean) => boolean) => void, label: string, key: string) => (
    <button className={on ? 'on' : undefined} onClick={() => set(x => !x)} title={key}>{label}</button>
  )

  return (
    <div className={`present spage spt tf-${art ? 'loopless' : 'std'}`}>
      <div className="pt-top">
        <span className="pt-where">{doc.title}｜{cur.section}</span>
        <span className="pt-tools">
          {tog(showRom, setShowRom, '音標', 'R')}
          {tog(showZh, setShowZh, '中文', 'Z')}
          {tog(showSeg, setShowSeg, '斷詞', 'S')}
          {tog(showNotes, setShowNotes, '講解', 'N')}
          {tog(art, setArt, '藝術字', '')}
          <button onClick={fullscreen} title="F">全螢幕</button>
          <button onClick={exit} title="Esc">離開</button>
        </span>
      </div>

      <div className={`spt-body${withVideo ? '' : ' novid'}`}>
        <div className="spt-vid">
          <div className="vplayer">
            <div ref={hostRef} className="vhost" />
            {status !== 'ready' && (
              <div className="vover">
                {status === 'loading' ? <p>載入播放器…</p> : <>
                  <p>{errorMsg}</p>
                  <a className="btn" href={`https://www.youtube.com/watch?v=${doc.youtubeId}`} target="_blank" rel="noopener noreferrer">在 YouTube 開啟</a>
                </>}
              </div>
            )}
          </div>
          <div className="vctl">
            <button type="button" className="vtog" aria-pressed={playing} onClick={play} disabled={status !== 'ready'} title="空白鍵">
              {playing ? '⏸ 暫停' : curLine !== null && !follow && !loop ? '▶ 播這句' : '▶ 播放'}
            </button>
            <button type="button" className="vtog" aria-pressed={follow} onClick={toggleFollow} disabled={status !== 'ready'} title="A">連播</button>
            <button type="button" className="vtog" aria-pressed={loop} onClick={toggleLoop} disabled={status !== 'ready' || curLine === null} title="L">循環這句</button>
            <button type="button" className="vtog" aria-pressed={rate !== 1} onClick={() => setRate(r => RATES[(RATES.indexOf(r) + 1) % RATES.length])} disabled={status !== 'ready'}>語速 {rate}×</button>
            <Volume player={playerRef.current} ready={status === 'ready'} />
          </div>
          <p className="small muted spt-keys">← → 換句・空白鍵 播放這句・A 連播・L 循環</p>
        </div>
        <div className="pt-stage spt-stage" ref={stage}>
          <div className="pt-inner spt-inner" ref={inner} key={i}>{cur.body}</div>
        </div>
      </div>

      <div className="pt-bottom">
        <button onClick={() => goto(i - 1)} disabled={i === 0} aria-label="上一頁">‹</button>
        <span>{i + 1} / {n}</span>
        <button onClick={() => goto(i + 1)} disabled={i >= n - 1} aria-label="下一頁">›</button>
      </div>
      <button className="pt-sidebtn" onClick={() => setSide(x => !x)} aria-label="投影片列表">☰</button>
      <div className="pt-edge" onMouseEnter={() => setSide(true)} />
      {side && (
        <nav className="pt-side spt-side" onMouseLeave={() => setSide(false)} aria-label="投影片列表">
          {slides.map((x, k) => (
            <button key={k} className={k === i ? 'on' : undefined} onClick={() => { goto(k); setSide(false) }} ref={k === i ? el => el?.scrollIntoView({ block: 'nearest' }) : undefined}>
              <span>{k + 1}　{x.section}</span>
              {x.line !== undefined && x.line >= 0 && <span className="th spt-side-th">{lines[x.line].th}</span>}
            </button>
          ))}
        </nav>
      )}
      <div className="pt-progress" style={{ width: `${((i + 1) / n) * 100}%` }} />
    </div>
  )
}

function Quiz({ q, n, total, pick, onPick, showZh }: { q: SongQuiz; n: number; total: number; pick?: number; onPick: (i: number) => void; showZh: boolean }) {
  const done = pick !== undefined
  return (
    <div className="spt-quiz">
      <p className="small muted">小測驗 {n} / {total}</p>
      <p className="th spt-q">{q.q}</p>
      {showZh && <p className="muted">{q.qZh}</p>}
      <div className="spt-opts">
        {q.options.map((o, k) => (
          <button
            key={k}
            type="button"
            className={`vtog th${done && k === q.answer ? ' sq-ok' : ''}${pick === k && k !== q.answer ? ' sq-no' : ''}`}
            onClick={() => onPick(k)}
          >{'ABCD'[k]}　{o}</button>
        ))}
      </div>
      {done && <p role="status">{pick === q.answer ? '✓ 答對了！' : '✗ 再想想～'}{pick === q.answer && ` ${q.explain}`}</p>}
    </div>
  )
}
