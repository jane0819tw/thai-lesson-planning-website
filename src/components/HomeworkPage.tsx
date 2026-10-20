import { useEffect, useMemo, useState } from 'react'
import { useThaiFont } from './thaiFont'
import { SECTIONS, KED, label as keyLabel } from './KeyboardPage'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getRepository } from '../data/repository'
import type { Lesson } from '../types'
import { ListenQuiz, VowelListenQuiz, vowelSyllables } from './Games'
import SpeakButton from './SpeakButton'
import { getApi, type HomeworkResult } from '../reservation/api'
import type { HomeworkRecord } from '../reservation/types'
import { reviewKey, reviewRange, reviewTitle } from '../reviews'

const norm = (s: string) => s.normalize('NFC').replace(/\s+/g, '')

type Result = HomeworkResult

// 作業複習：把這個單位（例如 L1–L5）每一課的字母、母音合起來；聽寫字每課取 2 個
function buildReview(ls: Lesson[], unit: number): Lesson | null {
  if (!ls.length) return null
  const sorted = [...ls].sort((a, b) => a.number - b.number)
  const pool = (l: Lesson) => [...new Set(l.homework.length ? l.homework : l.vocab.length ? l.vocab.map(w => w.thai) : l.consonants.flatMap(c => c.words.map(w => w.thai)))]
  return {
    id: `review-${unit}`, number: reviewRange(unit).to, title: reviewTitle(unit), summary: '', status: 'ready',
    rules: [], toneTables: [], vocab: [], practice: [], patterns: [], links: [], memes: [], extras: [],
    consonants: sorted.flatMap(l => l.consonants), vowels: sorted.flatMap(l => l.vowels),
    homework: [...new Set(sorted.flatMap(l => pool(l).slice(0, 2)))],
  }
}

export default function HomeworkPage() {
  const { id, unit } = useParams()
  const reviewUnit = unit ? Number(unit) : 0 // 有值＝作業複習（/reading/review/:unit），否則是一般的某一課作業
  const [sp] = useSearchParams()
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined)
  const token = sp.get('t') ?? ''
  const api = getApi(sp.get('mock') === '1')
  const [name, setName] = useState('')
  const [res, setRes] = useState<Result>({})
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [err, setErr] = useState('')
  const [last, setLast] = useState<HomeworkRecord | null>(null) // 這課上一次送出的成績
  const [round, setRound] = useState(0) // 「再做一次」：換 key 讓題目全部重來
  const [lp, setLp] = useState<{ c?: [number, number]; v?: [number, number] }>({}) // 複習：字母、母音兩段聽音選字的成績
  useEffect(() => {
    if (reviewUnit) {
      const { from, to } = reviewRange(reviewUnit)
      getRepository().listLessons().then(ls => setLesson(buildReview(ls.filter(l => l.number >= from && l.number <= to), reviewUnit)))
    } else getRepository().getLesson(id ?? '').then(l => setLesson(l ?? null))
  }, [id, reviewUnit])
  const lessonNo = reviewUnit ? reviewKey(reviewUnit) : lesson?.number
  useEffect(() => {
    if (token && lessonNo) api.getHomeworkInfo(token, lessonNo).then(i => { setName(i.name); setLast(i.last) }).catch(() => setName(''))
  }, [token, lessonNo]) // eslint-disable-line react-hooks/exhaustive-deps

  // 聽寫用的詞：優先用老師指定的作業字，沒有就用單字表
  const words = useMemo(() => {
    if (!lesson) return [] as string[]
    const src = lesson.homework.length ? lesson.homework : lesson.vocab.map(w => w.thai)
    return [...new Set(src)].slice(0, reviewUnit ? 10 : 8)
  }, [lesson, reviewUnit])

  if (lesson === undefined) return <p>載入中…</p>
  if (lesson === null) return <p>找不到這一課。<Link to="/reading">回課程列表</Link></p>
  const hasC = lesson.consonants.length >= 4
  const nV = vowelSyllables(lesson.vowels).length
  const hasV = nV >= 6
  const listenCount = Math.min(10, hasV && !hasC ? nV : lesson.consonants.length)

  // 複習的聽音選字分兩段（字母、母音），成績加總成一個「聽音選字」送出
  const onPart = (k: 'c' | 'v', score: number, total: number) => {
    const n = { ...lp, [k]: [score, total] as [number, number] }
    setLp(n)
    const a = n.c ?? [0, 0], b = n.v ?? [0, 0]
    setRes(r => ({ ...r, listen: [a[0] + b[0], a[1] + b[1]] }))
  }

  const submit = async () => {
    setState('sending'); setErr('')
    try {
      await api.submitHomework(token, lessonNo!, res)
      const f = (r?: [number, number]) => (r ? `${r[0]}/${r[1]}` : '未做')
      setLast(l => ({ time: '', listen: f(res.listen), typing: f(res.typing), count: (l?.count ?? 0) + 1 }))
      setState('sent')
    }
    catch (e) { setErr(e instanceof Error ? e.message : '送出失敗'); setState('idle') }
  }

  return (
    <>
      <p>{reviewUnit ? <Link to="/reading">← 認字課程</Link> : <Link to={`/reading/lesson/${lesson.id}`}>← 回 L{lesson.number}</Link>}</p>
      <h1>{reviewUnit ? lesson.title : `L${lesson.number} 作業`}</h1>
      {!reviewUnit && <p className="muted">{lesson.title}</p>}
      {name && <p className="hw-name">👤 {name}</p>}
      {last && state !== 'sent' && (
        <p className="hw-last">✅ 已完成過：聽音 {last.listen}・聽寫 {last.typing}{last.time && `（${last.time.slice(0, 10).replace(/-/g, '/')}）`}。可以再做一次，老師會看到最近一次的成績。</p>
      )}

      <div className="hw-steps" key={round}>
        {reviewUnit > 0 && (
          <>
            <section className="hw-sec">
              <h2><span className="hw-n">1</span> 聽音選字（字母）{lp.c && <em className="hw-done">已完成 {lp.c[0]}/{lp.c[1]}</em>}</h2>
              <p className="muted small">聽發音，選出正確的字母。</p>
              <ListenQuiz items={lesson.consonants} onDone={(s, t) => onPart('c', s, t)} />
            </section>
            <section className="hw-sec">
              <h2><span className="hw-n">2</span> 聽音選字（母音）{lp.v && <em className="hw-done">已完成 {lp.v[0]}/{lp.v[1]}</em>}</h2>
              <p className="muted small">聽發音，選出正確的音節。</p>
              <VowelListenQuiz vowels={lesson.vowels} onDone={(s, t) => onPart('v', s, t)} />
            </section>
          </>
        )}
        {!reviewUnit && (hasC || hasV) && (
          <section className="hw-sec">
            <h2><span className="hw-n">1</span> 聽音選字{res.listen && <em className="hw-done">已完成 {res.listen[0]}/{res.listen[1]}</em>}</h2>
            <p className="muted small">聽發音，選出正確的{hasV && !hasC ? '音節' : '字母'}，共 {listenCount} 題。</p>
            {hasV && !hasC
              ? <VowelListenQuiz vowels={lesson.vowels} onDone={(s, t) => setRes(r => ({ ...r, listen: [s, t] }))} />
              : <ListenQuiz items={lesson.consonants} onDone={(s, t) => setRes(r => ({ ...r, listen: [s, t] }))} />}
          </section>
        )}

        {words.length > 0 && (
          <section className="hw-sec">
            <h2><span className="hw-n">{reviewUnit ? 3 : hasC || hasV ? 2 : 1}</span> 聽寫{res.typing && <em className="hw-done">已完成 {res.typing[0]}/{res.typing[1]}</em>}</h2>
            <p className="muted small">按喇叭聽發音，用下方的泰文鍵盤打出來。</p>
            <Dictation words={words} onDone={(s, t) => setRes(r => ({ ...r, typing: [s, t] }))} />
          </section>
        )}
      </div>

      <section className="hw-sec hw-submit">
        <h2>繳交</h2>
        {!token
          ? <p className="muted small">請從預約頁的「我的課程」進入作業頁，才能送出作業。</p>
          : state === 'sent'
            ? <>
              <p className="hw-sent">✅ 已完成！聽音選字 {last?.listen}・聽寫 {last?.typing}，老師會收到你的成績。</p>
              <button className="gbtn" onClick={() => { setRes({}); setLp({}); setState('idle'); setRound(r => r + 1); window.scrollTo({ top: 0 }) }}>再做一次</button>
            </>
            : <>
              <p className="muted small">做完以上題目後，按「送出作業」，成績會直接傳給老師。</p>
              <button className="gbtn on" disabled={state === 'sending' || (!res.listen && !res.typing)} onClick={submit}>{state === 'sending' ? '送出中…' : '送出作業'}</button>
              {err && <p className="bk-msg err">{err}</p>}
            </>}
      </section>

      <section className="hw-sec hw-video">
        <h2>🎬 延伸影片挑戰</h2>
        <p className="muted small">做完作業，再用影片多練習一點。</p>
        {lesson.videoChallenge
          ? <Link className="gbtn on" to={lesson.videoChallenge}>開始延伸影片挑戰 →</Link>
          : <button type="button" className="gbtn" disabled>延伸影片挑戰（即將開放）</button>}
      </section>
    </>
  )
}

function Dictation({ words, onDone }: { words: string[]; onDone: (score: number, total: number) => void }) {
  const [ans, setAns] = useState<string[]>(() => words.map(() => ''))
  const [checked, setChecked] = useState(false)
  const [active, setActive] = useState(0)
  const [font, nextFont] = useThaiFont()
  const [pad, setPad] = useState(true) // 用網站鍵盤；關掉就用手機／電腦自己的泰文輸入法
  const score = words.filter((w, i) => norm(ans[i]) === norm(w)).length
  const edit = (f: (t: string) => string) => setAns(a => a.map((x, j) => (j === active ? f(x) : x)))
  return (
    <div className={`dict tf-${font.id}`}>
      {words.map((w, i) => {
        const ok = checked && norm(ans[i]) === norm(w)
        return (
          <div className={`dict-row${checked ? (ok ? ' ok' : ' bad') : ''}${i === active && pad && !checked ? ' act' : ''}`} key={w}>
            <span className="dict-n">{i + 1}</span>
            <SpeakButton text={w} />
            <input className="th" value={ans[i]} disabled={checked} inputMode={pad ? 'none' : 'text'} onFocus={() => setActive(i)} onChange={e => setAns(a => a.map((x, j) => (j === i ? e.target.value : x)))} placeholder="打出泰文" aria-label={`第 ${i + 1} 題`} />
            {checked && <span className="dict-res">{ok ? '✅' : <>❌ <span className="th">{w}</span></>}</span>}
          </div>
        )
      })}
      {!checked && (
        <>
          <label className="hw-check"><input type="checkbox" checked={pad} onChange={e => setPad(e.target.checked)} /> 使用網站泰文鍵盤（目前輸入第 {active + 1} 題）</label>
          {pad && <Keypad fontLabel={font.label} onFont={nextFont} onKey={ch => edit(t => t + ch)} onBack={() => edit(t => Array.from(t).slice(0, -1).join(''))} />}
        </>
      )}
      {checked
        ? <p>得分 {score} / {words.length}　<button className="gbtn" onClick={() => { setChecked(false); setAns(words.map(() => '')); setActive(0) }}>重做</button></p>
        : <button className="gbtn on" onClick={() => { setChecked(true); onDone(score, words.length) }}>檢查答案</button>}
    </div>
  )
}

// 作業頁內建的泰文鍵盤（同「泰文鍵盤」頁的兩種排列），不用離開作業頁
function Keypad({ onKey, onBack, fontLabel, onFont }: { onKey: (ch: string) => void; onBack: () => void; fontLabel: string; onFont: () => void }) {
  const [mode, setMode] = useState<'learn' | 'ked'>('learn')
  const [shift, setShift] = useState(false)
  const press = (ch: string) => onKey(ch) // 上檔（⇧）會一直保持，要再按 ⇧ 才回到第一頁
  const K = ({ ch }: { ch: string }) => <button type="button" className="key th" onClick={() => press(ch)}>{keyLabel(ch)}</button>
  return (
    <div className="hw-pad">
      <div className="tabs" role="tablist">
        <button type="button" className={mode === 'learn' ? 'on' : ''} onClick={() => setMode('learn')}>分類</button>
        <button type="button" className={mode === 'ked' ? 'on' : ''} onClick={() => setMode('ked')}>標準鍵盤</button>
        <button type="button" className="act" onClick={onBack}>⌫</button>
        <button type="button" className="act" onClick={onFont} title="切換字體">Aa 字體：{fontLabel}</button>
      </div>
      {mode === 'learn' && SECTIONS.map(s => <div className="krow" key={s.title}>{s.keys.split(' ').map(ch => <K key={ch} ch={ch} />)}</div>)}
      {mode === 'ked' && (
        <div className="hw-ked">
          {KED.map((r, i) => {
            const side = [0, 1.5, 1.8, 2.3][i]
            return (
              <div className="krow" key={i}>
                {side > 0 && <span className="kspace" style={{ flexGrow: side }} />}
                {i === 3 && <button type="button" className={`key act${shift ? ' on' : ''}`} style={{ flexGrow: 2.3 }} onClick={() => setShift(x => !x)}>⇧</button>}
                {r.map(([a, b]) => (
                  <button type="button" key={a} className="key th" onClick={() => press(shift ? b : a)}>
                    <small>{shift ? a : b}</small>{keyLabel(shift ? b : a)}
                  </button>
                ))}
                {i === 0 && <button type="button" className="key act" style={{ flexGrow: 1.6 }} onClick={onBack}>⌫</button>}
                {i === 3 && <span className="kspace" style={{ flexGrow: 2.3 }} />}
                {(i === 1 || i === 2) && <span className="kspace" style={{ flexGrow: i === 1 ? 0.1 : 1.8 }} />}
              </div>
            )
          })}
          <div className="krow">
            <span className="kspace" style={{ flexGrow: 4.3 }} />
            <button type="button" className="key act" style={{ flexGrow: 6 }} onClick={() => press(' ')}>空格</button>
            <span className="kspace" style={{ flexGrow: 4.3 }} />
          </div>
        </div>
      )}
    </div>
  )
}
