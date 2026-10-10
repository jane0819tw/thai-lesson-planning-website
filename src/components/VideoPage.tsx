import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getVideoRepository } from '../data/videoRepository'
import type { VideoLesson, VideoLine, VideoWord } from '../video/types'
import { loadYouTubeApi, PLAYER_ERRORS, type YTPlayer } from '../video/youtube'
import { Rom } from '../video/Rom'
import { speak } from '../audio/speak'
import '../video.css'

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
 * 每個字的開始秒數。優先順序：打點結果 → 資料裡每個字的 t → 依字長在整句範圍內估算。
 * 估算只是近似值（YouTube 沒有逐字時間），要準確請用校時模式打點。
 */
function wordStartsFor(line: VideoLine, lineStart: number, lineEnd: number, override?: number[]): number[] {
  if (override && override.length === line.words.length) return override
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

  // 各句開始秒數與逐字打點結果放在 state，方便校時模式即時修改
  const [starts, setStarts] = useState<number[]>(() => video.lines.map(l => l.start))
  const [wordT, setWordT] = useState<Record<number, number[]>>({})
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
  const [rate, setRate] = useState(1)
  const [showRom, setShowRom] = useState(true)
  const [showZh, setShowZh] = useState(true)
  const [showTone, setShowTone] = useState(true)
  const [word, setWord] = useState<VideoWord | null>(null)
  const [copied, setCopied] = useState(false)
  const [rec, setRec] = useState<{ line: number; times: number[] } | null>(null)

  const wordStarts = useMemo(
    () => video.lines.map((L, i) => wordStartsFor(L, starts[i], i + 1 < starts.length ? starts[i + 1] : video.duration, wordT[i])),
    [video, starts, wordT],
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

  // 5) 逐字打點：空白鍵記錄「下一個字」開始的時間
  const tapRef = useRef<() => void>(() => {})
  tapRef.current = () => {
    const p = playerRef.current
    if (!rec || !p) return
    const times = [...rec.times, Math.round(p.getCurrentTime() * 100) / 100]
    if (times.length >= video.lines[rec.line].words.length) {
      setWordT(m => ({ ...m, [rec.line]: times }))
      setRec(null)
    } else {
      setRec({ line: rec.line, times })
    }
  }
  useEffect(() => {
    if (!rec) return
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
  const toggleGlobalLoop = () => setLoopIdx(l => (l === null ? Math.max(active, 0) : null))
  const toggleLineLoop = (i: number) => {
    if (loopIdx === i) { setLoopIdx(null); return }
    setLoopIdx(i)
    seekTo(i, false)
  }
  const openPattern = (pid: string) => {
    const el = document.getElementById(`vpat-${pid}`) as HTMLDetailsElement | null
    if (el) { el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  }
  const setStartNow = (i: number) => {
    const p = playerRef.current
    if (!p) return
    const t = Math.round(p.getCurrentTime() * 10) / 10
    setStarts(s => s.map((v, j) => (j === i ? t : v)))
    setWordT(m => { const n = { ...m }; delete n[i]; return n })
  }
  const startRec = (i: number) => {
    const p = playerRef.current
    if (!p) return
    p.seekTo(Math.max(0, starts[i] - 0.5), true)
    p.playVideo()
    setLoopIdx(null)
    setRec({ line: i, times: [] })
  }
  // 校時後的完整資料：整份貼回 data/videos/*.json 即可
  const exportJson = useMemo(() => {
    const out: VideoLesson = {
      ...video,
      lines: video.lines.map((L, i) => ({
        ...L,
        start: starts[i],
        words: L.words.map((w, j) => (wordT[i] ? { ...w, t: wordT[i][j] } : w)),
      })),
    }
    return JSON.stringify(out, null, 1)
  }, [video, starts, wordT])
  const copyJson = () => {
    navigator.clipboard?.writeText(exportJson).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500) }).catch(() => {})
  }

  const vocab = useMemo(() => {
    const seen = new Map<string, VideoWord>()
    video.lines.forEach(l => l.words.forEach(w => { if (!seen.has(w.th) && w.th !== '3') seen.set(w.th, w) }))
    return [...seen.values()]
  }, [video])

  return (
    <div className={`vpage${showRom ? '' : ' hide-rom'}${showZh ? '' : ' hide-zh'}${showTone ? '' : ' no-tone'}`}>
      <p><Link to="/video">← 影片教學</Link></p>
      <h1 className="th">{video.title}</h1>
      <p className="muted small">{video.titleZh}・{video.topic}・{video.level}・{mmss(video.duration)}</p>

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
            <button type="button" className="vtog" aria-pressed={follow} onClick={() => setFollow(f => !f)}>自動跟隨</button>
            <button type="button" className="vtog" aria-pressed={wordFollow} onClick={() => setWordFollow(f => !f)}>逐字高亮</button>
            <button type="button" className="vtog" aria-pressed={loopIdx !== null} onClick={toggleGlobalLoop}>
              單句循環{loopIdx !== null ? `（第 ${loopIdx + 1} 句）` : ''}
            </button>
            <label className="vrate">速度
              <select value={rate} onChange={e => setRate(Number(e.target.value))} disabled={status !== 'ready'}>
                <option value={0.5}>0.5×</option><option value={0.75}>0.75×</option><option value={1}>1×</option>
              </select>
            </label>
          </div>

          {rec && (
            <div className="vrec" role="status">
              <span className="small">第 {rec.line + 1} 句打點：聽到下面這個字開始時，按空白鍵或按鈕</span>
              <button type="button" className="vtap" onClick={() => tapRef.current()}>
                <span className="th">{video.lines[rec.line].words[rec.times.length].th}</span>
                <small>{rec.times.length + 1} / {video.lines[rec.line].words.length}</small>
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
            <button type="button" className="vtog" aria-pressed={showTone} onClick={() => setShowTone(v => !v)}>聲調顏色</button>
            <span className="vlegend small">
              <b className="tn-mid">平</b><b className="tn-low">低</b><b className="tn-fall">降</b><b className="tn-high">高</b><b className="tn-rise">升</b>
            </span>
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
                  <button type="button" className="vtime" onClick={e => { e.stopPropagation(); seekTo(i) }}>▶ {mmss(starts[i])}</button>
                  <span className="small muted">第 {i + 1} 句</span>
                  {L.guess && <span className="vguess">字幕不確定，請老師確認</span>}
                  <span className="vsp" />
                  <button type="button" className="vmini" onClick={e => { e.stopPropagation(); speak(L.words.map(w => w.th).join('')) }}>朗讀</button>
                  <button type="button" className="vmini" aria-pressed={loopIdx === i} onClick={e => { e.stopPropagation(); toggleLineLoop(i) }}>
                    {loopIdx === i ? '停止循環' : '循環這句'}
                  </button>
                </div>
                <div className="vwords">
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
                </div>
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
                    <button type="button" className="vmini" onClick={() => startRec(i)} disabled={status !== 'ready'}>逐字打點</button>
                    <span className="small muted">開始 {starts[i]} 秒・{wordT[i] ? '字已打點' : '字為估算'}</span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <p className="vnote">{video.note}</p>
      <p className="small muted">音標寫法依 <a href="https://thai2english.com/" target="_blank" rel="noopener noreferrer">thai2english.com</a>：ป 寫 bp、ต 寫 dtaa，聲調符號 ` 低、^ 降、´ 高、˘ 升，沒有符號是平。</p>
      <p className="small muted">逐字高亮：資料裡沒有每個字的時間時，會依字長估算，可能與實際唸法差一點；用校時模式打點後就會準確。</p>

      {edit && (
        <div className="card vedit-out">
          <strong>校時模式</strong>
          <p className="small muted">
            1) 播到某句開始的瞬間，按該句「把目前播放秒數設為這句開始」。
            2) 按「逐字打點」，影片會從該句稍前播放，每聽到一個字開始就按空白鍵。
            3) 全部完成後複製下面的完整 JSON，貼回 data/videos 對應檔案。
          </p>
          <textarea className="vjson" readOnly value={exportJson} rows={8} onFocus={e => e.currentTarget.select()} />
          <button type="button" className="vmini" onClick={copyJson}>{copied ? '已複製' : '複製完整 JSON'}</button>
        </div>
      )}

      <h2>這支影片的句型</h2>
      {video.patterns.map(p => (
        <details className="vpat card" id={`vpat-${p.id}`} key={p.id}>
          <summary><span className="th vpat-th">{p.th}</span><span className="muted">{p.zh}</span></summary>
          <p className="vcmp">{p.cmp}</p>
          {p.examples.map((x, k) => (
            <div className="vex" key={k}>
              <span className="th vex-th">{x.th}</span>
              <Rom text={x.rom} />
              <span className="small muted">{x.zh}</span>
              <button type="button" className="vmini" onClick={() => speak(x.th)}>播放</button>
            </div>
          ))}
        </details>
      ))}

      <h2>單字表</h2>
      <div className="tablewrap">
        <table className="tone vvocab">
          <thead><tr><th>泰文</th><th>音標</th><th>中文</th><th /></tr></thead>
          <tbody>
            {vocab.map(w => (
              <tr key={w.th}>
                <td className="th vth">{w.th}</td>
                <td><Rom text={w.rom} /></td>
                <td>{w.zh}</td>
                <td><button type="button" className="speak" aria-label={`播放發音：${w.th}`} onClick={() => speak(w.th)}>🔊</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>華人學習者的注意點</h2>
      <ul className="plain vtips">
        {video.tips.map(t => <li className="card" key={t.title}><b>{t.title}</b><br />{t.body}</li>)}
      </ul>
    </div>
  )
}
