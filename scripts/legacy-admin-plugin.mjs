// 老師管理頁（reservation/web/admin.html）還沒改寫成 React，先原樣放在 /reservation-admin/。
// 開發時由 Vite 直接提供；build 時複製到 dist/reservation-admin/。學生頁已改成 React（#/book）。
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../reservation/web', import.meta.url))
const PREFIX = '/reservation-admin/'
const FILES = ['admin.html', 'admin.js', 'common.js', 'config.js', 'mock.js', 'style.css']
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }

export default function legacyAdmin() {
  return {
    name: 'legacy-reservation-admin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        if (!url.startsWith(PREFIX)) return next()
        const file = url.slice(PREFIX.length) || 'admin.html'
        if (!FILES.includes(file)) return next()
        res.setHeader('Content-Type', TYPES[extname(file)])
        res.end(readFileSync(join(SRC, file)))
      })
    },
    closeBundle() {
      const out = fileURLToPath(new URL('../dist/reservation-admin', import.meta.url))
      if (!existsSync(SRC)) return
      mkdirSync(out, { recursive: true })
      for (const f of FILES) cpSync(join(SRC, f), join(out, f))
    },
  }
}
