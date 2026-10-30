import type { FinalsIntroConfig } from '../types'

// 尾音總表＋音節結構圖（對應講義：清尾音 5 音 10 字、濁尾音 3 音 26 字，以及依長音／短音的規則）
// finalsIntro: true 時用清尾音的預設表（L10）
const CLEAR: FinalsIntroConfig = {
  kind: '清',
  rule: 'long',
  rows: [
    { sound: 'm', main: 'ม' },
    { sound: 'n', main: 'น', others: 'ณ ล ฬ ร ญ' },
    { sound: 'y', main: 'ย' },
    { sound: 'w', main: 'ว' },
    { sound: 'ng', main: 'ง' },
  ],
}

export default function FinalsIntro({ config = CLEAR }: { config?: FinalsIntroConfig }) {
  const count = (s?: string) => s ? s.split(/\s+/).length : 0
  const letters = config.rows.reduce((n, r) => n + ('lines' in r ? r.lines.reduce((m, l) => m + count(l), 0) : 1 + count(r.others)), 0)
  return (
    <article className="card vintro">
      <div className="fintro">
        <div className="fintro-count">{config.rows.length} 音<br />{letters} 字</div>
        <table className="ftable">
          <tbody>
            {config.rows.map(r => (
              <tr key={r.sound}>
                <th scope="row">{r.sound}</th>
                {'lines' in r ? (
                  // 分組：一組一列，第一列的第一個字母當主要字母（底線）
                  <td className="th flines">
                    {r.lines.map((l, i) => (
                      <div key={l}>{i === 0 ? <><span className="fmain">{l.split(/\s+/)[0]}</span>{l.split(/\s+/).slice(1).map(ch => ' ' + ch).join('')}</> : l}</div>
                    ))}
                  </td>
                ) : (
                  <td className="th"><span className={r.others ? 'fmain' : undefined}>{r.main}</span>{r.others && <span className="fothers">（{r.others}）</span>}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="fintro-side">
        <figure className="vpos syl" aria-label="音節結構：子音的上下左右是母音，上方是聲調符號，前面可加 ห，最後是尾音">
          <div className="vp tone">聲調符號</div>
          <div className="vp vow vtop">母音</div>
          <div className="vp vow left">母音</div>
          <div className="vp h th">ห</div>
          <div className="vp cons">子音</div>
          <div className="vp vow right">母音</div>
          <div className="vp fin">尾音</div>
          <div className="vp vow bottom">母音</div>
        </figure>
        <p className="fintro-rule">有{config.kind}尾音，不論長短音，<br /><strong>follow {config.rule === 'long' ? '長' : '短'}音的規則</strong>。</p>
      </div>
    </article>
  )
}
