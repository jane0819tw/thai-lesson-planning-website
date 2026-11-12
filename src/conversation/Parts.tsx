import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import SpeakButton from '../components/SpeakButton'
import ZoomImage from '../components/ZoomImage'
import { speak } from '../audio/speak'
import { Rom } from '../video/Rom'
import { plain } from './data'
import type { ConvBlock, ConvExample, ConvLesson, ConvTag, ConvText, ConvWord, Dialogue, Extra, NumTableBlock, PatternBlock, PhrasesBlock, Practice, TemplateBlock } from './types'

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
    <div className="c-word">
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
      {/* 前一半在左、後一半在右，中間虛線（L2 老師） */}
      <ol className="c-review" style={{ ['--rows' as string]: Math.ceil(l.review.length / 2) }}>{l.review.map((x, i) => <li key={i}><Line t={x.q} /><div className="c-ans"><Line t={x.a} /></div></li>)}</ol>
    </article>
  )
}

export function PhrasesCard({ b }: { b: PhrasesBlock }) {
  return (
    <article className="card">
      <h3>{b.title}</h3>
      {b.rows ? (
        // 照指定的列數分列（L3 老師：1–5 一列、6–0 一列）；欄數＝最長那列，卡片大小一致
        <div className="c-words phrases c-rows" style={{ ['--cols' as string]: Math.max(...b.rows) }}>
          {b.items.map((w, i) => <div key={w.th} style={b.rows!.reduce<number[]>((a, n) => [...a, a[a.length - 1] + n], [0]).includes(i) ? { gridColumnStart: 1 } : undefined} className="c-rows-cell"><Word w={w} /></div>)}
        </div>
      ) : <div className="c-words phrases">{b.items.map(w => <Word key={w.th} w={w} />)}</div>}
    </article>
  )
}

/** 數字表：照講義的格子表（L3 老師），點格子播放 */
export function NumTableCard({ b }: { b: NumTableBlock }) {
  return (
    <article className="card c-numtable">
      <h3>{b.title}</h3>
      {b.rules?.length ? <div className="c-nt-rules">{b.rules.map(r => <div key={r}><Rich text={r} /></div>)}</div> : null}
      <div className="tablewrap"><table className="c-nt">
        <colgroup><col className="head" />{b.cols.map((c, k) => <col key={c} className={k < 3 ? 'wide' : undefined} />)}</colgroup>
        <thead><tr><th />{b.cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{b.rows.map(r => (
          <tr key={r.head}><th>{r.head}</th>{b.cols.map((_, k) => {
            const c = r.cells[k] ?? ''
            if (!c.includes('｜')) return <td key={k} className="c-nt-q">{c}</td>
            const [th, rom] = c.split('｜')
            return (
              <td key={k} className="c-nt-cell" onClick={() => speak(plain(th))} title="點一下播放">
                <div className="c-rom"><Mk text={rom} rom /></div>
                <div className="th"><Mk text={th} /></div>
              </td>
            )
          })}</tr>
        ))}</tbody>
      </table></div>
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

/** 投影片：接話小工具自己一頁（放在句型頁裡會讓那頁變高、縮得比其他句型頁小，L2 老師） */
/** 大圖單字（句型框下面）：圖要看得清楚上面的價格，點圖放大 */
function BigWord({ w }: { w: ConvWord }) {
  return (
    <div className="c-word c-big-word">
      {w.image && <ZoomImage className="c-big-img" src={BASE + w.image} alt={w.zh} />}
      <div>
        <div className="th c-th">{w.th}<SpeakButton text={w.th} /></div>
        <div className="c-rom"><Rom text={w.rom} /></div>
        <div className="c-zh">{w.zh}</div>
      </div>
    </div>
  )
}

export function ToolboxCard({ b }: { b: PatternBlock }) {
  return (
    <article className="card c-toolbox-slide">
      <Toolbox items={b.toolbox ?? []} />
    </article>
  )
}

/** 投影片：句型的對照圖自己一頁（L2 老師：甜度、冰塊圖） */
export function PatternImagesCard({ b }: { b: PatternBlock }) {
  return (
    <article className="card c-pat-imgs">
      <h3>{b.zh}</h3>
      <div>{(b.images ?? []).map(src => <img key={src} src={BASE + src} alt="" />)}</div>
    </article>
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
export function PatternCard({ b, noToolbox, noImages }: { b: PatternBlock; noToolbox?: boolean; noImages?: boolean }) {
  if (b.vocabRows?.length) return <PatternSide b={b} noToolbox={noToolbox} noImages={noImages} />
  return (
    <article className={b.printStack ? 'card c-pattern print-stack' : 'card c-pattern'}>
      <div className="c-pat-top">
        <div className="c-pat-left">
          <div className="c-key">
            <div className="th">{b.th}<SpeakButton text={b.th} /></div>
            <div className="c-rom"><Rom text={b.rom} /></div>
            <div className="c-zh">{b.zh}</div>
          </div>
          {b.sideVocab?.length ? <div className="c-big-words">{b.sideVocab.map(w => <BigWord key={w.th} w={w} />)}</div> : null}
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
      {/* 單字和只有圖的一排同時有時放同一列（L3 老師：บาท 和價格圖） */}
      {b.vocab?.length && b.quiz?.length ? (
        <div className="c-pat-row">
          <div className="c-words c-pat-words">{b.vocab.map(w => <Word key={w.th} w={w} />)}</div>
          <div className="c-quiz">{b.quiz.map(src => <img key={src} src={BASE + src} alt="" />)}</div>
        </div>
      ) : <>
        {b.vocab?.length ? <div className="c-words c-pat-words">{b.vocab.map(w => <Word key={w.th} w={w} />)}</div> : null}
        {b.quiz?.length ? <div className="c-quiz">{b.quiz.map(src => <img key={src} src={BASE + src} alt="" />)}</div> : null}
      </>}
      {b.toolbox?.length && !noToolbox ? <Toolbox items={b.toolbox} /> : null}
    </article>
  )
}

/** 句型（左右排）：左邊句型框＋句子直排，右邊單字一排一類（L2 老師：甜度一排、冰塊一排） */
function PatternSide({ b, noToolbox, noImages }: { b: PatternBlock; noToolbox?: boolean; noImages?: boolean }) {
  return (
    <article className="card c-pattern side">
      <div className="c-side-left">
        <div className="c-key">
          <div className="th">{b.th}<SpeakButton text={b.th} /></div>
          <div className="c-rom"><Rom text={b.rom} /></div>
          <div className="c-zh">{b.zh}</div>
        </div>
        <div className="c-side-ex">{b.examples.map((e, k) => <Example key={k} e={e} />)}</div>
        {b.images?.length && !noImages ? <div className="c-side-imgs">{b.images.map(src => <img key={src} src={BASE + src} alt="" />)}</div> : null}
      </div>
      <div className="c-side-rows">{b.vocabRows!.map((r, i) => <div className="c-words c-side-row" key={i}>{r.map(w => <Word key={w.th} w={w} />)}</div>)}</div>
      {b.toolbox?.length && !noToolbox ? <Toolbox items={b.toolbox} /> : null}
    </article>
  )
}

export function TemplateCard({ b }: { b: TemplateBlock }) {
  return (
    <article className="card c-template">
      <h3>{b.title}</h3>
      {b.body && <p className="muted"><Rich text={b.body} /></p>}
      {/* 列印：分左右兩欄（前一半在左、後一半在右），中間一條線（L1 老師：省空間） */}
      <ol style={{ ['--rows' as string]: Math.ceil(b.lines.length / 2) }}>{b.lines.map((t, i) => <li key={i}><Line t={t} /></li>)}</ol>
    </article>
  )
}

export function BlockCard({ b }: { b: ConvBlock }) {
  return b.type === 'pattern' ? <PatternCard b={b} /> : b.type === 'phrases' ? <PhrasesCard b={b} /> : b.type === 'numtable' ? <NumTableCard b={b} /> : <TemplateCard b={b} />
}

const SPAN = 3

export const TAG_LABEL: Record<ConvTag, string> = { answer: '① 回答', add: '② 補一句', ask: '③ 反問', react: '接話詞', listen: '聽懂就好' }

/** 對話串：LINE 對話框，第一個說話的人在左、第二個在右；每段標回答／補一句／反問 */
export function DialogueCard({ d, from = 0, to }: { d: Dialogue; from?: number; to?: number }) {
  const speakers = [...new Set(d.lines.map(x => x.who))]
  const shown = d.lines.slice(from, to)
  // 左右交錯、高度重疊：每則訊息佔 SPAN 列，換人說話時只往下一列（和上一則重疊大半），但不能早於同一欄上一則的結尾（L1 老師：框框才不會太小；第 9 頁 Tae 兩則疊在一起）
  const rows: number[] = []
  const colEnd = [1, 1]
  shown.forEach((x, i) => {
    const col = speakers.indexOf(x.who) % 2
    const r = Math.max(i === 0 ? 1 : rows[i - 1] + 1, colEnd[col])
    rows.push(r); colEnd[col] = r + SPAN
  })
  return (
    <article className="card c-dialogue">
      <h3>💬 對話串：{d.scene}</h3>
      {/* 一對一練法（跟讀→分角色→換成自己）老師口頭帶，不放在畫面上（L1 老師） */}
      {from === 0 && <p className="c-steps">接話三步驟：<b>① 回答</b> → <b>② 補一句</b> → <b>③ 把問題丟回去</b>{d.body && <span className="muted">　<Rich text={d.body} /></span>}</p>}
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
      {p.body && <p><Rich text={p.body} /></p>}
      {p.cards?.length ? <div className="c-cards">{p.cards.map((c, i) => (
        <div className={c.image ? 'c-pcard has-img' : 'c-pcard'} key={i}>
          {c.image ? <img className="c-pcard-img" src={BASE + c.image} alt={c.name ?? ''} onLoad={e => { const i = e.currentTarget; if (i.naturalWidth > i.naturalHeight) i.dataset.wide = '' }} /> : c.icon && <div className="c-pcard-icon" aria-hidden="true">{c.icon}</div>}
          {c.name && <b>{c.name}</b>}
          {c.lines.map(t => <div key={t}><Rich text={t} /></div>)}
        </div>
      ))}</div> : null}
      {p.hints?.length ? <div className="c-hints"><h4>可以用的句子</h4>{p.hints.map(t => <Line key={t.th} t={t} />)}</div> : null}
      {p.items?.length ? <ol className="c-items">{p.items.map(t => <li key={t}>{t}{print && <div className="c-blank" />}</li>)}</ol> : null}
    </article>
  )
}

/** layout：講義排法（有 joinNext 的課才給）half＝兩張並排、third＝三張並排、full＝佔一整排 */
export function ExtraCard({ x, layout }: { x: Extra; layout?: 'half' | 'third' | 'full' }) {
  return (
    <article className={layout ? `card c-extra ${layout}` : 'card c-extra'}>
      {x.title && <h3>{x.title}</h3>}
      {x.body && <p><Rich text={x.body} /></p>}
      {x.images?.length || x.bigText ? <div className="c-ex-imgs">{x.bigText && <span className="th c-ex-big">{x.bigText}</span>}{x.images?.map(src => <img key={src} src={BASE + src} alt="" />)}</div> : null}
      {x.lines?.length ? <div className="c-ex-lines">{x.lines.map(t => <Line key={t.th} t={t} />)}</div> : null}
      {x.footnote && <p><Rich text={x.footnote} /></p>}
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
  const q = new URLSearchParams({ rel: '0', enablejsapi: '1', ...(v.start ? { start: String(v.start) } : {}), ...(v.end ? { end: String(v.end) } : {}) })
  const url = `https://www.youtube.com/watch?v=${v.id}${v.start ? `&t=${v.start}` : ''}`
  const frame = useRef<HTMLIFrameElement>(null)
  const [rate, setRate] = useState(1)
  // 調速度：用 YouTube 播放器的 postMessage 指令（enablejsapi=1），不用載入 IFrame API（L1 老師）
  const send = (msg: object) => frame.current?.contentWindow?.postMessage(JSON.stringify(msg), '*')
  const changeRate = (r: number) => { setRate(r); send({ event: 'command', func: 'setPlaybackRate', args: [r] }) }
  // 還沒播放前拉的速度播放器會忽略：開始播放（playerState 1）時再套一次
  const rateRef = useRef(rate); rateRef.current = rate
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return
      try {
        const d = JSON.parse(e.data)
        const st = d.event === 'onStateChange' ? d.info : d.info?.playerState
        if (st === 1 && rateRef.current !== 1 && d.info?.playbackRate !== rateRef.current) send({ event: 'command', func: 'setPlaybackRate', args: [rateRef.current] })
      } catch { /* 不是播放器的訊息 */ }
    }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [])
  return (
    <>
      <div className="c-video noprint">
        <iframe ref={frame} onLoad={() => send({ event: 'listening', id: v.id })} src={`https://www.youtube-nocookie.com/embed/${v.id}?${q}`} title={v.label} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      </div>
      <label className="c-rate noprint">速度
        <input type="range" min={0.25} max={1.5} step={0.25} value={rate} onChange={e => changeRate(Number(e.target.value))} />
        <b>{rate}×</b>
      </label>
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
      <ol>{(l.recap ?? []).map((t, i) => <li key={i}><Line t={t} /></li>)}</ol>
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
  if (l.extras?.length) s.push({ key: 'extras', label: '補充', cards: l.extras.map((x, i, a) => {
    // 有 joinNext 的課：講義也照投影片的合併方式排，合併的兩張各 50%、其他 100%（L2 老師）
    const join = a.some(e => e.joinNext)
    // 這張所在的合併組有幾張：往前、往後沿著 joinNext 數
    let from = i, to = i
    while (from > 0 && a[from - 1].joinNext) from--
    while (to < a.length - 1 && a[to].joinNext) to++
    const n = to - from + 1
    const layout = x.wide ? 'full' : !join ? undefined : n === 2 ? 'half' : n >= 3 ? 'third' : 'full'
    return <ExtraCard x={x} layout={layout} key={i} />
  }) })
  if (l.recap?.length) s.push({ key: 'recap', label: '總結', cards: [<RecapCard l={l} key="c" />] })
  return s
}
