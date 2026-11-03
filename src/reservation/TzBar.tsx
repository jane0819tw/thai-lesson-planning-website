import { useEffect, useState } from 'react'
import { TZ_CHOICES, deviceTz, msIn, tzLabel, tzName, wdName } from './tz'

interface Props { tz: string; setTz: (tz: string) => void; auto: boolean }

/** 「以下時間為 曼谷時間（UTC+7）・現在 11/04（三）14:32」＋更換時區 */
export default function TzBar({ tz, setTz, auto }: Props) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 20000); return () => clearInterval(i) }, [])
  const [open, setOpen] = useState(false)
  const dev = deviceTz()
  const s = msIn(now, tz)
  const choices = TZ_CHOICES.some(([k]) => k === dev) ? TZ_CHOICES : [[dev, tzName(dev)] as [string, string], ...TZ_CHOICES]
  return (
    <div className="bk-tz">
      <span>🌏 以下時間都是 <b>{tzLabel(tz, now)}</b>・現在 <b>{+s.slice(5, 7)}/{+s.slice(8, 10)}（{wdName(s.slice(0, 10))}）{s.slice(11)}</b></span>
      <span className="bk-muted">{auto ? '（依你的裝置所在地自動偵測）' : '（你手動選的時區）'}</span>
      {!auto && dev !== tz && <button className="mini" onClick={() => setTz('')}>改用裝置所在地：{tzName(dev)}</button>}
      {open
        ? <select autoFocus value={auto ? '' : tz} onChange={e => { setTz(e.target.value); setOpen(false) }} onBlur={() => setOpen(false)}>
            <option value="">自動偵測（{tzLabel(dev, now)}）</option>
            {choices.map(([k]) => <option key={k} value={k}>{tzLabel(k, now)}</option>)}
          </select>
        : <button className="mini" onClick={() => setOpen(true)}>更換時區</button>}
    </div>
  )
}
