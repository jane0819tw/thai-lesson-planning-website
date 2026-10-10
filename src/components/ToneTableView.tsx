import type { ToneTable } from '../types'
import SpeakButton from './SpeakButton'

const COLS = ['第一聲', '第二聲', '第三聲', '第四聲', '第五聲']
const isNote = (s: string) => s === 'x' || s === '(x)' || s.includes('不發音') || s.startsWith('用')

export default function ToneTableView({ table }: { table: ToneTable }) {
  return (
    <div className="tablewrap">
      <table className="tone">
        <caption>{table.title}</caption>
        <thead><tr><th />{COLS.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {table.rows.map(r => (
            <tr key={r.label}>
              <th className="th">{r.label}</th>
              {r.cells.map((cell, i) => (
                <td key={i} className={isNote(cell) ? 'na' : 'th big3'}>
                  {cell}
                  {!isNote(cell) && <SpeakButton text={cell.replace(/\s*\(x\)/, '')} />}
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
