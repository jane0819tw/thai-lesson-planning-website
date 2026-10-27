// 清尾音總表＋音節結構圖（對應講義：5 音 10 字、有清尾音時依長音規則）
const ROWS: [string, string, string?][] = [
  ['m', 'ม'],
  ['n', 'น', 'ณ ล ฬ ร ญ'],
  ['y', 'ย'],
  ['w', 'ว'],
  ['ng', 'ง'],
]

export default function FinalsIntro() {
  return (
    <article className="card vintro">
      <div className="fintro">
        <div className="fintro-count">5 音<br />10 字</div>
        <table className="ftable">
          <tbody>
            {ROWS.map(([sound, main, others]) => (
              <tr key={sound}>
                <th scope="row">{sound}</th>
                <td className="th"><span className={others ? 'fmain' : undefined}>{main}</span>{others && <span className="fothers">（{others}）</span>}</td>
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
        <p className="fintro-rule">有清尾音，不論長短音，<br /><strong>follow 長音的規則</strong>。</p>
      </div>
    </article>
  )
}
