import { Link, Route, Routes } from 'react-router-dom'
import Home from './components/Home'
import LessonPage from './components/LessonPage'

export default function App() {
  return (
    <>
      <header className="top">
        <Link to="/" className="brand"><span className="th">ก</span> 泰語認字課</Link>
      </header>
      <main className="wrap">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lesson/:id" element={<LessonPage />} />
          <Route path="*" element={<p>找不到頁面。<Link to="/">回首頁</Link></p>} />
        </Routes>
      </main>
      <footer className="foot">第一階段：第 1–10 課（開發中）</footer>
    </>
  )
}
