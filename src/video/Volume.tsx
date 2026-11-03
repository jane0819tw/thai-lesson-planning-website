import { useEffect, useState } from 'react'
import type { YTPlayer } from './youtube'

const KEY = 'video-volume'

/** 影片音量：🔊 靜音切換＋滑桿。影片教學、歌詞跟讀共用，設定存在瀏覽器，下次打開沿用。 */
export function Volume({ player, ready }: { player: YTPlayer | null; ready: boolean }) {
  const [vol, setVol] = useState(() => {
    const v = Number(localStorage.getItem(KEY))
    return Number.isFinite(v) && localStorage.getItem(KEY) !== null ? Math.min(100, Math.max(0, v)) : 100
  })
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    if (!ready || !player) return
    // 播放器剛被拆掉（換頁、熱更新）時 YouTube 會丟錯，忽略即可，不能讓整頁掛掉
    try {
      player.setVolume(vol)
      if (muted || vol === 0) player.mute(); else player.unMute()
    } catch { /* 播放器已移除 */ }
  }, [player, ready, vol, muted])
  useEffect(() => { localStorage.setItem(KEY, String(vol)) }, [vol])

  const off = muted || vol === 0
  return (
    <span className="vvol">
      <button
        type="button"
        className="vtog"
        aria-pressed={off}
        aria-label={off ? '取消靜音' : '靜音'}
        onClick={() => { if (vol === 0) { setVol(60); setMuted(false) } else setMuted(m => !m) }}
        disabled={!ready}
      >{off ? '🔇' : vol < 50 ? '🔉' : '🔊'}</button>
      <input
        type="range" min={0} max={100} step={5} value={off ? 0 : vol}
        aria-label="影片音量"
        onChange={e => { setVol(Number(e.target.value)); setMuted(false) }}
        disabled={!ready}
      />
    </span>
  )
}
