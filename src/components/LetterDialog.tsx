import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Consonant } from '../types'
import { getStrokes } from '../strokes'
import SpeakButton from './SpeakButton'
import StrokePlayer from './StrokePlayer'
import WordIcon from './WordIcon'

const GROUP_ZH = { mid: '中子音', high: '高子音', lcp: '低子音 LCp', lcs: '低子音 LCs' } as const

export default function LetterDialog({ char, info, onClose }: { char: string; info?: Consonant; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  const strokes = getStrokes(char)
  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="關閉">✕</button>
        <div className="dhead">
          <span className="big th">{char}</span>
          <WordIcon char={char} label={info?.zh} size={64} />
          {info && (
            <div>
              <div className="th">{info.name} <SpeakButton text={info.name} audioUrl={info.audioUrl} /></div>
              <div className="muted">{info.roman}　{info.zh}</div>
              <div className="small muted">{GROUP_ZH[info.group]}｜發音 {info.sound}{info.sameHigh && `｜同音高子音：${info.sameHigh}`}</div>
            </div>
          )}
          {!info && <SpeakButton text={char} />}
        </div>
        <h3>筆順</h3>
        {strokes ? <StrokePlayer char={char} data={strokes} /> : (
          <p className="muted">這個字的筆順資料還沒有。<Link to="/reading/stroke-editor" onClick={onClose}>用錄製工具建立</Link></p>
        )}
      </div>
    </div>
  )
}
