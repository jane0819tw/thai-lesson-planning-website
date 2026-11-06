import { Link } from 'react-router-dom'
import { getSession } from './session'

// 返回連結：從預約連結進來過的學生 → 回「我的預約」的課程與作業；老師／一般訪客 → 原本的上一層
export default function BackLink({ to, label }: { to: string; label: string }) {
  const s = getSession()
  return s
    ? <Link to={`/book?t=${encodeURIComponent(s.token)}`}>← 回到課程與作業</Link>
    : <Link to={to}>← {label}</Link>
}
