import { useState } from 'react'

// 會話課的顯示開關：拼音、中文、喇叭（播放鈕）預設開，藝術字預設關（和認字課投影片「中文預設關」不同，不共用）
// 存在這台電腦，課程頁、投影片、列印講義讀同一份
export interface ConvToggles { rom: boolean; zh: boolean; speak: boolean; art: boolean }
const KEY = 'conv-toggles'
const DEFAULT: ConvToggles = { rom: true, zh: true, speak: true, art: false }

function load(): ConvToggles {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return DEFAULT }
}

export function useConvToggles(): [ConvToggles, (k: keyof ConvToggles) => void] {
  const [t, setT] = useState<ConvToggles>(load)
  const flip = (k: keyof ConvToggles) => setT(cur => {
    const next = { ...cur, [k]: !cur[k] }
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* 存不了就算了 */ }
    return next
  })
  return [t, flip]
}

/** 外層 class：tf-loopless＝藝術字（同歌詞頁）；c-hide-rom、c-hide-zh、c-hide-speak 藏拼音、中文、喇叭（保留位置，版面不跳） */
export const toggleClass = (t: ConvToggles) => `tf-${t.art ? 'loopless' : 'std'}${t.rom ? '' : ' c-hide-rom'}${t.zh ? '' : ' c-hide-zh'}${t.speak ? '' : ' c-hide-speak'}`

export function ToggleBar({ t, flip }: { t: ConvToggles; flip: (k: keyof ConvToggles) => void }) {
  return (
    <span className="c-toggles">
      <button type="button" className="vtog" aria-pressed={t.rom} onClick={() => flip('rom')}>拼音</button>
      <button type="button" className="vtog" aria-pressed={t.zh} onClick={() => flip('zh')}>中文</button>
      <button type="button" className="vtog" aria-pressed={t.speak} onClick={() => flip('speak')}>喇叭</button>
      <button type="button" className="vtog" aria-pressed={t.art} onClick={() => flip('art')}>藝術字</button>
    </span>
  )
}
