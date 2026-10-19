import VowelText from './VowelText'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../data/useCatalog'
import type { Consonant } from '../types'
import LetterDialog from './LetterDialog'

// 講義「總表對照」的聲音順序與注音
const SOUNDS: [string, string][] = [
  ['bp', 'ㄅ'], ['p', 'ㄆ'], ['m', 'ㄇ'], ['f', 'ㄈ'], ['dt', 'ㄉ'], ['t', 'ㄊ'], ['n', 'ㄋ'], ['l', 'ㄌ'],
  ['g', 'ㄍ'], ['k', 'ㄎ'], ['h', 'ㄏ'], ['ch', 'ㄔ'], ['j', 'ㄗ'], ['s', 'ㄙ'], ['y', 'ㄧ'], ['w', 'ㄨ'],
  ['/', ''], ['b', ''], ['d', ''], ['ng', ''], ['r', ''],
]
const GROUP_ZH = { mid: '中', high: '高', lcp: '低 LCp', lcs: '低 LCs' } as const

export default function ChartPage() {
  const { consonants, vowels } = useCatalog()
  const [open, setOpen] = useState<Consonant | null>(null)
  return (
    <>
      <p><Link to="/reading">← 認字課程</Link></p>
      <h1>子音・母音總表</h1>
      <p className="muted">點任一個字母可以看讀音與筆順。內容會隨課程增加。</p>

      <h2>子音（依發音分組）</h2>
      <div className="tablewrap">
        <table className="tone">
          <thead><tr><th>發音</th><th>注音</th><th>子音（輩）</th></tr></thead>
          <tbody>
            {SOUNDS.map(([s, zhuyin]) => (
              <tr key={s}>
                <th>{s}</th><td>{zhuyin}</td>
                <td className="th">
                  {consonants.filter(c => c.sound === s).map(c => (
                    <button key={c.id} className={`chartchar clickable g-${c.group}`} onClick={() => setOpen(c)}>{c.char}<small>{GROUP_ZH[c.group]}</small></button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>母音（長短音）</h2>
      <div className="tablewrap">
        <table className="tone">
          <thead><tr><th>音標</th><th>短音</th><th>長音</th><th>例字</th></tr></thead>
          <tbody>
            {vowels.map(v => (
              <tr key={v.id}>
                <th>{v.ipa}</th>
                <td className="th big3">{v.short ? <VowelText form={v.short} /> : '—'}</td>
                <td className="th big3">{v.long ? <VowelText form={v.long} /> : '—'}</td>
                <td className="th">{v.words.slice(0, 3).map(w => w.thai).join('　')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <LetterDialog char={open.char} info={open} onClose={() => setOpen(null)} />}
    </>
  )
}
