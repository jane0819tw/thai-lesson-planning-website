import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import chart from '../../data/reading-chart.json'
import { getRepository } from '../data/repository'
import type { Lesson, ToneTable } from '../types'
import { KED, label as keyLabel } from './KeyboardPage'
import ToneTableView from './ToneTableView'
import VowelText from './VowelText'
import MarkGlyph from './MarkGlyph'

// 複習：鍵盤＋子母音填空＋拼讀規則填空。
// 投影片（L2 起每課自動有）：左邊鍵盤、右邊這課之前學過的子母音填空，點空格翻開、鍵盤上亮出位置；點鍵盤上的字也會填進空格。
// 講義（單元最前面、L1 之前）：兩個鍵盤（一般、Shift）＋各類字母的空格，讓學生寫出來、在鍵盤上找到位置；拼讀規則填空。
// 資料：子音、母音讀各課 JSON；拼讀規則、提早學到的母音在 data/reading-chart.json（認字總表）

type Cat = 'mid' | 'high' | 'lcp' | 'lcs' | 'long' | 'short' | 'compound' | 'special'
const CATS: [Cat, string][] = [['mid', '中子音'], ['high', '高子音'], ['lcp', '低子音 LCp'], ['lcs', '低子音 LCs'], ['long', '長母音'], ['short', '短母音'], ['compound', '複合母音'], ['special', '特殊母音']]
interface Item { id: string; text: string; keys: string[]; vowel: boolean; cat: Cat; lesson: number }
interface ChartRule { id: string; lesson: number; title: string; body: string; toneTable?: ToneTable }
export const RULES = chart.rules as ChartRule[]

// 母音要按哪些鍵：去掉代表子音位置的「-」，一個字一個鍵（เ-ียะ＝เ ี ย ะ）
const vowelKeys = (form: string) => [...form.replace('-', '')]

export function reviewItems(lessons: Lesson[]): Item[] {
  const early = new Map(chart.vowelsEarly.map(v => [v.form, v.lesson]))
  const out: Item[] = []
  for (const l of lessons) {
    for (const c of l.consonants) out.push({ id: 'c' + c.char, text: c.char, keys: [c.char], vowel: false, cat: c.group, lesson: l.number })
    // 母音分組沿用課程資料的 heading（L5 複合母音、特殊母音），沒有 heading 的是單母音
    let kind = ''
    for (const v of l.vowels) {
      kind = v.heading ?? kind
      const add = (form: string, cat: Cat) => form && out.push({ id: 'v' + form, text: form, keys: vowelKeys(form), vowel: true, cat, lesson: Math.min(l.number, early.get(form) ?? l.number) })
      if (kind.includes('特殊')) add(v.short, 'special')
      else if (kind.includes('複合')) { add(v.short, 'compound'); add(v.long, 'compound') }
      else { add(v.short, 'short'); add(v.long, 'long') }
    }
  }
  return out
}

function useLessons() {
  const [ls, setLs] = useState<Lesson[]>([])
  useEffect(() => { getRepository().listLessons().then(setLs) }, [])
  return ls
}

// 標準鍵盤（Kedmanee）：shift＝上檔字；lit＝要亮的鍵（值是類別，決定顏色）；flash＝剛按的鍵（對：綠、錯：紅）
export function Keyboard({ shift, lit, onKey, flash }: { shift: boolean; lit?: Map<string, Cat>; onKey?: (ch: string) => void; flash?: { ch: string; ok: boolean } | null }) {
  return (
    <div className="rk">
      <div className="rk-title small muted">{shift ? 'Shift ＋' : '一般'}</div>
      {KED.map((row, i) => (
        <div className="rk-row" key={i} style={{ paddingLeft: `${[0, 0.6, 1, 1.5][i]}em` }}>
          {row.map(pair => {
            const ch = pair[shift ? 1 : 0]
            const thai = /[฀-๿]/.test(ch)
            const cat = lit?.get(ch)
            const cls = ['rk-key th', !thai && 'other', cat && `lit c-${cat}`, flash?.ch === ch && (flash.ok ? 'ok' : 'bad')].filter(Boolean).join(' ')
            return onKey && thai
              ? <button key={ch} className={cls} onClick={() => onKey(ch)}>{keyLabel(ch)}</button>
              : <span key={ch} className={cls}>{thai ? keyLabel(ch) : ch}</span>
          })}
        </div>
      ))}
    </div>
  )
}

// 拼讀規則的說明：[[答案]]＝填空（cover：點了翻開；print：印成空格），**文字**＝重點，{{้}}＝聲調符號（單獨畫，不帶 อ，L2 老師：不寫符號名稱、直接顯示符號）
function FillText({ body, mode }: { body: string; mode: 'slide' | 'print' }) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  let n = 0
  const line = (t: string) => t.split(/(\[\[.+?\]\]|\*\*.+?\*\*|\{\{.+?\}\})/).map((p, i) => {
    if (p.startsWith('[[')) {
      const k = n++, ans = p.slice(2, -2)
      if (mode === 'print') return <span key={i} className="fb-blank" style={{ minWidth: `${Math.max(2.5, ans.length * 1.1)}em` }} />
      return open.has(k) ? <strong key={i} className="hl">{ans}</strong> : <button key={i} className="fb-cover" style={{ minWidth: `${Math.max(2, ans.length * 1.1)}em` }} onClick={() => setOpen(s => new Set(s).add(k))} aria-label="翻開答案" />
    }
    if (p.startsWith('{{')) return <span key={i} className="fb-mark"><MarkGlyph char={p.slice(2, -2)} size={mode === 'print' ? 16 : 20} /></span>
    if (p.startsWith('**')) return <strong key={i} className="hl">{p.slice(2, -2)}</strong>
    return <Fragment key={i}>{p}</Fragment>
  })
  return <ul className="fb-body">{body.split('\n').map((t, i) => <li key={i}>{line(t)}</li>)}</ul>
}

// 講義的聲調表填空：表頭、每列的標題照印，格子空白
function BlankToneTable({ t }: { t: ToneTable }) {
  return (
    <table className="h-tones fb-tones">
      <thead><tr><th>{t.title}</th>{['第一聲', '第二聲', '第三聲', '第四聲', '第五聲'].map(c => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>{t.rows.map((r, i) => <tr key={i}><th className="th">{r.label}</th>{r.cells.map((_, k) => <td key={k} />)}</tr>)}</tbody>
    </table>
  )
}

// ── 投影片 ──
// 頁 1：左邊兩個鍵盤（一般、Shift），右邊這課之前學過的子母音，一類一列、一個字一個黑圈
export function ReviewSlide({ upTo }: { upTo: number }) {
  const lessons = useLessons()
  const items = useMemo(() => reviewItems(lessons).filter(x => x.lesson < upTo), [lessons, upTo])
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [flash, setFlash] = useState<{ ch: string; ok: boolean } | null>(null)
  const reveal = (ids: string[]) => setOpen(s => new Set([...s, ...ids]))
  // 翻開的字在鍵盤上亮起來（母音的每個鍵都亮）
  const lit = useMemo(() => {
    const m = new Map<string, Cat>()
    for (const x of items) if (open.has(x.id)) for (const k of x.keys) if (!m.has(k)) m.set(k, x.cat)
    return m
  }, [items, open])
  // 點鍵盤：一個鍵就是答案的字（子音、ะ า ไ…）直接填進去；是某個母音的一部分→綠；沒學過→紅
  const onKey = (ch: string) => {
    const exact = items.filter(x => x.keys.length === 1 && x.keys[0] === ch)
    reveal(exact.map(x => x.id))
    setFlash({ ch, ok: exact.length > 0 || items.some(x => x.keys.includes(ch)) })
    window.setTimeout(() => setFlash(f => f?.ch === ch ? null : f), 700)
  }
  if (!lessons.length) return null
  const rows = CATS.map(([c, name]) => [c, name, items.filter(x => x.cat === c)] as const).filter(([, , xs]) => xs.length)
  return (
    <article className="card rf">
      <div className="rf-kb">
        <Keyboard shift={false} lit={lit} onKey={onKey} flash={flash} />
        <Keyboard shift lit={lit} onKey={onKey} flash={flash} />
      </div>
      <div className="rf-fill">
        <div className="rf-tools">
          <button onClick={() => reveal(items.map(x => x.id))}>全部翻開</button>
          <button onClick={() => setOpen(new Set())}>全部蓋上</button>
        </div>
        {rows.map(([c, name, xs]) => (
          <div key={c} className="rf-row">
            {/* 點類別名稱：這一列全部翻開 */}
            <button className={`rf-cat c-${c}`} onClick={() => reveal(xs.map(x => x.id))}>{name}</button>
            <div className="rf-blanks">
              {xs.map(x => {
                const o = open.has(x.id)
                return <button key={x.id} className={`rf-b th c-${c}${x.vowel ? ' v' : ''}${o ? ' open' : ''}`} onClick={() => setOpen(s => { const n = new Set(s); if (n.has(x.id)) n.delete(x.id); else n.add(x.id); return n })} aria-label={o ? x.text : `翻開一個${name}`}>{o && (x.vowel ? <VowelText form={x.text} /> : x.text)}</button>
              })}
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}
export const hasRulesBefore = (upTo: number) => RULES.some(r => r.lesson < upTo)

// 頁 2：這課之前學過的拼讀規則，說明裡的答案、聲調表的格子都先蓋住
export function RuleFillSlide({ upTo }: { upTo: number }) {
  return (
    <article className="card rf-rules">
      {RULES.filter(r => r.lesson < upTo).map(r => (
        <section key={r.id}>
          <h3>L{r.lesson}　{r.title}</h3>
          <FillText body={r.body} mode="slide" />
          {r.toneTable && <ToneTableView table={r.toneTable} cover />}
        </section>
      ))}
    </article>
  )
}

// ── 講義（單元最前面）：兩個鍵盤＋每類字母的空格（數量＝整個課程這類有幾個）＋這個單元的拼讀規則填空 ──
export function ReviewSheet({ from, to, title }: { from: number; to: number; title: string }) {
  const lessons = useLessons()
  if (!lessons.length) return null
  const items = reviewItems(lessons)
  const rules = RULES.filter(r => r.lesson >= from && r.lesson <= to)
  const blanks = (n: number): ReactNode => Array.from({ length: n }, (_, i) => <span key={i} className="fb-cell" />)
  return (
    <>
      <section className="h-sheet fb-sheet">
        <div className="h-name">姓名＿＿＿＿＿＿＿＿　日期＿＿＿＿＿＿</div>
        <h2>{title} 複習　鍵盤與子母音</h2>
        <p className="small">把每一類的字母寫在格子裡（母音用 อ 代表子音的位置），再到鍵盤上圈出它的位置。</p>
        <div className="fb-kbs">
          <Keyboard shift={false} />
          <Keyboard shift />
        </div>
        <div className="fb-rows">
          {CATS.map(([c, name]) => (
            <div key={c} className="fb-row">
              <span className="fb-cat">{name}<small>（{items.filter(x => x.cat === c).length}）</small></span>
              <div className="fb-cells">{blanks(items.filter(x => x.cat === c).length)}</div>
            </div>
          ))}
        </div>
      </section>
      {rules.length > 0 && (
        <section className="h-sheet fb-sheet">
          <h2>{title} 複習　拼讀規則</h2>
          <p className="small">填入空格，再把聲調表寫完整。</p>
          {rules.map(r => (
            <div key={r.id} className="fb-rule">
              <h3>L{r.lesson}　{r.title}</h3>
              <FillText body={r.body} mode="print" />
              {r.toneTable && <BlankToneTable t={r.toneTable} />}
            </div>
          ))}
        </section>
      )}
    </>
  )
}
