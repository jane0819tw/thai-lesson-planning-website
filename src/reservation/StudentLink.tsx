import { Link, useLocation } from 'react-router-dom'
import { getSession } from './session'

// 頁首右側：已從預約連結進來過的學生，顯示「○○｜我的預約」
export default function StudentLink() {
  useLocation() // 換頁時重新讀取（預約頁剛存好學生資料）
  const s = getSession()
  if (!s) return null
  return <Link to={`/book?t=${encodeURIComponent(s.token)}`} className="mybook">{s.name ? `${s.name}｜` : ''}我的預約</Link>
}
