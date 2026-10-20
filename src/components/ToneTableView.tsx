import type { ToneTable } from '../types'
import SpeakButton from './SpeakButton'
import { speakSequence } from '../audio/speak'

const COLS = ['第一聲', '第二聲', '第三聲', '第四聲', '第五聲']
const isNote = (s: string) => s === 'x' || s === '(x)' || s.includes('不發音') || s.startsWith('用')
const clean = (cell: string) => cell.replace(/\s*\(x\)/, '')

export default function ToneTableView({ table }: { table: ToneTable }) {
  return (
    <div className="tablewrap">
      <table className="tone">
        <caption>{table.title}</caption>
        <thead><tr><th />{COLS.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {table.rows.map(r => (
            <tr key={r.label}>
              <th className="th">
                {r.label}
                <button className="playall" aria-label={`依序播放 ${r.label} 第一聲到第五聲`}
                  onClick={() => void speakSequence(r.cells.filter(c => !isNote(c)).map(clean), 0)}>▶ 一到五聲</button>
              </th>
              {r.cells.map((cell, i) => (
                <td key={i} className={isNote(cell) ? 'na' : 'th big3'}>
                  {cell}
                  {!isNote(cell) && <SpeakButton text={clean(cell)} />}
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
