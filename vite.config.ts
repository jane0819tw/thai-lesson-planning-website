import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' => 不論部署在 GitHub Pages 的 /repo-name/ 還是 GCP 根路徑都能運作
export default defineConfig({
  base: './',
  plugins: [react()],
})
