// 開放時段的規則 ⇄ 草稿轉換（純函式，不碰畫面）
// 規則：每週 → reg[星期]；單日 → ov[日期]（休假＝closed；其餘存成實際開放的格子，單位是「當天第幾分鐘」）
import type { Rule } from './types'

export const STEP = 30, LO0 = 360, HI0 = 1440
export interface Override { closed: boolean; label: string; set: Set<number> }
export interface Draft { reg: Record<number, Set<number>>; ov: Record<string, Override> }

export const hm = (m: number) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')
export const hhmm = (x: string) => { const [h, m] = x.split(':').map(Number); return h * 60 + m }
export const wdOf = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).getUTCDay() || 7 }
export const shiftDate = (d: string, n: number) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10) }
const fill = (set: Set<number>, a: string, b: string) => { for (let t = hhmm(a); t + STEP <= hhmm(b); t += STEP) set.add(t) }
const same = (a: Set<number>, b: Set<number>) => a.size === b.size && [...a].every(x => b.has(x))

export function buildDraft(rules: Rule[]): Draft {
  const reg: Draft['reg'] = {}
  for (let w = 1; w <= 7; w++) reg[w] = new Set()
  rules.filter(r => r.type === '每週').forEach(r => fill(reg[+r.weekday], r.start, r.end))
  const by: Record<string, Rule[]> = {}
  rules.filter(r => r.type !== '每週').forEach(r => (by[r.date] ??= []).push(r))
  const ov: Draft['ov'] = {}
  Object.keys(by).forEach(d => {
    const hol = by[d].find(r => r.type === '休假')
    if (hol) { ov[d] = { closed: true, label: hol.label || '休假', set: new Set() }; return }
    const set = new Set(by[d].some(r => r.type === '限定') ? [] : reg[wdOf(d)])
    by[d].forEach(r => fill(set, r.start, r.end))
    ov[d] = { closed: false, label: '', set }
  })
  return { reg, ov }
}

export const effective = (dr: Draft, d: string): Set<number> => { const o = dr.ov[d]; return o ? (o.closed ? new Set() : o.set) : dr.reg[wdOf(d)] }

function ranges(set: Set<number>): [number, number][] {
  const out: [number, number][] = []
  let s: number | null = null, p = 0
  ;[...set].sort((a, b) => a - b).forEach(t => {
    if (s === null) { s = p = t }
    else if (t === p + STEP) { p = t }
    else { out.push([s, p + STEP]); s = p = t }
  })
  if (s !== null) out.push([s, p + STEP])
  return out
}

export function serialize(dr: Draft, today: string): Rule[] {
  const rules: Rule[] = [], blank = { weekday: '' as const, date: '', start: '', end: '', label: '' }
  for (let w = 1; w <= 7; w++) ranges(dr.reg[w]).forEach(([a, b]) => rules.push({ ...blank, type: '每週', weekday: w, start: hm(a), end: hm(b) }))
  Object.keys(dr.ov).sort().forEach(d => {
    if (d < today) return // 過去的單日設定不再保留
    const o = dr.ov[d]
    if (o.closed || !o.set.size) rules.push({ ...blank, type: '休假', date: d, label: o.closed ? o.label : '休假' })
    else ranges(o.set).forEach(([a, b]) => rules.push({ ...blank, type: '限定', date: d, start: hm(a), end: hm(b) }))
  })
  return rules
}

/** 把一欄裡的一批格子設成開放／關閉。tab='reg'：key 是星期；tab='cal'：key 是日期（單日設定） */
export function paintCells(dr: Draft, tab: 'cal' | 'reg', key: string | number, mins: number[], on: boolean): Draft {
  if (tab === 'reg') {
    const set = new Set(dr.reg[+key])
    mins.forEach(m => (on ? set.add(m) : set.delete(m)))
    return { ...dr, reg: { ...dr.reg, [+key]: set } }
  }
  const date = String(key), wd = wdOf(date)
  const ov = { ...dr.ov }
  let o = ov[date] ? { ...ov[date], set: new Set(ov[date].set) } : { closed: false, label: '', set: new Set(dr.reg[wd]) }
  if (o.closed) o = { closed: false, label: '', set: new Set() }
  mins.forEach(m => (on ? o.set.add(m) : o.set.delete(m)))
  if (same(o.set, dr.reg[wd])) delete ov[date]; else ov[date] = o
  return { ...dr, ov }
}

/** label=null 代表取消休假 */
export function setHoliday(dr: Draft, date: string, label: string | null): Draft {
  const ov = { ...dr.ov }
  if (label === null) delete ov[date]; else ov[date] = { closed: true, label: label || '休假', set: new Set() }
  return { ...dr, ov }
}
