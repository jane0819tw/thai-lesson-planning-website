import type { Diagram } from '../types'

// 講義風格的組成圖：色塊 ＋ 色塊 … ＝ 單字，每個色塊下方列出分類。
// showTitle：和其他說明卡排在同一區塊時（L1 基本概念），卡片自己顯示標題
export default function DiagramView({ d, showTitle }: { d: Diagram; showTitle?: boolean }) {
  return (
    <article className="card diagram">
      {showTitle && <h3>{d.title}</h3>}
      <p>{d.intro}</p>
      <div className="dg-row">
        {d.tiles.map(t => (
          <div className={`dg-col${t.wide ? ' wide' : ''}`} key={t.label}>
            <div className={`dg-tile ${t.color}${t.dashed ? ' dashed' : ''}`}>
              {t.label}{t.count && <><br /><span className={t.count.length > 5 ? 'dg-count sm' : 'dg-count'}>{t.count}</span></>}
            </div>
            <ul className="dg-sub">
              {t.sub.map((x, i) => (
                <li key={i} className={x.i ? 'indent' : ''}>{x.b && <strong>{x.b}</strong>}{x.t}{x.th && <> <span className="th">{x.th}</span></>}</li>
              ))}
            </ul>
          </div>
        ))}
        <div className="dg-eq" aria-hidden="true"><span /><span /></div>
        <div className="dg-col dg-result">
          <div className="dg-tile purple">{d.result}</div>
        </div>
      </div>
    </article>
  )
}
