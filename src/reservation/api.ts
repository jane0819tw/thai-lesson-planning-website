import type { AdminState, HomeworkRecord, HomeworkRow, OpenDays, RecSession, Rule, StudentInfo, StudentView, Week } from './types'

// Apps Script「網頁應用程式」網址（結尾 /exec）。這個網址本來就會公開，不是密碼。
// 留空或網址帶 mock=1 時使用假資料，不會碰到真實試算表。
export const ENDPOINT = 'https://script.google.com/macros/s/AKfycbxfMPqPLR0wlaV4RfW40stOthBs_pikwfAG97W9X7tVhoyHOk6budX-N75V4fuHKGgb/exec'

export interface HomeworkResult { listen?: [number, number]; typing?: [number, number] }

interface Api {
  getStudentInfo(token: string): Promise<StudentInfo>
  /** force＝略過後端快取（學生按「重新整理時段」） */
  getOpenDays(force?: boolean): Promise<OpenDays>
  submitBooking(token: string, name: string, email: string, start: string, len: number): Promise<{ ok: boolean }>
  getHomeworkInfo(token: string, lessonNumber: number | string): Promise<{ name: string; last: HomeworkRecord | null }>
  submitHomework(token: string, lessonNumber: number | string, result: HomeworkResult): Promise<{ ok: boolean; name: string }>
  adminGetHomework(): Promise<HomeworkRow[]>
  adminGetState(): Promise<AdminState>
  adminGetWeek(date: string): Promise<Week>
  adminSaveRules(rules: Rule[]): Promise<boolean>
  adminSetStatus(id: string, status: string): Promise<boolean>
  adminCreateStudent(name: string, email: string, display?: string): Promise<boolean>
  adminDeleteStudent(name: string): Promise<boolean>
  adminRenewLink(name: string): Promise<boolean>
  adminSetRecord(name: string, url: string): Promise<boolean>
  adminSetDisplay(name: string, display: string): Promise<boolean>
  adminImportPlatformStudents(): Promise<{ added: string[]; linked: string[] }>
  adminSetCourses(name: string, courses: string[]): Promise<boolean>
  adminGetRecordSessions(): Promise<RecSession[]>
  adminCancelRecordLesson(name: string, start: string): Promise<boolean>
}

// 管理密鑰只存在這個瀏覽器（Apps Script 的 createAdminKey 產生）
const KEY_NAME = 'thaiskr_admin_key'
export const getAdminKey = () => { try { return localStorage.getItem(KEY_NAME) || '' } catch { return '' } }
export const setAdminKey = (k: string) => { try { k ? localStorage.setItem(KEY_NAME, k) : localStorage.removeItem(KEY_NAME) } catch { /* 無痕模式等情況存不了 */ } }

async function call<T>(fn: string, args: unknown[]): Promise<T> {
  let r: Response
  // text/plain 避免瀏覽器送 CORS preflight（Apps Script 不支援 OPTIONS）
  try { r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn, args, ...(fn.startsWith('admin') ? { key: getAdminKey() } : {}) }) }) }
  catch { throw new Error('連線失敗，請檢查網路後再試') }
  let d: { ok: boolean; data?: T; error?: string }
  const text = await r.text().catch(() => '')
  try { d = JSON.parse(text) } catch {
    // Apps Script 沒跑到 doPost（授權、逾時、程式碼有錯）時會回 HTML 錯誤頁，把狀態碼和頁面文字帶出來方便查
    const snippet = text.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
    throw new Error(`伺服器回應格式不正確（${fn}，HTTP ${r.status}${snippet ? `：${snippet}` : '，空白回應'}）`)
  }
  if (!d.ok) throw new Error(d.error || '發生錯誤')
  return d.data as T
}

const real: Api = {
  getStudentInfo: t => call('getStudentInfo', [t]),
  getOpenDays: f => call('getOpenDays', [!!f]),
  submitBooking: (t, n, e, s, l) => call('submitBooking', [t, n, e, s, l]),
  getHomeworkInfo: (t, n) => call('getHomeworkInfo', [t, n]),
  submitHomework: (t, n, r) => call('submitHomework', [t, n, r]),
  // 舊版後端的學生資料沒有 courses 欄位：補成空陣列（＝尚未開放任何課程）
  adminGetState: () => call<AdminState>('adminGetState', []).then(st => ({ ...st, students: st.students.map(x => ({ ...x, courses: x.courses ?? [] })) })),
  adminGetWeek: d => call('adminGetWeek', [d]),
  adminSaveRules: r => call('adminSaveRules', [r]),
  adminSetStatus: (id, st) => call('adminSetStatus', [id, st]),
  adminCreateStudent: (n, e, d) => call('adminCreateStudent', [n, e, d ?? '']),
  adminDeleteStudent: n => call('adminDeleteStudent', [n]),
  adminRenewLink: n => call('adminRenewLink', [n]),
  adminSetRecord: (n, u) => call('adminSetRecord', [n, u]),
  adminSetDisplay: (n, d) => call('adminSetDisplay', [n, d]),
  adminImportPlatformStudents: () => call('adminImportPlatformStudents', []),
  adminSetCourses: (n, c) => call('adminSetCourses', [n, c]),
  adminGetRecordSessions: () => call('adminGetRecordSessions', []),
  adminGetHomework: () => call('adminGetHomework', []),
  adminCancelRecordLesson: (n, s) => call('adminCancelRecordLesson', [n, s]),
}

// ───────── 假資料（資料只在記憶體裡）─────────
const day = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
const hhmm = (offsetMin: number) => new Date(Date.now() + 8 * 3600000 + offsetMin * 60000).toISOString().slice(11, 16)
const sl = (...t: [string, boolean, boolean][]) => t.map(([time, can25, can50]) => ({ time, can25, can50 }))
const delay = <T,>(v: T) => new Promise<T>(res => setTimeout(() => res(v), 150))
import type { WeekDay } from './types'

const db: AdminState = {
  rules: [
    { type: '每週', weekday: 2, date: '', start: '19:00', end: '21:00' },
    { type: '單次', weekday: '', date: day(5), start: '10:00', end: '12:00' },
    { type: '限定', weekday: '', date: day(6), start: '20:00', end: '21:00' },
    { type: '休假', weekday: '', date: day(2), start: '', end: '', label: '出國' },
  ],
  bookings: [
    { id: 'B0020', source: '私下', name: 'Amy', start: `${day(1)} 19:00`, length: 50, status: '待確認' },
    { id: 'B0021', source: 'AmazingTalker', name: 'Jenny', start: `${day(2)} 21:00`, length: 50, status: '已過期' },
  ],
  pending: [{ id: 'B0020', name: 'Amy', start: `${day(1)} 19:00`, length: 50, note: 'Email: amy@example.com' }],
  students: [{ name: 'Jenny', email: 'jenny@example.com', token: 'abc123', record: 'https://docs.google.com/spreadsheets/d/xxx', courses: ['reading:1', 'video'] }, { name: '王小明', display: 'Ming W.', email: '', token: 'at', courses: ['reading:1'] }],
}
const week = (d: string): Week => {
  const base = d || day(0)
  const mon = new Date(Date.UTC(+base.slice(0, 4), +base.slice(5, 7) - 1, +base.slice(8)))
  mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay() || 7) - 1))
  const days: WeekDay[] = [0, 1, 2, 3, 4, 5, 6].map(i => ({
    date: new Date(mon.getTime() + i * 864e5).toISOString().slice(0, 10), closed: i === 5 ? '休假' : '',
    open: i === 1 || i === 3 ? [1140, 1170, 1200, 1230] : [], allDay: [], lessons: [], events: [],
  }))
  days[1].lessons.push({ id: 'B1', name: 'Jenny', source: '私下', status: '已確認', len: 50, start: 1140, end: 1200 })
  days[1].lessons.push({ id: 'B2', name: 'Karen Kwok', source: 'AmazingTalker', status: '已確認', len: 25, start: 540, end: 570 })
  days[2].lessons.push({ id: 'B3', name: 'Amy', source: '私下', status: '待確認', len: 25, start: 1200, end: 1230 })
  days[3].lessons.push({ id: 'B4', name: 'Toro hsu', source: 'AmazingTalker', status: '待確認', len: 50, start: 600, end: 660 })
  days[4].events.push({ title: 'Ann-2026101 Zoom', start: 540, end: 600 })
  return { monday: days[0].date, today: day(0), days }
}

const mockHw: Record<string, HomeworkRecord> = { '1': { time: `${day(-1)} 20:15`, listen: '8/9', typing: '5/6', count: 2 } }

const mock: Api = {
  getStudentInfo: t => t === 'bad' ? delay({ mode: 'invalid' } as StudentInfo) : delay({
    homework: t ? mockHw : {},
    platform: t === 'at', // ?mock=1&t=at 可看平台學生的畫面
    mode: t ? 'known' : 'generic', name: t ? 'Jenny' : '',
    lastLesson: t ? { date: '2026-09-25', progress: '會話Level2L3第一頁', next: '會話Level2L3第2頁開始' } : null,
    lessons: t ? { bought: 10, used: 3, booked: 3, left: 7, len: 25, leftMinutes: 175 } : null,
    courses: t ? ['reading:1', 'video'] : [],
    upcoming: t ? [
      { start: `${day(0)} ${hhmm(5)}`, end: `${day(0)} ${hhmm(35)}`, length: 25, count: 1, status: '已確認', zoom: 'https://zoom.us/j/123' },
      { start: `${day(2)} 09:00`, end: `${day(2)} 10:00`, length: 25, count: 2, status: '已確認', zoom: 'https://zoom.us/j/456' },
      { start: `${day(3)} 10:00`, end: `${day(3)} 10:25`, length: 25, count: 1, status: '待確認', zoom: '' },
    ] : [],
  }),
  getOpenDays: () => delay({
    days: [
      { date: day(1), closed: '', label: '', slots: sl(['19:00', true, true], ['19:30', false, false], ['20:00', true, true], ['20:30', true, false]) },
      { date: day(2), closed: '休假', label: '出國', slots: [] },
      { date: day(3), closed: '', label: '', slots: sl(['10:00', false, false], ['10:30', false, false]) },
      { date: day(4), closed: '', label: '', slots: sl(['19:00', true, true], ['19:30', true, false]) },
    ],
    asOf: new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' '),
  }),
  submitBooking: (t, n) => (!t && !n ? Promise.reject(new Error('請填姓名')) : delay({ ok: true })),
  getHomeworkInfo: (t, n) => delay({ name: t ? 'Jenny' : '', last: t ? mockHw[String(n)] ?? null : null }),
  adminGetHomework: () => delay(Object.entries(mockHw).map(([n, r]) => ({ time: r.time, name: 'Jenny', lesson: /^R/.test(n) ? n : 'L' + n, listen: r.listen, typing: r.typing }))),
  submitHomework: (t, n, r) => (t ? (mockHw[String(n)] = { time: `${day(0)} ${hhmm(0)}`, listen: r.listen ? r.listen.join('/') : '未做', typing: r.typing ? r.typing.join('/') : '未做', count: (mockHw[String(n)]?.count ?? 0) + 1 }, delay({ ok: true, name: 'Jenny' })) : Promise.reject(new Error('作業連結已失效，請向老師索取新的連結'))),
  adminGetState: () => delay(structuredClone(db)),
  adminGetWeek: d => delay(week(d)),
  adminSaveRules: r => { db.rules = r; return delay(true) },
  adminSetStatus: (id, st) => { db.pending = db.pending.filter(p => p.id !== id); db.bookings.forEach(b => { if (b.id === id) b.status = st }); return delay(true) },
  adminCreateStudent: (n, e, d) => { if (!n) return Promise.reject(new Error('請填姓名')); db.students.push({ name: n, display: d?.trim() ?? '', email: e, token: 'mock' + db.students.length, courses: [] }); return delay(true) },
  adminDeleteStudent: n => { db.students = db.students.filter(s => s.name !== n); return delay(true) },
  adminRenewLink: n => { db.students.forEach(s => { if (s.name === n) s.token = Math.random().toString(36).slice(2) }); return delay(true) },
  adminSetRecord: (n, u) => { db.students.forEach(s => { if (s.name === n) s.record = u }); return delay(true) },
  adminImportPlatformStudents: () => delay({ added: [], linked: [] }),
  adminSetDisplay: (n, d) => { db.students.forEach(s => { if (s.name === n) s.display = d.trim() }); return delay(true) },
  adminSetCourses: (n, c) => { db.students.forEach(s => { if (s.name === n) s.courses = c }); return delay(true) },
  adminGetRecordSessions: () => delay([{ name: 'Ariel', start: `${day(3)} 09:00`, end: `${day(3)} 09:30` }, { name: 'Ariel', start: `${day(3)} 09:30`, end: `${day(3)} 10:00` }]),
  adminCancelRecordLesson: () => delay(true),
}

export const getApi = (useMock: boolean): Api => (useMock || !ENDPOINT ? mock : real)
