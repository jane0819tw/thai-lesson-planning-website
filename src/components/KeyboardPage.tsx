import { soundLabel } from '../consonant'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../data/useCatalog'
import { speak } from '../audio/speak'
import { useThaiFont } from './thaiFont'
import LetterDialog from './LetterDialog'

type Mode = 'learn' | 'kedmanee' | 'four'
type Section = { title: string; keys: string; cls: string }

// 學習版：依講義的分類排列，顏色 = 子音類別
const SECTIONS: Section[] = [
  { title: '中子音（9）', keys: 'ก จ อ ป บ ต ด ฏ ฎ', cls: 'mid' },
  { title: '高子音（11）', keys: 'ผ ฝ ถ ฐ ห ข ฃ ฉ ส ษ ศ', cls: 'high' },
  { title: '低子音 LCp（14）', keys: 'พ ภ ฟ ท ฑ ธ ฒ ค ฆ ฅ ฮ ช ฌ ซ', cls: 'lcp' },
  { title: '低子音 LCs（10）', keys: 'ม น ย ว ง ล ร ณ ญ ฬ', cls: 'lcs' },
  { title: '母音', keys: 'ะ า ำ ิ ี ึ ื ุ ู ั ็ เ แ โ ไ ใ ฤ ฦ ฯ', cls: 'vowel' },
  { title: '聲調符號與其他', keys: '่ ้ ๊ ๋ ์ ๆ ฿ ๐ ๑ ๒ ๓ ๔ ๕ ๖ ๗ ๘ ๙', cls: 'mark' },
]
// Kedmanee（標準泰文鍵盤）：[一般, Shift]
const KED: [string, string][][] = [
  [['_', '%'], ['ๅ', '+'], ['/', '๑'], ['-', '๒'], ['ภ', '๓'], ['ถ', '๔'], ['ุ', 'ู'], ['ึ', '฿'], ['ค', '๕'], ['ต', '๖'], ['จ', '๗'], ['ข', '๘'], ['ช', '๙']],
  [['ๆ', '๐'], ['ไ', '"'], ['ำ', 'ฎ'], ['พ', 'ฑ'], ['ะ', 'ธ'], ['ั', 'ํ'], ['ี', '๊'], ['ร', 'ณ'], ['น', 'ฯ'], ['ย', 'ญ'], ['บ', 'ฐ'], ['ล', ','], ['ฃ', 'ฅ']],
  [['ฟ', 'ฤ'], ['ห', 'ฆ'], ['ก', 'ฏ'], ['ด', 'โ'], ['เ', 'ฌ'], ['้', '็'], ['่', '๋'], ['า', 'ษ'], ['ส', 'ศ'], ['ว', 'ซ'], ['ง', '.']],
  [['ผ', '('], ['ป', ')'], ['แ', 'ฉ'], ['อ', 'ฮ'], ['ิ', 'ฺ'], ['ื', '์'], ['ท', '?'], ['ม', 'ฒ'], ['ใ', 'ฬ'], ['ฝ', 'ฦ']],
]
// 四排（手機精簡排列）：前三排是字母 [一般, Shift]，'' = 空位；第三排左右是 ⇧ 和 ⌫；第四排是上方／下方母音與聲調符號（不分上下檔）＋空格
const ROWS4: [string, string][][] = [
  [['ต', 'ถ'], ['ค', 'ภ'], ['พ', 'ำ'], ['ะ', 'โ'], ['ข', 'ฦ'], ['ว', 'ฎ'], ['ร', 'ซ'], ['น', 'ณ'], ['ย', 'ญ'], ['ไ', 'ฯ'], ['ใ', '']],
  [['ห', 'ฤ'], ['ก', 'ฟ'], ['ด', 'ฆ'], ['เ', 'ฏ'], ['จ', 'ฌ'], ['บ', 'ษ'], ['า', 'ศ'], ['ล', 'ๆ'], ['ส', 'ฬ'], ['แ', '.']],
  [['ผ', 'ฑ'], ['ป', 'ธ'], ['อ', 'ฉ'], ['ง', 'ฐ'], ['ช', 'ฮ'], ['ท', 'ฒ'], ['ม', 'ฝ']],
]
const MARKS4 = 'ั ิ ี ึ ื ุ ู ็ ่ ้ ๊ ๋ ์'.split(' ')
export { SECTIONS, KED, ROWS4, MARKS4 }

// 四排鍵盤：寫成一般函式（不是元件），按鍵時才不會整排重建、手機上閃
export function fourRows({ shift, onShift, onKey, onBack }: { shift: boolean; onShift: () => void; onKey: (ch: string) => void; onBack: () => void }) {
  const k = (pair: [string, string], i: number) => {
    const ch = pair[shift ? 1 : 0]
    return ch
      ? <button type="button" key={i} className="key th" onClick={() => onKey(ch)}>{label(ch)}</button>
      : <span key={i} className="kspace" style={{ flexGrow: 1 }} />
  }
  return (
    <div className="hw-ked k4">
      <div className="krow">{ROWS4[0].map(k)}</div>
      <div className="krow"><span className="kspace" style={{ flexGrow: 0.5 }} />{ROWS4[1].map(k)}<span className="kspace" style={{ flexGrow: 0.5 }} /></div>
      <div className="krow">
        <button type="button" className={`key act${shift ? ' on' : ''}`} style={{ flexGrow: 1.5 }} onClick={onShift}>⇧</button>
        {ROWS4[2].map(k)}
        <button type="button" className="key act" style={{ flexGrow: 1.5 }} onClick={onBack}>⌫</button>
      </div>
      <div className="krow">
        {MARKS4.map(ch => <button type="button" key={ch} className="key th g-vowel" onClick={() => onKey(ch)}>{label(ch)}</button>)}
        <button type="button" className="key act" style={{ flexGrow: 3 }} onClick={() => onKey(' ')}>空格</button>
      </div>
    </div>
  )
}
export const isCombining = (ch: string) => /[ัิ-ฺ็-๎]/.test(ch)
export const label = (ch: string) => (isCombining(ch) ? '◌' + ch : ch)

export default function KeyboardPage() {
  const { consonants } = useCatalog()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<Mode>('learn')
  const [shift, setShift] = useState(false)
  const [last, setLast] = useState('')
  const [open, setOpen] = useState(false)
  const [font, nextFont] = useThaiFont()
  const byChar = useMemo(() => new Map(consonants.map(c => [c.char, c])), [consonants])
  const cls = (ch: string) => byChar.get(ch)?.group ?? (isCombining(ch) ? 'vowel' : 'mark')

  const press = (ch: string) => { setText(t => t + ch); setLast(ch); if (shift) setShift(false) }
  const info = byChar.get(last)

  const Key = ({ ch, c }: { ch: string; c?: string }) => (
    <button className={`key th g-${c ?? cls(ch)}`} onClick={() => press(ch)}>{label(ch)}</button>
  )

  return (
    <div className={`tf-${font.id}`}>
      <p><Link to="/reading">← 認字課程</Link></p>
      <h1>泰文鍵盤</h1>
      <div className="outbox">
        <textarea className="th out" readOnly inputMode="none" value={text} placeholder="點下面的字母…" rows={2} />
        <div className="kbtools">
          <button className="act" onClick={() => setText(t => Array.from(t).slice(0, -1).join(''))}>⌫</button>
          <button className="act" onClick={() => setText(t => t + ' ')}>空格</button>
          <button className="act" onClick={() => setText('')}>清除</button>
          <button className="act" onClick={() => text && speak(text)}>🔊 朗讀</button>
          <button className="act" onClick={() => { void navigator.clipboard?.writeText(text) }}>複製</button>
        </div>
      </div>

      {last && (
        <div className="kinfo">
          <span className="big th">{last}</span>
          {info ? <span><b className="th">{info.name}</b>　{info.roman}　{info.zh}<br /><span className="muted small">{soundLabel(info)}</span></span> : <span className="muted small">母音／符號</span>}
          <button className="act" onClick={() => setOpen(true)}>筆順</button>
        </div>
      )}

      <div className="tabs" role="tablist">
        <button className={mode === 'learn' ? 'on' : ''} onClick={() => setMode('learn')}>學習版（分類）</button>
        <button className={mode === 'kedmanee' ? 'on' : ''} onClick={() => setMode('kedmanee')}>標準鍵盤 Kedmanee</button>
        <button className={mode === 'four' ? 'on' : ''} onClick={() => setMode('four')}>四排</button>
        <button onClick={nextFont} title="切換字體">Aa 字體：{font.label}</button>
      </div>

      {mode === 'learn' && SECTIONS.map(s => (
        <section key={s.title} className="ksec">
          <h3>{s.title}</h3>
          <div className="krow">{s.keys.split(' ').map(ch => <Key key={ch} ch={ch} c={s.cls === 'vowel' || s.cls === 'mark' ? s.cls : undefined} />)}</div>
        </section>
      ))}

      {mode === 'kedmanee' && (
        <section className="ksec">
          <p className="muted small">依一般電腦／手機的 Kedmanee 排列；按 ⇧ 切換上檔字。</p>
          {KED.map((r, i) => <div className="krow center" key={i}>{r.map(([a, b]) => <Key key={a} ch={shift ? b : a} />)}</div>)}
          <div className="krow center">
            <button className={`key act wide${shift ? ' on' : ''}`} onClick={() => setShift(s => !s)}>⇧</button>
            <button className="key wide2" onClick={() => press(' ')}>空格</button>
          </div>
        </section>
      )}
      {mode === 'four' && (
        <section className="ksec">
          <p className="muted small">手機精簡排列：前三排是字母（按 ⇧ 切換上檔字），第四排是母音與聲調符號。</p>
          {fourRows({ shift, onShift: () => setShift(s => !s), onKey: press, onBack: () => setText(t => Array.from(t).slice(0, -1).join('')) })}
        </section>
      )}
      {open && last && <LetterDialog char={last} info={info} onClose={() => setOpen(false)} />}
    </div>
  )
}
