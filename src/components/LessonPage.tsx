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
import Games, { vowelSyllables } from './Games'
import RuleDemo from './RuleDemo'
import ToneIntro from './ToneIntro'
import VowelIntro from './VowelIntro'

const GROUP_ZH = { mid: '中子音', high: '高子音', lcp: '低子音 LCp', lcs: '低子音 LCs' } as const
type Tab = 'rules' | 'games' | 'extras' | 'diagram' | 'consonants' | 'vowels' | 'tones' | 'vocab' | 'practice' | 'memes'

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
    if (lesson.diagram) t.push(['diagram', lesson.diagram.title])
    if (lesson.vowels.length) t.push(['vowels', '母音'])
    if (lesson.rules.length) t.push(['rules', '說明'])
    if (lesson.consonants.length) t.push(['consonants', '子音'])
    if (lesson.toneTables.length) t.push(['tones', '聲調表'])
    if (lesson.vocab.length) t.push(['vocab', '單字'])
    if (lesson.practice.length || lesson.patterns.length) t.push(['practice', '練習・句型'])
    if (lesson.memes.length) t.push(['memes', '梗圖'])
    if (lesson.consonants.length >= 4 || vowelSyllables(lesson.vowels).length >= 6) t.push(['games', '互動練習'])
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

  const content = (cur: Tab) => (
    <>
      {cur === 'diagram' && lesson.diagram && <DiagramView d={lesson.diagram} />}

      {cur === 'rules' && (
        <section className="stack">
          {lesson.rules.map(r => (
            <article className="card" key={r.id}><h3>{r.title}</h3><p>{r.body}</p>{r.demo && <RuleDemo tiles={r.demo} />}</article>
          ))}
        </section>
      )}

      {cur === 'games' && <Games consonants={lesson.consonants} vowels={lesson.vowels} />}

      {cur === 'extras' && (
        <section className="stack">
          {lesson.extras.map(x => (
            <article className="card" key={x.title}>
              <h3>{x.title}</h3>
              {x.lines.map((l, i) => <p className="th big2" key={i}>{l}</p>)}
              {x.images?.map(im => <img key={im.src} src={`${import.meta.env.BASE_URL}${im.src}`} alt={im.alt} style={{ maxWidth: '100%', borderRadius: 12 }} />)}
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
                <div className="small mini">
                  {c.words.map(w => <span key={w.thai} className="minichip"><span className="th">{w.star ? '＊' : ''}{w.thai}</span>{showZh && w.zh ? ` ${w.zh}` : ''}</span>)}
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {cur === 'vowels' && (
        <>
        {lesson.vowelIntro && <VowelIntro />}
        <section className="vstack">
          {lesson.vowels.map(v => (
            <Fragment key={v.id}>
            {v.preface?.map(r => <article className="card" key={r.id}><h3>{r.title}</h3><p>{r.body}</p></article>)}
            <article className="vcard">
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
              {(v.shortSyllables.length > 0 || v.longSyllables.length > 0) && (
                <div className="tablewrap">
                  <table className="vtable">
                    <tbody>
                      {[[v.shortSyllables, '短音'], [v.longSyllables, v.short ? '長音' : '例']].map(([list, label]) => (list as string[]).length > 0 && (
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
              {v.words.length > 0 && (
                <div className="vwords">
                  {v.words.map((w, i) => (
                    <div className="vword" key={w.thai + i}>
                      <span className="th vword-th">{w.star ? '＊' : ''}{w.thai}</span>
                      <SpeakButton text={w.thai} audioUrl={w.audioUrl} />
                      <span className="vword-meta">
                        {showRoman && w.roman && <span className="muted">{w.roman}</span>}
                        {showZh && w.zh && <span>{w.zh}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </article>
            </Fragment>
          ))}
        </section>
        </>
      )}

      {cur === 'tones' && (
        <>
          {lesson.toneIntro && <ToneIntro />}
          <section className="stack">{lesson.toneTables.map(t => <ToneTableView key={t.title} table={t} />)}</section>
        </>
      )}

      {cur === 'vocab' && <WordList words={lesson.vocab} showZh={showZh} showRoman={showRoman} />}

      {cur === 'practice' && (
        <section className="stack">
          {lesson.practice.map(g => (
            <article className="card" key={g.title}>
              <h3>{g.title}</h3>
              <WordList words={g.items.map(i => ({ thai: i.thai, zh: i.zh ?? '', group: i.note }))} showZh={showZh} showRoman={showRoman} />
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
        <section className="stack">
          {lesson.memes.map(m => (
            <article className="card" key={m.title}>
              {m.imageUrl ? <img src={m.imageUrl} alt={m.title} style={{ maxWidth: '100%' }} /> : <div className="meme-placeholder">梗圖待補</div>}
              <h3 className="th">{m.title}</h3>
              <p className="muted small">{m.desc}</p>
            </article>
          ))}
        </section>
      )}
    </>
  )

  return (
    <>
      {(() => { const st = getSession(); return <p>{st ? <Link to={`/book?t=${encodeURIComponent(st.token)}`}>← 回我的預約</Link> : <Link to="/reading">← 認字課程</Link>}</p> })()}
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
