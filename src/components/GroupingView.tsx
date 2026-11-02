import type { ReactNode } from 'react'
import type { GroupingUnit, GroupingWord, WordItem } from '../types'
import SpeakButton from './SpeakButton'

// **文字**＝講義的紅字（例 **ห**C2V(F)）；\n 另起一行
const red = (s: string) => s.split('\n').map((line, k) => (
  <div key={k}>{line.split(/\*\*(.+?)\*\*/).map((t, i) => i % 2 ? <strong className="gp-red" key={i}>{t}</strong> : t)}</div>
))

// 例字依 group 分成好幾張表（相鄰同 group 一張；沒填 group 的標題叫「例字」）
const groups = (ws: GroupingWord[]) => ws.reduce<[string, GroupingWord[]][]>((acc, w) => {
  const last = acc[acc.length - 1]
  if (last && last[0] === (w.group ?? '')) last[1].push(w)
  else acc.push([w.group ?? '', [w]])
  return acc
}, [])

const thai = (s: string) => /[\u0E00-\u0E7F]/.test(s)

// Grouping（對應講義 L15-1～L15-4、L16 Double Grouping／特殊 ห）：上面是音節結構圖（預設 C1｜C2 V (F)，可用 boxes 自訂）＋各音節對照表，
// 下面是例字表（例字｜第1個音節-第2個音節…｜意思），講義標紅的念法用紅字。
export default function GroupingView({ g, vocab, showZh, top }: { g: GroupingUnit; vocab: WordItem[]; showZh: boolean; top?: ReactNode }) {  // top：排在副標下面、結構圖上面的說明卡
  const n = g.pron.length
  const boxes = g.boxes ?? [
    { cells: [{ label: '子音', big: 'C1', sub: g.c1 }] },
    { cells: [{ label: '子音', big: 'C2', sub: g.c2 }, { label: '母音', big: 'V' }, { label: '尾音', big: '(F)' }] },
  ]
  const vowels = g.vowels ?? ['ะ', 'V']
  const finals = g.finals ?? ['/', '(F)']
  const nextNull = (i: number) => vowels[i] === null  // 子音格往下合併到母音列
  const label = boxes.map(b => b.cells.map(c => c.big + (c.sub ? `（${c.sub}）` : '')).join(' ')).join('｜')
  return (
    <>
      {g.subtitle && <p className="gp-sub">{g.subtitle}</p>}
      {top}
      <article className={"card vintro" + (n > 2 ? " gp-3" : "")}>
        {(g.heading || g.body) && (
          <div className="gp-head">
            {g.heading && <h3>{g.heading}</h3>}
            {g.body && <ul>{g.body.split('\n').map((l, i) => <li key={i}>{l.split(/\*\*(.+?)\*\*/).map((t, k) => k % 2 ? <strong className="gp-red" key={k}>{t}</strong> : t)}</li>)}</ul>}
          </div>
        )}
        <figure className="gp-syl" aria-label={`音節結構：${label}`}>
          {boxes.map((b, i) => (
            <div key={i} className={'gp-box' + (b.cells.length > 1 ? ' gp-wide' : '') + (b.pink ? ' gp-pink' : '')}>
              {b.cells.map((c, k) => <div key={k}><small>{c.label}</small><b className={thai(c.big) ? 'th' : undefined}>{c.big}</b><small>{c.sub}</small></div>)}
            </div>
          ))}
          {g.caption && <figcaption>{g.caption}</figcaption>}
        </figure>
        <div className="tablewrap gp-wrap">
          <table className="tone gp-table">
            <thead><tr><th />{Array.from({ length: n }, (_, i) => <th key={i}>第{i + 1}個音節</th>)}</tr></thead>
            <tbody>
              {!g.pronOnly && <>
                <tr><th scope="row">子音</th>{g.consonants.length === 1 ? <td colSpan={n}>{red(g.consonants[0])}</td> : g.consonants.map((c, i) => <td key={i} className={thai(c) ? 'th' : undefined} rowSpan={nextNull(i) ? 2 : undefined}>{red(c)}</td>)}</tr>
                <tr><th scope="row">母音</th>{vowels.map((v, i) => v === null ? null : <td key={i} className={thai(v) ? 'th' : undefined}>{red(v)}</td>)}</tr>
                <tr><th scope="row">尾音</th>{finals.map((f, i) => <td key={i}>{f}</td>)}</tr>
              </>}
              <tr className="gp-pron"><th scope="row">音節發音</th>{g.pron.map((p, i) => <td key={i}>{red(p)}</td>)}</tr>
              {g.note && <tr><td colSpan={n + 1}>{red(g.note)}</td></tr>}
            </tbody>
          </table>
        </div>
      </article>
      {groups(g.words).map(([title, words], gi) => (
        <article className="card" key={gi}>
          <h3>{title || '例字'}</h3>
          <div className="tablewrap">
            <table className="tone clwords gp-words">
              <thead><tr><th>例字</th><th>{Array.from({ length: n }, (_, i) => `第${i + 1}個音節`).join('-')}</th><th>意思</th></tr></thead>
              <tbody>
                {words.map(w => {
                  const v = vocab.find(x => x.thai === w.thai)
                  return (
                    <tr key={w.thai}>
                      <td className="th cl-w">{w.star && '＊'}{w.thai}<SpeakButton text={w.thai} audioUrl={v?.audioUrl} /></td>
                      <td className={'th cl-parts' + (w.mark ? ' gp-red' : '')}>{w.split}</td>
                      <td className="cl-zh">{showZh && v?.zh}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </article>
      ))}
    </>
  )
}
