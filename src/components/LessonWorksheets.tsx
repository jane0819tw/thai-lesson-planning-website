import type { Lesson, Worksheet } from '../types'
import { ghostText, vowelForm } from '../strokes'
import MarkGlyph from './MarkGlyph'

// 講義作業（課程資料的 worksheets）：L2 拼字表＋聲調填空、L3 拼字表、L4 判斷聲調、L5 拆字（2026-11 老師定）
// 一份作業一頁（.h-sheet），右上姓名日期；出題內容在課程 JSON，這裡只排版
const TONES = ['第一聲', '第二聲', '第三聲', '第四聲', '第五聲']
const spell = (c: string, form: string) => form.replace('-', c)
const Name = () => <div className="h-name">姓名＿＿＿＿＿＿＿＿　日期＿＿＿＿＿＿</div>

// 拼字表：一列一個子音、一欄一個母音（短音、長音），第一列示範
function Spell({ l, consonants }: { l: Lesson; consonants: string[] }) {
  const forms = l.vowels.flatMap(v => [v.short, v.long]).filter(Boolean)
  return (
    <>
      <p className="small">把左邊的子音和上面的母音拼在一起，寫出這個字。第一列是示範。</p>
      <table className="ws-table ws-spell">
        <thead><tr><th />{forms.map(f => <th key={f} className="th">{ghostText(vowelForm(f))}</th>)}</tr></thead>
        <tbody>
          {consonants.map((c, i) => (
            <tr key={c}><th className="th">{c}</th>{forms.map(f => <td key={f} className={i === 0 ? 'th ws-given' : undefined}>{i === 0 ? spell(c, f) : ''}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

// 聲調填空（中子音）：短音列＝第一聲 ✕、不加符號念第二聲（給好）、第五聲少用（打 x 的小字）；長音列＝不加符號念第一聲（給好）
function ToneFill({ l, pairs }: { l: Lesson; pairs: { c: string; vowel: string }[] }) {
  return (
    <>
      <p className="small">子音＋母音，依序加上聲調符號，寫出每一個聲調。灰色 ✕＝沒有這個聲調；(x)＝很少用，可以不寫。</p>
      <table className="ws-table ws-tones">
        <colgroup><col style={{ width: '9%' }} /><col style={{ width: '9%' }} />{TONES.map(t => <col key={t} />)}</colgroup>
        <thead><tr><th colSpan={2} />{TONES.map((t, k) => <th key={t}>{t}<div className="ws-mark">{k ? <MarkGlyph char={['', '่', '้', '๊', '๋'][k]} size={18} /> : <small>不加符號</small>}</div></th>)}</tr></thead>
        <tbody>
          {pairs.map(({ c, vowel }) => {
            const v = l.vowels.find(x => x.id === vowel)
            if (!v) return null
            return [
              <tr key={c + vowel + 's'} className="ws-short">
                <th rowSpan={2} className="th ws-c">{c}</th><th className="ws-kind">短音</th>
                <td className="ws-x">✕</td><td className="th ws-given">{spell(c, v.short)}</td><td /><td /><td><small className="muted">(x)</small></td>
              </tr>,
              <tr key={c + vowel + 'l'} className="ws-long">
                <th className="ws-kind">長音</th>
                <td className="th ws-given">{spell(c, v.long)}</td><td /><td /><td /><td />
              </tr>,
            ]
          })}
        </tbody>
      </table>
    </>
  )
}

// 判斷聲調：圈子音類型、長短母音，寫聲調符號與念第幾聲
function ToneJudge({ words }: { words: Extract<Worksheet, { kind: 'toneJudge' }>['words'] }) {
  return (
    <>
      <p className="small">看每個字：圈出子音是中子音還是高子音、母音是長還是短，寫出聲調符號（沒有就寫「無」），最後寫出念第幾聲。</p>
      <table className="ws-table ws-judge">
        <thead><tr><th>字</th><th>子音</th><th>母音</th><th>聲調符號</th><th>念第幾聲</th></tr></thead>
        <tbody>
          {words.map(w => (
            <tr key={w.thai}>
              <th><span className="th ws-word">{w.thai}</span>{w.zh && <small className="muted">　{w.zh}</small>}</th>
              <td className="ws-circle">中　　高</td><td className="ws-circle">長　　短</td><td /><td>第＿＿聲</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

// 拆字：一個音節一列（字那一格合併），示範題直接印答案
function Split({ words }: { words: Extract<Worksheet, { kind: 'split' }>['words'] }) {
  return (
    <>
      <p className="small">把生活中常見的字拆開：每個音節寫出子音、母音（用 - 代表子音的位置）、聲調符號（沒有就寫「無」）和念第幾聲。第一個字是示範。</p>
      <table className="ws-table ws-split">
        <thead><tr><th>字</th><th>音節</th><th>子音</th><th>母音</th><th>聲調符號</th><th>念第幾聲</th></tr></thead>
        <tbody>
          {words.flatMap(w => w.parts.map((p, i) => (
            <tr key={w.thai + i} className={i === 0 ? 'ws-first' : undefined}>
              {i === 0 && <th rowSpan={w.parts.length}><div className="th ws-word">{w.thai}</div><small className="muted">{w.zh}</small></th>}
              {w.demo ? <>
                <td className="th ws-given">{p.syl}</td><td className="th ws-given">{p.c}</td><td className="th ws-given">{p.v}</td>
                <td className="ws-given">{p.m ? <span className="ws-inline-mark"><MarkGlyph char={p.m} size={16} /></span> : '無'}</td><td className="ws-given">第 {p.t} 聲</td>
              </> : <><td /><td /><td /><td /><td>第＿＿聲</td></>}
            </tr>
          )))}
        </tbody>
      </table>
    </>
  )
}

const TITLE: Record<Worksheet['kind'], string> = { spell: '拼字表', toneFill: '聲調填空', toneJudge: '判斷聲調', split: '拆字' }

export default function LessonWorksheets({ l }: { l: Lesson }) {
  return <>{(l.worksheets ?? []).map((w, i) => (
    <section className="h-sheet ws" key={i}>
      <Name />
      <h2>L{l.number} 作業　{TITLE[w.kind]}</h2>
      {w.kind === 'spell' && <Spell l={l} consonants={w.consonants} />}
      {w.kind === 'toneFill' && <ToneFill l={l} pairs={w.pairs} />}
      {w.kind === 'toneJudge' && <ToneJudge words={w.words} />}
      {w.kind === 'split' && <Split words={w.words} />}
    </section>
  ))}</>
}
