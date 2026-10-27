import type { WordItem } from '../types'
import SpeakButton from './SpeakButton'
import ZoomImage from './ZoomImage'

// compact：一列排多個單字。true＝3～4 個（練習用）、'wide'＝2～3 個（單字清單用，每格要放得下拼音與中文）、'half'＝固定 2 個、'third'＝固定 3 個
export default function WordList({ words, showZh, showRoman, compact }: { words: WordItem[]; showZh: boolean; showRoman: boolean; compact?: boolean | 'wide' | 'half' | 'third' }) {
  return (
    <section className={compact === 'wide' || compact === 'half' || compact === 'third' ? `list compact ${compact}` : compact ? 'list compact' : 'list'}>
      {words.map((w, i) => (
        <article className="row" key={w.thai + i}>
          <div className="th big2">{w.star ? '＊' : ''}{w.thai}</div>
          <SpeakButton text={w.thai} audioUrl={w.audioUrl} />
          <div className="meta">
            {showRoman && w.roman && <span className="muted">{w.roman}</span>}
            {showZh && w.zh && <span>{w.zh}</span>}
            {w.group && <span className="chip">{w.group}</span>}
          </div>
          {w.image && <ZoomImage className="wordimg" src={`${import.meta.env.BASE_URL}${w.image.src}`} alt={w.image.alt} />}
        </article>
      ))}
    </section>
  )
}
