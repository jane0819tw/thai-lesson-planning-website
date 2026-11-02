import { useState } from 'react'
import type { Numeral } from '../types'
import SpeakButton from './SpeakButton'
import LetterDialog from './LetterDialog'

// 大寫數字對照表（對應講義 L18）：每 5 個數字一張表，三列是 大寫數字（淺黃底）｜阿拉伯數字｜念法；
// 點大寫數字打開筆順視窗（不發音；念法那一格有喇叭）（筆順資料在 data/strokes/chars/๑.json…）
export default function NumeralTable({ numerals }: { numerals: Numeral[] }) {
  const [open, setOpen] = useState<Numeral | null>(null)
  const chunks = numerals.reduce<Numeral[][]>((acc, n, i) => { if (i % 5 === 0) acc.push([]); acc[acc.length - 1].push(n); return acc }, [])
  return (
    <article className="card">
      <p className="muted small">點大寫數字看筆順。</p>
      {chunks.map((ns, k) => (
        <div className="tablewrap" key={k}>
          <table className="tone numtable">
            <tbody>
              <tr>
                <th scope="row">大寫數字</th>
                {ns.map(n => <td key={n.digit} className="th num-digit"><button className="clickable" onClick={() => setOpen(n)} aria-label={`查看 ${n.digit} 的筆順`}>{n.digit}</button></td>)}
              </tr>
              <tr>
                <th scope="row">阿拉伯數字</th>
                {ns.map(n => <td key={n.digit} className="num-arabic">{n.arabic}</td>)}
              </tr>
              <tr>
                <th scope="row">念法</th>
                {ns.map(n => <td key={n.digit} className="th num-word">{n.word}<SpeakButton text={n.word} /></td>)}
              </tr>
            </tbody>
          </table>
        </div>
      ))}
      {open && <LetterDialog char={open.digit} caption={`${open.arabic}　${open.word}`} onClose={() => setOpen(null)} />}
    </article>
  )
}
