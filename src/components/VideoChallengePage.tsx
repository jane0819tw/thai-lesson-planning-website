import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getRepository } from '../data/repository'
import type { Lesson } from '../types'
import { getSession } from '../reservation/session'
import { getApi } from '../reservation/api'
import type { HomeworkRecord } from '../reservation/types'
import { dictClipsOf, videoInfoOf, videoKey, type DictClip } from '../dictationClips'
import { loadYouTubeApi, PLAYER_ERRORS, type YTPlayer } from '../video/youtube'
import { useThaiFont } from './thaiFont'
import { Keypad, norm } from './HomeworkPage'
import '../dictation.css'

// 延伸影片挑戰：播電視劇的一小段（不顯示答案），學生聽完把聽到的泰文打出來。
// 只算「這課學過的字」（hits）有沒有打對，其他字不計分；檢查後才顯示整句與標示。
const correct = (c: DictClip, ans: string) => c.hits.every(h => norm(ans).includes(norm(h.word)))

function Marked({ clip }: { clip: DictClip }) {
  const parts: React.ReactNode[] = []
  let pos = 0
  for (const h of [...clip.hits].sort((a, b) => a.from - b.from)) {
    if (h.from < pos) continue
    if (h.from > pos) parts.push(clip.text.slice(pos, h.from))
    parts.push(<mark key={h.from} className="list">{clip.text.slice(h.from, h.to)}</mark>)
    pos = h.to
  }
  parts.push(clip.text.slice(pos))
  return <span className="th vc-nocopy" onCopy={e => e.preventDefault()} onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()}>{parts}</span>
}

export default function VideoChallengePage() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const token = sp.get('t') ?? ''
  const api = getApi(sp.get('mock') === '1')
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined)
  const [name, setName] = useState('')
  const [last, setLast] = useState<HomeworkRecord | null>(null)
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [err, setErr] = useState('')
  const [round, setRound] = useState(0)

  useEffect(() => { getRepository().getLesson(id ?? '').then(l => setLesson(l ?? null)) }, [id])
  const key = lesson ? videoKey(lesson.number) : ''
  useEffect(() => {
    if (token && key) api.getHomeworkInfo(token, key).then(i => { setName(i.name); setLast(i.last) }).catch(() => setName(''))
  }, [token, key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (lesson === undefined) return <p>載入中…</p>
  if (lesson === null) return <p>找不到這一課。<Link to="/reading">回課程列表</Link></p>
  const clips = dictClipsOf(lesson.number)
  const st = getSession()
  const back = st ? <Link to={`/book?t=${encodeURIComponent(st.token)}`}>← 回到課程與作業</Link> : <Link to={`/reading/lesson/${lesson.id}`}>← 回 L{lesson.number}</Link>

  return (
    <>
      <p>{back}</p>
      <h1>L{lesson.number} 延伸影片挑戰</h1>
      <p className="muted">{lesson.title}</p>
      <p className="muted small">🔄 影片題目會持續更新，之後回來可能會看到新的題目。</p>
      {name && <p className="hw-name">👤 {name}</p>}
      {last && state !== 'sent' && <p className="hw-last">✅ 已完成過：{last.typing}{last.time && `（${last.time.slice(0, 10).replace(/-/g, '/')}）`}。可以再做一次，老師會看到最近一次的成績。</p>}
      {clips.length === 0
        ? <p className="muted">這一課的影片題目還在準備中。</p>
        : <Challenge key={round} clips={clips} token={token} state={state} err={err} last={last}
            onSubmit={async (s, t) => {
              setState('sending'); setErr('')
              try {
                await api.submitHomework(token, key, { typing: [s, t] })
                setLast(l => ({ time: '', listen: '未做', typing: `${s}/${t}`, count: (l?.count ?? 0) + 1 }))
                setState('sent')
              } catch (e) { setErr(e instanceof Error ? e.message : '送出失敗'); setState('idle') }
            }}
            onAgain={() => { setState('idle'); setRound(r => r + 1); window.scrollTo({ top: 0 }) }} />}
    </>
  )
}

function Challenge({ clips, token, state, err, last, onSubmit, onAgain }: {
  clips: DictClip[]; token: string; state: 'idle' | 'sending' | 'sent'; err: string; last: HomeworkRecord | null
  onSubmit: (score: number, total: number) => void; onAgain: () => void
}) {
  const [ans, setAns] = useState<string[]>(() => clips.map(() => ''))
  const [checked, setChecked] = useState(false)
  const [active, setActive] = useState(0)
  const [slow, setSlow] = useState(false)
  const [pad, setPad] = useState(true)
  const [hint, setHint] = useState<Record<string, boolean>>({})
  const [font, nextFont] = useThaiFont()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const loaded = useRef(clips[0].videoId)
  const slowRef = useRef(slow)
  const playing = useRef<DictClip | null>(null)
  const arrived = useRef(false)
  const src = videoInfoOf(clips[active].videoId)
  const score = clips.filter((c, i) => correct(c, ans[i])).length

  // 不同影片的題目共用同一個播放器：換影片用 loadVideoById，不重建 iframe
  const play = useCallback((c: DictClip) => {
    const p = playerRef.current
    if (!p) return
    playing.current = c
    arrived.current = false
    if (loaded.current !== c.videoId) {
      loaded.current = c.videoId
      p.loadVideoById({ videoId: c.videoId, startSeconds: c.start })
    } else {
      p.seekTo(c.start, true)
      p.playVideo()
    }
  }, [])

  // 播放器只建一次
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
          videoId: loaded.current, width: '100%', height: '100%',
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1, cc_load_policy: 0, controls: 0, disablekb: 1 },
          events: {
            onReady: () => { if (!cancelled) { playerRef.current = player; setStatus('ready') } },
            // 換影片後播放速度會被重設，開始播放時再套一次
            onStateChange: e => { if (e.data === 1) player?.setPlaybackRate(slowRef.current ? 0.75 : 1) },
            onError: e => { if (!cancelled) { setStatus('error'); setErrorMsg(PLAYER_ERRORS[e.data] ?? '無法播放這支影片。') } },
          },
        })
      })
      .catch(() => { if (!cancelled) { setStatus('error'); setErrorMsg('無法載入 YouTube 播放器（可能被網路或瀏覽器擋住）。') } })
    return () => {
      cancelled = true
      playerRef.current = null
      playing.current = null
      try { player?.destroy() } catch { /* 已被移除 */ }
      host.innerHTML = ''
    }
  }, [])

  useEffect(() => { slowRef.current = slow; if (status === 'ready') playerRef.current?.setPlaybackRate(slow ? 0.75 : 1) }, [status, slow])
  // 播到片段結尾就暫停（每 100ms 檢查）。要先看到播放位置進入這個片段才開始判斷，
  // 否則跳轉／緩衝還沒完成時讀到的是上一題的位置，會一開始就被暫停。
  useEffect(() => {
    if (status !== 'ready') return
    const t = window.setInterval(() => {
      const p = playerRef.current, c = playing.current
      if (!p || !c) return
      const now = p.getCurrentTime()
      if (!arrived.current) { arrived.current = now >= c.start - 0.5 && now < c.end; return }
      if (now >= c.end) { p.pauseVideo(); playing.current = null }
    }, 100)
    return () => window.clearInterval(t)
  }, [status])

  const edit = (f: (t: string) => string) => setAns(a => a.map((x, j) => (j === active ? f(x) : x)))
  const pick = (i: number) => { setActive(i); play(clips[i]) }

  return (
    <div className={`dict tf-${font.id}`}>
      <p className="muted small">按 ▶ 聽一小段電視劇，把聽到的泰文用下方鍵盤打出來（可以重聽、放慢）。{checked ? '' : '需要時可按「💡 提示」看答案，但要自己打出來（提示無法複製）。'}</p>
      <div className="vc-layout">
      <div className="vc-side">
        <div className="dr-frame vc-frame">
          <div ref={hostRef} className="vc-host" />
          {status !== 'ready' && <p className="vc-msg">{status === 'error' ? errorMsg : '播放器載入中…'}</p>}
        </div>
        <label className="hw-check"><input type="checkbox" checked={slow} onChange={e => setSlow(e.target.checked)} /> 放慢速度（0.75 倍）</label>
        {src && (
          <p className="vc-src small muted">
            影片來源：{src.channel && <>{src.channel}・</>}{src.title ?? 'YouTube 影片'}<br />
            <a href={src.url} target="_blank" rel="noopener noreferrer">前往 YouTube 觀看完整影片 ↗</a>
          </p>
        )}
      </div>
      <div className="vc-rows">
      {clips.map((c, i) => {
        const ok = checked && correct(c, ans[i])
        return (
          <div className={`dict-row${checked ? (ok ? ' ok' : ' bad') : ''}${i === active && pad && !checked ? ' act' : ''}`} key={c.id}>
            <span className="dict-n">{i + 1}</span>
            <button type="button" className="gbtn" disabled={status !== 'ready'} onClick={() => pick(i)} aria-label={`播放第 ${i + 1} 題`}>▶</button>
            <input className="th" value={ans[i]} disabled={checked} inputMode={pad ? 'none' : 'text'} onFocus={() => setActive(i)} onChange={e => setAns(a => a.map((x, j) => (j === i ? e.target.value : x)))} placeholder="打出聽到的泰文" aria-label={`第 ${i + 1} 題`} />
            {!checked && <button type="button" className="gbtn" onClick={() => setHint(h => ({ ...h, [c.id]: !h[c.id] }))} aria-pressed={!!hint[c.id]}>💡 提示</button>}
            {checked && <span className="dict-res">{ok ? '✅' : '❌'}</span>}
            {checked
              ? <span className="vc-ans small"><Marked clip={c} /></span>
              : hint[c.id] && <span className="vc-ans vc-hint th vc-nocopy" onCopy={e => e.preventDefault()} onContextMenu={e => e.preventDefault()}>{c.hits.map(h => <mark key={h.from}>{h.word}</mark>)}</span>}
          </div>
        )
      })}
      </div>
      </div>

      {!checked && (
        <>
          <label className="hw-check"><input type="checkbox" checked={pad} onChange={e => setPad(e.target.checked)} /> 使用網站泰文鍵盤（目前輸入第 {active + 1} 題）</label>
          {pad && <Keypad fontLabel={font.label} onFont={nextFont} onKey={ch => edit(t => t + ch)} onBack={() => edit(t => Array.from(t).slice(0, -1).join(''))} />}
          <button className="gbtn on" onClick={() => setChecked(true)}>檢查答案</button>
        </>
      )}
      {checked && (
        <section className="hw-sec hw-submit">
          <p>得分 {score} / {clips.length}　<small className="muted">（標色的是這課學過的字，只算這些字）</small></p>
          {!token
            ? <p className="muted small">請從預約頁的「我的課程與作業」進入，才能送出成績。</p>
            : state === 'sent'
              ? <><p className="hw-sent">✅ 已完成！影片挑戰 {last?.typing}，老師會收到你的成績。</p><button className="gbtn" onClick={onAgain}>再做一次</button></>
              : <>
                <button className="gbtn on" disabled={state === 'sending'} onClick={() => onSubmit(score, clips.length)}>{state === 'sending' ? '送出中…' : '送出成績'}</button>{' '}
                <button className="gbtn" onClick={() => { setChecked(false); setAns(clips.map(() => '')); setActive(0) }}>重做</button>
                {err && <p className="bk-msg err">{err}</p>}
              </>}
        </section>
      )}
    </div>
  )
}
