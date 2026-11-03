// 時區：後端（試算表、規則、行事曆）一律存台北時間的牆上時間字串 'yyyy-MM-dd HH:mm'。
// 畫面上改用「看的人所在地」的時區顯示（學生、老師都可能在不同國家移動），送回後端時仍用台北時間字串。
import { useEffect, useState } from 'react'

export const BASE_TZ = 'Asia/Taipei'
const BASE_OFF = 480 // 台北 UTC+8，沒有夏令時間

/** 常用時區（選單用）；自動偵測到的時區不在清單裡時會另外加上去 */
export const TZ_CHOICES: [string, string][] = [
  ['Asia/Taipei', '台北'], ['Asia/Bangkok', '曼谷'], ['Asia/Ho_Chi_Minh', '胡志明市'], ['Asia/Singapore', '新加坡'], ['Asia/Kuala_Lumpur', '吉隆坡'], ['Asia/Jakarta', '雅加達'], ['Asia/Manila', '馬尼拉'], ['Asia/Kolkata', '印度'], ['Asia/Dubai', '杜拜'],
  ['Asia/Hong_Kong', '香港'], ['Asia/Shanghai', '上海'], ['Asia/Tokyo', '東京'], ['Asia/Seoul', '首爾'],
  ['Australia/Perth', '伯斯'], ['Australia/Brisbane', '布里斯本'], ['Australia/Sydney', '雪梨'], ['Australia/Melbourne', '墨爾本'], ['Pacific/Auckland', '奧克蘭'],
  ['Europe/London', '倫敦'], ['Europe/Paris', '巴黎'], ['Europe/Berlin', '柏林'], ['Europe/Amsterdam', '阿姆斯特丹'],
  ['America/New_York', '紐約'], ['America/Toronto', '多倫多'], ['America/Chicago', '芝加哥'], ['America/Denver', '丹佛'], ['America/Los_Angeles', '洛杉磯'], ['America/Vancouver', '溫哥華'],
]
const NAMES: Record<string, string> = Object.fromEntries(TZ_CHOICES)

const fmts: Record<string, Intl.DateTimeFormat> = {}
function parts(ms: number, tz: string) {
  const f = (fmts[tz] ??= new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }))
  const o: Record<string, string> = {}
  f.formatToParts(ms).forEach(p => { o[p.type] = p.value })
  return { date: `${o.year}-${o.month}-${o.day}`, time: `${o.hour === '24' ? '00' : o.hour}:${o.minute}` }
}

/** 裝置所在的時區 */
export const deviceTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || BASE_TZ } catch { return BASE_TZ } }
const valid = (tz: string) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false } }

/** 台北時間字串 → 時間戳 */
export const baseMs = (s: string) => { const [y, mo, d] = s.slice(0, 10).split('-').map(Number); const [h, m] = (s.slice(11, 16) || '00:00').split(':').map(Number); return Date.UTC(y, mo - 1, d, h, m) - BASE_OFF * 60000 }
/** 時間戳 → 某時區的 'yyyy-MM-dd HH:mm' */
export const msIn = (ms: number, tz: string) => { const p = parts(ms, tz); return `${p.date} ${p.time}` }
/** 台北時間字串 → 某時區的 'yyyy-MM-dd HH:mm'（只有日期的字串原樣回傳） */
export const fromBase = (s: string, tz: string) => (s.length < 16 ? s : msIn(baseMs(s), tz) + s.slice(16))
/** 某時區在某時刻比 UTC 快幾分鐘 */
export const offsetOf = (tz: string, ms: number) => { const p = parts(ms, tz); return Math.round((baseMs(`${p.date} ${p.time}`) + BASE_OFF * 60000 - Math.floor(ms / 60000) * 60000) / 60000) }
/** 某時區比台北快幾分鐘（以那一天中午計，夏令時間切換當天會有一小時誤差） */
export const diffOn = (tz: string, date: string) => offsetOf(tz, baseMs(`${date} 12:00`)) - BASE_OFF

const utc = (off: number) => `UTC${off < 0 ? '−' : '+'}${Math.floor(Math.abs(off) / 60)}${Math.abs(off) % 60 ? ':' + String(Math.abs(off) % 60).padStart(2, '0') : ''}`
/** 「曼谷時間（UTC+7）」 */
export const tzName = (tz: string) => NAMES[tz] ?? tz.split('/').pop()!.replace(/_/g, ' ')
export const tzLabel = (tz: string, ms = Date.now()) => `${tzName(tz)}時間（${utc(offsetOf(tz, ms))}）`

// 選擇記在這個瀏覽器；沒選過＝跟著裝置走（人移動到別的國家，手機時區一改就跟著變）
const KEY = 'thaiskr_tz'
const saved = () => { try { const v = localStorage.getItem(KEY) || ''; return valid(v) ? v : '' } catch { return '' } }
const subs = new Set<() => void>()

/** [目前顯示用的時區, 設定（空字串＝跟著裝置）] */
export function useViewTz(): [string, (tz: string) => void, boolean] {
  const [pick, setPick] = useState(saved)
  useEffect(() => { const f = () => setPick(saved()); subs.add(f); window.addEventListener('storage', f); return () => { subs.delete(f); window.removeEventListener('storage', f) } }, [])
  const set = (tz: string) => { try { if (tz) localStorage.setItem(KEY, tz); else localStorage.removeItem(KEY) } catch { /* 存不了就算了 */ } subs.forEach(f => f()) }
  return [pick || deviceTz(), set, !pick]
}

const WD = ['日', '一', '二', '三', '四', '五', '六']
export const wdName = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return WD[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()] }
