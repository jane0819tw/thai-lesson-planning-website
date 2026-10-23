import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadYouTubeApi, PLAYER_ERRORS, type YTPlayer } from '../video/youtube'
import '../dictation.css'

// 聽寫片段審查頁（老師用，只有本機 npm run dev 能存檔）：
// 讀 data/dictation/candidates/lesson-NN.json，逐句聽、改句子、刪掉標錯的字或整句。
// 檔案由 scripts/dictation-build.py 產生；這裡刪掉的整句會記在 rejected，重跑腳本不會再加回來。

interface Hit { word: string; from: number; to: number; source: '講義' | '規則' | '自選' }
interface Clip { id: string; videoId: string; start: number; end: number; text: string; hits: Hit[]; reviewed?: boolean }
interface VideoInfo { id: string; title?: string; channel?: string; url: string; subtitle?: { kind: string } }
interface LessonFile { lesson: number; clips: Clip[]; rejected: string[] }

const api = '/__dictation'
const SRC_CLASS = { 講義: 'list', 規則: 'rule', 自選: 'custom' } as const
const round1 = (n: number) => Math.round(n * 10) / 10
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

/** 句子改過後，把每個 hit 對回新句子：原位置還對就保留，否則找最近的同字；找不到就丟掉。 */
function remapHits(hits: Hit[], text: string): Hit[] {
  const out: Hit[] = []
  for (const h of hits) {
    let at = text.slice(h.from, h.to) === h.word ? h.from : -1
    if (at < 0) {
      let best = -1
      for (let i = text.indexOf(h.word); i >= 0; i = text.indexOf(h.word, i + 1)) {
        if (best < 0 || Math.abs(i - h.from) < Math.abs(best - h.from)) best = i
      }
      at = best
    }
    if (at >= 0) out.push({ ...h, from: at, to: at + h.word.length })
  }
  return out
}

function Marked({ clip }: { clip: Clip }) {
  const parts: React.ReactNode[] = []
  let pos = 0
  for (const h of [...clip.hits].sort((a, b) => a.from - b.from)) {
    if (h.from < pos) continue
    if (h.from > pos) parts.push(clip.text.slice(pos, h.from))
    parts.push(<mark key={h.from} className={SRC_CLASS[h.source]}>{clip.text.slice(h.from, h.to)}</mark>)
    pos = h.to
  }
  parts.push(clip.text.slice(pos))
  return <span className="th">{parts}</span>
}

export default function DictationReview() {
  const [lessons, setLessons] = useState<{ lesson: number; clips: number }[] | null>(null)
  const [n, setN] = useState<number | null>(null)
  const [data, setData] = useState<LessonFile | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [filter, setFilter] = useState<'all' | '講義' | '規則' | 'todo'>('all')
  const [loop, setLoop] = useState(true)
  const [rate, setRate] = useState(1)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [videos, setVideos] = useState<VideoInfo[]>([])

  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const lastSeek = useRef(0)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const clips = data?.clips ?? []
  const cur = clips.find(c => c.id === sel) ?? null
  const curVideo = videos.find(v => v.id === cur?.videoId)
  const videoId = cur?.videoId ?? clips[0]?.videoId ?? null

  // 輪詢計時器要讀最新值，用 ref 避免閉包過期
  const live = useRef({ cur, loop })
  live.current = { cur, loop }

  const go = useCallback((c: Clip) => {
    const p = playerRef.current
    if (!p) return
    lastSeek.current = Date.now()
    p.seekTo(c.start, true)
    p.playVideo()
  }, [])

  // 1) 課次清單
  useEffect(() => {
    fetch(`${api}/lessons`).then(r => r.json()).then((ls: { lesson: number; clips: number }[]) => {
      setLessons(ls)
      if (ls.length) setN(ls[0].lesson)
    }).catch(() => setLessons([]))
  }, [])

  useEffect(() => { fetch(`${api}/videos`).then(r => r.json()).then(j => setVideos(j.videos ?? [])).catch(() => {}) }, [])

  // 2) 讀該課檔案
  const load = (lesson: number) => {
    fetch(`${api}/lesson/${lesson}`).then(r => r.json()).then((j: LessonFile) => {
      setData(j); setSel(j.clips[0]?.id ?? null); setDirty(false); setMsg(null)
    }).catch(() => setMsg({ ok: false, text: '讀取失敗' }))
  }
  useEffect(() => { if (n !== null) load(n) }, [n])

  // 3) 播放器：影片換了才重建
  useEffect(() => {
    if (!videoId) return
    let cancelled = false
    let player: YTPlayer | null = null
    const host = hostRef.current!
    const mount = document.createElement('div')
    host.appendChild(mount)
    setStatus('loading')
    loadYouTubeApi()
      .then(() => {
        if (cancelled || !window.YT) return
        player = new window.YT.Player(mount, {
          videoId, width: '100%', height: '100%',
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
  }, [videoId])

  // 4) 選到的片段：播放器就緒或換片段時自動從頭播；每 100ms 檢查是否到結尾
  useEffect(() => { if (status === 'ready' && cur) go(cur) }, [status, sel]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (status === 'ready') playerRef.current?.setPlaybackRate(rate) }, [status, rate])
  useEffect(() => {
    if (status !== 'ready') return
    const timer = window.setInterval(() => {
      const p = playerRef.current
      const { cur, loop } = live.current
      if (!p || !cur || Date.now() - lastSeek.current < 500) return
      if (p.getPlayerState() === 2) return // 使用者手動暫停
      if (p.getCurrentTime() >= cur.end) {
        if (loop) go(cur)
        else p.pauseVideo()
      }
    }, 100)
    return () => window.clearInterval(timer)
  }, [status, go])

  const update = (id: string, fn: (c: Clip) => Clip) => {
    setData(d => d && { ...d, clips: d.clips.map(c => (c.id === id ? { ...fn(c), reviewed: true } : c)) })
    setDirty(true)
  }
  const removeClip = (c: Clip) => {
    if (!window.confirm(`刪除整句？\n${c.text}\n\n之後重跑腳本也不會再出現。`)) return
    const i = clips.findIndex(x => x.id === c.id)
    const next = clips[i + 1] ?? clips[i - 1]
    setData(d => d && { ...d, clips: d.clips.filter(x => x.id !== c.id), rejected: [...new Set([...d.rejected, c.id])] })
    setSel(next?.id ?? null)
    setDirty(true)
  }
  // 把句子輸入框裡選取的字標示起來；和既有標示重疊就取代它（沿用原本的種類），可用來把單字擴大成短句
  const markSelection = (c: Clip) => {
    const ta = taRef.current
    if (!ta) return
    let a = ta.selectionStart, b = ta.selectionEnd
    while (a < b && /\s/.test(c.text[a])) a++
    while (b > a && /\s/.test(c.text[b - 1])) b--
    if (a >= b) { setMsg({ ok: false, text: '請先在句子框裡選取要標示的字' }); return }
    setMsg(null)
    const hit = c.hits.filter(h => h.from < b && h.to > a)
    const added: Hit = { word: c.text.slice(a, b), from: a, to: b, source: hit[0]?.source ?? '自選' }
    update(c.id, x => ({ ...x, hits: [...x.hits.filter(h => !hit.includes(h)), added].sort((p, q) => p.from - q.from) }))
  }
  const nudge = (c: Clip, key: 'start' | 'end', dt: number) => {
    const v = round1(Math.max(0, c[key] + dt))
    const next = { ...c, [key]: v }
    if (next.end <= next.start) return
    update(c.id, () => next)
    lastSeek.current = Date.now()
    if (key === 'start') { playerRef.current?.seekTo(v, true); playerRef.current?.playVideo() }
  }
  const save = async () => {
    if (!data || n === null) return
    setMsg({ ok: true, text: '儲存中…' })
    try {
      const r = await fetch(`${api}/lesson/${n}`, { method: 'POST', body: JSON.stringify(data) })
      const j = await r.json()
      if (j.ok) setDirty(false)
      setMsg({ ok: !!j.ok, text: j.ok ? `已儲存到 ${j.file}` : `儲存失敗：${j.error}` })
    } catch {
      setMsg({ ok: false, text: '儲存失敗：只有本機 npm run dev 時能存檔' })
    }
  }
  const pickLesson = (v: number) => {
    if (dirty && !window.confirm('這一課有尚未儲存的修改，確定要切換？')) return
    setN(v)
  }

  const shown = useMemo(() => clips.filter(c =>
    filter === 'all' ? true
      : filter === 'todo' ? !c.reviewed
        : c.hits.some(h => h.source === filter)), [clips, filter])
  const nReviewed = clips.filter(c => c.reviewed).length

  if (lessons === null) return <p className="muted">讀取中…</p>
  if (!lessons.length) return (
    <div className="card">
      <h1>聽寫片段審查</h1>
      <p>找不到候選片段。請在本機用 <code>npm run dev</code> 開啟，並先執行 <code>scripts/dictation-build.py</code> 產生 <code>data/dictation/candidates/</code>。</p>
    </div>
  )

  return (
    <div className="dr">
      <p className="small"><Link to="/admin">← 回管理頁</Link></p>
      <h1>聽寫片段審查</h1>
      <div className="dr-bar">
        <label>課次
          <select value={n ?? ''} onChange={e => pickLesson(Number(e.target.value))}>
            {lessons.map(l => <option key={l.lesson} value={l.lesson}>L{l.lesson}（{l.clips} 句）</option>)}
          </select>
        </label>
        <label>顯示
          <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
            <option value="all">全部</option>
            <option value="講義">含講義字</option>
            <option value="規則">含規則字</option>
            <option value="todo">還沒審過</option>
          </select>
        </label>
        <span className="muted small">已審 {nReviewed} / {clips.length}　<mark className="list">講義字</mark> <mark className="rule">規則字</mark> <mark className="custom">自選</mark></span>
        <span className="dr-spacer" />
        <button className="dr-btn primary" onClick={save} disabled={!dirty}>{dirty ? '儲存修改' : '已儲存'}</button>
      </div>
      {msg && <div className={`dr-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}

      <div className="dr-layout">
        <aside className="dr-player">
          <div className="dr-frame">
            <div ref={hostRef} className="dr-host" />
            {status === 'error' && <div className="dr-err">{errorMsg}{cur && <> <a href={`https://www.youtube.com/watch?v=${cur.videoId}&t=${Math.floor(cur.start)}s`} target="_blank" rel="noopener noreferrer">在 YouTube 開啟</a></>}</div>}
          </div>
          {cur ? (
            <>
              <div className="dr-ctrl">
                <button className="dr-btn primary" onClick={() => go(cur)} disabled={status !== 'ready'}>🔁 重聽這句</button>
                <label className="small"><input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} /> 自動循環</label>
                <label className="small">速度
                  <select value={rate} onChange={e => setRate(Number(e.target.value))}>
                    {[0.5, 0.75, 1].map(r => <option key={r} value={r}>{r}×</option>)}
                  </select>
                </label>
              </div>
              <div className="dr-video small">
                <div className="th">{curVideo?.title ?? cur.videoId}</div>
                <div className="muted">{curVideo?.channel}{curVideo?.subtitle && `・${curVideo.subtitle.kind}字幕`}</div>
                <a href={`https://www.youtube.com/watch?v=${cur.videoId}&t=${Math.floor(cur.start)}s`} target="_blank" rel="noopener noreferrer">在 YouTube 開啟這一句</a>
              </div>
              <div className="dr-time small">
                <span>開始 {mmss(cur.start)}（{cur.start}s）
                  <button className="dr-mini" onClick={() => nudge(cur, 'start', -0.5)}>−0.5</button>
                  <button className="dr-mini" onClick={() => nudge(cur, 'start', 0.5)}>+0.5</button></span>
                <span>結束 {cur.end}s
                  <button className="dr-mini" onClick={() => nudge(cur, 'end', -0.5)}>−0.5</button>
                  <button className="dr-mini" onClick={() => nudge(cur, 'end', 0.5)}>+0.5</button></span>
                <span className="muted">長度 {round1(cur.end - cur.start)} 秒</span>
              </div>
            </>
          ) : <p className="muted small">選一句開始。</p>}
        </aside>

        <ul className="dr-list">
          {shown.map(c => {
            const open = c.id === sel
            return (
              <li key={c.id} className={`dr-clip${open ? ' open' : ''}${c.reviewed ? ' done' : ''}`}>
                <button className="dr-row" onClick={() => setSel(c.id)}>
                  <span className="dr-t">{mmss(c.start)}</span>
                  <span className="dr-text"><Marked clip={c} /></span>
                  {c.reviewed && <span className="dr-ok" title="已審過">✔</span>}
                </button>
                {open && (
                  <div className="dr-edit">
                    <label className="small muted">句子（改字後，位置會自動對回標示的字；對不到的標示會被拿掉）</label>
                    <textarea ref={taRef} className="th" rows={2} value={c.text}
                      onChange={e => update(c.id, x => ({ ...x, text: e.target.value, hits: remapHits(x.hits, e.target.value) }))} />
                    <div className="dr-actions">
                      <button className="dr-btn" onClick={() => markSelection(c)}>＋ 標示選取的字</button>
                      <span className="small muted">在上面的句子框拖曳選字（可選好幾個字的短句），再按這個鈕</span>
                    </div>
                    <div className="small muted">標示的字（按 ✕ 刪掉標錯的）</div>
                    <div className="dr-hits">
                      {c.hits.length === 0 && <span className="muted small">沒有標示的字了</span>}
                      {c.hits.map((h, i) => (
                        <span key={`${h.from}-${i}`} className={`dr-chip ${SRC_CLASS[h.source]}`}>
                          <span className="th">{h.word}</span><small>{h.source}</small>
                          <button title="刪除這個標示" onClick={() => update(c.id, x => ({ ...x, hits: x.hits.filter((_, j) => j !== i) }))}>✕</button>
                        </span>
                      ))}
                    </div>
                    <div className="dr-actions">
                      <button className="dr-btn" onClick={() => update(c.id, x => x)}>✔ 標記已審</button>
                      <button className="dr-btn danger" onClick={() => removeClip(c)}>🗑 刪除整句</button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
          {!shown.length && <li className="muted">沒有符合的句子。</li>}
        </ul>
      </div>
    </div>
  )
}
