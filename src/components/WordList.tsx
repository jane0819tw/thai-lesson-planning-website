import type { WordItem } from '../types'
import SpeakButton from './SpeakButton'
import ZoomImage from './ZoomImage'

export default function WordList({ words, showZh, showRoman }: { words: WordItem[]; showZh: boolean; showRoman: boolean }) {
  return (
    <section className="list">
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
