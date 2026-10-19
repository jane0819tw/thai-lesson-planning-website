import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getRepository } from '../data/repository'
import type { Lesson } from '../types'
import { ListenQuiz, VowelListenQuiz, vowelSyllables } from './Games'
import SpeakButton from './SpeakButton'

const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); return true } catch { return false } }
const norm = (s: string) => s.normalize('NFC').replace(/\s+/g, '')

// 老師端：在課程頁產生「指派連結」（可帶學生姓名）
export function AssignBar({ lessonId }: { lessonId: string }) {
  const [name, setName] = useState('')
  const [done, setDone] = useState(false)
  const url = () => `${location.href.split('#')[0]}#/reading/lesson/${lessonId}/homework${name.trim() ? `?to=${encodeURIComponent(name.trim())}` : ''}`
  return (
    <div className="assignbar">
      <strong>📝 作業</strong>
      <Link className="btn" to={`/reading/lesson/${lessonId}/homework`}>開啟作業頁</Link>
      <input value={name} onChange={e => { setName(e.target.value); setDone(false) }} placeholder="學生姓名（選填）" aria-label="學生姓名" />
      <button className="gbtn" onClick={async () => setDone(await copy(url()))}>{done ? '已複製 ✓' : '複製指派連結'}</button>
    </div>
  )
}

interface Result { listen?: [number, number]; typing?: [number, number]; read?: boolean }

export default function HomeworkPage() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined)
  const [name, setName] = useState(() => sp.get('to') ?? '')
  const [res, setRes] = useState<Result>({})
  const [copied, setCopied] = useState(false)
  useEffect(() => { getRepository().getLesson(id ?? '').then(l => setLesson(l ?? null)) }, [id])

  // 聽寫 / 朗讀用的詞：優先用老師指定的作業字，沒有就用單字表
  const words = useMemo(() => {
    if (!lesson) return [] as string[]
    const src = lesson.homework.length ? lesson.homework : lesson.vocab.map(w => w.thai)
    return [...new Set(src)].slice(0, 8)
  }, [lesson])

  if (lesson === undefined) return <p>載入中…</p>
  if (lesson === null) return <p>找不到這一課。<Link to="/reading">回課程列表</Link></p>
  const hasC = lesson.consonants.length >= 4
  const hasV = vowelSyllables(lesson.vowels).length >= 6

  const summary = () => {
    const f = (r?: [number, number]) => (r ? `${r[0]}/${r[1]}` : '未做')
    return [`【L${lesson.number} 作業】${name.trim() || '（未填姓名）'}`,
      hasC || hasV ? `聽音選字：${f(res.listen)}` : '', words.length ? `聽寫：${f(res.typing)}` : '',
      words.length ? `朗讀：${res.read ? '已完成' : '未完成'}` : '', new Date().toLocaleDateString('zh-TW')].filter(Boolean).join('\n')
  }

  return (
    <>
      <p><Link to={`/reading/lesson/${lesson.id}`}>← 回 L{lesson.number}</Link></p>
      <h1>L{lesson.number} 作業</h1>
      <p className="muted">{lesson.title}</p>
      <div className="hw-name">
        <label>姓名　<input value={name} onChange={e => setName(e.target.value)} placeholder="請輸入姓名" /></label>
      </div>

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

        {words.length > 0 && (
          <section className="hw-sec">
            <h2><span className="hw-n">{(hasC || hasV ? 1 : 0) + 2}</span> 朗讀{res.read && <em className="hw-done">已完成</em>}</h2>
            <p className="muted small">把下面的詞大聲唸三遍，錄成語音傳給老師。</p>
            <div className="hw-words">{words.map(w => <span key={w} className="hw-word th">{w}<SpeakButton text={w} /></span>)}</div>
            <label className="hw-check"><input type="checkbox" checked={!!res.read} onChange={e => setRes(r => ({ ...r, read: e.target.checked }))} /> 我唸完並錄好音了</label>
          </section>
        )}
      </div>

      <section className="hw-sec hw-submit">
        <h2>繳交</h2>
        <p className="muted small">完成後按「複製成績」，貼給老師（LINE／訊息）。</p>
        <pre className="hw-sum">{summary()}</pre>
        <button className="gbtn on" onClick={async () => { setCopied(await copy(summary())) }}>{copied ? '已複製 ✓' : '複製成績'}</button>
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
