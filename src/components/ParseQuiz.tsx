import { useState } from 'react'
import type { PracticeItem, Syllable } from '../types'
import SpeakButton from './SpeakButton'

// 短句斷句作業：① 點字和字之間切開 ② 每個音節選子音、母音、聲調符號、第幾聲 ③ 選中文意思（4 選 1，其他選項取自別句的中文）
// 每句的分數＝斷句對 1 分＋每個音節全對各 1 分＋中文選對 1 分

const MARKS = ['', '่', '้', '๊', '๋']
const markLabel = (m: string) => (m ? `-${m}` : '無')
// 上下標的母音、聲調符號、ำ 要跟前一個字黏在一起，不能從中間切開
const isMark = (ch: string) => /[ัำ-ฺ็-๎]/.test(ch)
function clusters(s: string) {
  const out: string[] = []
  for (const ch of s.normalize('NFC')) { if (out.length && isMark(ch)) out[out.length - 1] += ch; else out.push(ch) }
  return out
}
const pieces = (cs: string[], cuts: Set<number>) => {
  const out: string[] = ['']
  cs.forEach((c, i) => { out[out.length - 1] += c; if (cuts.has(i) && i < cs.length - 1) out.push('') })
  return out
}

type Pick = { c: string; v: string; m: string; t: number }
const blank = (): Pick => ({ c: '', v: '', m: '', t: 0 })
const fields = (p: Pick, a: Syllable) => ({ c: p.c === a.c, v: p.v === a.v, m: p.m === (a.m ?? ''), t: p.t === a.t })
const allOk = (f: Record<string, boolean>) => Object.values(f).every(Boolean)
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }

export default function ParseQuiz({ items, onDone }: { items: PracticeItem[]; onDone: (score: number, total: number) => void }) {
  const qs = items.filter(i => i.parts?.length && !i.demo)
  const demo = items.find(i => i.demo && i.parts?.length)
  const opts = {
    c: [...new Set(items.flatMap(i => i.parts!.map(p => p.c)))].sort(),
    v: [...new Set(items.flatMap(i => i.parts!.map(p => p.v)))].sort((a, b) => a.replace(/[-เแโใไ]/g, '').localeCompare(b.replace(/[-เแโใไ]/g, '')) || a.localeCompare(b)),
    zh: [...new Set(items.flatMap(i => (i.zh ? [i.zh] : [])))],
  }
  const [scores, setScores] = useState<([number, number] | null)[]>(() => qs.map(() => null))
  const done = scores.filter(Boolean).length
  const set = (i: number, r: [number, number] | null) => {
    const n = scores.map((x, j) => (j === i ? r : x))
    setScores(n)
    if (n.every(Boolean)) onDone(n.reduce((a, x) => a + x![0], 0), n.reduce((a, x) => a + x![1], 0))
  }
  return (
    <div className="pq">
      {demo && <Card item={demo} n={0} opts={opts} />}
      {qs.map((it, i) => <Card key={it.thai + i} item={it} n={i + 1} opts={opts} onCheck={r => set(i, r)} />)}
      <p className="muted small">已完成 {done} / {qs.length} 句{done === qs.length && `，得分 ${scores.reduce((a, x) => a + x![0], 0)} / ${scores.reduce((a, x) => a + x![1], 0)}`}</p>
    </div>
  )
}

function Card({ item, n, opts, onCheck }: { item: PracticeItem; n: number; opts: { c: string[]; v: string[]; zh: string[] }; onCheck?: (r: [number, number] | null) => void }) {
  const ans = item.parts!
  const demo = !onCheck
  const cs = clusters(item.thai)
  // 正確答案的切點（第幾個字後面切）
  const right = new Set<number>()
  { let k = 0; ans.slice(0, -1).forEach(p => { k += clusters(p.syl).length; right.add(k - 1) }) }
  const [cuts, setCuts] = useState<Set<number>>(() => (demo ? right : new Set()))
  const [split, setSplit] = useState(demo) // 斷句按了「斷好了」
  const [picks, setPicks] = useState<Pick[]>(() => ans.map(a => (demo ? { c: a.c, v: a.v, m: a.m ?? '', t: a.t } : blank())))
  const [zh, setZh] = useState(demo ? item.zh ?? '' : '')
  const [zhChoices] = useState(() => (item.zh ? shuffle([item.zh, ...shuffle(opts.zh.filter(x => x !== item.zh)).slice(0, 3)]) : []))
  const total = ans.length + 1 + (item.zh ? 1 : 0)
  const [checked, setChecked] = useState(demo)
  const splitOk = pieces(cs, cuts).join('|') === ans.map(a => a.syl).join('|')
  const edit = (i: number, k: keyof Pick, v: string | number) => setPicks(ps => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)))
  const filled = picks.every(p => p.c && p.v && p.t) && (!item.zh || zh)
  const score = (splitOk ? 1 : 0) + picks.filter((p, i) => allOk(fields(p, ans[i]))).length + (item.zh && zh === item.zh ? 1 : 0)
  const redo = () => { setCuts(new Set()); setSplit(false); setPicks(ans.map(blank)); setZh(''); setChecked(false); onCheck!(null) }

  return (
    <article className={`pq-card${demo ? ' demo' : ''}${checked && !demo ? (score === total ? ' ok' : ' bad') : ''}`}>
      <div className="pq-head">
        <span className="dict-n">{demo ? '例' : n}</span>
        <span className="th pq-th">{item.thai}</span>
        <SpeakButton text={item.thai} />
        {demo && <span className="chip">示範</span>}
        {checked && !demo && <span className="pq-score">{score} / {total}</span>}
      </div>

      <div className="pq-step">
        <div><b>① 斷句</b>{!split && <span className="muted small">　點字和字中間的虛線切開</span>}</div>
        <div className="pq-split th">
          {cs.map((c, i) => (
            <span key={i} className="pq-cl">
              {c}
              {i < cs.length - 1 && (
                <button type="button" disabled={split} className={`pq-gap${cuts.has(i) ? ' on' : ''}${split && !demo && right.has(i) !== cuts.has(i) ? ' wrong' : ''}`}
                  onClick={() => setCuts(s => { const x = new Set(s); if (x.has(i)) x.delete(i); else x.add(i); return x })} aria-label={`在 ${c} 後面切開`} />
              )}
            </span>
          ))}
          {!split && <button type="button" className="gbtn on" disabled={!cuts.size} onClick={() => setSplit(true)}>斷好了</button>}
        </div>
        {split && !demo && (splitOk ? <p className="pq-ok">✅ 斷句正確</p> : <p className="pq-no">❌ 正確斷句：<span className="th">{ans.map(a => a.syl).join(' ｜ ')}</span></p>)}
      </div>

      {split && (
        <div className="pq-step">
          <b>② 拆子音＋母音＋聲調符號，念第幾聲</b>
          {ans.map((a, i) => {
            const p = picks[i], f = fields(p, a), bad = (k: keyof typeof f) => (checked && !demo && !f[k] ? ' wrong' : '')
            return (
              <div className="pq-row" key={i}>
                <span className="th pq-syl">{a.syl}</span>
                <label>子音 <select className={`th${bad('c')}`} disabled={checked} value={p.c} onChange={e => edit(i, 'c', e.target.value)}><option value="" />{opts.c.map(x => <option key={x}>{x}</option>)}</select></label>
                <label>母音 <select className={`th${bad('v')}`} disabled={checked} value={p.v} onChange={e => edit(i, 'v', e.target.value)}><option value="" />{opts.v.map(x => <option key={x}>{x}</option>)}</select></label>
                <label>符號 <select className={`th${bad('m')}`} disabled={checked} value={p.m} onChange={e => edit(i, 'm', e.target.value)}>{MARKS.map(x => <option key={x} value={x}>{markLabel(x)}</option>)}</select></label>
                <span className={`pq-tones${bad('t')}`}>第{[1, 2, 3, 4, 5].map(t => <button type="button" key={t} disabled={checked} className={p.t === t ? 'on' : ''} onClick={() => edit(i, 't', t)}>{t}</button>)}聲</span>
                {checked && !demo && !allOk(f) && <span className="pq-no small">→ <span className="th">{a.c} ＋ {a.v}{a.m ? ` ＋ -${a.m}` : ''}</span>／第 {a.t} 聲</span>}
              </div>
            )
          })}
        </div>
      )}

      {split && item.zh && (
        <div className="pq-step">
          <b>③ 中文意思</b>
          <div className="pq-zhs">
            {(demo ? [item.zh] : zhChoices).map(x => (
              <button type="button" key={x} disabled={checked} onClick={() => setZh(x)}
                className={`${zh === x ? 'on' : ''}${checked && !demo ? (x === item.zh ? ' right' : zh === x ? ' wrong' : '') : ''}`}>{x}</button>
            ))}
          </div>
        </div>
      )}

      {!demo && split && (checked
        ? <button type="button" className="gbtn" onClick={redo}>重做這句</button>
        : <button type="button" className="gbtn on" disabled={!filled} onClick={() => { setChecked(true); onCheck!([score, total]) }}>檢查這句</button>)}
    </article>
  )
}
