import { Link, useLocation } from 'react-router-dom'
import { getAdminKey } from './api'

// 頁首：老師的瀏覽器（存有管理金鑰）在課程頁等頁面顯示「回管理頁」，學生看不到
export default function AdminLink() {
  const { pathname } = useLocation() // 換頁時重新判斷
  if (pathname.startsWith('/admin') || !getAdminKey()) return null
  return <Link to="/admin" className="mybook">← 回管理頁</Link>
}
