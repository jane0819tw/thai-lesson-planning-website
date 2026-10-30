import type { SanskritVowel, WordItem } from '../types'
import SpeakButton from './SpeakButton'

// 梵文來的母音（對應講義 L14）：字母｜念法｜例字｜中文［分音節念法］，一個字母有幾種念法就幾列、字母那一格合併；
// 沒有例字＝講義的「/」，現今不使用的字母後兩格合併成一格。
export default function SanskritVowels({ vowels, vocab, showZh }: { vowels: SanskritVowel[]; vocab: WordItem[]; showZh: boolean }) {
  return (
    <article className="card">
      <h3>梵文來的母音</h3>
      <div className="tablewrap">
        <table className="tone sktable">
          <tbody>
            {vowels.flatMap(v => v.readings.map((r, i) => {
              const w = r.word ? vocab.find(x => x.thai === r.word) : undefined
              return (
                <tr key={v.char + r.sound}>
                  {i === 0 && <th scope="row" className={v.readings.some(x => x.mark) ? 'th sk-char sk-mark' : 'th sk-char'} rowSpan={v.readings.length}>{v.char}</th>}
                  <td className={r.mark ? 'th sk-sound sk-mark' : 'th sk-sound'}>[{r.sound}]<SpeakButton text={r.sound} /></td>
                  {r.unused ? <td colSpan={2} className="sk-unused">現今不使用</td> : r.word ? (
                    <>
                      <td className="th sk-word">{r.word}<SpeakButton text={r.word} audioUrl={w?.audioUrl} /></td>
                      <td className="sk-zh">{showZh && w?.zh} {r.split && <span className="th">[{r.split}]</span>}</td>
                    </>
                  ) : <><td>/</td><td>/</td></>}
                </tr>
              )
            }))}
          </tbody>
        </table>
      </div>
    </article>
  )
}
