import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Rom } from '../video/Rom'
import { firstOfLines, repeatsOfLines, shownAsLines } from '../song/lines'
import type { StudyDoc } from './types'

/** 開瀏覽器列印視窗（可選「另存為 PDF」），檔名預設取 document.title */
export function printDoc(doc: StudyDoc) {
  const old = document.title
  document.title = `${doc.title} ${doc.kind === 'song' ? '歌詞' : '影片'}講義`
  window.addEventListener('afterprint', () => { document.title = old }, { once: true })
  window.print()
}

/**
 * 列印用講義：平常隱藏，只在列印時取代整個網站畫面。
 * 歌詞／台詞右邊留筆記線，後面接單字、句型、練習、補充圖片、注意點（不印詳細解釋和解答）。
 */
export function PrintSheet({ doc, showRom, showZh, art }: { doc: StudyDoc; showRom: boolean; showZh: boolean; art: boolean }) {
  const firstOf = useMemo(() => firstOfLines(doc.lines), [doc.lines])
  const repeatsOf = useMemo(() => repeatsOfLines(shownAsLines(doc.lines)), [doc.lines])
  const ABCD = 'ABCD'
  const visible = doc.lines.map((L, i) => ({ L, i })).filter(({ L }) => !L.hidden)
  const words = doc.notes.filter(n => n.kind === 'word')
  const pats = doc.notes.filter(n => n.kind === 'pattern')
  let sec = 0
  const head = (t: string) => <h2>{'一二三四五六七'[sec++]}、{t}</h2>
  const noteBlock = (n: StudyDoc['notes'][number]) => (
    <div key={n.id} className="pr-note">
      <p className="pr-note-h"><span className={`pr-kind pk-${n.kind}`}>{n.kind === 'word' ? '單字' : '句型'}</span><span className="th">{n.th}</span>{showRom && n.rom && <Rom text={n.rom} />}<b>{n.zh}</b></p>
      {n.examples.map((x, k) => (
        <div key={k} className="pr-eg">
          <p className="th">例：{x.th}</p>
          {showRom && <p className="pr-rom"><Rom text={x.rom} /></p>}
          {showZh && <p className="pr-zh">{x.zh}</p>}
        </div>
      ))}
      <p className="pr-mine">我的例句：</p>
    </div>
  )
  return createPortal(
    <div className={`sprint tf-${art ? 'loopless' : 'std'}`} aria-hidden="true">
      <header className="pr-head">
        <div>
          <h1 className={doc.kind === 'video' ? 'th' : undefined}>{doc.title}</h1>
          <p>{doc.subtitle}</p>
        </div>
        <div className="pr-name">姓名＿＿＿＿＿＿　日期＿＿＿＿＿</div>
      </header>

      {head(doc.kind === 'song' ? '歌詞' : '台詞')}
      <ol className="pr-lines">
        {visible.map(({ L, i }, n) => {
          const rep = firstOf[i] !== i
          const again = repeatsOf[i].length
          return (
            <li key={i} className="pr-line">
              <span className="pr-no">{n + 1}</span>
              <div>
                <p className="th pr-th">{L.th}</p>
                {rep ? <p className="pr-meta">（同第 {visible.findIndex(v => v.i === firstOf[i]) + 1} 句）</p> : <>
                  {showRom && <p className="pr-rom"><Rom text={L.words.map(w => w.rom).filter(Boolean).join(' ')} /></p>}
                  {showZh && L.zh && <p className="pr-zh">{L.zh}</p>}
                </>}
                {again > 0 && <p className="pr-meta">副歌・之後再唱 {again} 次</p>}
              </div>
              <div className="pr-rule" />
            </li>
          )
        })}
      </ol>

      {words.length > 0 && (
        <section>
          {head('單字')}
          {/* 有例句的單字（歌曲）照句型的樣子印；只有詞義的單字表（影片）印成兩欄小表 */}
          {words.some(n => n.examples.length) ? words.map(noteBlock) : (
            <table className="pr-vocab">
              <tbody>
                {words.map(n => (
                  <tr key={n.id}><td className="th">{n.th}</td><td>{showRom && n.rom && <Rom text={n.rom} />}</td><td>{n.zh}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {pats.length > 0 && <section>{head('句型')}{pats.map(noteBlock)}</section>}

      {!!doc.quiz?.length && (
        <section>
          {head('練習')}
          <ol className="pr-quiz">
            {doc.quiz.map((q, i) => (
              <li key={i}>
                <p><span className="pr-blank">（　　）</span><span className="th">{q.q}</span></p>
                {showZh && <p className="pr-zh">{q.qZh}</p>}
                <p className="pr-opts">{q.options.map((o, j) => <span key={j}>({ABCD[j]}) <span className="th">{o}</span></span>)}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!!doc.images?.length && (
        <section>
          {head('補充')}
          {/* 不用 lazy：講義平常是 display:none，lazy 的圖不會載入，印出來會空白 */}
          <div className="pr-imgs">
            {doc.images.map(im => (
              <figure key={im.src} className="pr-img">
                <img src={im.src} alt={im.alt} />
                {im.caption && <figcaption>{im.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}

      {!!doc.tips?.length && (
        <section>
          {head('注意點')}
          <ul className="pr-tips">{doc.tips.map(t => <li key={t.title}><b>{t.title}</b>：{t.body}</li>)}</ul>
        </section>
      )}
    </div>,
    document.body,
  )
}
