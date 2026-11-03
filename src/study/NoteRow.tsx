import { Rom } from '../video/Rom'
import type { StudyNote } from './types'

/**
 * 單字／句型：一列一則。左邊是詞（標籤、泰文、音標、中文），右邊是解釋和例句。
 * 沒有解釋也沒有例句的單字（影片單字表）縮成一行。
 */
export function NoteRow({ note, showRom = true, showZh = true, onSpeak }: {
  note: StudyNote; showRom?: boolean; showZh?: boolean; onSpeak?: (th: string) => void
}) {
  const body = !!note.explain || note.examples.length > 0
  return (
    <div className={`nrow nk-${note.kind}${body ? '' : ' nrow-brief'}`} id={`note-${note.id}`}>
      <div className="nrow-head">
        <span className="nkind">{note.kind === 'word' ? '單字' : '句型'}</span>
        <span className="th nrow-th">{note.th}</span>
        {showRom && note.rom && <Rom text={note.rom} />}
        <b className="nrow-zh">{note.zh}</b>
        {/* 句型的標題有「+ 受詞」這種中文，不能唸 */}
        {onSpeak && note.kind === 'word' && <button type="button" className="speak" aria-label={`播放發音：${note.th}`} onClick={() => onSpeak(note.th)}>🔊</button>}
      </div>
      {body && (
        <div className="nrow-body">
          {note.explain && <p className="nrow-explain">{note.explain}</p>}
          {note.examples.map((x, k) => (
            <div key={k} className="nrow-eg">
              <span className="th">{x.th}</span>
              {showRom && <Rom text={x.rom} />}
              {showZh && <span className="small">{x.zh}</span>}
              {onSpeak && <button type="button" className="vmini" onClick={() => onSpeak(x.th)}>播放</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** 頁面下方的「單字」「句型」兩區（同歌詞頁：單字在前） */
export function NoteSections({ notes, onSpeak }: { notes: StudyNote[]; onSpeak?: (th: string) => void }) {
  return <>
    {(['word', 'pattern'] as const).map(k => {
      const list = notes.filter(n => n.kind === k)
      return list.length > 0 && (
        <section key={k} className="sextra">
          <h2>{k === 'word' ? '單字' : '句型'}</h2>
          <div className="nlist">{list.map(n => <NoteRow key={n.id} note={n} onSpeak={onSpeak} />)}</div>
        </section>
      )
    })}
  </>
}
