import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
// Noto Sans Thai Looped 內建在網站裡（不靠 Google Fonts），確保每台裝置的泰文字形一致
import '@fontsource/noto-sans-thai-looped/thai-400.css'
import '@fontsource/noto-sans-thai-looped/thai-500.css'
import '@fontsource/noto-sans-thai-looped/thai-600.css'
import '@fontsource/noto-sans-thai-looped/thai-700.css'
import '@fontsource/noto-sans-thai-looped/latin-400.css'
import '@fontsource/noto-sans-thai-looped/latin-500.css'
import '@fontsource/noto-sans-thai-looped/latin-600.css'
import '@fontsource/noto-sans-thai-looped/latin-700.css'
import '@fontsource/noto-sans-thai/thai-400.css'
import '@fontsource/noto-sans-thai/thai-600.css'
// 認字課程（/reading）的泰文改用 Sarabun；筆順描紅的底字仍用 LayijiTrace
import '@fontsource/sarabun/thai-400.css'
import '@fontsource/sarabun/thai-500.css'
import '@fontsource/sarabun/thai-600.css'
import '@fontsource/sarabun/thai-700.css'
import './styles.css'

// 任何未捕捉的錯誤都直接顯示在畫面底部（不依賴 React），方便在沒有開發者工具時回報問題
const showError = (m: string) => {
  let el = document.getElementById('fatal-msg')
  if (!el) {
    el = document.createElement('pre')
    el.id = 'fatal-msg'
    el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;margin:0;padding:8px 12px;background:#b91c1c;color:#fff;font:12px/1.4 monospace;white-space:pre-wrap;max-height:40vh;overflow:auto'
    document.body.appendChild(el)
  }
  el.textContent += m + '\n'
}
window.addEventListener('error', e => showError(`錯誤：${e.message}（${(e.filename || '').split('/').pop()}:${e.lineno}）`))
window.addEventListener('unhandledrejection', e => showError('Promise 錯誤：' + (e.reason?.message ?? String(e.reason))))

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* HashRouter：GitHub Pages 不需要額外的 404 轉址設定 */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
