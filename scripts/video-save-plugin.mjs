// 開發模式專用：影片頁校時模式把各句起點寫回 data/videos/<id>.json
//   POST /__videos/<id>  body: { starts: number[] }
//   只改各句的 start；起點改過的句子，舊的逐字時間 t 對不上了，一併拿掉改回估算
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'videos')
const num = v => typeof v === 'number' && Number.isFinite(v)

export default function videoSave() {
  return {
    name: 'video-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__videos', (req, res) => {
        const send = (code, body) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }
        const m = /^\/([\w-]{1,60})$/.exec((req.url ?? '').split('?')[0])
        if (!m) return send(404, { ok: false, error: 'not found' })
        if (req.method !== 'POST') return send(405, { ok: false, error: 'method' })
        const file = join(dir, `${m[1]}.json`)
        if (!existsSync(file)) return send(404, { ok: false, error: '找不到這支影片' })
        let body = ''
        req.on('data', c => { body += c })
        req.on('end', () => {
          try {
            const { starts } = JSON.parse(body)
            const v = JSON.parse(readFileSync(file, 'utf8'))
            if (!Array.isArray(starts) || starts.length !== v.lines.length) throw new Error('句數不對')
            starts.forEach((t, i) => {
              if (!num(t) || t < 0 || (v.duration && t >= v.duration)) throw new Error(`第 ${i + 1} 句：秒數不正確`)
              if (i > 0 && t <= starts[i - 1]) throw new Error(`第 ${i + 1} 句：起點要晚於第 ${i} 句`)
            })
            v.lines.forEach((L, i) => {
              if (L.start === starts[i]) return
              L.start = starts[i]
              L.words.forEach(w => { delete w.t })
            })
            writeFileSync(file, JSON.stringify(v, null, 1) + '\n')
            send(200, { ok: true, file: `data/videos/${m[1]}.json` })
          } catch (e) {
            send(400, { ok: false, error: String(e.message ?? e) })
          }
        })
      })
    },
  }
}
