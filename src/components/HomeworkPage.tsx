import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getRepository } from '../data/repository'
import type { Lesson } from '../types'
import { ListenQuiz, VowelListenQuiz, vowelSyllables } from './Games'
import SpeakButton from './SpeakButton'
import { getApi, type HomeworkResult } from '../reservation/api'

const norm = (s: string) => s.normalize('NFC').replace(/\s+/g, '')

type Result = HomeworkResult

export default function HomeworkPage() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined)
  const token = sp.get('t') ?? ''
  const api = getApi(sp.get('mock') === '1')
  const [name, setName] = useState('')
  const [res, setRes] = useState<Result>({})
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [err, setErr] = useState('')
  useEffect(() => { if (token) api.getHomeworkInfo(token).then(i => setName(i.name)).catch(() => setName('')) }, [token]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { getRepository().getLesson(id ?? '').then(l => setLesson(l ?? null)) }, [id])

  // 聽寫用的詞：優先用老師指定的作業字，沒有就用單字表
  const words = useMemo(() => {
    if (!lesson) return [] as string[]
    const src = lesson.homework.length ? lesson.homework : lesson.vocab.map(w => w.thai)
    return [...new Set(src)].slice(0, 8)
  }, [lesson])

  if (lesson === undefined) return <p>載入中…</p>
  if (lesson === null) return <p>找不到這一課。<Link to="/reading">回課程列表</Link></p>
  const hasC = lesson.consonants.length >= 4
  const hasV = vowelSyllables(lesson.vowels).length >= 6

  const submit = async () => {
    setState('sending'); setErr('')
    try { await api.submitHomework(token, lesson.number, res); setState('sent') }
    catch (e) { setErr(e instanceof Error ? e.message : '送出失敗'); setState('idle') }
  }

  return (
    <>
      <p><Link to={`/reading/lesson/${lesson.id}`}>← 回 L{lesson.number}</Link></p>
      <h1>L{lesson.number} 作業</h1>
      <p className="muted">{lesson.title}</p>
      {name && <p className="hw-name">👤 {name}</p>}

      <div className="hw-steps">
        {(hasC || hasV) && (
          <section className="hw-sec">
            <h2><span className="hw-n">1</span> 聽音選字{res.listen && <em className="hw-done">已完成 {res.listen[0]}/{res.listen[1]}</em>}</h2>
            <p className="muted small">聽發音，選出正確的{hasV && !hasC ? '音節' : '字母'}，共 10 題。</p>
            {hasV && !hasC
              ? <VowelListenQuiz vowels={lesson.vowels} onDone={(s, t) => setRes(r => ({ ...r, listen: [s, t] }))} />
              : <ListenQuiz items={lesson.consonants} onDone={(s, t) => setRes(r => ({ ...r, listen: [s, t] }))} />}
          </section>
        )}

        {words.length > 0 && (
          <section className="hw-sec">
            <h2><span className="hw-n">{hasC || hasV ? 2 : 1}</span> 聽寫{res.typing && <em className="hw-done">已完成 {res.typing[0]}/{res.typing[1]}</em>}</h2>
            <p className="muted small">按喇叭聽發音，打出泰文。還沒有泰文鍵盤？<Link to="/reading/keyboard">用網站的泰文鍵盤</Link>。</p>
            <Dictation words={words} onDone={(s, t) => setRes(r => ({ ...r, typing: [s, t] }))} />
          </section>
        )}
      </div>

      <section className="hw-sec hw-submit">
        <h2>繳交</h2>
        {!token
          ? <p className="muted small">請從預約頁的「我的課程」進入作業頁，才能送出作業。</p>
          : state === 'sent'
            ? <p className="hw-sent">✅ 已送出，老師會收到你的成績。</p>
            : <>
              <p className="muted small">做完以上題目後，按「送出作業」，成績會直接傳給老師。</p>
              <button className="gbtn on" disabled={state === 'sending' || (!res.listen && !res.typing)} onClick={submit}>{state === 'sending' ? '送出中…' : '送出作業'}</button>
              {err && <p className="bk-msg err">{err}</p>}
            </>}
      </section>
    </>
  )
}

function Dictation({ words, onDone }: { words: string[]; onDone: (score: number, total: number) => void }) {
  const [ans, setAns] = useState<string[]>(() => words.map(() => ''))
  const [checked, setChecked] = useState(false)
  const score = words.filter((w, i) => norm(ans[i]) === norm(w)).length
  return (
    <div className="dict">
      {words.map((w, i) => {
        const ok = checked && norm(ans[i]) === norm(w)
        return (
          <div className={`dict-row${checked ? (ok ? ' ok' : ' bad') : ''}`} key={w}>
            <span className="dict-n">{i + 1}</span>
            <SpeakButton text={w} />
            <input className="th" value={ans[i]} disabled={checked} onChange={e => setAns(a => a.map((x, j) => (j === i ? e.target.value : x)))} placeholder="打出泰文" aria-label={`第 ${i + 1} 題`} />
            {checked && <span className="dict-res">{ok ? '✅' : <>❌ <span className="th">{w}</span></>}</span>}
          </div>
        )
      })}
      {checked
        ? <p>得分 {score} / {words.length}　<button className="gbtn" onClick={() => { setChecked(false); setAns(words.map(() => '')) }}>重做</button></p>
        : <button className="gbtn on" onClick={() => { setChecked(true); onDone(score, words.length) }}>檢查答案</button>}
    </div>
  )
}
