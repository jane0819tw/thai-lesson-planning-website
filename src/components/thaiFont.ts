import { useState } from 'react'

// 鍵盤與輸入框可切換的泰文字體（同一個選擇記在瀏覽器，作業頁與泰文鍵盤頁共用）
export const THAI_FONTS = [
  { id: 'std', label: '標準' },
  { id: 'loopless', label: '無頭體 Headless' },
] as const
export type ThaiFontId = (typeof THAI_FONTS)[number]['id']
const KEY = 'thaiskr_keyfont'

export function useThaiFont(): [(typeof THAI_FONTS)[number], () => void] {
  const [id, setId] = useState<ThaiFontId>(() => {
    try { const v = localStorage.getItem(KEY); return THAI_FONTS.some(f => f.id === v) ? (v as ThaiFontId) : 'std' } catch { return 'std' }
  })
  const next = () => setId(cur => {
    const n = THAI_FONTS[(THAI_FONTS.findIndex(f => f.id === cur) + 1) % THAI_FONTS.length].id
    try { localStorage.setItem(KEY, n) } catch { /* 存不了就算了 */ }
    return n
  })
  return [THAI_FONTS.find(f => f.id === id)!, next]
}
