import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getSession } from '../reservation/session'
import { getRepository } from '../data/repository'
import type { Consonant, Lesson, PracticeGroup, Rule } from '../types'
import SpeakButton from './SpeakButton'
import { nameText } from '../audio/speak'
import WordIcon from './WordIcon'
import ToneTableView from './ToneTableView'
import WordList from './WordList'
import LetterDialog from './LetterDialog'
import DiagramView from './DiagramView'
import { vowelForm, vowelSpeech } from '../strokes'
import VowelText from './VowelText'
import ZoomImage from './ZoomImage'
import ChoiceTable from './ChoiceTable'
import Games, { vowelSyllables } from './Games'
import RuleDemo from './RuleDemo'
import ToneIntro from './ToneIntro'
import VowelIntro from './VowelIntro'
import FinalsIntro from './FinalsIntro'
import ClusterIntro from './ClusterIntro'
import VowelShiftView from './VowelShiftView'
import GroupingView from './GroupingView'

const GROUP_ZH = { mid: '中子音', high: '高子音', lcp: '低子音 LCp', lcs: '低子音 LCs' } as const
type Tab = 'review' | 'finals' | 'rules' | 'games' | 'extras' | 'diagram' | 'consonants' | 'vowels' | 'vocab' | 'practice' | 'memes' | `unit-${number}`

// 沒有句型、只有一組練習時，區塊直接用那組練習的名稱（例如「多音節練習」）
// 說明文字有換行時，每行列成一點
// **文字**：本課重點，粗體＋主色
const emph = (s: string) => s.split(/\*\*(.+?)\*\*/).map((t, i) => i % 2 ? <strong className="hl" key={i}>{t}</strong> : t)
const RuleBody = ({ body }: { body: string }) => body.includes('\n') ? <ul>{body.split('\n').map((l, i) => <li key={i}>{emph(l)}</li>)}</ul> : <p>{emph(body)}</p>
// 標 homework 的練習改放在作業頁；標 unit 的練習放進那個小單元的區塊
const lessonPractice = (l: Lesson) => l.practice.filter(g => !g.homework && !g.unit)
// 小單元（例 L13-1 複合子音、L13-2 อ นำ ย、L15 的四種 Grouping）：依組合表、說明卡、練習出現的順序，各自一個區塊
const unitsOf = (l: Lesson) => [...new Set([l.clusters?.unit, ...(l.grouping ?? []).map(g => g.unit), ...l.rules.map(r => r.unit), ...l.practice.filter(g => !g.homework).map(g => g.unit)].filter((u): u is string => !!u))]
const practiceLabel = (l: Lesson) => (l.patterns.length === 0 && lessonPractice(l).length === 1 ? lessonPractice(l)[0].title : '練習・句型')

export default function LessonPage() {
  const { id } = useParams()
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined)
  const [collapsed, setCollapsed] = useState<Set<Tab>>(new Set())
  const [navOpen, setNavOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 760)
  const [showZh, setShowZh] = useState(true)
  const [showRoman, setShowRoman] = useState(true)
  const [open, setOpen] = useState<Consonant | null>(null)
  const [openVowel, setOpenVowel] = useState<{ char: string; ipa: string } | null>(null)
  const [reviewTab, setReviewTab] = useState(0)
  const [finalsOpen, setFinalsOpen] = useState(false)  // 複習卡的尾音字母表：預設收起，按鈕展開（各分頁共用，切換分頁時高度不變）
  const [active, setActive] = useState<Tab | null>(null)

  useEffect(() => { getRepository().getLesson(id ?? '').then(l => { setLesson(l ?? null); setCollapsed(new Set()); setReviewTab(0); setFinalsOpen(false) }) }, [id])

  // 只顯示這一課有資料的分頁
  const tabs = useMemo(() => {
    if (!lesson) return [] as [Tab, string][]
    const t: [Tab, string][] = []
    if (lesson.review?.length) t.push(['review', lesson.reviewLabel ?? '複習'])
    if (lesson.diagram) t.push(['diagram', lesson.diagram.title])
    if (lesson.vowels.length) t.push(['vowels', '母音'])
    if (lesson.rules.some(r => !r.unit) || lesson.toneTables.length || lesson.finalsIntro || lesson.vowelShifts?.length || (lesson.clusters && !lesson.clusters.unit)) t.push(['rules', '說明'])
    unitsOf(lesson).forEach((u, i) => t.push([`unit-${i}`, u]))
    if (lesson.finals?.length) t.push(['finals', '尾音'])
    if (lesson.consonants.length) t.push(['consonants', '子音'])
    if (lesson.vocab.length && !lesson.vocabAfterVowel && !lesson.finals?.length && !lesson.vowelShifts?.length && !lesson.clusters && !lesson.grouping?.length) t.push(['vocab', '單字'])
    if (lessonPractice(lesson).length || lesson.patterns.length) t.push(['practice', practiceLabel(lesson)])
    if (lesson.memes.length) t.push(['memes', '補充'])
    if (lesson.consonants.length >= 4 || vowelSyllables(lesson.vowels).length >= 6 || lesson.vocab.length >= 4) t.push(['games', '互動練習'])
    if (lesson.extras.length) t.push(['extras', '補充'])
    return t
  }, [lesson])

  // 捲到哪個區塊，左邊目錄的那一項就變色
  useEffect(() => {
    const onScroll = () => {
      let cur: Tab | null = null
      for (const [k] of tabs) { const el = document.getElementById('sec-' + k); if (el && el.getBoundingClientRect().top <= 120) cur = k }
      // 捲到底時最後幾個區塊到不了上方，直接算最後一個
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4 && tabs.length) cur = tabs[tabs.length - 1][0]
      setActive(cur ?? tabs[0]?.[0] ?? null)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(onScroll)  // 圖片載入、區塊收合後頁面高度會變，重算一次
    ro.observe(document.body)
    return () => { window.removeEventListener('scroll', onScroll); ro.disconnect() }
  }, [tabs])

  if (lesson === undefined) return <p>載入中…</p>
  if (lesson === null) return <p>找不到這一課。<Link to="/reading">回課程列表</Link></p>
  const toggle = (k: Tab) => setCollapsed(c => { const n = new Set(c); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const goto = (k: Tab) => {
    setCollapsed(c => { const n = new Set(c); n.delete(k); return n })
    window.setTimeout(() => document.getElementById('sec-' + k)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
    if (window.innerWidth <= 760) setNavOpen(false)
  }

  // 連續標了 inRow 的母音卡排在同一列（例如特殊母音四張）
  const vowelGroups = lesson.vowels.reduce<Lesson['vowels'][]>((acc, v) => { const last = acc[acc.length - 1]; if (v.inRow && last && last[0].inRow) last.push(v); else acc.push([v]); return acc }, [])
  const vwords = (words: Lesson['vocab']) => words.length > 0 && (
    <div className="vwords">
      {words.map((w, i) => (
        <div className="vword" key={w.thai + i}>
          <span className="th vword-th">{w.star ? '＊' : ''}{w.thai}</span>
          <SpeakButton text={w.thai} audioUrl={w.audioUrl} />
          <span className="vword-meta">
            {showRoman && w.roman && <span className="muted">{w.roman}</span>}
            {showZh && w.zh && <span>{w.zh}</span>}
          </span>
          {w.image && <ZoomImage className="vword-img" src={`${import.meta.env.BASE_URL}${w.image.src}`} alt={w.image.alt} />}
        </div>
      ))}
    </div>
  )
  const vowelCard = (v: Lesson['vowels'][number]) => (
    <article className="vcard" key={v.id}>
      <div className="vhead">
        <span className="vipa">{v.ipa}</span>
        <div className="vforms">
          {[[v.short, '短音'], [v.long, v.short ? '長音' : '']].map(([f, label], i) => f ? (
            <div key={i} className="vform-wrap">
              <button className="vform th" onClick={() => setOpenVowel({ char: vowelForm(f), ipa: v.ipa })} aria-label={`查看 ${vowelForm(f)} 的筆順`}>
                <span className="vglyph"><VowelText form={f} /></span>
                {label && <span className="vlabel">{label}</span>}
              </button>
              <SpeakButton text={vowelSpeech(f)} />
            </div>
          ) : null)}
        </div>
      </div>
      {v.note && <p className="muted vnote">{v.note}</p>}
      {(v.shortSyllables.length > 0 || (v.long && v.longSyllables.length > 0)) && (
        <div className="tablewrap">
          <table className="vtable">
            <tbody>
              {[[v.shortSyllables, '短音'], [v.long || !v.short ? v.longSyllables : [], v.short ? '長音' : '例']].map(([list, label]) => (list as string[]).length > 0 && (
                <tr key={label as string}>
                  <th scope="row">{label as string}</th>
                  {Array.from({ length: Math.max(v.shortSyllables.length, v.longSyllables.length) }, (_, i) => (list as string[])[i]).map((s, i) => (
                    <td key={i}>{s ? <span className="vsyl th">{s}<SpeakButton text={s} /></span> : <span className="muted">—</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {vwords(v.words)}
    </article>
  )
  // 尾音卡：左邊是字母（尾音不用看筆順，不能點）、右邊接音標，下面口型，右邊同一列排這個尾音的單字
  const finalCard = (f: NonNullable<Lesson['finals']>[number]) => (
    <article className={f.lines ? 'vcard final rows' : 'vcard final'} key={f.id}>
      <div className="vhead">
        <div className="fletters">
          {f.lines ? (
            <div className="vforms rows">
              {f.lines.map(line => (
                <div key={line} className="vrow">
                  {line.split(/\s+/).map(ch => <span key={ch} className="vform th static"><span className="vglyph">{ch}</span></span>)}
                </div>
              ))}
            </div>
          ) : (
            <div className={f.letters.length > 3 ? 'vforms many' : 'vforms'}>
              {f.letters.map(ch => (
                <span key={ch} className="vform th static"><span className="vglyph">{ch}</span></span>
              ))}
            </div>
          )}
          <span className="vipa">{f.sound}</span>
        </div>
        {f.mouth && <p className="fmouth"><strong>口型：</strong>{f.mouth}</p>}
      </div>
      {vwords(lesson.vocab.filter(w => w.group === f.group))}
    </article>
  )

  const ruleCard = (r: Rule) => (
    <article className="card" key={r.id}>{r.title && <h3>{r.title}</h3>}<RuleBody body={r.body} />{r.demo && <RuleDemo tiles={r.demo} />}{r.toneTable && <ToneTableView table={r.toneTable} />}</article>
  )
  const practiceCard = (g: PracticeGroup, showTitle: boolean) => (
    <article className="card" key={g.title}>
      {showTitle && <h3>{g.title}</h3>}
      {g.images ? (
        <div className={g.half ? 'picgrid half' : g.third ? 'picgrid third' : 'picgrid'}>
          {g.items.map(i => (
            <figure className="picword" key={i.thai}>
              {i.image ? <ZoomImage src={`${import.meta.env.BASE_URL}${i.image.src}`} alt={i.image.alt} /> : <div className="meme-placeholder">圖片待補</div>}
              <figcaption><span className="th big2">{i.thai}</span><SpeakButton text={i.thai} />{showZh && i.zh && <span>{i.zh}</span>}</figcaption>
            </figure>
          ))}
        </div>
      ) : g.qa ? (
        <div className="qa">
          <WordList words={g.items.slice(0, 1).map(i => ({ thai: i.thai, zh: i.zh ?? '' }))} showZh={showZh} showRoman={showRoman} />
          <WordList words={g.items.slice(1).map(i => ({ thai: i.thai, zh: i.zh ?? '' }))} showZh={showZh} showRoman={showRoman} />
        </div>
      ) : <WordList compact={g.half ? 'half' : g.third ? 'third' : true} words={g.items.map(i => ({ thai: i.thai, zh: i.zh ?? '', group: i.note }))} showZh={showZh} showRoman={showRoman} />}
    </article>
  )

  // 卡片固定三段：標題（＋尾音字母按鈕）｜字母表等上方內容｜聲調表等主要內容（分頁切換時三段各自對齊）
  const extraCard = (x: NonNullable<Lesson['review']>[number], off: boolean) => (
    <article className={off ? 'card off' : 'card'} key={x.title} aria-hidden={off || undefined}>
      <div className="card-head">
        <h3>{x.title}</h3>
        {x.finals && <button className="finals-toggle" aria-expanded={finalsOpen} onClick={() => setFinalsOpen(o => !o)}>{finalsOpen ? '收起尾音字母 ▴' : '尾音字母 ▾'}</button>}
      </div>
      <div>
        {x.lines.map((l, i) => <p className="th big2" key={i}>{l}</p>)}
        {x.finals && finalsOpen && (
          <table className="finals-mini"><tbody>
            {x.finals.map(f => <tr key={f.sound}><th scope="row">{f.sound}</th><td className="th"><span className="fmain">{f.main}</span>{f.others && `（${f.others}）`}</td></tr>)}
          </tbody></table>
        )}
      </div>
      <div>
        {x.choices && <ChoiceTable choices={x.choices} />}
        {x.toneTables?.map(t => <ToneTableView key={t.title} table={t} />)}
        {x.images?.map(im => <ZoomImage key={im.src} src={`${import.meta.env.BASE_URL}${im.src}`} alt={im.alt} style={{ maxWidth: '100%', borderRadius: 12 }} />)}
      </div>
    </article>
  )

  const content = (cur: Tab) => (
    <>
      {cur === 'diagram' && lesson.diagram && <DiagramView d={lesson.diagram} />}

      {cur === 'rules' && (
        <>
          {lesson.finalsIntro && <FinalsIntro config={lesson.finalsIntro === true ? undefined : lesson.finalsIntro} />}
          {lesson.clusters && !lesson.clusters.unit && <ClusterIntro config={lesson.clusters} vocab={lesson.vocab} showZh={showZh} />}
          <section className="stack">
            {lesson.rules.filter(r => !r.unit).map(ruleCard)}
          </section>
          {lesson.vowelShifts && <section className="stack">{lesson.vowelShifts.map((t, i) => <VowelShiftView key={i} table={t} vocab={lesson.vocab} showZh={showZh} />)}</section>}
          {/* 聲調表放在說明的最下面 */}
          {lesson.toneIntro && <ToneIntro />}
          {lesson.toneTables.length > 0 && <section className="stack">{lesson.toneTables.map(t => <ToneTableView key={t.title} table={t} />)}</section>}
        </>
      )}

      {cur.startsWith('unit-') && (() => {
        const u = unitsOf(lesson)[Number(cur.slice(5))]
        return (
          <>
            {lesson.clusters?.unit === u && <ClusterIntro config={lesson.clusters} vocab={lesson.vocab} showZh={showZh} />}
            {lesson.grouping?.filter(g => g.unit === u).map(g => <GroupingView key={g.unit} g={g} vocab={lesson.vocab} showZh={showZh} />)}
            <section className="stack">
              {lesson.rules.filter(r => r.unit === u).map(ruleCard)}
              {lesson.practice.filter(g => !g.homework && g.unit === u).map(g => practiceCard(g, true))}
            </section>
          </>
        )
      })()}

      {cur === 'games' && <Games consonants={lesson.consonants} vowels={lesson.vowels} words={lesson.vocab} />}

      {(cur === 'extras' || cur === 'review') && (() => { const tabbed = cur === 'review' && (lesson.review?.length ?? 0) > 1; return (
        <section className="cardgrid">
          {/* 複習有好幾張卡時，用分頁切換、一次看一張 */}
          {tabbed && (
            <div className="subtabs" role="tablist">
              {lesson.review!.map((x, i) => <button key={x.title} role="tab" aria-selected={i === reviewTab} className={i === reviewTab ? 'on' : undefined} onClick={() => setReviewTab(i)}>{x.tab ?? x.title}</button>)}
            </div>
          )}
          {tabbed ? (
            // 所有卡疊在同一格、只顯示目前那張：分頁高度一樣，切換時下面的內容不會跳
            <div className="subpanels">{lesson.review!.map((x, i) => extraCard(x, i !== reviewTab))}</div>
          ) : (cur === 'review' ? lesson.review ?? [] : lesson.extras).map(x => extraCard(x, false))}
        </section>
      ) })()}

      {cur === 'consonants' && (
        <section className="grid">
          {lesson.consonants.map(c => (
            <article className="card letter" key={c.id}>
              <button className="big th clickable" onClick={() => setOpen(c)} aria-label={`查看 ${c.char} 的筆順`}>{c.char}</button>
              <WordIcon char={c.char} label={c.zh} />
              <div className="th">{c.name} <SpeakButton text={nameText(c.name)} audioUrl={c.audioUrl} /></div>
              {showRoman && <div className="muted">{c.roman}</div>}
              {showZh && <div>{c.zh}</div>}
              <div className="small muted">{GROUP_ZH[c.group]}｜發音 {c.sound}{c.sameHigh && <>｜同音高子音：<span className="th">{c.sameHigh}</span></>}</div>
              {c.words.length > 0 && (
                <div className="cwords">
                  {c.words.map(w => (
                    <div key={w.thai} className="cword">
                      <span className="th cword-th">{w.star ? '＊' : ''}{w.thai}</span>
                      <SpeakButton text={w.thai} audioUrl={w.audioUrl} />
                      {showZh && w.zh && <span className="cword-zh">{w.zh}</span>}
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {cur === 'vowels' && (
        <>
        {lesson.vowelIntro && <VowelIntro config={typeof lesson.vowelIntro === 'object' ? lesson.vowelIntro : undefined} />}
        {lesson.vowelNotes?.map(r => <article className="card" key={r.id}><h3>{r.title}</h3><RuleBody body={r.body} />{r.demo && <RuleDemo tiles={r.demo} />}</article>)}
        <section className="vstack">
          {vowelGroups.map(g => (
            <Fragment key={g[0].id}>
            {g[0].heading && <h3 className="vgroup-h">{g[0].heading}</h3>}
            {g[0].preface?.map(r => <article className="card" key={r.id}>{r.title && <h3>{r.title}</h3>}{r.body && <RuleBody body={r.body} />}{r.toneTable && <ToneTableView table={r.toneTable} />}</article>)}
            {g.length > 1 ? <div className="vrow">{g.map(vowelCard)}</div> : vowelCard(g[0])}
            {lesson.vocabAfterVowel && g.some(v => v.id === lesson.vocabAfterVowel) && lesson.vocab.length > 0 && (
              <>
                <h3 className="vgroup-h">單字</h3>
                <WordList compact="wide" words={lesson.vocab} showZh={showZh} showRoman={showRoman} />
              </>
            )}
            </Fragment>
          ))}
        </section>
        </>
      )}

      {cur === 'finals' && lesson.finals && (
        <section className="vstack">
          {lesson.finals.map(finalCard)}
        </section>
      )}

      {cur === 'vocab' && <WordList compact="wide" words={lesson.vocab} showZh={showZh} showRoman={showRoman} />}

      {cur === 'practice' && (
        <section className="stack">
          {lessonPractice(lesson).map(g => practiceCard(g, g.title !== practiceLabel(lesson)))}
          {lesson.patterns.length > 0 && (
            <article className="card">
              <h3>句型</h3>
              <ul className="plain">{lesson.patterns.map(p => <li key={p.thai}><span className="th big2">{p.thai}</span> {showZh && <span>{p.zh}</span>}</li>)}</ul>
            </article>
          )}
        </section>
      )}

      {cur === 'memes' && (
        <section className="memegrid">
          {lesson.memes.map(m => (
            <article className={m.half ? 'card half' : 'card'} key={m.title || m.imageUrl}>
              {m.title && <h3>{m.title}</h3>}
              {m.big && <div className="th meme-big">{m.big}</div>}
              {m.desc && <p className="muted small">{m.desc}</p>}
              {m.imageUrl ? <ZoomImage src={/^(https?:|data:|\/)/.test(m.imageUrl) ? m.imageUrl : `${import.meta.env.BASE_URL}${m.imageUrl}`} alt={m.title || m.big || ''} style={{ maxWidth: '100%' }} /> : m.imageUrl === undefined && <div className="meme-placeholder">圖片待補</div>}
            </article>
          ))}
        </section>
      )}
    </>
  )

  return (
    <>
      {(() => { const st = getSession(); return <p>{st ? <Link to={`/book?t=${encodeURIComponent(st.token)}`}>← 回到課程與作業</Link> : <Link to="/reading">← 認字課程</Link>}</p> })()}
      <h1>L{lesson.number}　{lesson.title}</h1>
      {/* 說明有換行時列點（L15） */}
      <div className="muted lsummary"><RuleBody body={lesson.summary} /></div>

      <div className="toolbar">
        <label><input type="checkbox" checked={showZh} onChange={e => setShowZh(e.target.checked)} /> 顯示中文翻譯</label>
        <label><input type="checkbox" checked={showRoman} onChange={e => setShowRoman(e.target.checked)} /> 顯示拼音</label>
      </div>

      <div className={`lesson-layout${navOpen ? '' : ' navclosed'}`}>
        <aside className="sidenav" aria-label="本課目錄">
          <div className="sidenav-head">
            <strong>目錄</strong>
            <button onClick={() => setNavOpen(false)} aria-label="收合目錄">«</button>
          </div>
          <ul>
            {tabs.map(([k, label]) => (
              <li key={k}><button className={k === active ? 'on' : undefined} onClick={() => goto(k)}>{label}</button></li>
            ))}
          </ul>
          <div className="sidenav-foot">
            <button onClick={() => setCollapsed(new Set())}>全部展開</button>
            <button onClick={() => setCollapsed(new Set(tabs.map(([k]) => k)))}>全部收合</button>
          </div>
        </aside>
        <div className="lesson-main">
          {!navOpen && <button className="navopen" onClick={() => setNavOpen(true)}>☰ 目錄</button>}
          {tabs.map(([k, label]) => (
            <section className="lsec" id={'sec-' + k} key={k}>
              <h2 className="lsec-h"><button onClick={() => toggle(k)} aria-expanded={!collapsed.has(k)}>
                <span className="caret">{collapsed.has(k) ? '▸' : '▾'}</span> {label}</button></h2>
              {!collapsed.has(k) && content(k)}
            </section>
          ))}
        </div>
      </div>
      {open && <LetterDialog char={open.char} info={open} onClose={() => setOpen(null)} />}
      {openVowel && <LetterDialog char={openVowel.char} caption={openVowel.ipa} onClose={() => setOpenVowel(null)} />}
    </>
  )
}
