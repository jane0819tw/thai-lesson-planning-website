import { Link, Route, Routes, useLocation } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import Home from './components/Home'
import ReadingIndex from './components/ReadingIndex'
import LessonPage from './components/LessonPage'
import StudentLink from './reservation/StudentLink'
import BookingPage from './reservation/BookingPage'
import AdminPage from './reservation/AdminPage'
import HomeworkPage from './components/HomeworkPage'
import ChartPage from './components/ChartPage'
import KeyboardPage from './components/KeyboardPage'
import StrokeEditor from './components/StrokeEditor'
import VideoIndex from './components/VideoIndex'
import VideoPage from './components/VideoPage'

export default function App() {
  const loc = useLocation() // 換頁時重置錯誤保護
  return (
    <>
      <header className="top">
        <Link to="/" className="brand"><span className="th">ก</span> 泰語學習</Link>
        <StudentLink />
      </header>
      <main className="wrap">
        <ErrorBoundary key={loc.pathname + loc.search}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/reading" element={<ReadingIndex />} />
          <Route path="/reading/chart" element={<ChartPage />} />
          <Route path="/reading/keyboard" element={<KeyboardPage />} />
          <Route path="/reading/stroke-editor" element={<StrokeEditor />} />
          <Route path="/reading/lesson/:id" element={<LessonPage />} />
          <Route path="/reading/lesson/:id/homework" element={<HomeworkPage />} />
          <Route path="/book" element={<BookingPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/video" element={<VideoIndex />} />
          <Route path="/video/:id" element={<VideoPage />} />
          <Route path="*" element={<p>找不到頁面。<Link to="/">回首頁</Link></p>} />
        </Routes>
        </ErrorBoundary>
      </main>
      <footer className="foot">開發中</footer>
    </>
  )
}
