import { Fragment } from 'react'
import type { VowelShift, VowelShiftTable, WordItem } from '../types'
import SpeakButton from './SpeakButton'
import VowelText from './VowelText'

// 母音加尾音的變形表（同講義：母音｜加尾音｜例字，左右兩組對照）。
// 加尾音的寫法用 x 標尾音位置，x 前面照一般母音顯示（- 換成灰色 อ）；寫法有變的格子用橘底。
// 一種母音有兩種變形時分成兩列：下一列整邊填 null＝和上一列合併成一格，vowel 留空＝只合併母音那一格。
const FinalForm = ({ f }: { f: string }) => {
  const i = f.indexOf('x')
  return <>{i < 0 ? <VowelText form={f} /> : <><VowelText form={f.slice(0, i)} /><span className="vx">x</span>{f.slice(i + 1)}</>}</>
}

export default function VowelShiftView({ table, vocab, showZh }: { table: VowelShiftTable; vocab: WordItem[]; showZh: boolean }) {
  // 每一邊、每一格往下要跨幾列（0＝被上一列合併，不畫）
  const spanOf = (side: 0 | 1, merged: (s: VowelShift | null) => boolean) => table.rows.map((r, i) => {
    if (merged(r[side])) return 0
    let n = 1
    while (table.rows[i + n] && merged(table.rows[i + n][side])) n++
    return n
  })
  const spans = ([0, 1] as const).map(side => ({ side: spanOf(side, s => s === null), vowel: spanOf(side, s => s === null || s.vowel === '') }))

  const cells = (s: VowelShift | null, side: 0 | 1, i: number) => s && (
    <>
      {spans[side].vowel[i] > 0 && <td className={side ? 'th vs-v vs-split' : 'th vs-v'} rowSpan={spans[side].vowel[i]}><VowelText form={s.vowel} /></td>}
      <td className={s.changed ? 'th vs-f changed' : 'th vs-f'} rowSpan={spans[side].side[i]}>
        {s.finals?.length ? s.finals.map((f, k) => <Fragment key={f}>{k > 0 && <span className="vs-or">；</span>}<FinalForm f={f} /></Fragment>) : <span className="muted">/</span>}
      </td>
      <td className="vs-w" rowSpan={spans[side].side[i]}>
        {s.words.length ? s.words.map(t => {
          const w = vocab.find(x => x.thai === t)
          return (
            <div className="vs-word" key={t}>
              <span className="th">{w?.star ? '＊' : ''}{t}</span><SpeakButton text={t} audioUrl={w?.audioUrl} />
              {showZh && w?.zh && <small className="muted">{w.zh}</small>}
            </div>
          )
        }) : <span className="muted">/</span>}
        {s.note && <p className="small muted vs-note">{s.note}</p>}
      </td>
    </>
  )
  return (
    <article className="card">
      {table.title && <h3>{table.title}</h3>}
      <div className="tablewrap">
        <table className="tone vshift">
          <thead><tr>{table.heads.map((h, k) => <Fragment key={h}><th className={k ? 'vs-split' : undefined}>{h}</th><th>加尾音</th><th>例字</th></Fragment>)}</tr></thead>
          <tbody>
            {table.rows.map(([a, b], i) => <tr key={i}>{cells(a, 0, i)}{cells(b, 1, i)}</tr>)}
          </tbody>
        </table>
      </div>
    </article>
  )
}
