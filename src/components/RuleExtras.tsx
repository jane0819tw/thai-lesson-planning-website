import { Fragment, type ReactNode } from 'react'
import type { Rule, SentencePart } from '../types'
import RuleDemo from './RuleDemo'
import SpeakButton from './SpeakButton'
import ToneTableView from './ToneTableView'

export const sentenceText = (s: SentencePart[]) => s.map(p => p.words.map(w => w.th).join('')).join(' ')

// 例句（L1 文字系統）：詞與詞連著寫（底線交替顏色標出詞的邊界），段與段之間的空格標成「空格」，下面一條「由左至右」箭頭
function Sentence({ parts }: { parts: SentencePart[] }) {
  return (
    <div className="rsent">
      <div className="rs-line">
        {parts.map((p, i) => (
          <span className="rs-seg" key={i}>
            {i > 0 && <span className="rs-gap"><span className="rs-gapbox" /><small>空格</small></span>}
            <span className="rs-part">
              <span className="rs-words">
                {p.words.map((w, k) => <span className={`rs-w${k % 2 ? ' alt' : ''}`} key={k}><span className="th">{w.th}</span><small>{w.zh}</small></span>)}
              </span>
              {p.zh && <small className="rs-pzh">{p.zh}</small>}
            </span>
          </span>
        ))}
        <SpeakButton text={sentenceText(parts)} />
      </div>
      <div className="rs-dir" aria-hidden="true">由左至右 →</div>
    </div>
  )
}

// 說明卡內文之後的附加內容：圖解（demo）、接續段落（parts）、例句、聲調表；課程頁與投影片共用
// Body：說明文字怎麼排（課程頁 RuleBody、投影片 SlideBody 會分點），parts 的說明也用它
export default function RuleExtras({ r, Body }: { r: Rule; Body: (p: { body: string }) => ReactNode }) {
  return (
    <>
      {r.sentence && <Sentence parts={r.sentence} />}
      {r.demo && <RuleDemo tiles={r.demo} />}
      {r.parts?.map((x, i) => <Fragment key={i}><Body body={x.body} />{x.demo && <RuleDemo tiles={x.demo} />}</Fragment>)}
      {r.toneTable && <ToneTableView table={r.toneTable} />}
    </>
  )
}
