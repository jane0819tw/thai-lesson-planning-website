export interface Slot { time: string; can25: boolean; can50: boolean }
export interface Day { date: string; closed: string; label: string; slots: Slot[] }
export interface Upcoming { start: string; end: string; length: number; count: number; status: string; zoom: string }
export interface StudentView {
  mode: 'invalid' | 'known' | 'generic'
  name: string
  days: Day[]
  asOf: string
  lastLesson: { date: string; progress: string; next: string } | null
  lessons: { bought: number; used: number; booked: number; left: number; len: number; leftMinutes: number } | null
  upcoming: Upcoming[]
}
