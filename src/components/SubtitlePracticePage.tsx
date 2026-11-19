import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getRepository } from '../data/repository'
import type { Lesson } from '../types'
import { getSession } from '../reservation/session'
import { getApi } from '../reservation/api'
import type { ClassWorkDraft, ClassWorkItem, ClassWorkLine, ClassWorkView } from '../reservation/types'
import { subKey, subPracticeOf, type SubLine, type SubPractice } from '../subtitlePractice'
import { loadYouTubeApi, PLAYER_ERRORS, type YTPlayer } from '../video/youtube'
import { useThaiFont } from './thaiFont'
import { Keypad } from './HomeworkPage'
import '../dictation.css'
import '../video.css'

// 字幕聽打＋斷句解析（團班作業）：聽影片一句一句打出泰文（字幕不能複製），再寫自己的斷句解析。
// 送出後才看得到同班同學的作業，可以互相留言；老師在管理頁「班級作業」回饋。

// 只有字幕不能複製；學生自己打在輸入框的字可以複製、貼上（例如把打好的泰文貼到斷句解析）
const inputProps = { autoComplete: 'off', autoCorrect: 'off', spellCheck: false } as const

// 斷句解析的寫法範例：一行一個字；已經會的字只寫意思，其他寫 子音＋母音＋尾音＋聲調符號；特殊規則寫實際念法
type Field = 'typed' | 'zh' | 'note'
const FIELD_LABEL: Record<Field, string> = { typed: '泰文', zh: '中文意思', note: '斷句解析' }
const NOTE_EXAMPLE = `เสื้อ 衣服
กัน＝ก＋ะ＋น 防止
หนาว＝หน＋า＋ว 冷
特殊規則：บริษัท＝บอ-ริ-ษัด`
const NOTE_PLACEHOLDER = '斷句解析（一行一個字）：\nกัน＝ก＋ะ＋น 防止\n特殊規則：บริษัท＝บอ-ริ-ษัด'

// 手機（窄螢幕）：一次只顯示一句的卡片，用上一句／下一句（或左右滑）切換
function useNarrow() {
  const q = '(max-width: 760px)'
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches)
  useEffect(() => { const m = window.matchMedia(q); const f = () => setNarrow(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  return narrow
}
// 播放速度：一顆按鈕輪流切換 0.75 → 0.5 → 1 → 0.75
const RATES = [0.75, 0.5, 1]
/** 速度、字幕、藝術字放在一起（電腦版在影片下方，手機版在每句卡片上） */
interface Aids { rate: number; onRate: (r: number) => void; showSub: boolean; onSub: () => void; art: boolean; onArt: () => void }
const AidBar = ({ rate, onRate, showSub, onSub, art, onArt }: Aids) => (
  <span className="sw-rate" role="group" aria-label="輔助">
    <button type="button" className="vtog" title="點一下切換速度" onClick={() => onRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])}>🐢 {rate === 1 ? '正常速度' : `${rate} 倍`}</button>
    <button type="button" className="vtog" aria-pressed={showSub} onClick={onSub}>字幕</button>
    <button type="button" className="vtog" aria-pressed={art} onClick={onArt}>藝術字</button>
  </span>
)

const draftKey = (token: string, key: string) => `thaiskr_subwork_${key}_${token.slice(0, 12)}`
/** 全頁的讀取中遮罩：送出作業、存草稿時顯示，避免以為當掉 */
const Busy = ({ text }: { text: string }) => (
  <div className="sw-busy" role="status" aria-live="polite"><div><i className="sw-spin" aria-hidden /><span>{text}</span></div></div>
)
const taipeiNow = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ')
const fmt = (t: string) => t.slice(5, 16).replace('-', '/')

export default function SubtitlePracticePage() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const token = sp.get('t') ?? ''
  const api = getApi(sp.get('mock') === '1')
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined)
  const [view, setView] = useState<ClassWorkView | null>(null)
  const [loadErr, setLoadErr] = useState('')

  useEffect(() => { getRepository().getLesson(id ?? '').then(l => setLesson(l ?? null)) }, [id])
  const key = lesson ? subKey(lesson.number) : ''
  useEffect(() => {
    if (token && key) api.getClassWork(token, key).then(setView).catch(e => setLoadErr((e as Error).message))
  }, [token, key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (lesson === undefined) return <p>載入中…</p>
  if (lesson === null) return <p>找不到這一課。<Link to="/reading">回課程列表</Link></p>
  const prac = subPracticeOf(lesson.number)
  const st = getSession()
  const back = st ? <Link to={`/book?t=${encodeURIComponent(st.token)}`}>← 回到課程與作業</Link> : <Link to={`/reading/lesson/${lesson.id}`}>← 回 L{lesson.number}</Link>

  return (
    <>
      <p>{back}</p>
      <h1>L{lesson.number} 字幕聽打＋斷句解析</h1>
      <p className="muted">{lesson.title}{prac && `｜影片：${prac.title}`}</p>
      {view?.name && <p className="hw-name">👤 {view.name}{view.cls && <span className="muted">　{view.cls}</span>}</p>}
      {!prac ? <p className="muted">這一課的影片還在準備中。</p>
        : !token ? <p className="bk-msg err">請從預約頁的「我的課程與作業」進入，才能送出作業、看到同學的作業。</p>
        : loadErr ? <p className="bk-msg err">{loadErr}</p>
        : !view ? <p className="muted">載入中…</p>
        : <Work key={view.mine?.id ?? 'new'} prac={prac} token={token} view={view} onView={setView}
            submit={items => api.submitClassWork(token, key, items)}
            saveDraft={items => api.saveClassDraft(token, key, items)}
            comment={(w, t) => api.addClassComment(token, w, t)} />}
    </>
  )
}

function Work({ prac, token, view, onView, submit, saveDraft, comment }: {
  prac: SubPractice; token: string; view: ClassWorkView; onView: (v: ClassWorkView) => void
  saveDraft: (items: ClassWorkLine[]) => Promise<{ time: string }>
  submit: (items: ClassWorkLine[]) => Promise<ClassWorkView>; comment: (workId: string, text: string) => Promise<ClassWorkView>
}) {
  const key = subKey(prac.lesson)
  // 草稿兩份：這台裝置自動存的、按「儲存草稿」存到後台的（換裝置也接得下去），用比較新的那份
  const initial = (useDraft = true): ClassWorkLine[] => {
    const local = (() => { try { const v = JSON.parse(localStorage.getItem(draftKey(token, key)) || 'null'); return Array.isArray(v) ? { items: v, time: '' } : v as ClassWorkDraft | null } catch { return null } })()
    const server = view.draft ?? null
    const best = !useDraft ? null : local && server ? (local.time >= server.time ? local : server) : local ?? server
    const from = best?.items ?? view.mine?.items ?? []
    return prac.lines.map(l => from.find(x => x.n === l.n) ?? { n: l.n, typed: '', zh: '', note: '' })
  }
  const [items, setItems] = useState<ClassWorkLine[]>(initial)
  const [editing, setEditing] = useState(!view.mine)
  const [active, setActive] = useState(0)
  const [field, setField] = useState<Field>('typed')
  const [pad, setPad] = useState(false)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [font, nextFont] = useThaiFont()
  // 輔助：整句字幕與中文意思（預設開啟，可以挑戰關掉）
  const [showSub, setShowSub] = useState(true)
  const [rate, setRate] = useState(0.75)
  const aids: Aids = { rate, onRate: setRate, showSub, onSub: () => setShowSub(v => !v), art: font.id === 'loopless', onArt: nextFont }
  const narrow = useNarrow()
  const cardRef = useRef<HTMLDivElement>(null)
  const touchX = useRef<number | null>(null)
  // 手機換句：捲到卡片頂端；autoplay＝按「下一句」時順便播（使用者按的，瀏覽器允許播放）
  const go = (i: number, autoplay = false) => {
    if (i < 0 || i >= prac.lines.length) return
    setActive(i); setField('typed')
    if (autoplay) playLine?.(prac.lines[i])
    requestAnimationFrame(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const [draftAt, setDraftAt] = useState(view.draft?.time ?? '')
  const [drafting, setDrafting] = useState(false)
  const [confirm, setConfirm] = useState<{ i: number; miss: string[] }[] | null>(null)
  const dirty = useRef(false)
  useEffect(() => {
    if (!editing || !dirty.current) return
    try { localStorage.setItem(draftKey(token, key), JSON.stringify({ items, time: taipeiNow() })) } catch { /* 存不了就算了 */ }
  }, [items, editing, token, key])

  const doSaveDraft = async () => {
    setDrafting(true); setErr('')
    try { const r = await saveDraft(items); setDraftAt(r.time) } catch (e) { setErr((e as Error).message) } finally { setDrafting(false) }
  }
  // 送出前檢查：有句子的欄位沒填就先跳確認框
  const trySend = () => {
    const miss = items.map((x, i) => ({ i, miss: ([['typed', '泰文'], ['zh', '中文意思'], ['note', '斷句解析']] as const).filter(([f]) => !(x[f] ?? '').trim()).map(([, label]) => label) })).filter(x => x.miss.length)
    if (miss.length) setConfirm(miss); else send()
  }

  const set = (i: number, f: Field, v: string) => (dirty.current = true, setItems(a => a.map((x, j) => (j === i ? { ...x, [f]: v } : x))))
  const edit = (fn: (t: string) => string) => (dirty.current = true, setItems(a => a.map((x, j) => (j === active ? { ...x, [field]: fn(x[field] ?? '') } : x))))
  const done = items.filter(x => x.typed.trim()).length

  const send = async () => {
    setConfirm(null); setSending(true); setErr('')
    try {
      const v = await submit(items)
      try { localStorage.removeItem(draftKey(token, key)) } catch { /* 無痕模式 */ }
      setEditing(false); onView(v); window.scrollTo({ top: document.getElementById('sw-wall')?.offsetTop ?? 0, behavior: 'smooth' })
    } catch (e) { setErr((e as Error).message) } finally { setSending(false) }
  }

  return (
    <div className={`dict tf-${font.id}`}>
      {editing ? (
        <>
          <details className="sw-guide" open={!narrow}>
          <summary>📋 作業怎麼做</summary>
          <ol className="sw-steps small">
            <li>按 ▶ 聽一句（可以重聽、放慢），對照字幕把泰文<b>自己打一遍</b>（字幕不能複製）。英文名字照英文打就好。<br /><b>💪 挑戰：</b>熟了之後把「字幕」關掉，只靠聽力打出來！</li>
            <li>寫出這句的<b>中文意思</b>。</li>
            <li>在下面寫<b>斷句解析</b>：一行一個字，寫出音節的<b>拼讀規則</b>（子音＋母音＋尾音＋聲調符號）和意思；<b>已經會的字不用拆</b>，寫意思就好。遇到特殊規則（不照拼字念的字）寫出實際念法。
              <pre className="sw-ex th">{NOTE_EXAMPLE}</pre>
            </li>
            <li>全部寫完按「送出作業」。<b>送出後</b>才看得到同學的作業，可以互相留言，老師也會回饋。</li>
          </ol>
          </details>
          <div className="vc-layout">
            <ClipPlayer prac={prac} active={active} rate={rate} aids={aids} narrow={narrow} />
            <div className="vc-rows" ref={cardRef}>
              {narrow && (
                <div className="sw-dots" role="tablist" aria-label="選擇句子">
                  {prac.lines.map((l, i) => <button key={l.n} type="button" role="tab" aria-selected={i === active} className={`${i === active ? 'on' : ''}${items[i].typed.trim() ? ' done' : ''}`} onClick={() => go(i)}>{items[i].typed.trim() && i !== active ? '✓' : l.n}</button>)}
                </div>
              )}
              {prac.lines.map((l, i) => (narrow && i !== active) ? null : (
                <div className={`sw-line${i === active ? ' act' : ''}`} key={l.n} onFocusCapture={() => setActive(i)}
                  onTouchStart={narrow ? e => { touchX.current = e.touches[0].clientX } : undefined}
                  onTouchEnd={narrow ? e => {
                    const x0 = touchX.current; touchX.current = null
                    if (x0 === null || (e.target as HTMLElement).closest('input, textarea')) return
                    const dx = e.changedTouches[0].clientX - x0
                    if (Math.abs(dx) > 60) go(i + (dx < 0 ? 1 : -1))
                  } : undefined}>
                  <div className="sw-head">{!narrow && <span className="dict-n">{l.n}</span>}<PlayBtn line={l} i={i} onPick={setActive} />{narrow && <AidBar {...aids} />}{narrow && <span className="sw-of muted small">{i + 1} / {prac.lines.length}</span>}</div>
                  {!showSub && <div className="small muted">💪 挑戰模式：字幕已關，只靠聽力</div>}
                  {showSub && <div className="th sw-sub vc-nocopy" onCopy={e => e.preventDefault()} onCut={e => e.preventDefault()} onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()}>{l.text}</div>}
                  <input className="th" value={items[i].typed} inputMode={pad && field === 'typed' ? 'none' : 'text'} {...inputProps}
                    onFocus={() => setField('typed')} onChange={e => set(i, 'typed', e.target.value)} placeholder="自己打一遍泰文" aria-label={`第 ${l.n} 句聽打`} />
                  <input value={items[i].zh ?? ''} inputMode={pad && field === 'zh' ? 'none' : 'text'} {...inputProps}
                    onFocus={() => setField('zh')} onChange={e => set(i, 'zh', e.target.value)} placeholder="這句的中文意思" aria-label={`第 ${l.n} 句中文意思`} />
                  <textarea className="sw-note" rows={3} value={items[i].note} inputMode={pad && field === 'note' ? 'none' : 'text'} {...inputProps}
                    onFocus={() => setField('note')} onChange={e => set(i, 'note', e.target.value)} placeholder={NOTE_PLACEHOLDER} aria-label={`第 ${l.n} 句斷句解析`} />
                  {narrow && (
                    <div className="sw-nav">
                      <button type="button" className="gbtn" disabled={i === 0} onClick={() => go(i - 1)}>← 上一句</button>
                      {i < prac.lines.length - 1
                        ? <button type="button" className="gbtn on" onClick={() => go(i + 1, true)}>下一句 ▶</button>
                        : <button type="button" className="gbtn on" onClick={() => document.querySelector('.hw-submit')?.scrollIntoView({ behavior: 'smooth' })}>完成，去送出 ↓</button>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <label className="hw-check"><input type="checkbox" checked={pad} onChange={e => setPad(e.target.checked)} /> 使用網站泰文鍵盤（目前：第 {prac.lines[active].n} 句{FIELD_LABEL[field]}）</label>
          {pad && <Keypad fontLabel={font.label} onFont={nextFont} onKey={ch => edit(t => t + ch)} onBack={() => edit(t => Array.from(t).slice(0, -1).join(''))} />}
          <section className="hw-sec hw-submit">
            <p>已打 {done} / {prac.lines.length} 句</p>
            <div className="sw-actions">
              <button className="gbtn" disabled={drafting || sending} onClick={doSaveDraft}>{drafting ? '儲存中…' : '💾 儲存草稿'}</button>
              <button className="gbtn on" disabled={sending || !done} onClick={trySend}>{sending ? '送出中…' : view.mine ? '儲存修改' : '送出作業'}</button>
              {view.mine && <button className="gbtn" onClick={() => { setEditing(false); setItems(initial(false)) }}>取消</button>}
            </div>
            <p className="small muted">{draftAt ? `✅ 草稿已儲存（${fmt(draftAt)}），換手機或電腦打開也接得下去。` : '寫到一半可以按「儲存草稿」，下次（換裝置也可以）接著寫；同學看不到草稿。'}</p>
            {err && <p className="bk-msg err">{err}</p>}
          </section>
          {(sending || drafting) && <Busy text={sending ? '作業送出中，請稍候…' : '草稿儲存中…'} />}
          {confirm && (
            <div className="sw-modal" role="dialog" aria-modal="true" aria-labelledby="sw-modal-h" onClick={e => { if (e.target === e.currentTarget) setConfirm(null) }}>
              <div className="sw-modal-box">
                <h3 id="sw-modal-h">還有欄位沒填，確定要送出嗎？</h3>
                <ul>{confirm.map(c => <li key={c.i}>第 {prac.lines[c.i].n} 句：{c.miss.join('、')}</li>)}</ul>
                <div className="sw-actions">
                  <button className="gbtn" onClick={() => { const i = confirm[0].i; setConfirm(null); if (narrow) go(i); else document.querySelectorAll('.sw-line')[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}>回去補寫</button>
                  <button className="gbtn on" onClick={send}>還是送出</button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="hw-sent">✅ 已送出{view.mine && `（${fmt(view.mine.updated || view.mine.time)}）`}　<button className="gbtn" onClick={() => setEditing(true)}>修改我的作業</button></p>
          <details className="sw-replay"><summary>🎬 再看一次影片</summary><div className="vc-layout"><ClipPlayer prac={prac} active={0} full /></div></details>
        </>
      )}

      <section id="sw-wall" className="sw-wall">
        <h2>班級作業區</h2>
        {!view.mine ? <p className="muted">🔒 送出自己的作業後，就能看到{view.cls ? '同班同學' : '老師'}的回饋{view.cls ? '和同學的作業' : ''}。</p> : (
          <>
            {!view.cls && <p className="muted small">你目前是一對一，只有你和老師看得到這份作業。</p>}
            {view.works.map(w => <WorkCard key={w.id} w={w} me={view.name} lines={prac.lines} onComment={t => comment(w.id, t).then(onView)} />)}
            {view.cls && view.works.length === 1 && <p className="muted small">同學還沒交，晚點再回來看看。</p>}
          </>
        )}
      </section>
      <p className="vc-src small muted">
        影片來源：{prac.source.channel}・{prac.source.title}<br />
        <a href={prac.source.url} target="_blank" rel="noopener noreferrer">前往 YouTube 觀看完整影片 ↗</a>
      </p>
    </div>
  )
}

/** 一份作業：每句的聽打與斷句解析、老師回饋、留言 */
export function WorkCard({ w, me, lines, onComment, children }: { w: ClassWorkItem; me?: string; lines?: SubLine[]; onComment?: (text: string) => Promise<unknown>; children?: React.ReactNode }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  return (
    <article className={`sw-card${w.name === me ? ' mine' : ''}`}>
      <header><b>{w.name === me ? `${w.name}（我）` : w.name}</b>{w.cls && <span className="muted small">{w.cls}</span>}<span className="muted small">{fmt(w.time)}{w.updated && `・${fmt(w.updated)} 修改`}</span></header>
      <ol className="sw-items">
        {w.items.filter(x => x.typed.trim() || x.zh?.trim() || x.note.trim()).map(x => {
          const ref = lines?.find(l => l.n === x.n)
          return (
            <li key={x.n} value={x.n}>
              <div className="th sw-typed">{x.typed || <span className="muted">（沒打）</span>}</div>
              {x.zh && <div className="sw-zh-v">{x.zh}</div>}
              {x.note && <div className="sw-note-v">{x.note}</div>}
              {children && ref && <div className="sw-ref small">參考：<span className="th">{ref.text}</span>　{ref.zh}</div>}
            </li>
          )
        })}
      </ol>
      {w.feedback && <div className="sw-fb"><b>👩‍🏫 老師回饋</b>{w.feedbackTime && <span className="muted small">{fmt(w.feedbackTime)}</span>}<p>{w.feedback}</p></div>}
      {children}
      {(w.comments.length > 0 || onComment) && (
        <div className="sw-comments">
          {w.comments.map(c => <p key={c.id} className={c.teacher ? 'teacher' : ''}><b>{c.teacher ? '👩‍🏫 老師' : c.name}</b> {c.text} <span className="muted small">{fmt(c.time)}</span></p>)}
          {onComment && (
            <form className="sw-cform" onSubmit={async e => {
              e.preventDefault(); if (!text.trim()) return
              setBusy(true); setErr('')
              try { await onComment(text.trim()); setText('') } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
            }}>
              <input value={text} onChange={e => setText(e.target.value)} maxLength={500} placeholder={w.name === me ? '補充說明…' : `留言給 ${w.name}…`} />
              <button className="gbtn" disabled={busy || !text.trim()}>{busy ? <><i className="sw-spin sm" aria-hidden /> 送出中</> : '留言'}</button>
              {err && <span className="bk-msg err small">{err}</span>}
            </form>
          )}
        </div>
      )}
    </article>
  )
}

// ───────── 播放器：一次只播一句，播完自動暫停；不顯示 YouTube 控制列與字幕 ─────────
let playLine: ((l: SubLine) => void) | null = null
function PlayBtn({ line, i, onPick }: { line: SubLine; i: number; onPick: (i: number) => void }) {
  return <button type="button" className="gbtn" onClick={() => { onPick(i); playLine?.(line) }} aria-label={`播放第 ${line.n} 句`}>▶ 聽</button>
}

function ClipPlayer({ prac, active, full, rate = 1, aids, narrow }: { prac: SubPractice; active: number; full?: boolean; rate?: number; aids?: Aids; narrow?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const playing = useRef<SubLine | null>(null)
  const arrived = useRef(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const rateRef = useRef(rate)

  useEffect(() => {
    let cancelled = false
    let player: YTPlayer | null = null
    const host = hostRef.current!
    const mount = document.createElement('div')
    host.appendChild(mount)
    loadYouTubeApi().then(() => {
      if (cancelled || !window.YT) return
      player = new window.YT.Player(mount, {
        videoId: prac.videoId, width: '100%', height: '100%',
        playerVars: full ? { playsinline: 1, rel: 0, cc_load_policy: 0 } : { playsinline: 1, rel: 0, modestbranding: 1, cc_load_policy: 0, controls: 0, disablekb: 1 },
        events: {
          onReady: () => { if (!cancelled) { playerRef.current = player; setStatus('ready') } },
          onStateChange: e => { if (e.data === 1) player?.setPlaybackRate(rateRef.current) },
          onError: e => { if (!cancelled) { setStatus('error'); setErrorMsg(PLAYER_ERRORS[e.data] ?? '無法播放這支影片。') } },
        },
      })
    }).catch(() => { if (!cancelled) { setStatus('error'); setErrorMsg('無法載入 YouTube 播放器（可能被網路或瀏覽器擋住）。') } })
    return () => { cancelled = true; playerRef.current = null; try { player?.destroy() } catch { /* 已移除 */ } host.innerHTML = '' }
  }, [prac.videoId, full])

  useEffect(() => {
    if (full) return
    playLine = l => { const p = playerRef.current; if (!p) return; playing.current = l; arrived.current = false; p.seekTo(l.start, true); p.playVideo() }
    return () => { playLine = null }
  }, [full])
  useEffect(() => { rateRef.current = rate; if (status === 'ready') playerRef.current?.setPlaybackRate(rate) }, [status, rate])
  useEffect(() => {
    if (status !== 'ready' || full) return
    const t = window.setInterval(() => {
      const p = playerRef.current, c = playing.current
      if (!p || !c) return
      const now = p.getCurrentTime()
      if (!arrived.current) { arrived.current = now >= c.start - 0.5 && now < c.end; return }
      if (now >= c.end) { p.pauseVideo(); playing.current = null }
    }, 100)
    return () => window.clearInterval(t)
  }, [status, full])

  return (
    <div className={`vc-side${narrow ? ' sw-mside' : ''}`}>
      <div className="dr-frame vc-frame">
        <div ref={hostRef} className="vc-host" />
        {status !== 'ready' && <p className="vc-msg">{status === 'error' ? errorMsg : '播放器載入中…'}</p>}
      </div>
      {!full && !narrow && <div className="bk-row">
        <button type="button" className="gbtn" disabled={status !== 'ready'} onClick={() => playLine?.(prac.lines[active])}>▶ 重聽第 {prac.lines[active].n} 句</button>
        {aids && <AidBar {...aids} />}
      </div>}
    </div>
  )
}
