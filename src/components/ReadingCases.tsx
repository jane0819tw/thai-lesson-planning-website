import type { ReadingCaseTable, WordItem } from '../types'
import SpeakButton from './SpeakButton'
import ZoomImage from './ZoomImage'

// **文字**＝講義的紅字；\n 另起一行
const red = (s: string) => s.split('\n').map((line, k) => (
  <div key={k}>{line.split(/\*\*(.+?)\*\*/).map((t, i) => i % 2 ? <strong className="gp-red" key={i}>{t}</strong> : t)}</div>
))

// 框裡的大字：**文字**＝紅字、不分行
const redInline = (s: string) => s.split(/\*\*(.+?)\*\*/).map((t, i) => i % 2 ? <span className="gp-red" key={i}>{t}</span> : t)

// 情境讀法表（對應講義 L19 a. Cรร(F) 讀法、b. ร 遇到特殊結合、ร 已經扮演的角色）：
// 情境｜讀法｜例字｜[念法]｜意思，一個情境的例字一字一列，情境、讀法兩格往下合併；講義標紅的念法用紅字。
export default function ReadingCases({ t, vocab, showZh }: { t: ReadingCaseTable; vocab: WordItem[]; showZh: boolean }) {
  const hasRead = t.cases.some(c => c.reading)
  const hasPron = t.cases.some(c => c.words.some(w => w.read))
  return (
    <article className="card">
      {t.title && <h3>{t.title}</h3>}
      <div className="tablewrap">
        <table className="tone rc-table">
          <thead>
            <tr>
              <th>{red(t.caseHead ?? '情境')}</th>
              {hasRead && <th>{red(t.readHead ?? '讀法')}</th>}
              <th colSpan={hasPron ? 3 : 2}>範例</th>
            </tr>
          </thead>
          {t.cases.map((c, ci) => (
            <tbody key={ci}>
              {c.words.map((w, i) => {
                const v = vocab.find(x => x.thai === w.thai)
                return (
                  <tr key={w.thai}>
                    {i === 0 && <th scope="rowgroup" rowSpan={c.words.length} className="rc-case">{red(c.case)}{c.boxes && <div className="rc-boxes">{c.boxes.map((b, k) => (
                      <div key={k} className="gp-box gp-wide">{b.map((x, j) => <div key={j}><small>{x.label}</small><b className="th">{redInline(x.big)}</b></div>)}</div>
                    ))}</div>}{c.image && <ZoomImage className="rc-img" src={`${import.meta.env.BASE_URL}${c.image.src}`} alt={c.image.alt} />}</th>}
                    {i === 0 && hasRead && <td rowSpan={c.words.length} className="th rc-read">{red(c.reading ?? '')}</td>}
                    <td className="th cl-w">{w.thai}<SpeakButton text={w.thai} audioUrl={v?.audioUrl} /></td>
                    {hasPron && <td className={'th rc-pron' + (w.mark ? ' gp-red' : '')}>{w.read && `[${w.read}]`}</td>}
                    <td className="cl-zh">{showZh && v?.zh}</td>
                  </tr>
                )
              })}
            </tbody>
          ))}
        </table>
      </div>
      {t.note && <p className="muted small">{red(t.note)}</p>}
    </article>
  )
}
