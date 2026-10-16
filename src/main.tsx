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
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* HashRouter：GitHub Pages 不需要額外的 404 轉址設定 */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
