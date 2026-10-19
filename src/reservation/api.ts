import type { StudentView } from './types'

// Apps Script「網頁應用程式」網址（結尾 /exec）。這個網址本來就會公開，不是密碼。
// 留空或網址帶 mock=1 時使用假資料，不會碰到真實試算表。
export const ENDPOINT = 'https://script.google.com/macros/s/AKfycbxfMPqPLR0wlaV4RfW40stOthBs_pikwfAG97W9X7tVhoyHOk6budX-N75V4fuHKGgb/exec'

interface Api {
  getStudentView(token: string): Promise<StudentView>
  submitBooking(token: string, name: string, email: string, start: string, len: number): Promise<{ ok: boolean }>
}

async function call<T>(fn: string, args: unknown[]): Promise<T> {
  let r: Response
  // text/plain 避免瀏覽器送 CORS preflight（Apps Script 不支援 OPTIONS）
  try { r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn, args }) }) }
  catch { throw new Error('連線失敗，請檢查網路後再試') }
  let d: { ok: boolean; data?: T; error?: string }
  try { d = await r.json() } catch { throw new Error('伺服器回應格式不正確（網址是否為最新部署的 /exec？）') }
  if (!d.ok) throw new Error(d.error || '發生錯誤')
  return d.data as T
}

const real: Api = {
  getStudentView: t => call('getStudentView', [t]),
  submitBooking: (t, n, e, s, l) => call('submitBooking', [t, n, e, s, l]),
}

// ───────── 假資料（資料只在記憶體裡）─────────
const day = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
const hhmm = (offsetMin: number) => new Date(Date.now() + 8 * 3600000 + offsetMin * 60000).toISOString().slice(11, 16)
const sl = (...t: [string, boolean, boolean][]) => t.map(([time, can25, can50]) => ({ time, can25, can50 }))
const delay = <T,>(v: T) => new Promise<T>(res => setTimeout(() => res(v), 150))

const mock: Api = {
  getStudentView: t => t === 'bad' ? delay({ mode: 'invalid' } as StudentView) : delay({
    mode: t ? 'known' : 'generic', name: t ? 'Jenny' : '',
    days: [
      { date: day(1), closed: '', label: '', slots: sl(['19:00', true, true], ['19:30', false, false], ['20:00', true, true], ['20:30', true, false]) },
      { date: day(2), closed: '休假', label: '出國', slots: [] },
      { date: day(3), closed: '', label: '', slots: sl(['10:00', false, false], ['10:30', false, false]) },
      { date: day(4), closed: '', label: '', slots: sl(['19:00', true, true], ['19:30', true, false]) },
    ],
    asOf: new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' '),
    lastLesson: t ? { date: '2026-09-25', progress: '會話Level2L3第一頁', next: '會話Level2L3第2頁開始' } : null,
    lessons: t ? { bought: 10, used: 3, booked: 3, left: 7, len: 25, leftMinutes: 175 } : null,
    upcoming: t ? [
      { start: `${day(0)} ${hhmm(5)}`, end: `${day(0)} ${hhmm(35)}`, length: 25, count: 1, status: '已確認', zoom: 'https://zoom.us/j/123' },
      { start: `${day(2)} 09:00`, end: `${day(2)} 10:00`, length: 25, count: 2, status: '已確認', zoom: 'https://zoom.us/j/456' },
      { start: `${day(3)} 10:00`, end: `${day(3)} 10:25`, length: 25, count: 1, status: '待確認', zoom: '' },
    ] : [],
  }),
  submitBooking: (t, n) => (!t && !n ? Promise.reject(new Error('請填姓名')) : delay({ ok: true })),
}

export const getApi = (useMock: boolean): Api => (useMock || !ENDPOINT ? mock : real)
