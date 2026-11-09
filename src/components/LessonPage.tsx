import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getSession } from '../reservation/session'
import { getRepository } from '../data/repository'
import type { Consonant, Diagram, Lesson, PracticeGroup, RecapPoint, Rule } from '../types'
import SpeakButton from './SpeakButton'
import { nameText } from '../audio/speak'
import WordIcon from './WordIcon'
import ToneTableView from './ToneTableView'
import WordList from './WordList'
import LetterDialog from './LetterDialog'
import DiagramView from './DiagramView'
import { MemeCard, PracticeItems, VowelCard, VowelWords } from './LessonCards'
import ZoomImage from './ZoomImage'
import ChoiceTable from './ChoiceTable'
import Games, { vowelSyllables } from './Games'
import RuleDemo from './RuleDemo'
import RuleExtras from './RuleExtras'
import { soundLabel } from '../consonant'
import ToneIntro from './ToneIntro'
import VowelIntro from './VowelIntro'
import FinalsIntro from './FinalsIntro'
import ClusterIntro from './ClusterIntro'
import VowelShiftView from './VowelShiftView'
import GroupingView from './GroupingView'
import NumeralTable from './NumeralTable'
import SanskritVowels from './SanskritVowels'
import ReadingCases from './ReadingCases'
import TraceRow from './TraceRow'
import { vowelForm } from '../strokes'

const GROUP_ZH = { mid: '中子音', high: '高子音', lcp: '低子音 LCp', lcs: '低子音 LCs' } as const
export type Tab = 'recap' | 'review' | 'finals' | 'rules' | 'games' | 'extras' | 'diagram' | 'consonants' | 'vowels' | 'vocab' | 'practice' | 'memes' | 'numerals' | `unit-${number}` | `vowels-${number}`

// 沒有句型、只有一組練習時，區塊直接用那組練習的名稱（例如「多音節練習」）
// 說明文字有換行時，每行列成一點
// **文字**：本課重點，粗體＋主色
const emph = (s: string) => s.split(/\*\*(.+?)\*\*/).map((t, i) => i % 2 ? <strong className="hl" key={i}>{t}</strong> : t)
// 說明卡：\n 分行列點；「- 」開頭的行是上一點底下的小點（L16-1）
// 小結：呼應 summary 的幾點，開頭用綠色勾表示「這個重點學會了」，底下列細項
export const Recap = ({ points }: { points: RecapPoint[] }) => (
  <article className="card recap">
    <ul>{points.map((p, i) => (
      <li key={i}>{emph(p.point)}
        {p.items?.length ? <ul>{p.items.map((t, k) => <li key={k}>{emph(t)}</li>)}</ul> : null}
        {p.toneTable && <ToneTableView table={p.toneTable} />}
      </li>
    ))}</ul>
  </article>
)
export const RuleBody = ({ body }: { body: string }) => {
  if (!body.includes('\n')) return <p>{emph(body)}</p>
  const items: { text: string; subs: string[] }[] = []
  for (const l of body.split('\n')) {
    if (l.startsWith('- ') && items.length) items[items.length - 1].subs.push(l.slice(2))
    else items.push({ text: l, subs: [] })
  }
  return <ul>{items.map((it, i) => <li key={i}>{emph(it.text)}{it.subs.length > 0 && <ul>{it.subs.map((t, k) => <li key={k}>{emph(t)}</li>)}</ul>}</li>)}</ul>
}
// 標 homework 的練習改放在作業頁；標 unit 的練習放進那個小單元的區塊
export const lessonPractice = (l: Lesson) => l.practice.filter(g => !g.homework && !g.unit)

// 小單元（例 L13-1 複合子音、L13-2 อ นำ ย、L15 的四種 Grouping）：依組合表、說明卡、練習出現的順序，各自一個區塊
const unitsOf = (l: Lesson) => [...new Set([l.clusters?.unit, ...(l.grouping ?? []).map(g => g.unit), ...(l.readingCases ?? []).map(t => t.unit), ...l.rules.map(r => r.unit), ...l.practice.filter(g => !g.homework).map(g => g.unit)].filter((u): u is string => !!u))]
// 「基本概念」區塊（L1）：標 at:'concept' 的說明卡＋音節組成圖，組成圖排在 diagram.after 那張卡之後
export const conceptItems = (l: Lesson): (Rule | Diagram)[] => {
  const rs = l.rules.filter(r => r.at === 'concept')
  if (!l.diagram) return rs
  const k = rs.findIndex(r => r.id === l.diagram!.after)
  return [...rs.slice(0, k + 1), l.diagram, ...rs.slice(k + 1)]
}
// 母音分段：標了 heading 的母音開始新的一段（L5 複合母音、特殊母音）；每段都有 heading 時，課程頁目錄、投影片章節各自一個區塊
// 第一段的 key 是 'vowels'（母音總覽、說明卡也放這段），之後是 vowels-1、vowels-2…
export const vowelSections = (l: Lesson) => {
  const out: { heading?: string; vowels: Lesson['vowels'] }[] = []
  for (const v of l.vowels) { if (v.heading || !out.length) out.push({ heading: v.heading, vowels: [] }); out[out.length - 1].vowels.push(v) }
  return out.length > 1 && out.every(x => x.heading) ? out : [{ heading: undefined, vowels: l.vowels }]
}
export const vowelsOf = (l: Lesson, k: Tab) => vowelSections(l)[k === 'vowels' ? 0 : Number(k.slice(7))]?.vowels ?? []
const plainRules = (l: Lesson) => l.rules.filter(r => !r.unit && !r.at)
// 本課的區塊與順序（課程頁的目錄、投影片模式共用）
export function lessonTabs(lesson: Lesson): [Tab, string][] {
  const t: [Tab, string][] = []
  const hasRules = plainRules(lesson).length || lesson.toneTables.length || lesson.finalsIntro || lesson.vowelShifts?.length || (lesson.clusters && !lesson.clusters.unit) || lesson.readingCases?.some(t => !t.unit)
  if (lesson.review?.length) t.push(['review', lesson.reviewLabel ?? '複習'])
  if (lesson.diagram) t.push(['diagram', lesson.rules.some(r => r.at === 'concept') ? '基本概念' : lesson.diagram.title])
  if (lesson.vowels.length || lesson.sanskritVowels?.length) vowelSections(lesson).forEach((x, i) => t.push([i ? `vowels-${i}` : 'vowels', x.heading ?? '母音']))
  if (lesson.numerals?.length) t.push(['numerals', '大寫數字'])
  if (hasRules && !lesson.tonesAfterConsonants) t.push(['rules', '說明'])
  unitsOf(lesson).forEach((u, i) => t.push([`unit-${i}`, u]))
  if (lesson.finals?.length) t.push(['finals', '尾音'])
  if (lesson.consonants.length) t.push(['consonants', '子音'])
  if (hasRules && lesson.tonesAfterConsonants) t.push(['rules', '聲調'])
  if (lesson.vocab.length && !lesson.vocabAfterVowel && !lesson.finals?.length && !lesson.vowelShifts?.length && !lesson.clusters && !lesson.grouping?.length && !lesson.sanskritVowels?.length && !lesson.numerals?.length && !lesson.readingCases?.length) t.push(['vocab', '單字'])
  if (lessonPractice(lesson).length || lesson.patterns.length) t.push(['practice', practiceLabel(lesson)])
  if (lesson.recap?.length) t.push(['recap', '小結'])
  if (lesson.memes.length) t.push(['memes', '補充'])
  if (lesson.consonants.length >= 4 || vowelSyllables(lesson.vowels).length >= 6 || lesson.vocab.length >= 4) t.push(['games', '互動練習'])
  if (lesson.extras.length) t.push(['extras', '補充'])
  return t
}
// 列印講義的「字母卡＋練字格」一列：on＝列印才包；trace＝要練寫的字（母音用 อ 補子音位置，短音、長音各一列）
const Wrap = ({ on, vowel, trace, children }: { on: boolean; vowel?: boolean; trace: string[]; children: ReactNode }) => on ? (
  <div className={vowel ? 'h-wrow v' : 'h-wrow'}>
    {children}
    <div className="h-wtrace">{trace.map(t => <TraceRow key={t} text={t} trace={vowel ? 2 : 3} blank={vowel ? 3 : 4} />)}</div>
  </div>
) : <>{children}</>
export const practiceLabel = (l: Lesson) => (l.patterns.length === 0 && lessonPractice(l).length === 1 ? lessonPractice(l)[0].title : '練習・句型')

// printLesson：列印講義（HandoutPage）直接傳入課程資料，只排內容：不要返回連結、按鈕、目錄、互動練習，區塊全部展開
export default function LessonPage({ printLesson }: { printLesson?: Lesson } = {}) {
  const { id: routeId } = useParams()
  const id = printLesson?.id ?? routeId
  const [lesson, setLesson] = useState<Lesson | null | undefined>(printLesson)
  const [collapsed, setCollapsed] = useState<Set<Tab>>(new Set())
  const [navOpen, setNavOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 760)
  // 中文、拼音一律顯示；只有練習卡可以各自隱藏中文（見 practiceCard）
  const showZh = true, showRoman = true
  const wordRoman = false  // 認字課的單字、例字、練習一律不顯示拼音（L1 老師 2026-11-05）；子音名稱的拼音照常顯示
  const [open, setOpen] = useState<Consonant | null>(null)
  const [openVowel, setOpenVowel] = useState<{ char: string; ipa: string } | null>(null)
  const [reviewTab, setReviewTab] = useState(0)
  const [finalsOpen, setFinalsOpen] = useState(false)  // 複習卡的尾音字母表：預設收起，按鈕展開（各分頁共用，切換分頁時高度不變）
  const [active, setActive] = useState<Tab | null>(null)
  const [zhOff, setZhOff] = useState<Set<string>>(new Set())  // 隱藏中文的練習卡（unit 或 title）

  useEffect(() => { if (printLesson) return; getRepository().getLesson(id ?? '').then(l => { setLesson(l ?? null); setCollapsed(new Set()); setReviewTab(0); setFinalsOpen(false); setZhOff(new Set()) }) }, [id, printLesson])

  // 只顯示這一課有資料的分頁
  const tabs = useMemo(() => lesson ? lessonTabs(lesson) : [], [lesson])

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
  const splitVowels = vowelSections(lesson).length > 1  // 母音分成好幾個區塊時，區塊標題就是 heading，卡片上方不再重複
  const vowelGroups = (vs: Lesson['vowels']) => vs.reduce<Lesson['vowels'][]>((acc, v) => { const last = acc[acc.length - 1]; if (v.inRow && last && last[0].inRow) last.push(v); else acc.push([v]); return acc }, [])
  const vowelCard = (v: Lesson['vowels'][number]) => <VowelCard key={v.id} v={v} showZh={showZh} onOpen={setOpenVowel} />
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
      <VowelWords words={lesson.vocab.filter(w => w.group === f.group)} showZh={showZh} />
    </article>
  )

  const ruleCard = (r: Rule) => (
    <article className="card" key={r.id}>{r.title && <h3>{r.title}</h3>}{r.body && <RuleBody body={r.body} />}<RuleExtras r={r} Body={RuleBody} /></article>
  )
  // 練習卡有中文時，右上角可以單獨隱藏這張卡的中文（預設顯示）
  const practiceCard = (g: PracticeGroup, showTitle: boolean) => {
    const k = (g.unit ?? '') + '｜' + g.title  // 同一個小單元可以有好幾組練習（L19 多音節練習＋真的假的）
    const hasZh = g.items.some(i => i.zh)
    const zh = showZh && !zhOff.has(k)
    return (
    <article className="card" key={k}>
      {((showTitle && g.title) || hasZh) && (
        <div className="card-head">
          {showTitle && g.title ? <h3>{g.title}</h3> : <span />}
          {hasZh && <button className="finals-toggle" aria-pressed={!zhOff.has(k)} onClick={() => setZhOff(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })}>{zhOff.has(k) ? '顯示中文' : '隱藏中文'}</button>}
        </div>
      )}
      <PracticeItems g={g} zh={zh} />
    </article>
    )
  }

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
      {cur === 'diagram' && lesson.diagram && (lesson.rules.some(r => r.at === 'concept')
        ? <section className="stack">{conceptItems(lesson).map(x => 'tiles' in x ? <DiagramView key="diagram" d={x} showTitle /> : ruleCard(x))}</section>
        : <DiagramView d={lesson.diagram} />)}

      {cur === 'rules' && (
        <>
          {lesson.finalsIntro && <FinalsIntro config={lesson.finalsIntro === true ? undefined : lesson.finalsIntro} />}
          {lesson.clusters && !lesson.clusters.unit && <ClusterIntro config={lesson.clusters} vocab={lesson.vocab} showZh={showZh} />}
          {lesson.readingCases?.filter(t => !t.unit).map((t, i) => <ReadingCases key={i} t={t} vocab={lesson.vocab} showZh={showZh} />)}
          <section className="stack">
            {plainRules(lesson).map(ruleCard)}
          </section>
          {lesson.vowelShifts && <section className="stack">{lesson.vowelShifts.map((t, i) => <VowelShiftView key={i} table={t} vocab={lesson.vocab} showZh={showZh} />)}</section>}
          {/* 聲調表放在說明的最下面 */}
          {lesson.toneIntro && <ToneIntro />}
          {lesson.toneTables.length > 0 && <section className="stack">{lesson.toneTables.map(t => <ToneTableView key={t.title} table={t} />)}</section>}
        </>
      )}

      {cur.startsWith('unit-') && (() => {
        const u = unitsOf(lesson)[Number(cur.slice(5))]
        const topRules = (u: string) => lesson.rules.some(r => r.unit === u && r.at === 'top') ? <section className="stack">{lesson.rules.filter(r => r.unit === u && r.at === 'top').map(ruleCard)}</section> : null
        return (
          <>
            {/* at: 'top' 的說明卡排在小單元最上面（有 Grouping 副標時排在副標下面） */}
            {!lesson.grouping?.some(g => g.unit === u) && topRules(u)}
            {lesson.clusters?.unit === u && <ClusterIntro config={lesson.clusters} vocab={lesson.vocab} showZh={showZh} />}
            {lesson.grouping?.filter(g => g.unit === u).map((g, i) => <GroupingView key={i} top={i === 0 ? topRules(u) : null} g={g} vocab={lesson.vocab} showZh={showZh} />)}
            {lesson.readingCases?.filter(t => t.unit === u).map((t, i) => <ReadingCases key={i} t={t} vocab={lesson.vocab} showZh={showZh} />)}
            <section className="stack">
              {lesson.rules.filter(r => r.unit === u && r.at !== 'top').map(ruleCard)}
              {lesson.practice.filter(g => !g.homework && g.unit === u).map(g => practiceCard(g, true))}
            </section>
          </>
        )
      })()}

      {cur === 'recap' && lesson.recap && <Recap points={lesson.recap} />}

      {cur === 'numerals' && lesson.numerals && <NumeralTable numerals={lesson.numerals} />}

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

      {cur === 'consonants' && lesson.rules.some(r => r.at === 'consonants' && !r.afterLetter) && <section className="stack">{lesson.rules.filter(r => r.at === 'consonants' && !r.afterLetter).map(ruleCard)}</section>}
      {cur === 'consonants' && (
        // 列印講義：一個字母一列，字母卡在左邊、練字格在右邊（不另外放描字作業頁）
        <section className={printLesson ? 'h-wlist' : 'grid'}>
          {lesson.consonants.map(c => (<Fragment key={c.id}>
            <Wrap on={!!printLesson} trace={[c.char]}>
            <article className="card letter">
              <button className="big th clickable" onClick={() => setOpen(c)} aria-label={`查看 ${c.char} 的筆順`}>{c.char}</button>
              <WordIcon char={c.char} label={c.zh} />
              <div className="th">{c.name} <SpeakButton text={nameText(c.name)} audioUrl={c.audioUrl} /></div>
              {showRoman && <div className="muted">{c.roman}</div>}
              {showZh && <div>{c.zh}</div>}
              <div className="small muted">{GROUP_ZH[c.group]}｜{soundLabel(c)}{c.sameHigh && <>｜同音高子音：<span className="th">{c.sameHigh}</span></>}</div>
              {c.words.length > 0 && (
                <div className="cwords">
                  {c.words.map(w => (
                    <div key={w.thai} className={w.star ? 'cword wstar' : 'cword'}>
                      <span className="th cword-th">{w.thai}</span>
                      <SpeakButton text={w.thai} audioUrl={w.audioUrl} />
                      {showZh && w.zh && <span className="cword-zh">{w.zh}</span>}
                    </div>
                  ))}
                </div>
              )}
            </article>
            </Wrap>
            {/* afterLetter：說明卡排在這個字母後面、佔滿一整列（L1 看完 ก 再解釋子音怎麼念） */}
            {lesson.rules.filter(r => r.at === 'consonants' && r.afterLetter === c.char).map(r => <div className="gridfull" key={r.id}>{ruleCard(r)}</div>)}
          </Fragment>))}
        </section>
      )}

      {(cur === 'vowels' || cur.startsWith('vowels-')) && (
        <>
        {cur === 'vowels' && <>
        {lesson.vowelIntro && <VowelIntro config={typeof lesson.vowelIntro === 'object' ? lesson.vowelIntro : undefined} />}
        {lesson.sanskritVowels && <SanskritVowels vowels={lesson.sanskritVowels} vocab={lesson.vocab} showZh={showZh} />}
        {lesson.vowelNotes?.map(r => <article className="card" key={r.id}><h3>{r.title}</h3><RuleBody body={r.body} />{r.demo && <RuleDemo tiles={r.demo} />}</article>)}
        </>}
        <section className="vstack">
          {vowelGroups(vowelsOf(lesson, cur)).map(g => (
            <Fragment key={g[0].id}>
            {g[0].heading && !splitVowels && <h3 className="vgroup-h">{g[0].heading}</h3>}
            {g[0].preface?.map(r => <article className="card" key={r.id}>{r.title && <h3>{r.title}</h3>}{r.body && <RuleBody body={r.body} />}<RuleExtras r={r} Body={RuleBody} /></article>)}
            {printLesson ? g.map(v => <Wrap key={v.id} on vowel trace={[v.short, v.long].filter(Boolean).map(vowelForm)}>{vowelCard(v)}</Wrap>)
              : g.length > 1 ? <div className="vrow">{g.map(vowelCard)}</div> : vowelCard(g[0])}
            {g.flatMap(v => v.after ?? []).map(ruleCard)}
            {lesson.vocabAfterVowel && g.some(v => v.id === lesson.vocabAfterVowel) && lesson.vocab.length > 0 && (
              <>
                <h3 className="vgroup-h">單字</h3>
                <WordList compact="wide" words={lesson.vocab} showZh={showZh} showRoman={wordRoman} />
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

      {cur === 'vocab' && <WordList compact="wide" words={lesson.vocab} showZh={showZh} showRoman={wordRoman} />}

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
            <MemeCard key={m.title || m.imageUrl} m={m} />
          ))}
        </section>
      )}
    </>
  )

  if (printLesson) return (
    <article className="h-lesson">
      <header className="h-head">
        <div className="h-num">L{lesson.number}</div>
        <h1>{lesson.title}</h1>
        <RuleBody body={lesson.summary} />
      </header>
      {tabs.filter(([k]) => k !== 'games').map(([k, label]) => (
        <section className={`lsec sec-${k}`} key={k}><h2 className="lsec-h">{label}</h2>{content(k)}</section>
      ))}
    </article>
  )

  return (
    <>
      {(() => { const st = getSession(); return <p>{st ? <Link to={`/book?t=${encodeURIComponent(st.token)}`}>← 回到課程與作業</Link> : <Link to="/reading">← 認字課程</Link>}</p> })()}
      <h1>L{lesson.number}　{lesson.title}</h1>
      {/* 說明有換行時列點（L15） */}
      <div className="muted lsummary"><RuleBody body={lesson.summary} /></div>

      {/* 投影片模式：資料設了 slides 的課才開放（見 lesson-slides skill） */}
      {lesson.slides && <div className="toolbar"><Link className="btn" to={`/reading/lesson/${lesson.id}/present`}>▶ 投影片模式</Link></div>}

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
