import type { ReactNode } from 'react'
import type { Lesson, Meme, PracticeGroup } from '../types'
import SpeakButton from './SpeakButton'
import ZoomImage from './ZoomImage'
import WordList from './WordList'
import VowelText from './VowelText'
import { vowelForm, vowelSpeech } from '../strokes'

// 課程頁與投影片共用的卡片：母音卡、練習卡內容、補充卡（投影片一張卡一頁）
const img = (src: string) => /^(https?:|data:|\/)/.test(src) ? src : `${import.meta.env.BASE_URL}${src}`
// 補充卡說明裡的網址（例如講義的 YouTube 影片）做成超連結，另開分頁
const linkify = (s: string) => s.split(/(https?:\/\/\S+)/).map((t, i) => i % 2 ? <a key={i} href={t} target="_blank" rel="noopener noreferrer">{t}</a> : t)

// 例字：一個一格，播放鈕＋中文（認字課不顯示拼音）
export function VowelWords({ words, showZh, showRoman = false }: { words: Lesson['vocab']; showZh: boolean; showRoman?: boolean }) {
  if (!words.length) return null
  return (
    <div className="vwords">
      {words.map((w, i) => (
        <div className={w.star ? 'vword wstar' : 'vword'} key={w.thai + i}>
          <span className="th vword-th">{w.thai}</span>
          <SpeakButton text={w.thai} audioUrl={w.audioUrl} />
          <span className="vword-meta">
            {showRoman && w.roman && <span className="muted">{w.roman}</span>}
            {showZh && w.zh && <span>{w.zh}</span>}
          </span>
          {w.image && <ZoomImage className="vword-img" src={img(w.image.src)} alt={w.image.alt} />}
        </div>
      ))}
    </div>
  )
}

// 母音卡：音標＋長短音大字（點了看筆順）＋拼讀表＋例字
// aside：列印講義放在母音右邊的練字格（有 aside 時，拼讀表和例字排成同一列，見 .vcard.has-aside）
export function VowelCard({ v, showZh, onOpen, aside }: { v: Lesson['vowels'][number]; showZh: boolean; onOpen: (x: { char: string; ipa: string }) => void; aside?: ReactNode }) {
  return (
    <article className={aside ? 'vcard has-aside' : 'vcard'}>
      <div className="vhead">
        <span className="vipa">{v.ipa}</span>
        <div className="vforms">
          {[[v.short, '短音'], [v.long, v.short ? '長音' : '']].map(([f, label], i) => f ? (
            <div key={i} className="vform-wrap">
              <button className="vform th" onClick={() => onOpen({ char: vowelForm(f), ipa: v.ipa })} aria-label={`查看 ${vowelForm(f)} 的筆順`}>
                <span className="vglyph"><VowelText form={f} /></span>
                {label && <span className="vlabel">{label}</span>}
              </button>
              <SpeakButton text={vowelSpeech(f)} />
            </div>
          ) : null)}
        </div>
        {aside && <div className="vaside">{aside}</div>}
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
      <VowelWords words={v.words} showZh={showZh} />
    </article>
  )
}

// 練習卡的內容（標題、隱藏中文按鈕由外層決定）：圖卡、問答、或一般清單
export function PracticeItems({ g, zh }: { g: PracticeGroup; zh: boolean }) {
  if (g.images) return (
    <div className={g.half ? 'picgrid half' : g.third ? 'picgrid third' : 'picgrid'}>
      {g.items.map(i => (
        <figure className="picword" key={i.thai}>
          {i.image ? <ZoomImage src={img(i.image.src)} alt={i.image.alt} /> : <div className="meme-placeholder">圖片待補</div>}
          <figcaption><span className="th big2">{i.thai}</span><SpeakButton text={i.thai} />{zh && i.zh && <span>{i.zh}</span>}</figcaption>
        </figure>
      ))}
    </div>
  )
  if (g.qa) return (
    <div className="qa">
      <WordList words={g.items.slice(0, 1).map(i => ({ thai: i.thai, zh: i.zh ?? '' }))} showZh={zh} showRoman={false} />
      <WordList words={g.items.slice(1).map(i => ({ thai: i.thai, zh: i.zh ?? '' }))} showZh={zh} showRoman={false} />
    </div>
  )
  return <WordList compact={g.half ? 'half' : g.third ? 'third' : true} words={g.items.map(i => ({ thai: i.thai, zh: i.zh ?? '', group: i.note }))} showZh={zh} showRoman={false} tagFirst />
}

// 補充卡（梗圖、廣告、影片截圖）：標題、大字泰文、說明（網址可點）、圖
export function MemeCard({ m, className }: { m: Meme; className?: string }) {
  return (
    <article className={className ?? (m.half ? 'card half' : 'card')}>
      {m.title && <h3>{m.title}</h3>}
      {m.big && <div className="th meme-big">{m.big}</div>}
      {m.desc && <p className="muted small">{linkify(m.desc)}</p>}
      {m.imageUrl ? <ZoomImage src={img(m.imageUrl)} alt={m.title || m.big || ''} style={{ maxWidth: '100%' }} /> : m.imageUrl === undefined && <div className="meme-placeholder">圖片待補</div>}
    </article>
  )
}
