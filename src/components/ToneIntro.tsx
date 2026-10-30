import { useState } from 'react'
import LetterDialog from './LetterDialog'

// 聲調總覽：①聲調符號＋音高走向表 ②泰語與漢語的五度標記法對照圖。
const NAMES = ['第一聲', '第二聲', '第三聲', '第四聲', '第五聲']
const MARKS = ['', ' ่', ' ้', ' ๊', ' ๋']
const MARK_NAME = ['不加符號', 'ไม้เอก máai èek', 'ไม้โท máai too', 'ไม้ตรี máai dtrii', 'ไม้จัตวา máai jàt-dtà-waa']

interface Tone { zh: string; th?: string; rom?: string; pts: number[] }
const THAI: Tone[] = [
  { zh: '第一聲', th: 'เสียงสามัญ', rom: 'sǐang sǎa-man', pts: [3, 3] },
  { zh: '第二聲', th: 'เสียงเอก', rom: 'sǐang èek', pts: [2, 1] },
  { zh: '第三聲', th: 'เสียงโท', rom: 'sǐang too', pts: [4, 1] },
  { zh: '第四聲', th: 'เสียงตรี', rom: 'sǐang dtrii', pts: [4, 5] },
  { zh: '第五聲', th: 'เสียงจัตวา', rom: 'sǐang jàt-dtà-waa', pts: [1, 4] },
]
const ZH: Tone[] = [
  { zh: '一聲', rom: 'ā', pts: [5, 5] },
  { zh: '二聲', rom: 'á', pts: [3, 5] },
  { zh: '三聲', rom: 'ǎ', pts: [2, 1, 4] },
  { zh: '四聲', rom: 'à', pts: [5, 1] },
]

function Mini({ t, id, color = '#c2410c' }: { t: Tone; id: string; color?: string }) {
  const Y = (l: number) => 88 - (l - 1) * 16
  const pts = t.pts.map((l, k) => [34 + (52 * k) / (t.pts.length - 1), Y(l)])
  return (
    <svg viewBox="0 0 120 100" className="tmini" role="img" aria-label={`${t.zh} 音高 ${t.pts.join('→')}`}>
      <defs><marker id={id} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill={color} /></marker></defs>
      <line x1={14} x2={14} y1={Y(5) - 6} y2={Y(1) + 4} className="taxis" />
      {[1, 2, 3, 4, 5].map(l => <g key={l}><line x1={11} x2={17} y1={Y(l)} y2={Y(l)} className="taxis" /><text x={8} y={Y(l) + 4} textAnchor="end" className="tnum" style={{ fontSize: 10 }}>{l}</text></g>)}
      <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" markerEnd={`url(#${id})`} />
      <text x={pts[0][0] - 6} y={pts[0][1] + 4} textAnchor="end" className="tnum sm" style={{ fontSize: 12 }}>{t.pts[0]}</text>
      <text x={pts[pts.length - 1][0] + 8} y={pts[pts.length - 1][1] + 4} className="tnum sm" style={{ fontSize: 12 }}>{t.pts[t.pts.length - 1]}</text>
    </svg>
  )
}

function Chart({ title, tones, color }: { title: string; tones: Tone[]; color: string }) {
  const W = 640, H = 270, x0 = 50, bottom = 215
  const Y = (l: number) => bottom - (l - 1) * 40
  const slot = (W - x0 - 10) / tones.length
  const mid = 'zh' + color.slice(1)
  return (
    <figure className="tchart">
      {title && <figcaption>{title}</figcaption>}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        <defs>
          <marker id={mid} markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill={color} /></marker>
        </defs>
        {[1, 2, 3, 4, 5].map(l => (
          <g key={l}>
            <line x1={x0 - 6} x2={x0 + 6} y1={Y(l)} y2={Y(l)} className="taxis" />
            <text x={x0 - 14} y={Y(l) + 5} textAnchor="end" className="tnum">{l}</text>
          </g>
        ))}
        <line x1={x0} x2={x0} y1={Y(5) - 10} y2={bottom} className="taxis" />
        <line x1={x0} x2={W - 6} y1={bottom + 4} y2={bottom + 4} className="taxis faint" />
        {tones.map((t, i) => {
          const cx = x0 + slot * (i + 0.5), span = Math.min(70, slot * 0.6)
          const pts = t.pts.map((l, k) => [cx - span / 2 + (span * k) / (t.pts.length - 1), Y(l)])
          return (
            <g key={t.zh}>
              <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" markerEnd={`url(#${mid})`} />
              <text x={pts[0][0] - 8} y={pts[0][1] + 4} textAnchor="end" className="tnum sm">{t.pts[0]}</text>
              <text x={pts[pts.length - 1][0] + 8} y={pts[pts.length - 1][1] + 4} className="tnum sm">{t.pts[t.pts.length - 1]}</text>
              <text x={cx} y={bottom + 28} textAnchor="middle" className="tlabel">{t.zh}</text>
              {t.rom && <text x={cx} y={bottom + 46} textAnchor="middle" className="tlabel">{t.rom}</text>}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

// part：只顯示其中一張（投影片模式一張卡一頁用），沒填＝兩張都顯示
export default function ToneIntro({ part }: { part?: 'marks' | 'compare' } = {}) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section className="stack toneintro">
      {part !== 'compare' && <article className="card">
        <h3>聲調符號與音高</h3>
        <div className="tablewrap">
          <table className="tone tmark">
            <thead><tr><th />{NAMES.map(n => <th key={n}>{n}</th>)}</tr></thead>
            <tbody>
              <tr>
                <th className="rowh">聲調符號</th>
                {MARKS.map((m, i) => <td key={i}>
                  {m ? <button className="th big3 clickable markbtn" onClick={() => setOpen(i)} aria-label={`查看 ${MARK_NAME[i]} 的筆順`}>{m}</button> : <span className="muted small">（不加符號）</span>}
                  <div className="small muted th">{i ? MARK_NAME[i] : ''}</div>
                </td>)}
              </tr>
              <tr>
                <th className="rowh">泰語聲調<br />五度標記法</th>
                {THAI.map((t, i) => (
                  <td key={t.zh}><Mini t={t} id={'mini' + i} /><div className="small muted th">{t.th}<br />{t.rom}</div></td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted small">縱軸 1 最低、5 最高，線的起點到終點就是音高走向。</p>
      </article>}

      {part !== 'marks' && <article className="card">
        <h3>對照：漢語聲調五度標記法</h3>
        <p className="muted small">漢語的聲調和泰語不同，這張只是拿來對照音高走向，四個聲調放在同一張圖。</p>
        <Chart title="" tones={ZH} color="#1d6fb8" />
      </article>}
      {open !== null && <LetterDialog char={MARKS[open].trim()} caption={`${NAMES[open]}　${MARK_NAME[open]}`} onClose={() => setOpen(null)} />}
    </section>
  )
}
