export interface Slot { time: string; can25: boolean; can50: boolean }
export interface Day { date: string; closed: string; /** 後端已不帶休假說明（只給老師看），一律空字串 */ label: string; slots: Slot[] }
export interface Upcoming { start: string; end: string; length: number; count: number; status: string; zoom: string }
export interface StudentView {
  mode: 'invalid' | 'known' | 'generic'
  name: string
  days: Day[]
  asOf: string
  lastLesson: { date: string; progress: string; next: string } | null
  lessons: { bought: number; used: number; booked: number; left: number; len: number; leftMinutes: number } | null
  upcoming: Upcoming[]
  /** 這位學生目前可進入的課程代號：reading:<n>（認字課每 5 課一個單位）或 categories.ts 的 key。舊版後端沒有這欄時為 undefined */
  courses?: string[]
  /** 每一課最近一次作業成績，key 是課號（'1'）。舊版後端沒有這欄時為 undefined */
  homework?: Record<string, HomeworkRecord>
  /** 平台（AmazingTalker）學生：在平台上預約，學生頁只顯示「我的課程與作業」 */
  platform?: boolean
  /** 已上完的課與課後錄影連結（新→舊）。舊版後端沒有這欄時為 undefined */
  videos?: VideoItem[]
  /** 需要課後錄影時是開始日期 yyyy-MM-dd（這天以後還沒上傳的課顯示「影片整理中」），不需要是空字串 */
  recording?: string
}

/** 一支課後錄影（連續的課合成一筆，no 會是「5–6」） */
export interface VideoItem { no: string; start: string; end: string; dateOnly: boolean; progress: string; video: string }

export interface HomeworkRecord { time: string; listen: string; typing: string; count: number }
export interface HomeworkRow { time: string; name: string; lesson: string; listen: string; typing: string }

/** 學生頁分兩次載入：getStudentInfo（姓名、課程、堂數、我的預約）與 getOpenDays（可預約時段，慢） */
export type StudentInfo = Omit<StudentView, 'days' | 'asOf'>
export interface OpenDays { days: Day[]; asOf: string }

// ───────── 老師管理頁 ─────────
export interface Rule { type: '每週' | '單次' | '限定' | '休假' | '備註'; weekday: number | ''; date: string; start: string; end: string; label?: string }
export interface Booking { id: string; source: string; name: string; start: string; length: number; status: string }
export interface Pending { id: string; name: string; start: string; length: number; note: string }
export interface StudentRow { name: string; /** 平台顯示名稱：有填＝AmazingTalker 學生 */ display?: string; email: string; token: string; record?: string; courses: string[]; /** 課後錄影開始日期 yyyy-MM-dd；空白＝不需要 */ recording?: string }
/** 預約備註裡還沒按 × 的錯誤訊息（Zoom／記錄表失敗等），items 是一段一段的訊息 */
export interface NoteIssue { id: string; source: string; name: string; start: string; status: string; items: string[] }
export interface AdminState { rules: Rule[]; bookings: Booking[]; pending: Pending[]; students: StudentRow[]; /** 舊版後端沒有 */ issues?: NoteIssue[]; sheetUrl?: string; scriptUrl?: string } // 後台試算表、Apps Script 專案網址（舊版後端沒有）
export interface WeekLesson { id: string; name: string; source: string; status: string; len: number; start: number; end: number }
export interface WeekEvent { title: string; start: number; end: number }
export interface WeekDay { date: string; closed: string; open: number[]; allDay: string[]; lessons: WeekLesson[]; events: WeekEvent[] }
export interface Week { monday: string; today: string; days: WeekDay[] }
/** 月曆：這個月所在的完整週（週一開始），month 是 yyyy-MM */
export interface Month { month: string; today: string; days: WeekDay[] }
export interface RecSession { name: string; start: string; end: string }
/** 待補錄影：需要錄影的學生已上完、但記錄表「影片連結」還空白的課 */
export interface PendingVideo { name: string; record: string; no: string; start: string; end: string; dateOnly: boolean; progress: string }
export interface PendingVideos { items: PendingVideo[]; /** 需要錄影但沒辦法檢查的學生（沒綁記錄表、沒有「影片連結」欄） */ problems: { name: string; reason: string }[] }
