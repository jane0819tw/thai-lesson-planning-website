import { useState } from 'react'
import type { Choice } from '../types'

// 二選一表格（例：哪一個拼法正確？）：點一個寫法就顯示對錯，正確的那一格標綠
export default function ChoiceTable({ choices }: { choices: Choice[] }) {
  const [picked, setPicked] = useState<(number | undefined)[]>([])
  const [all, setAll] = useState(false)
  const pick = (q: number, o: number) => setPicked(p => { const n = [...p]; n[q] = o; return n })
  const cls = (c: Choice, q: number, o: number) => {
    const shown = all || picked[q] !== undefined
    if (!shown) return 'ch-opt th'
    if (o === c.answer) return 'ch-opt th right'
    return picked[q] === o ? 'ch-opt th wrong' : 'ch-opt th'
  }
  return (
    <>
      <table className="choice">
        <thead><tr><th /><th>A</th><th>B</th></tr></thead>
        <tbody>
          {choices.map((c, q) => (
            <tr key={q}>
              <th scope="row">{q + 1}</th>
              {c.options.map((opt, o) => (
                <td key={o}>
                  <button className={cls(c, q, o)} onClick={() => pick(q, o)} aria-label={`第 ${q + 1} 題選 ${opt}`}>
                    {opt}
                    {(all || picked[q] !== undefined) && o === c.answer && <span className="ch-mark">✓</span>}
                    {picked[q] === o && o !== c.answer && <span className="ch-mark">✗</span>}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ch-tools">
        <button className="btn" onClick={() => setAll(true)}>顯示答案</button>
        <button className="btn" onClick={() => { setAll(false); setPicked([]) }}>重來</button>
      </div>
    </>
  )
}
