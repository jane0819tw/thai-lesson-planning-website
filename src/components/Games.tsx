import { useEffect, useMemo, useState } from 'react'
import type { Consonant } from '../types'
import { nameText, speak } from '../audio/speak'
import WordIcon from './WordIcon'

const shuffle = <T,>(a: T[]): T[] => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] } return r }

// ───────── 聽音選字 ─────────
function ListenQuiz({ items }: { items: Consonant[] }) {
  const rounds = Math.min(10, items.length)
  const [seed, setSeed] = useState(0)
  const qs = useMemo(() => shuffle(items).slice(0, rounds).map(ans => {
    const wrong = shuffle(items.filter(x => x.id !== ans.id)).slice(0, Math.min(3, items.length - 1))
    return { ans, options: shuffle([ans, ...wrong]) }
  }), [items, rounds, seed]) // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const q = qs[i]
  useEffect(() => { if (q) speak(nameText(q.ans.name), q.ans.audioUrl) }, [q])

  if (!q) return (
    <div className="gcard">
      <h3>完成！</h3>
      <p className="big2">{score} / {qs.length}</p>
      <button className="gbtn" onClick={() => { setSeed(s => s + 1); setI(0); setScore(0); setPicked(null) }}>再玩一次</button>
    </div>
  )
  const answer = (id: string) => { if (picked) return; setPicked(id); if (id === q.ans.id) setScore(s => s + 1) }
  return (
    <div className="gcard">
      <p className="muted small">第 {i + 1} / {qs.length} 題　答對 {score}</p>
      <button className="gbtn big-speak" onClick={() => speak(nameText(q.ans.name), q.ans.audioUrl)}>🔊 再聽一次</button>
      <p>聽到的是哪個字母？</p>
      <div className="gopts">
        {q.options.map(o => (
          <button key={o.id} onClick={() => answer(o.id)}
            className={`gopt th${picked ? (o.id === q.ans.id ? ' right' : o.id === picked ? ' wrong' : '') : ''}`}>{o.char}</button>
        ))}
      </div>
      {picked && (
        <div>
          <p>{picked === q.ans.id ? '✅ 答對了！' : '❌ 答錯了'}　正確：<span className="th big2">{q.ans.char}</span>　<span className="th">{q.ans.name}</span> {q.ans.zh}</p>
          <button className="gbtn" onClick={() => { setI(i + 1); setPicked(null) }}>{i + 1 >= qs.length ? '看成績' : '下一題'}</button>
        </div>
      )}
    </div>
  )
}

// ───────── 翻牌配對 ─────────
interface Card { key: string; pairId: string; face: 'char' | 'other'; c: Consonant }

function Memory({ items }: { items: Consonant[] }) {
  const [seed, setSeed] = useState(0)
  const cards = useMemo<Card[]>(() => {
    const pick = shuffle(items).slice(0, Math.min(6, items.length))
    return shuffle(pick.flatMap(c => [
      { key: c.id + 'a', pairId: c.id, face: 'char' as const, c },
      { key: c.id + 'b', pairId: c.id, face: 'other' as const, c },
    ]))
  }, [items, seed]) // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState<string[]>([])
  const [done, setDone] = useState<Set<string>>(new Set())
  const [moves, setMoves] = useState(0)
  useEffect(() => { setOpen([]); setDone(new Set()); setMoves(0) }, [cards])

  const flip = (k: string) => {
    if (open.length >= 2 || open.includes(k) || done.has(cards.find(c => c.key === k)!.pairId)) return
    const next = [...open, k]
    setOpen(next)
    if (next.length === 2) {
      setMoves(m => m + 1)
      const [a, b] = next.map(x => cards.find(c => c.key === x)!)
      if (a.pairId === b.pairId) {
        speak(nameText(a.c.name), a.c.audioUrl)
        window.setTimeout(() => { setDone(d => new Set(d).add(a.pairId)); setOpen([]) }, 600)
      } else window.setTimeout(() => setOpen([]), 900)
    }
  }
  const win = cards.length > 0 && done.size * 2 === cards.length
  return (
    <div className="gcard">
      <div className="gmodes">
        <button className="gbtn" onClick={() => setSeed(s => s + 1)}>重新洗牌</button>
        <span className="small muted">步數 {moves}</span>
      </div>
      <div className="mgrid">
        {cards.map(cd => {
          const shown = open.includes(cd.key) || done.has(cd.pairId)
          return (
            <button key={cd.key} className={`mcard${shown ? ' shown' : ''}${done.has(cd.pairId) ? ' ok' : ''}`} onClick={() => flip(cd.key)} aria-label={shown ? cd.c.char : '翻牌'}>
              {shown ? (cd.face === 'char'
                ? <span className="th big">{cd.c.char}</span>
                : <WordIcon char={cd.c.char} label={cd.c.zh} size={64} />) : '？'}
            </button>
          )
        })}
      </div>
      {win && <p>🎉 全部配對成功！共 {moves} 步。<button className="gbtn" onClick={() => setSeed(s => s + 1)}>再玩一次</button></p>}
    </div>
  )
}

export default function Games({ consonants }: { consonants: Consonant[] }) {
  const [g, setG] = useState<'listen' | 'memory' | null>(null)
  return (
    <section className="stack">
      <article className="card">
        <p className="muted">用這一課的子音來練習。</p>
        <div className="gmodes">
          <button className={`gbtn${g === 'listen' ? ' on' : ''}`} onClick={() => setG('listen')}>🎧 聽音選字</button>
          <button className={`gbtn${g === 'memory' ? ' on' : ''}`} onClick={() => setG('memory')}>🃏 翻牌配對</button>
        </div>
      </article>
      {g === 'listen' && <ListenQuiz items={consonants} />}
      {g === 'memory' && <Memory items={consonants} />}
    </section>
  )
}
