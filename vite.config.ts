import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error 開發用 .mjs 外掛，沒有型別宣告
import strokeSave from './scripts/stroke-save-plugin.mjs'
// @ts-expect-error 開發用 .mjs 外掛，沒有型別宣告
import dictationSave from './scripts/dictation-save-plugin.mjs'
// @ts-expect-error 開發用 .mjs 外掛，沒有型別宣告
import songSave from './scripts/song-save-plugin.mjs'

// base './' => 不論部署在 GitHub Pages 的 /repo-name/ 還是 GCP 根路徑都能運作
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC') },
  plugins: [react(), strokeSave(), dictationSave(), songSave()],
})
