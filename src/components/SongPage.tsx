import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getSong, listSongs } from '../data/songRepository'
import type { Song, SongLine, SongNote, SongQuiz, SongWord } from '../song/types'
import { loadYouTubeApi, PLAYER_ERRORS, type YTPlayer } from '../video/youtube'
import { Rom } from '../video/Rom'
import { getAdminKey } from '../reservation/api'
import ZoomImage from './ZoomImage'
import { useThaiFont } from './thaiFont'
import '../video.css'
import '../song.css'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function SongIndex() {
  return (
    <>
      <p><Link to="/">← 所有課程</Link></p>
      <h1>歌詞跟讀</h1>
      <p className="muted">跟著歌曲一句一句聽、一句一句唸。歌詞照 YouTube 官方泰文字幕。</p>
      <ul className="lessons">
        {listSongs().map(s => (
          <li key={s.id}>
            <Link to={`/song/${s.id}`}>
              <span className="num">{s.draft ? '草稿' : '歌曲'}</span>
              <strong>{s.title}</strong>
              <small>{s.titleZh || s.artist}</small>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function SongPage() {
  const { id } = useParams()
  const song = getSong(id ?? '')
  if (!song) return <p>找不到這首歌。<Link to="/song">回歌曲列表</Link></p>
  return <SongView key={song.id} initial={song} />
}

function SongView({ initial }: { initial: Song }) {
  const isAdmin = !!getAdminKey()
  const [song, setSong] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState('')
  const [editing, setEditing] = useState(false)
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const lineEls = useRef<(HTMLLIElement | null)[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [active, setActive] = useState(-1)
  const [loopIdx, setLoopIdx] = useState<number | null>(null)
  const [follow, setFollow] = useState(true)
  const [rate, setRate] = useState(1)
  const [showRom, setShowRom] = useState(true)
  const [showZh, setShowZh] = useState(true)
  const [showSeg, setShowSeg] = useState(false)
  const [font, nextFont] = useThaiFont()

  /** 每句第一次出現的句號；同樣的句子（如副歌）指回第一次 */
  const firstOf = useMemo(() => {
    const seen = new Map<string, number>()
    return song.lines.map((L, i) => {
      const key = L.th.replace(/\s/g, '')
      if (!seen.has(key)) seen.set(key, i)
      return seen.get(key) as number
    })
  }, [song.lines])

  const live = useRef({ lines: song.lines, loopIdx })
  live.current = { lines: song.lines, loopIdx }

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
          videoId: initial.youtubeId,
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
  }, [initial.youtubeId])

  // 2) 每 120ms 讀播放時間：判斷目前是哪一句，並處理單句循環（用每句自己的 end，間奏不算進去）
  useEffect(() => {
    if (status !== 'ready') return
    const timer = window.setInterval(() => {
      const p = playerRef.current
      if (!p) return
      const { lines, loopIdx } = live.current
      const t = p.getCurrentTime()
      let idx = -1
      if (loopIdx !== null) {
        const ended = p.getPlayerState() === 0
        if (ended || t >= lines[loopIdx].end - 0.05) {
          p.seekTo(lines[loopIdx].start, true)
          if (ended) p.playVideo()
        }
        idx = loopIdx
      } else {
        for (let i = 0; i < lines.length; i++) if (lines[i].start <= t + 0.05) idx = i
      }
      setActive(a => (a === idx ? a : idx))
    }, 120)
    return () => window.clearInterval(timer)
  }, [status])

  // 3) 自動跟隨：寬版捲動右欄，窄版捲動整頁
  useEffect(() => {
    if (!follow || active < 0) return
    const el = lineEls.current[active]
    const c = scrollRef.current
    if (!el) return
    if (c && c.scrollHeight > c.clientHeight) c.scrollTo({ top: Math.max(0, el.offsetTop - 64), behavior: 'smooth' })
    else el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [active, follow])

  // 4) 播放速度
  useEffect(() => { if (status === 'ready') playerRef.current?.setPlaybackRate(rate) }, [rate, status])

  const seekTo = (i: number) => {
    const p = playerRef.current
    if (!p) { window.open(`https://www.youtube.com/watch?v=${initial.youtubeId}&t=${Math.floor(song.lines[i].start)}s`, '_blank', 'noopener'); return }
    if (loopIdx !== null) setLoopIdx(i)
    p.seekTo(song.lines[i].start, true)
    p.playVideo()
  }
  /** 點單字或整句泰文：暫停，讓學生看清楚；按該句的 ▶ 才繼續 */
  const pause = (e: React.MouseEvent) => { e.stopPropagation(); playerRef.current?.pauseVideo() }
  /** ▶：停在這句時從暫停處繼續，否則跳到這句開頭 */
  const playLine = (i: number) => {
    const p = playerRef.current
    if (p && i === active && p.getPlayerState() === 2) { p.playVideo(); return }
    seekTo(i)
  }
  const toggleLoop = (i: number) => {
    if (loopIdx === i) { setLoopIdx(null); return }
    setLoopIdx(i)
    seekTo(i)
  }

  const updateLine = (i: number, patch: Partial<SongLine>) => {
    setSong(s => ({ ...s, lines: s.lines.map((L, k) => (k === i ? { ...L, ...patch } : L)) }))
    setDirty(true)
    setMsg('')
  }
  const updateWord = (i: number, j: number, patch: Partial<SongWord>) =>
    updateLine(i, { words: song.lines[i].words.map((w, k) => (k === j ? { ...w, ...patch } : w)) })

  /** 第 i 句和下一句合併成一句：原文中間補一個空白接起來，不改字 */
  const mergeNext = (i: number) => {
    setSong(s => {
      const a = s.lines[i], b = s.lines[i + 1]
      const sep = a.th.endsWith(' ') ? '' : ' '
      const words = a.words.map((w, k) => (k === a.words.length - 1 ? { ...w, th: w.th + sep } : w))
      const merged: SongLine = {
        start: a.start, end: b.end, th: a.th + sep + b.th,
        zh: [a.zh, b.zh].filter(Boolean).join(' '), words: [...words, ...b.words],
        ...(a.hidden && b.hidden ? { hidden: true } : {}),
      }
      return { ...s, lines: [...s.lines.slice(0, i), merged, ...s.lines.slice(i + 2)] }
    })
    setLoopIdx(null)
    setDirty(true)
    setMsg('已合併（還沒儲存，重新整理可以放棄）')
  }

  const save = () => {
    if (!import.meta.env.DEV) { setMsg('只有本機 dev 能存檔'); return }
    fetch(`/__songs/${song.id}`, { method: 'POST', body: JSON.stringify(song) })
      .then(r => r.json())
      .then(j => { if (j.ok) setDirty(false); setMsg(j.ok ? `已存到 ${j.file}` : `存檔失敗：${j.error}`) })
      .catch(() => setMsg('存檔失敗'))
  }

  const hiddenCount = song.lines.filter(L => L.hidden).length

  return (
    <div className={`vpage spage tf-${font.id}${showRom ? '' : ' hide-rom'}${showZh ? '' : ' hide-zh'}`}>
      <p><Link to="/song">← 歌詞跟讀</Link></p>
      <h1>{song.title}</h1>
      <p className="muted small">{[song.titleZh, song.artist, mmss(song.duration)].filter(Boolean).join('・')}</p>

      {isAdmin && (
        <div className="sadmin">
          <span className="small">老師模式：句子右上角 × 可隱藏（學生看不到），「併下一句」把這句和下一句合成一句。{hiddenCount > 0 && `已隱藏 ${hiddenCount} 句。`}</span>
          <button type="button" className="vtog" aria-pressed={editing} onClick={() => setEditing(v => !v)}>編輯斷詞／音標／中文</button>
          <button type="button" className="vtog" onClick={save} disabled={!dirty}>{dirty ? '儲存' : '已儲存'}</button>
          {msg && <span className="small muted">{msg}</span>}
        </div>
      )}

      <div className="vcols">
      <div className="vleft">
        <div className="vplayer">
          <div ref={hostRef} className="vhost" />
          {status !== 'ready' && (
            <div className="vover">
              {status === 'loading' ? <p>載入播放器…</p> : (
                <>
                  <p>{errorMsg}</p>
                  <a className="btn" href={`https://www.youtube.com/watch?v=${song.youtubeId}`} target="_blank" rel="noopener noreferrer">在 YouTube 開啟</a>
                </>
              )}
            </div>
          )}
        </div>
        <div className="vctl">
          <button type="button" className="vtog" aria-pressed={follow} onClick={() => setFollow(f => !f)}>自動跟隨</button>
          <span className="small muted">語速</span>
          {[1, 0.75, 0.5].map(r => (
            <button key={r} type="button" className="vtog" aria-pressed={rate === r} onClick={() => setRate(r)} disabled={status !== 'ready'}>{r}×</button>
          ))}
        </div>
      </div>

      <div className="vright" ref={scrollRef}>
      <div className="vdisp">
        <span className="small muted">顯示</span>
        <button type="button" className="vtog" aria-pressed={showRom} onClick={() => setShowRom(v => !v)}>音標</button>
        <button type="button" className="vtog" aria-pressed={showZh} onClick={() => setShowZh(v => !v)}>中文</button>
        <button type="button" className="vtog" aria-pressed={showSeg} onClick={() => setShowSeg(v => !v)}>斷詞輔助</button>
        <button type="button" className="vtog" aria-pressed={font.id === 'loopless'} onClick={nextFont}>藝術字</button>
      </div>
      <ol className="vlines">
        {song.lines.map((L, i) => {
          if (L.hidden && !isAdmin) return null
          const rep = firstOf[i] !== i
          return (
            <li
              key={i}
              ref={el => { lineEls.current[i] = el }}
              className={`vline${i === active ? ' on' : ''}${loopIdx === i ? ' loop' : ''}${L.hidden ? ' shidden' : ''}`}
              onClick={() => seekTo(i)}
            >
              <div className="vlh">
                <button type="button" className="vtime" onClick={e => { e.stopPropagation(); playLine(i) }}>▶ {mmss(L.start)}</button>
                <span className="small muted">第 {i + 1} 句</span>
                {rep && <span className="srep">重複第 {firstOf[i] + 1} 句</span>}
                {L.hidden && <span className="small muted">（已隱藏）</span>}
                <span className="vsp" />
                <button type="button" className="vmini" aria-pressed={loopIdx === i} onClick={e => { e.stopPropagation(); toggleLoop(i) }}>
                  {loopIdx === i ? '停止循環' : '循環這句'}
                </button>
                {isAdmin && i + 1 < song.lines.length && (
                  <button type="button" className="vmini" onClick={e => { e.stopPropagation(); mergeNext(i) }}>併下一句</button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    className="vmini sx"
                    aria-label={L.hidden ? `顯示第 ${i + 1} 句` : `隱藏第 ${i + 1} 句`}
                    onClick={e => { e.stopPropagation(); updateLine(i, { hidden: !L.hidden || undefined }) }}
                  >{L.hidden ? '復原' : '×'}</button>
                )}
              </div>
              {!L.hidden && (
                <>
                  {!showSeg ? <p className="th sfull" onClick={pause}>{L.th}</p> : <div className="vwords">
                    {L.words.map((w, j) => (
                      <span key={j} className="vw" onClick={pause}>
                        <span className="th vth">{w.th}</span>
                        {w.rom && <Rom text={w.rom} />}
                        {w.zh && <span className="vwzh">{w.zh}</span>}
                      </span>
                    ))}
                  </div>}
                  {L.zh && <p className="vzh">{L.zh}</p>}
                </>
              )}
              {isAdmin && editing && !L.hidden && (
                <LineEditor line={L} onLine={p => updateLine(i, p)} onWord={(j, p) => updateWord(i, j, p)} />
              )}
            </li>
          )
        })}
      </ol>
      </div>
      </div>

      {(!!song.notes?.length || !!song.images?.length) && (
        <section className="sextra">
          <h2>補充</h2>
          {(['word', 'pattern'] as const).map(k => {
            const list = song.notes?.filter(n => n.kind === k) ?? []
            return list.length > 0 && (
              <div key={k} className="snotes-wrap">
                <h3>{k === 'word' ? '單字' : '句型'}</h3>
                <div className="snotes">{list.map(n => <NoteCard key={n.th} note={n} />)}</div>
              </div>
            )
          })}
          {!!song.images?.length && (
            <div className="sextra-grid">
              {song.images.map(im => (
                <figure key={im.src} className="simg">
                  <ZoomImage src={im.src} alt={im.alt} />
                  {im.caption && <figcaption className="small muted">{im.caption}</figcaption>}
                </figure>
              ))}
            </div>
          )}
        </section>
      )}

      {!!song.quiz?.length && (
        <section className="sextra">
          <h2>小測驗</h2>
          <ol className="squiz">{song.quiz.map((q, i) => <QuizItem key={i} q={q} />)}</ol>
        </section>
      )}

      <p className="vnote">{song.note}</p>
    </div>
  )
}

/** 老師編輯一句：用「/」重新斷詞（只能切，不能改字）、填每個字的音標與中文、整句中文 */
function LineEditor({ line, onLine, onWord }: { line: SongLine; onLine: (p: Partial<SongLine>) => void; onWord: (j: number, p: Partial<SongWord>) => void }) {
  const joined = line.words.map(w => w.th).join('/')
  const [seg, setSeg] = useState(joined)
  const [err, setErr] = useState('')
  useEffect(() => setSeg(joined), [joined])

  const applySeg = () => {
    const parts = seg.split('/').filter(Boolean)
    if (parts.join('') !== line.th) { setErr('只能加減「/」，不能改字'); return }
    setErr('')
    if (parts.join('/') === joined) return
    // 同一個字原本填過的音標／中文盡量留著
    const old = new Map(line.words.map(w => [w.th, w]))
    onLine({ words: parts.map(th => ({ th, rom: old.get(th)?.rom ?? '', zh: old.get(th)?.zh ?? '' })) })
  }

  return (
    <div className="sedit" onClick={e => e.stopPropagation()}>
      <label className="small">斷詞（用 / 分開）
        <input className="th" value={seg} onChange={e => setSeg(e.target.value)} onBlur={applySeg} onKeyDown={e => { if (e.key === 'Enter') applySeg() }} />
      </label>
      {err && <span className="small serr">{err}</span>}
      <div className="sgrid">
        {line.words.map((w, j) => (
          <div key={j} className="scell">
            <span className="th">{w.th}</span>
            <input placeholder="音標" value={w.rom} onChange={e => onWord(j, { rom: e.target.value })} />
            <input placeholder="中文" value={w.zh} onChange={e => onWord(j, { zh: e.target.value })} />
          </div>
        ))}
      </div>
      <label className="small">整句中文
        <input value={line.zh} onChange={e => onLine({ zh: e.target.value })} />
      </label>
    </div>
  )
}

function NoteCard({ note }: { note: SongNote }) {
  return (
    <div className="snote">
      <div className="snote-h"><span className="th snote-th">{note.th}</span><Rom text={note.rom} /><b>{note.zh}</b></div>
      <div className="snote-eg">
        <span className="small muted">例句</span>
        <span className="th">{note.example.th}</span>
        <Rom text={note.example.rom} />
        <span className="small">{note.example.zh}</span>
      </div>
    </div>
  )
}

function QuizItem({ q }: { q: SongQuiz }) {
  const [pick, setPick] = useState<number | null>(null)
  return (
    <li className="sq">
      <p className="th sq-q">{q.q}</p>
      <div className="sq-opts">
        {q.options.map((o, i) => (
          <button
            key={i}
            type="button"
            className={`vtog th${pick !== null && i === q.answer ? ' sq-ok' : ''}${pick === i && i !== q.answer ? ' sq-no' : ''}`}
            onClick={() => setPick(i)}
          >{o}</button>
        ))}
      </div>
      {pick !== null && <p className="small" role="status">{pick === q.answer ? '✓ 答對了！' : '✗ 再想想～'}{pick === q.answer && ` ${q.explain}`}</p>}
    </li>
  )
}
