import type { ToneTable } from '../types'
import SpeakButton from './SpeakButton'
import { speakSequence } from '../audio/speak'

const COLS = ['第一聲', '第二聲', '第三聲', '第四聲', '第五聲']
const isNote = (s: string) => s === 'x' || s === '(x)' || s.includes('不發音') || s.startsWith('用')
const isBlank = (s: string) => s === ''
const clean = (cell: string) => cell.replace(/\s*\(x\)/, '')

const tintOf = (label: string, tint: ToneTable['tint']) => tint === 'long' ? 'long' :  label.includes('短母音') ? 'short' : label.includes('長母音') ? 'long' : undefined

export default function ToneTableView({ table }: { table: ToneTable }) {
  const grouped = table.rows.some(r => r.group)
  // 相鄰同 group 的列合併：第一列記下要跨幾列，其餘列不畫這一格
  const span = table.rows.map((r, i) => {
    if (!grouped || (i > 0 && table.rows[i - 1].group === r.group)) return 0
    let n = 1
    while (table.rows[i + n]?.group === r.group) n++
    return n
  })
  const rowClass = (r: ToneTable['rows'][number]) => [r.fill && 'fill', table.tint && tintOf(r.label, table.tint)].filter(Boolean).join(' ') || undefined
  return (
    <div className="tablewrap">
      <table className={table.corner ? 'tone corner' : 'tone'}>
        {!table.corner && table.title && <caption>{table.title}</caption>}
        <thead><tr>{table.corner ? <th className="corner-title" colSpan={grouped ? 2 : 1}>{table.title}</th> : <th colSpan={grouped ? 2 : 1} />}{COLS.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {table.rows.map((r, ri) => (
            <tr key={ri} className={rowClass(r)}>
              {span[ri] > 0 && <th className="group" rowSpan={span[ri]}>{r.group}</th>}
              <th className="th">
                {r.label}
                <button className="playall" aria-label={`依序播放 ${r.label} 第一聲到第五聲`}
                  onClick={() => void speakSequence(r.cells.filter(c => !isNote(c) && !isBlank(c)).map(clean), 0)}>▶ 一到五聲</button>
              </th>
              {r.cells.map((cell, i) => (
                <td key={i} className={isBlank(cell) ? undefined : isNote(cell) ? 'na' : 'th big3'}>
                  {r.fill && !isNote(cell) ? <span className="fillword">{cell}</span> : cell}
                  {!isNote(cell) && !isBlank(cell) && <SpeakButton text={clean(cell)} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.note && <p className="small muted tnote">{table.note}</p>}
    </div>
  )
}
