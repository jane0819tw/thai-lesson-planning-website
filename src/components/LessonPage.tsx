import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getSession } from '../reservation/session'
import { getRepository } from '../data/repository'
import type { Consonant, Lesson } from '../types'
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
import Games, { vowelSyllables } from './Games'
import RuleDemo from './RuleDemo'
import ToneIntro from './ToneIntro'
import VowelIntro from './VowelIntro'
import FinalsIntro from './FinalsIntro'
import VowelShiftView from './VowelShiftView'

const GROUP_ZH = { mid: '中子音', high: '高子音', lcp: '低子音 LCp', lcs: '低子音 LCs' } as const
type Tab = 'review' | 'finals' | 'rules' | 'games' | 'extras' | 'diagram' | 'consonants' | 'vowels' | 'vocab' | 'practice' | 'memes'

// 沒有句型、只有一組練習時，區塊直接用那組練習的名稱（例如「多音節練習」）
// 說明文字有換行時，每行列成一點
// **文字**：本課重點，粗體＋主色
const emph = (s: string) => s.split(/\*\*(.+?)\*\*/).map((t, i) => i % 2 ? <strong className="hl" key={i}>{t}</strong> : t)
const RuleBody = ({ body }: { body: string }) => body.includes('\n') ? <ul>{body.split('\n').map((l, i) => <li key={i}>{emph(l)}</li>)}</ul> : <p>{emph(body)}</p>
// 標 homework 的練習改放在作業頁
const lessonPractice = (l: Lesson) => l.practice.filter(g => !g.homework)
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

  useEffect(() => { getRepository().getLesson(id ?? '').then(l => { setLesson(l ?? null); setCollapsed(new Set()) }) }, [id])

  // 只顯示這一課有資料的分頁
  const tabs = useMemo(() => {
    if (!lesson) return [] as [Tab, string][]
    const t: [Tab, string][] = []
    if (lesson.review?.length) t.push(['review', '複習'])
    if (lesson.diagram) t.push(['diagram', lesson.diagram.title])
    if (lesson.vowels.length) t.push(['vowels', '母音'])
    if (lesson.rules.length || lesson.toneTables.length || lesson.finalsIntro || lesson.vowelShifts?.length) t.push(['rules', '說明'])
    if (lesson.finals?.length) t.push(['finals', '尾音'])
    if (lesson.consonants.length) t.push(['consonants', '子音'])
    if (lesson.vocab.length && !lesson.vocabAfterVowel && !lesson.finals?.length && !lesson.vowelShifts?.length) t.push(['vocab', '單字'])
    if (lessonPractice(lesson).length || lesson.patterns.length) t.push(['practice', practiceLabel(lesson)])
    if (lesson.memes.length) t.push(['memes', '補充'])
    if (lesson.consonants.length >= 4 || vowelSyllables(lesson.vowels).length >= 6 || lesson.vocab.length >= 4) t.push(['games', '互動練習'])
    if (lesson.extras.length) t.push(['extras', '補充'])
    return t
  }, [lesson])

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
    <article className="vcard final" key={f.id}>
      <div className="vhead">
        <div className="fletters">
          <div className={f.letters.length > 3 ? 'vforms many' : 'vforms'}>
            {f.letters.map(ch => (
              <span key={ch} className="vform th static"><span className="vglyph">{ch}</span></span>
            ))}
          </div>
          <span className="vipa">{f.sound}</span>
        </div>
        {f.mouth && <p className="fmouth"><strong>口型：</strong>{f.mouth}</p>}
      </div>
      {vwords(lesson.vocab.filter(w => w.group === f.group))}
    </article>
  )

  const content = (cur: Tab) => (
    <>
      {cur === 'diagram' && lesson.diagram && <DiagramView d={lesson.diagram} />}

      {cur === 'rules' && (
        <>
          {lesson.finalsIntro && <FinalsIntro />}
          <section className="stack">
            {lesson.rules.map(r => (
              <article className="card" key={r.id}><h3>{r.title}</h3><RuleBody body={r.body} />{r.demo && <RuleDemo tiles={r.demo} />}{r.toneTable && <ToneTableView table={r.toneTable} />}</article>
            ))}
          </section>
          {lesson.vowelShifts && <section className="stack">{lesson.vowelShifts.map((t, i) => <VowelShiftView key={i} table={t} vocab={lesson.vocab} showZh={showZh} />)}</section>}
          {/* 聲調表放在說明的最下面 */}
          {lesson.toneIntro && <ToneIntro />}
          {lesson.toneTables.length > 0 && <section className="stack">{lesson.toneTables.map(t => <ToneTableView key={t.title} table={t} />)}</section>}
        </>
      )}

      {cur === 'games' && <Games consonants={lesson.consonants} vowels={lesson.vowels} words={lesson.vocab} />}

      {(cur === 'extras' || cur === 'review') && (
        <section className="cardgrid">
          {(cur === 'review' ? lesson.review ?? [] : lesson.extras).map(x => (
            <article className="card" key={x.title}>
              <h3>{x.title}</h3>
              {x.lines.map((l, i) => <p className="th big2" key={i}>{l}</p>)}
              {x.toneTables?.map(t => <ToneTableView key={t.title} table={t} />)}
              {x.images?.map(im => <ZoomImage key={im.src} src={`${import.meta.env.BASE_URL}${im.src}`} alt={im.alt} style={{ maxWidth: '100%', borderRadius: 12 }} />)}
            </article>
          ))}
        </section>
      )}

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
          {lessonPractice(lesson).map(g => (
            <article className="card" key={g.title}>
              {g.title !== practiceLabel(lesson) && <h3>{g.title}</h3>}
              {g.images ? (
                <div className={g.half ? 'picgrid half' : g.third ? 'picgrid third' : 'picgrid'}>
                  {g.items.map(i => (
                    <figure className="picword" key={i.thai}>
                      {i.image ? <ZoomImage src={`${import.meta.env.BASE_URL}${i.image.src}`} alt={i.image.alt} /> : <div className="meme-placeholder">圖片待補</div>}
                      <figcaption><span className="th big2">{i.thai}</span><SpeakButton text={i.thai} />{showZh && i.zh && <span>{i.zh}</span>}</figcaption>
                    </figure>
                  ))}
                </div>
              ) : <WordList compact={g.half ? 'half' : g.third ? 'third' : true} words={g.items.map(i => ({ thai: i.thai, zh: i.zh ?? '', group: i.note }))} showZh={showZh} showRoman={showRoman} />}
            </article>
          ))}
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
      <p className="muted">{lesson.summary}</p>

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
              <li key={k}><button onClick={() => goto(k)}>{label}</button></li>
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
