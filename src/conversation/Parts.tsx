import { Fragment, type ReactNode } from 'react'
import SpeakButton from '../components/SpeakButton'
import { Rom } from '../video/Rom'
import { plain } from './data'
import type { ConvBlock, ConvExample, ConvLesson, ConvTag, ConvText, ConvWord, Dialogue, Extra, PatternBlock, PhrasesBlock, Practice, TemplateBlock } from './types'

// 會話課的卡片：課程頁、投影片、列印講義共用（同一份資料、同一種排法）

/** {{關鍵字}} 紅字粗體、[[可替換]] 底線；拼音的一般部分依聲調上色（Rom），關鍵字整段紅字 */
export function Mk({ text, rom }: { text: string; rom?: boolean }) {
  const parts = text.split(/(\{\{.*?\}\}|\[\[.*?\]\])/)
  const inner = (s: string) => (rom ? <Rom text={s} /> : s)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('{{') ? <b className="ck" key={i}>{inner(p.slice(2, -2))}</b>
          : p.startsWith('[[') ? <u className="cs" key={i}>{inner(p.slice(2, -2))}</u>
            : p ? <Fragment key={i}>{inner(p)}</Fragment> : null,
      )}
    </>
  )
}

/** 說明文字：<<泰文|拼音>> 顯示成泰文＋（拼音），拼音跟著開關；其他照原樣 */
export function Rich({ text }: { text: string }) {
  return <>{text.split(/(<<.*?>>)/).map((p, i) => {
    if (!p.startsWith('<<')) return p ? <Fragment key={i}>{p}</Fragment> : null
    const [th, rom] = p.slice(2, -2).split('|')
    return <span className="c-inline" key={i}><span className="th">{th}</span>{rom && <span className="c-rom">（<Rom text={rom} />）</span>}</span>
  })}</>
}

const BASE = import.meta.env.BASE_URL

/** 一句三行：泰文（播放）／拼音／中文 */
export function Line({ t, big, noSpeak }: { t: ConvText; big?: boolean; noSpeak?: boolean }) {
  return (
    <div className={big ? 'c-line big' : 'c-line'}>
      <div className="th c-th"><span><Mk text={t.th} /></span>{!noSpeak && <SpeakButton text={plain(t.th)} />}</div>
      <div className="c-rom"><Mk text={t.rom} rom /></div>
      <div className="c-zh"><Mk text={t.zh} />{t.note && <small className="muted"> {t.note}</small>}</div>
    </div>
  )
}

const AVATAR = { f: '👩', m: '👨' } as const
const Avatar = ({ who }: { who?: string }) => <span className="c-avatar" aria-hidden="true">{who && who in AVATAR ? AVATAR[who as 'f' | 'm'] : who ?? '🙂'}</span>

/** 單字卡：圖示＋泰文＋拼音＋中文；★必學 */
function Word({ w }: { w: ConvWord & { note?: string } }) {
  return (
    <div className={w.star ? 'c-word star' : 'c-word'}>
      {w.image ? <img className="c-icon c-icon-img" src={BASE + w.image} alt="" /> : w.icon && <span className="c-icon" aria-hidden="true">{w.icon}</span>}
      <div>
        <div className="th c-th">{w.th}<SpeakButton text={w.th} /></div>
        <div className="c-rom"><Rom text={w.rom} /></div>
        <div className="c-zh">{w.zh}{w.note && <small className="muted"> {w.note}</small>}</div>
      </div>
    </div>
  )
}

export function GoalsCard({ l }: { l: ConvLesson }) {
  return (
    <article className="card c-goals">
      <h3>🎯 今天上完，你可以…</h3>
      <ul>{l.goals.map(g => <li key={g}><Rich text={g} /></li>)}</ul>
    </article>
  )
}

export function ReviewCard({ l }: { l: ConvLesson }) {
  if (!l.review?.length) return null
  return (
    <article className="card">
      <h3>上一課快問快答</h3>
      <ol className="c-review">{l.review.map((x, i) => <li key={i}><Line t={x.q} /><div className="c-ans"><Line t={x.a} /></div></li>)}</ol>
    </article>
  )
}

export function PhrasesCard({ b }: { b: PhrasesBlock }) {
  return (
    <article className="card">
      <h3>{b.title}</h3>
      <div className="c-words phrases">{b.items.map(w => <Word key={w.th} w={w} />)}</div>
    </article>
  )
}

function Example({ e }: { e: ConvExample }) {
  return <div className="c-ex"><Avatar who={e.who} /><Line t={e} /></div>
}

/** 接話小工具：放在用得到它的句型旁邊 */
export function Toolbox({ items }: { items: ConvText[] }) {
  return (
    <aside className="c-toolbox">
      <b>🧰 接話小工具</b>
      {items.map(t => <Line key={t.th} t={t} />)}
    </aside>
  )
}

/** 問答分組：q 的句子開新的一列（放左邊），後面的回答都放這列右邊；列跟列之間虛線分開（講義 L1 p5） */
function qaRows(ex: ConvExample[]) {
  const rows: { q?: ConvExample; as: ConvExample[] }[] = []
  for (const e of ex) {
    if (e.q || !rows.length) rows.push({ q: e.q ? e : undefined, as: e.q ? [] : [e] })
    else rows[rows.length - 1].as.push(e)
  }
  return rows
}

/** 句型：左邊藍底句型框，右邊一問一答（問左答右），下面一排單字（不寫單字標題）、接話小工具 */
export function PatternCard({ b }: { b: PatternBlock }) {
  return (
    <article className="card c-pattern">
      <div className="c-pat-top">
        <div className="c-key">
          <div className="th">{b.th}<SpeakButton text={b.th} /></div>
          <div className="c-rom"><Rom text={b.rom} /></div>
          <div className="c-zh">{b.zh}</div>
        </div>
        <div className="c-qa">
          {qaRows(b.examples).map((r, i) => (
            <div className="c-qa-row" key={i}>
              <div className="c-q">{r.q && <Example e={r.q} />}</div>
              <div className="c-a">{r.as.map((e, k) => <Example key={k} e={e} />)}</div>
            </div>
          ))}
        </div>
      </div>
      {b.vocab?.length ? <div className="c-words c-pat-words">{b.vocab.map(w => <Word key={w.th} w={w} />)}</div> : null}
      {b.toolbox?.length ? <Toolbox items={b.toolbox} /> : null}
    </article>
  )
}

export function TemplateCard({ b }: { b: TemplateBlock }) {
  return (
    <article className="card c-template">
      <h3>{b.title}</h3>
      {b.body && <p className="muted"><Rich text={b.body} /></p>}
      <ol>{b.lines.map((t, i) => <li key={i}><Line t={t} /></li>)}</ol>
    </article>
  )
}

export function BlockCard({ b }: { b: ConvBlock }) {
  return b.type === 'pattern' ? <PatternCard b={b} /> : b.type === 'phrases' ? <PhrasesCard b={b} /> : <TemplateCard b={b} />
}

const SPAN = 3

export const TAG_LABEL: Record<ConvTag, string> = { answer: '① 回答', add: '② 補一句', ask: '③ 反問', react: '接話詞', listen: '聽懂就好' }

/** 對話串：LINE 對話框，第一個說話的人在左、第二個在右；每段標回答／補一句／反問 */
export function DialogueCard({ d, from = 0, to }: { d: Dialogue; from?: number; to?: number }) {
  const speakers = [...new Set(d.lines.map(x => x.who))]
  const shown = d.lines.slice(from, to)
  // 左右交錯、高度重疊：每則訊息佔 SPAN 列，換人說話時只往下一列（和上一則重疊大半），同一人連說才往下 SPAN 列（L1 老師：框框才不會太小）
  const rows: number[] = []
  shown.forEach((x, i) => { rows.push(i === 0 ? 1 : rows[i - 1] + (x.who === shown[i - 1].who ? SPAN : 1)) })
  return (
    <article className="card c-dialogue">
      <h3>💬 對話串：{d.scene}</h3>
      {from === 0 && <>
        <p className="c-steps">接話三步驟：<b>① 回答</b> → <b>② 補一句</b> → <b>③ 把問題丟回去</b>{d.body && <span className="muted">　<Rich text={d.body} /></span>}</p>
        {/* 學生大多一對一：同一段對話練三輪，最後一輪就是自由對話 */}
        <p className="c-howto">一對一練法：<b>❶ 跟讀</b>（播放或老師念）→ <b>❷ 分角色</b>（老師、學生各演一個，再交換）→ <b>❸ 換成自己</b>（<u>底線</u>換成自己的名字、國家、喜歡的事，老師照真實情況回答）</p>
      </>}
      <div className="c-chat">
        {shown.map((x, i) => (
          <div key={i} className={speakers.indexOf(x.who) % 2 ? 'c-msg right' : 'c-msg'} style={{ gridRow: `${rows[i]} / span ${SPAN}` }}>
            <div className="c-who"><span aria-hidden="true">{x.avatar}</span> {x.who}</div>
            <div className="c-bubble">
              {x.segs.map((s, k) => (
                <div className="c-seg" key={k}>
                  {s.tag && <span className={`c-tag t-${s.tag}`}>{TAG_LABEL[s.tag]}</span>}
                  <Line t={s} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

const KIND_LABEL: Record<Practice['kind'], string> = { roleplay: '角色扮演', qa: '兩人互問', picture: '看圖說話', translate: '中翻泰' }

export function PracticeCard({ p, print }: { p: Practice; print?: boolean }) {
  return (
    <article className="card c-practice">
      <h3><span className="c-kind">{KIND_LABEL[p.kind]}</span> {p.title}</h3>
      <p><Rich text={p.body} /></p>
      {p.cards?.length ? <div className="c-cards">{p.cards.map((c, i) => (
        <div className={c.image ? 'c-pcard has-img' : 'c-pcard'} key={i}>
          {c.image ? <img className="c-pcard-img" src={BASE + c.image} alt={c.name ?? ''} /> : c.icon && <div className="c-pcard-icon" aria-hidden="true">{c.icon}</div>}
          {c.name && <b>{c.name}</b>}
          {c.lines.map(t => <div key={t}><Rich text={t} /></div>)}
        </div>
      ))}</div> : null}
      {p.hints?.length ? <div className="c-hints"><h4>可以用的句子</h4>{p.hints.map(t => <Line key={t.th} t={t} />)}</div> : null}
      {p.items?.length ? <ol className="c-items">{p.items.map(t => <li key={t}>{t}{print && <div className="c-blank" />}</li>)}</ol> : null}
    </article>
  )
}

export function ExtraCard({ x }: { x: Extra }) {
  return (
    <article className="card c-extra">
      <h3>{x.title} <span className="c-later">有時間再上</span></h3>
      {x.body && <p><Rich text={x.body} /></p>}
      {x.lines?.map(t => <Line key={t.th} t={t} />)}
      {x.table && (
        <div className="tablewrap"><table className="c-table">
          <thead><tr>{x.table.head.map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{x.table.rows.map((r, i) => <tr key={i}>{r.map((c, k) => <td key={k}><CellText s={c} /></td>)}</tr>)}</tbody>
        </table></div>
      )}
      {x.video && <YouTubeClip v={x.video} />}
      {x.link && <p className="noprint"><a href={x.link.url} target="_blank" rel="noopener noreferrer">▶ {x.link.label}</a></p>}
      {x.link && <p className="printonly small muted">影片：{x.link.label}　{x.link.url}</p>}
    </article>
  )
}

/** 嵌入 YouTube 片段（start～end 秒）；列印時印網址 */
function YouTubeClip({ v }: { v: NonNullable<Extra['video']> }) {
  const q = new URLSearchParams({ rel: '0', ...(v.start ? { start: String(v.start) } : {}), ...(v.end ? { end: String(v.end) } : {}) })
  const url = `https://www.youtube.com/watch?v=${v.id}${v.start ? `&t=${v.start}` : ''}`
  return (
    <>
      <div className="c-video noprint">
        <iframe src={`https://www.youtube-nocookie.com/embed/${v.id}?${q}`} title={v.label} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      </div>
      <p className="printonly small muted">影片：{v.label}　{url}</p>
    </>
  )
}

/** 表格格子：一行一個詞（\n 分行），「泰文｜拼音｜中文」用｜分開，拼音、中文各自套開關 */
function CellText({ s }: { s: string }) {
  return <>{s.split('\n').map((x, i) => {
    const [th, rom, zh] = x.split('｜')
    return <div key={i}>{rom === undefined ? x : <><span className="th">{th}</span> <span className="c-rom"><Rom text={rom} /></span> <span className="c-zh">{zh}</span></>}</div>
  })}</>
}

export function RecapCard({ l }: { l: ConvLesson }) {
  return (
    <article className="card c-recap">
      <h3>📝 句型總結</h3>
      <ol>{l.recap.map((t, i) => <li key={i}><Line t={t} /></li>)}</ol>
    </article>
  )
}

/** 課程頁、講義的區塊（＝投影片的章節）。順序：目標 → 複習 → 句型 → 對話串 → 練習 → 補充 → 總結 */
export interface Section { key: string; label: string; cards: ReactNode[] }
export function sectionsOf(l: ConvLesson, print = false): Section[] {
  const s: Section[] = [{ key: 'goals', label: '今日目標', cards: [<GoalsCard l={l} key="g" />] }]
  if (l.review?.length) s.push({ key: 'review', label: '複習', cards: [<ReviewCard l={l} key="r" />] })
  s.push({ key: 'blocks', label: '句型', cards: l.blocks.map(b => <BlockCard b={b} key={b.id} />) })
  if (l.dialogue) s.push({ key: 'dialogue', label: '對話串', cards: [<DialogueCard d={l.dialogue} key="d" />] })
  if (l.practice.length) s.push({ key: 'practice', label: '練習', cards: l.practice.map((p, i) => <PracticeCard p={p} print={print} key={i} />) })
  if (l.extras?.length) s.push({ key: 'extras', label: '補充', cards: l.extras.map((x, i) => <ExtraCard x={x} key={i} />) })
  s.push({ key: 'recap', label: '總結', cards: [<RecapCard l={l} key="c" />] })
  return s
}
