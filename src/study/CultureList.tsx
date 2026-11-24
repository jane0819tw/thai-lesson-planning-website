import { Rom } from '../video/Rom'
import type { VideoCulture } from '../video/types'

/** 文化補充：金字塔（左邊職務、右邊官階與稱呼）＋詞條列表。影片頁、投影片、講義共用 */
/** 每個職務一個底色；右邊可擔任這個職務的官階用同一個底色 */
const TIER_COLORS = ['#f9d5d3', '#f6dcb8', '#f1e8a8', '#c8e6b0', '#bcd8f5', '#e1d3f3', '#e2e2e2']

/** part：all＝全部（影片頁、講義）；main＝金字塔與詞條；table＝只有小表（投影片拆兩頁用） */
export function CultureList({ c, showRom, part = 'all' }: { c: VideoCulture; showRom: boolean; part?: 'all' | 'main' | 'table' }) {
  const pyr = part === 'table' ? [] : c.pyramid ?? []
  const n = pyr.length
  const colorOf = (i: number) => (pyr[i]?.group === 'base' ? '#ece6dc' : TIER_COLORS[i % TIER_COLORS.length])
  return (
    <>
      {n > 0 && (
        <div className="spyr">
          <div className="spyr-head"><span>職務</span><span>官階（縮寫）→ 稱呼</span><span>職務內容</span></div>
          {pyr.map((t, i) => (
            <div key={t.th} className={`spyr-row g-${t.group ?? 'officer'}`} style={{ '--tier': colorOf(i) } as React.CSSProperties}>
              <div className="spyr-cell">
                <div className="spyr-bar" style={{ width: `${n > 1 ? 54 + (46 * i) / (n - 1) : 100}%` }}>
                  <span className="th">{t.th}</span>
                  {showRom && t.rom && <Rom text={t.rom} />}
                  <span className="spyr-zh">{t.zh}</span>
                  {t.full && <span className="spyr-full th">（{t.full}）</span>}
                </div>
              </div>
              <ul className="spyr-job">
                {t.ranks.map(r => {
                  const j = r.also ? pyr.findIndex(x => x.th === r.also) : -1
                  const bg = j >= 0 ? { background: `linear-gradient(90deg, ${colorOf(j)} 50%, ${colorOf(i)} 50%)` } : undefined
                  return (
                    <li key={r.rank}>
                      <span className="spyr-chip" style={bg}>
                        <span className="th">{r.rank}</span>
                        {(r.abbr || r.zh) && <span className="spyr-rank">（{[r.abbr, r.zh].filter(Boolean).join('・')}）</span>}
                      </span>
                      {r.call && <> → <b className="th">{r.call}</b>{showRom && r.callRom && <> <Rom text={r.callRom} /></>}</>}
                    </li>
                  )
                })}
              </ul>
              <p className="spyr-duty">
                {t.duty}
                {t.ranks.filter(r => r.entry).map(r => <span key={r.rank} className="spyr-entry">{r.entry}</span>)}
              </p>
            </div>
          ))}
          <p className="spyr-legend small">
            <span className="g-officer">左邊色線：警官（สัญญาบัตร）</span>
            <span className="g-nco">士官・警員（ประทวน）</span>
            <span>同一列底色＝可以擔任這個職務的官階；兩色各半＝兩個職務都可能</span>
          </p>
        </div>
      )}
      {c.table && part !== 'main' && (
        <div className="sctable">
          <h3>{c.table.title}</h3>
          <table>
            <thead><tr>{c.table.head.map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{c.table.rows.map((r, i) => <tr key={i}>{r.map((x, j) => <td key={j}>{x}</td>)}</tr>)}</tbody>
          </table>
          {c.table.note && <p className="small">{c.table.note}</p>}
        </div>
      )}
      {!!c.items?.length && part !== 'table' && (
        <dl className="sculture">
          {c.items.map(it => (
            <div key={it.th}>
              <dt><span className="th">{it.th}</span>{showRom && it.rom && <> <Rom text={it.rom} /></>}<span className="sculture-zh">{it.zh}</span></dt>
              {it.explain && <dd>{it.explain}</dd>}
            </div>
          ))}
        </dl>
      )}
    </>
  )
}
