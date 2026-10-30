import type { GroupingUnit, WordItem } from '../types'
import SpeakButton from './SpeakButton'

// **文字**＝講義的紅字（例 **ห**C2V(F)）；\n 另起一行
const red = (s: string) => s.split('\n').map((line, k) => (
  <div key={k}>{line.split(/\*\*(.+?)\*\*/).map((t, i) => i % 2 ? <strong className="gp-red" key={i}>{t}</strong> : t)}</div>
))

// Grouping（對應講義 L15-1～L15-4）：上面是音節結構圖（C1｜C2 V (F)）＋第 1／第 2 個音節對照表，
// 下面是例字表（例字｜第1個音節-第2個音節｜意思），講義標紅的念法用紅字。
export default function GroupingView({ g, vocab, showZh }: { g: GroupingUnit; vocab: WordItem[]; showZh: boolean }) {
  return (
    <>
      {g.subtitle && <p className="gp-sub">{g.subtitle}</p>}
      <article className="card vintro">
        <figure className="gp-syl" aria-label={`音節結構：第 1 個音節 C1${g.c1 ? `（${g.c1}）` : ''}，第 2 個音節 C2${g.c2 ? `（${g.c2}）` : ''}＋母音＋尾音`}>
          <div className="gp-box">
            <small>子音</small><b>C1</b><small>{g.c1}</small>
          </div>
          <div className="gp-box gp-wide">
            <div><small>子音</small><b>C2</b><small>{g.c2}</small></div>
            <div><small>母音</small><b>V</b><small /></div>
            <div><small>尾音</small><b>(F)</b><small /></div>
          </div>
          {g.caption && <figcaption>{g.caption}</figcaption>}
        </figure>
        <div className="tablewrap gp-wrap">
          <table className="tone gp-table">
            <thead><tr><th /><th>第1個音節</th><th>第2個音節</th></tr></thead>
            <tbody>
              <tr><th scope="row">子音</th>{g.consonants.length === 1 ? <td colSpan={2}>{g.consonants[0]}</td> : g.consonants.map(c => <td key={c}>{c}</td>)}</tr>
              <tr><th scope="row">母音</th><td className="th">ะ</td><td>V</td></tr>
              <tr><th scope="row">尾音</th><td>/</td><td>(F)</td></tr>
              <tr className="gp-pron"><th scope="row">音節發音</th>{g.pron.map((p, i) => <td key={i}>{red(p)}</td>)}</tr>
              {g.note && <tr><td colSpan={3}>{red(g.note)}</td></tr>}
            </tbody>
          </table>
        </div>
      </article>
      <article className="card">
        <h3>例字</h3>
        <div className="tablewrap">
          <table className="tone clwords gp-words">
            <thead><tr><th>例字</th><th>第1個音節-第2個音節</th><th>意思</th></tr></thead>
            <tbody>
              {g.words.map(w => {
                const v = vocab.find(x => x.thai === w.thai)
                return (
                  <tr key={w.thai}>
                    <td className="th cl-w">{w.thai}<SpeakButton text={w.thai} audioUrl={v?.audioUrl} /></td>
                    <td className={'th cl-parts' + (w.mark ? ' gp-red' : '')}>{w.split}</td>
                    <td className="cl-zh">{showZh && v?.zh}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </article>
    </>
  )
}
