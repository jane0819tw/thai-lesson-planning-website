import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../data/useCatalog'
import { speak } from '../audio/speak'
import LetterDialog from './LetterDialog'

type Mode = 'learn' | 'kedmanee'
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
const isCombining = (ch: string) => /[ัิ-ฺ็-๎]/.test(ch)
const label = (ch: string) => (isCombining(ch) ? '◌' + ch : ch)

export default function KeyboardPage() {
  const { consonants } = useCatalog()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<Mode>('learn')
  const [shift, setShift] = useState(false)
  const [last, setLast] = useState('')
  const [open, setOpen] = useState(false)
  const byChar = useMemo(() => new Map(consonants.map(c => [c.char, c])), [consonants])
  const cls = (ch: string) => byChar.get(ch)?.group ?? (isCombining(ch) ? 'vowel' : 'mark')

  const press = (ch: string) => { setText(t => t + ch); setLast(ch); if (shift) setShift(false) }
  const info = byChar.get(last)

  const Key = ({ ch, c }: { ch: string; c?: string }) => (
    <button className={`key th g-${c ?? cls(ch)}`} onClick={() => press(ch)}>{label(ch)}</button>
  )

  return (
    <>
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
          {info ? <span><b className="th">{info.name}</b>　{info.roman}　{info.zh}<br /><span className="muted small">發音 {info.sound}</span></span> : <span className="muted small">母音／符號</span>}
          <button className="act" onClick={() => setOpen(true)}>筆順</button>
        </div>
      )}

      <div className="tabs" role="tablist">
        <button className={mode === 'learn' ? 'on' : ''} onClick={() => setMode('learn')}>學習版（分類）</button>
        <button className={mode === 'kedmanee' ? 'on' : ''} onClick={() => setMode('kedmanee')}>標準鍵盤 Kedmanee</button>
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
      {open && last && <LetterDialog char={last} info={info} onClose={() => setOpen(false)} />}
    </>
  )
}
