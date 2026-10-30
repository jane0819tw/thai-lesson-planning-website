import type { ClusterIntroConfig, WordItem } from '../types'
import SpeakButton from './SpeakButton'
import VowelText from './VowelText'

// 拆法用「＋」分段：子音照常顯示，母音、聲調符號用 VowelText（- ＝ อ 的位置，灰色）；「＝」後面是整個字的念法，照常顯示
const Parts = ({ parts }: { parts: string }) => {
  const [main, ...rest] = parts.split('＝')
  return <>{main.split('＋').map((seg, i) => <span key={i}>{i > 0 && '＋'}{/^[ก-ฮ]+$/.test(seg) ? seg : <VowelText form={seg} />}</span>)}{rest.map(r => '＝' + r)}</>
}

// 複合子音（對應講義 L13-1）：左邊 C1｜C2｜組合表（講義劃掉的組合加刪除線），右邊音節結構圖＋規則句；
// 下面是例字拆解表（例字｜中文｜拆法），列底色同組合表的 C1 分組。
export default function ClusterIntro({ config, vocab, showZh }: { config: ClusterIntroConfig; vocab: WordItem[]; showZh: boolean }) {
  return (
    <>
      <article className="card vintro">
        <div className="tablewrap cl-wrap">
          <table className="cltable">
            <thead><tr><th>C1</th><th>C2</th><th>組合</th></tr></thead>
            <tbody>
              {config.rows.map((r, i) => (
                <tr key={r.c1} className={'cl-' + r.tint}>
                  <th scope="row" className="th">{r.c1}<small>（{r.group}）</small></th>
                  {i === 0 && <td className="th cl-c2" rowSpan={config.rows.length}>{config.c2.map(c => <div key={c}>{c}</div>)}</td>}
                  <td className="th cl-combos">
                    {r.combos.map((c, k) => <span key={c}>{k > 0 && '、'}{r.crossed?.includes(c) ? <s title="不存在的組合">{c}</s> : c}</span>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="fintro-side">
          <figure className="vpos syl cl" aria-label="音節結構：C1、C2 兩個子音連在一起，母音和聲調符號加在 C2 上，最後是尾音">
            <div className="vp tone">聲調符號</div>
            <div className="vp vow vtop">母音</div>
            <div className="vp vow left">母音</div>
            <div className="vp cons c1">C1</div>
            <div className="vp cons">C2</div>
            <div className="vp vow right">母音</div>
            <div className="vp fin">尾音</div>
            <div className="vp vow bottom">母音</div>
          </figure>
          <ul className="cl-rules">{config.rules.map(t => <li key={t}>{t}</li>)}</ul>
        </div>
      </article>
      <article className="card">
        <h3>例字拆解</h3>
        <div className="tablewrap">
          <table className="tone clwords">
            <tbody>
              {config.words.map(w => {
                const v = vocab.find(x => x.thai === w.thai)
                return (
                  <tr key={w.thai}>
                    <td className={'th cl-w cl-' + w.tint}>{w.thai}<SpeakButton text={w.thai} audioUrl={v?.audioUrl} /></td>
                    <td className="cl-zh">{showZh && v?.zh}</td>
                    <td className="th cl-parts"><Parts parts={w.parts} /></td>
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
