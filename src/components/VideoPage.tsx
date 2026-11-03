import { useEffect, useMemo, useRef, useState } from 'react'
import { getAdminKey } from '../reservation/api'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getVideoRepository } from '../data/videoRepository'
import type { VideoLesson, VideoLine, VideoWord } from '../video/types'
import { loadYouTubeApi, PLAYER_ERRORS, type YTPlayer } from '../video/youtube'
import { Rom } from '../video/Rom'
import { Volume } from '../video/Volume'
import { speak } from '../audio/speak'
import { fromVideo } from '../study/adapters'
import { NoteSections } from '../study/NoteRow'
import { PrintSheet, printDoc } from '../study/PrintSheet'
import '../video.css'
import '../song.css'

/** 語速按鈕每點一次換下一個（同歌詞頁） */
const RATES = [1, 0.75, 0.5]
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** 寬螢幕（≥900px）用左右兩欄，窄螢幕上下排列 */
function useWide() {
  const q = '(min-width: 900px)'
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const f = () => setWide(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return wide
}

/**
 * 每個字的開始秒數。優先順序：資料裡每個字的 t → 依字長在整句範圍內估算。
 * 估算只是近似值（YouTube 沒有逐字時間）；句子起點校準後，估算也會跟著變準。
 */
function wordStartsFor(line: VideoLine, lineStart: number, lineEnd: number): number[] {
  if (line.words.every(w => typeof w.t === 'number')) return line.words.map(w => w.t as number)
  const weights = line.words.map(w => Math.max(1, [...w.th.replace(/\s/g, '')].length))
  const total = weights.reduce((a, b) => a + b, 0)
  let acc = 0
  return weights.map(w => {
    const s = lineStart + ((lineEnd - lineStart) * acc) / total
    acc += w
    return s
  })
}

export default function VideoPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const [video, setVideo] = useState<VideoLesson | undefined | null>(null)
  useEffect(() => { getVideoRepository().getVideo(id ?? '').then(setVideo) }, [id])
  if (video === null) return <p className="muted">載入中…</p>
  if (!video) return <p>找不到這支影片。<Link to="/video">回影片列表</Link></p>
  return <VideoView key={video.id} video={video} edit={params.get('edit') === '1'} />
}

function VideoView({ video, edit }: { video: VideoLesson; edit: boolean }) {
  const ytUrl = (t: number) => `https://www.youtube.com/watch?v=${video.youtubeId}&t=${Math.floor(t)}s`
  const wide = useWide()

  // 各句開始秒數放在 state，方便校時模式即時修改
  const [starts, setStarts] = useState<number[]>(() => video.lines.map(l => l.start))
  const hostRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const lineEls = useRef<(HTMLLIElement | null)[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [active, setActive] = useState(-1)
  const [activeW, setActiveW] = useState(-1)
  const [follow, setFollow] = useState(true)
  const [wordFollow, setWordFollow] = useState(true)
  const [loopIdx, setLoopIdx] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [showRom, setShowRom] = useState(true)
  const [showZh, setShowZh] = useState(true)
  const [showSeg, setShowSeg] = useState(false)
  // 藝術字只在這頁切換、預設關閉（同歌詞頁）
  const [art, setArt] = useState(false)
  const [word, setWord] = useState<VideoWord | null>(null)
  const [saveMsg, setSaveMsg] = useState('')
  const [rec, setRec] = useState<number | null>(null)
  const [editMsg, setEditMsg] = useState('')

  const wordStarts = useMemo(
    () => video.lines.map((L, i) => wordStartsFor(L, starts[i], i + 1 < starts.length ? starts[i + 1] : video.duration)),
    [video, starts],
  )

  // 輪詢計時器要讀最新值，用 ref 避免閉包過期
  const live = useRef({ starts, wordStarts, loopIdx, duration: video.duration })
  live.current = { starts, wordStarts, loopIdx, duration: video.duration }

  // 1) 建立播放器
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
          videoId: video.youtubeId,
          width: '100%',
          height: '100%',
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => { if (!cancelled) { playerRef.current = player; setStatus('ready') } },
            onError: e => { if (!cancelled) { setStatus('error'); setErrorMsg(PLAYER_ERRORS[e.data] ?? '無法播放這支影片。') } },
          },
        })
      })
      .catch(() => {
        if (!cancelled) { setStatus('error'); setErrorMsg('無法載入 YouTube 播放器（可能被網路或瀏覽器擋住）。') }
      })
    return () => {
      cancelled = true
      playerRef.current = null
      try { player?.destroy() } catch { /* 已被移除 */ }
      host.innerHTML = ''
    }
  }, [video.youtubeId])

  // 2) 每 120ms 讀播放時間：判斷目前是哪一句、哪一個字，並處理單句循環
  useEffect(() => {
    if (status !== 'ready') return
    const timer = window.setInterval(() => {
      const p = playerRef.current
      if (!p) return
      const { starts, wordStarts, loopIdx, duration } = live.current
      const t = p.getCurrentTime()
      const dur = p.getDuration() || duration
      let idx = -1
      if (loopIdx !== null) {
        const end = loopIdx + 1 < starts.length ? starts[loopIdx + 1] : dur
        const ended = p.getPlayerState() === 0
        if (ended || t >= end - 0.05) {
          p.seekTo(starts[loopIdx], true)
          if (ended) p.playVideo()
        }
        idx = loopIdx
      } else {
        for (let i = 0; i < starts.length; i++) if (starts[i] <= t + 0.05) idx = i
      }
      let w = -1
      if (idx >= 0) {
        const ws = wordStarts[idx]
        for (let j = 0; j < ws.length; j++) if (ws[j] <= t + 0.03) w = j
      }
      setActive(a => (a === idx ? a : idx))
      setActiveW(a => (a === w ? a : w))
      const on = [1, 3].includes(p.getPlayerState())
      setPlaying(v => (v === on ? v : on))
    }, 120)
    return () => window.clearInterval(timer)
  }, [status])

  // 3) 自動跟隨：換句時把該句捲到可見位置（寬版捲動右欄，窄版捲動整頁）
  useEffect(() => {
    if (!follow || active < 0) return
    const el = lineEls.current[active]
    if (!el) return
    const c = scrollRef.current
    if (wide && c) c.scrollTo({ top: Math.max(0, el.offsetTop - 64), behavior: 'smooth' })
    else el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [active, follow, wide])

  // 4) 播放速度
  useEffect(() => { if (status === 'ready') playerRef.current?.setPlaybackRate(rate) }, [rate, status])

  // 5) 打起點：從前一句開頭播放，聽到這句第一個字時按一次空白鍵
  /** 按下去時人的反應會慢一點，往前扣一點，避免從這句開始播時切掉第一個字 */
  const REACTION = 0.2
  const tapRef = useRef<() => void>(() => {})
  tapRef.current = () => {
    const p = playerRef.current
    if (rec === null || !p) return
    const i = rec
    setRec(null)
    const t = Math.max(0, Math.round((p.getCurrentTime() - REACTION) * 10) / 10)
    const bad = orderError(i, t)
    if (bad) { setEditMsg(`第 ${i + 1} 句沒有改：${bad}`); return }
    setStarts(s => s.map((v, j) => (j === i ? t : v)))
    setEditMsg('')
  }
  useEffect(() => {
    if (rec === null) return
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); tapRef.current() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rec])

  const seekTo = (i: number, keepLoop = true) => {
    const p = playerRef.current
    if (!p) { window.open(ytUrl(starts[i]), '_blank', 'noopener,noreferrer'); return }
    p.seekTo(starts[i], true)
    p.playVideo()
    setActive(i)
    if (keepLoop && loopIdx !== null) setLoopIdx(i)
  }
  /** 點整句泰文：暫停，讓學生看清楚；按該句的 ▶ 才繼續 */
  const pause = (e: React.MouseEvent) => { e.stopPropagation(); playerRef.current?.pauseVideo() }
  /** ▶：停在這句時從暫停處繼續，正在播這句就暫停，否則跳到這句開頭 */
  const playLine = (i: number) => {
    const p = playerRef.current
    if (p && i === active) {
      const st = p.getPlayerState()
      if (st === 1 || st === 3) { p.pauseVideo(); setPlaying(false); return }
      if (st === 2) { p.playVideo(); return }
    }
    seekTo(i)
  }
  const togglePlay = () => {
    const p = playerRef.current
    if (!p) return
    if (playing) { p.pauseVideo(); setPlaying(false) } else p.playVideo()
  }
  const toggleLineLoop = (i: number) => {
    if (loopIdx === i) { setLoopIdx(null); return }
    setLoopIdx(i)
    seekTo(i, false)
  }
  const openPattern = (pid: string) => {
    document.getElementById(`note-${pid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  /** 起點必須落在前一句起點之後、下一句起點之前，否則句子順序會亂 */
  const orderError = (i: number, t: number) => {
    if (i > 0 && t <= starts[i - 1]) return `${t.toFixed(1)} 秒早於第 ${i} 句的起點（${starts[i - 1]} 秒），請先校正第 ${i} 句`
    if (i + 1 < starts.length && t >= starts[i + 1]) return `${t.toFixed(1)} 秒晚於第 ${i + 2} 句的起點（${starts[i + 1]} 秒），請先校正第 ${i + 2} 句`
    return ''
  }
  const setStartNow = (i: number) => {
    const p = playerRef.current
    if (!p) return
    const t = Math.round(p.getCurrentTime() * 10) / 10
    const bad = orderError(i, t)
    if (bad) { setEditMsg(`第 ${i + 1} 句沒有改：${bad}`); return }
    setEditMsg('')
    setStarts(s => s.map((v, j) => (j === i ? t : v)))
  }
  const startRec = (i: number) => {
    const p = playerRef.current
    if (!p) return
    // 從前一句開頭播：這句可能在前一句還沒結束時就開始，從這句的舊起點播會漏掉開頭的字
    p.seekTo(i > 0 ? starts[i - 1] : 0, true)
    p.playVideo()
    setLoopIdx(null)
    setEditMsg('')
    setRec(i)
  }
  // 校時結果直接寫回 data/videos/<id>.json（只有本機 dev server 有這個存檔端點）
  const changed = starts.filter((t, i) => t !== video.lines[i].start).length
  const save = () => {
    if (!import.meta.env.DEV) { setSaveMsg('只有本機 dev 能存檔'); return }
    setSaveMsg('儲存中…')
    fetch(`/__videos/${video.id}`, { method: 'POST', body: JSON.stringify({ starts }) })
      .then(r => r.json())
      .then(j => setSaveMsg(j.ok ? `已存到 ${j.file}` : `存檔失敗：${j.error}`))
      .catch(() => setSaveMsg('存檔失敗'))
  }

  /** 投影片、講義、單字句型列表共用的資料（校時後的秒數一起帶過去） */
  const doc = useMemo(() => fromVideo({ ...video, lines: video.lines.map((L, i) => ({ ...L, start: starts[i] })) }), [video, starts])

  return (
    <div className={`vpage spage tf-${art ? 'loopless' : 'std'}${showRom ? '' : ' hide-rom'}${showZh ? '' : ' hide-zh'}`}>
      <p><Link to="/video">← 影片教學</Link></p>
      <h1 className="th">{video.title}</h1>
      <p className="muted small">{video.titleZh}・{video.topic}・{video.level}・{mmss(video.duration)}</p>
      <p className="sprint-btn">
        <Link className="vtog" to={`/video/${video.id}/present`}>🖥 投影片模式</Link>
        <button type="button" className="vtog" onClick={() => printDoc(doc)}>🖨 列印講義／存成 PDF</button>
        <span className="small muted">照下面「音標」「中文」「藝術字」開關決定講義樣式</span>
      </p>

      <div className="vcols">
        <div className="vleft">
          <div className="vplayer">
            <div ref={hostRef} className="vhost" />
            {status !== 'ready' && (
              <div className="vover">
                {status === 'loading' ? <p>載入播放器…</p> : (
                  <>
                    <p>{errorMsg}</p>
                    <a className="btn" href={ytUrl(0)} target="_blank" rel="noopener noreferrer">在 YouTube 開啟</a>
                    <p className="small">點句子的時間會在 YouTube 新分頁從該秒數開始播放。</p>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="vctl">
            <button type="button" className="vtog" aria-pressed={playing} onClick={togglePlay} disabled={status !== 'ready'}>{playing ? '⏸ 暫停' : '▶ 播放'}</button>
            <button type="button" className="vtog" aria-pressed={follow} onClick={() => setFollow(f => !f)}>自動跟隨</button>
            <button type="button" className="vtog" aria-pressed={rate !== 1} title="點一下換速度" onClick={() => setRate(r => RATES[(RATES.indexOf(r) + 1) % RATES.length])} disabled={status !== 'ready'}>語速 {rate}×</button>
            <Volume player={playerRef.current} ready={status === 'ready'} />
          </div>

          {edit && editMsg && <p className="small vguess" role="alert">{editMsg}</p>}
          {rec !== null && (
            <div className="vrec" role="status">
              <span className="small">第 {rec + 1} 句打起點（從{rec > 0 ? '前一句' : '影片'}開頭播放）：聽到這句第一個字時，按空白鍵或按鈕</span>
              <button type="button" className="vtap" onClick={() => tapRef.current()}>
                <span className="th">{video.lines[rec].words[0].th}</span>
                <small>第 {rec + 1} 句開頭</small>
              </button>
              <button type="button" className="vmini" onClick={() => setRec(null)}>取消</button>
            </div>
          )}

          {word && (
            <div className="vsheet" role="status">
              <span className="th vsheet-th">{word.th}</span>
              <Rom text={word.rom} />
              <span>{word.zh}</span>
              <button type="button" className="speak" aria-label="再播放一次" onClick={() => speak(word.th)}>🔊</button>
              <button type="button" className="vmini" onClick={() => setWord(null)}>關閉</button>
            </div>
          )}
        </div>

        <div className="vright" ref={scrollRef}>
          <div className="vdisp">
            <span className="small muted">顯示</span>
            <button type="button" className="vtog" aria-pressed={showRom} onClick={() => setShowRom(v => !v)}>音標</button>
            <button type="button" className="vtog" aria-pressed={showZh} onClick={() => setShowZh(v => !v)}>中文</button>
            <button type="button" className="vtog" aria-pressed={showSeg} onClick={() => setShowSeg(v => !v)}>斷詞輔助</button>
            <button type="button" className="vtog" aria-pressed={art} onClick={() => setArt(v => !v)}>藝術字</button>
            {showSeg && <>
              <button type="button" className="vtog" aria-pressed={wordFollow} onClick={() => setWordFollow(f => !f)}>逐字高亮</button>
            </>}
          </div>
          <ol className="vlines">
            {video.lines.map((L, i) => (
              <li
                key={i}
                ref={el => { lineEls.current[i] = el }}
                className={`vline${i === active ? ' on' : ''}${loopIdx === i ? ' loop' : ''}`}
                onClick={() => seekTo(i)}
              >
                <div className="vlh">
                  <button type="button" className="vtime" onClick={e => { e.stopPropagation(); playLine(i) }}>{i === active && playing ? '⏸' : '▶'} {mmss(starts[i])}</button>
                  <span className="small muted">第 {i + 1} 句</span>
                  {L.guess && getAdminKey() && <span className="vguess">字幕不確定，請老師確認</span>}
                  <span className="vsp" />
                  <button type="button" className="vmini" onClick={e => { e.stopPropagation(); speak(L.words.map(w => w.th).join('')) }}>朗讀</button>
                  <button type="button" className="vmini" aria-pressed={loopIdx === i} onClick={e => { e.stopPropagation(); toggleLineLoop(i) }}>
                    {loopIdx === i ? '停止循環' : '循環這句'}
                  </button>
                </div>
                {!showSeg ? <p className="th sfull" onClick={pause}>{L.words.map(w => w.th).join('')}</p> : <div className="vwords">
                  {L.words.map((w, j) => (
                    <button
                      key={j}
                      type="button"
                      className={`vw${w.p ? ' pat' : ''}${word === w ? ' on' : ''}${wordFollow && i === active && j === activeW ? ' now' : ''}`}
                      onClick={e => { e.stopPropagation(); setWord(w); speak(w.th) }}
                    >
                      <span className="th vth">{w.th}</span>
                      <Rom text={w.rom} />
                      <span className="vwzh">{w.zh}</span>
                    </button>
                  ))}
                </div>}
                <p className="vzh">{L.zh}</p>
                {L.patterns.length > 0 && (
                  <div className="vchips">
                    {L.patterns.map(pid => {
                      const p = video.patterns.find(x => x.id === pid)
                      return p ? <button key={pid} type="button" className="vchip th" onClick={e => { e.stopPropagation(); openPattern(pid) }}>{p.th}</button> : null
                    })}
                  </div>
                )}
                {edit && (
                  <div className="vedit" onClick={e => e.stopPropagation()}>
                    <button type="button" className="vmini" onClick={() => setStartNow(i)} disabled={status !== 'ready'}>把目前播放秒數設為這句開始</button>
                    <button type="button" className="vmini" onClick={() => startRec(i)} disabled={status !== 'ready'}>打起點</button>
                    <span className="small muted">開始 {starts[i]} 秒{starts[i] !== L.start && '（已改）'}</span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {edit && (
        <div className="card vedit-out">
          <strong>校時模式</strong>
          <p className="small muted">
            1) 按某句的「打起點」，影片會從前一句開頭播放，聽到這句第一個字時按一次空白鍵就好（會自動往前扣 0.2 秒反應時間）。這句在前一句還沒唸完就開始也沒關係。
            2) 也可以自己暫停在這句開始的地方，按「把目前播放秒數設為這句開始」。
            3) 每個字的高亮時間會依句子起點自動估算。改好後按「儲存回 JSON」，直接寫回 data/videos/{video.id}.json。
          </p>
          <p className="vsave">
            <button type="button" className="vtog" onClick={save} disabled={!changed}>💾 儲存回 JSON</button>
            <span className="small muted">{saveMsg || (changed ? `改了 ${changed} 句，還沒儲存` : '沒有改動')}</span>
          </p>
        </div>
      )}

      {/* 順序同歌詞頁：單字 → 句型 */}
      <NoteSections notes={doc.notes} onSpeak={speak} />


      <p className="vnote">{video.note}</p>
      <p className="small muted">音標寫法依 <a href="https://thai2english.com/" target="_blank" rel="noopener noreferrer">thai2english.com</a>：ป 寫 bp、ต 寫 dtaa，聲調符號 ` 低、^ 降、´ 高、˘ 升，沒有符號是平。</p>
      <p className="small muted">逐字高亮：資料裡沒有每個字的時間時，會依字長估算，可能與實際唸法差一點；用校時模式把句子起點校準後會更接近。</p>
      <PrintSheet doc={doc} showRom={showRom} showZh={showZh} art={art} />
    </div>
  )
}
