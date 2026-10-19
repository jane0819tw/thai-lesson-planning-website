// 記住「這個瀏覽器是哪位學生」：從預約連結（#/book?t=<代碼>）進來時存下來，
// 讓認字網站的頁面能顯示「我的預約」連結，學生不用再翻訊息找連結。
const KEY = 'thaiskr_student'
export interface StudentSession { token: string; name: string }

export const getSession = (): StudentSession | null => {
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && typeof v.token === 'string' ? v : null } catch { return null }
}
export const setSession = (s: StudentSession | null) => {
  try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY) } catch { /* 無痕模式等情況存不了 */ }
}
