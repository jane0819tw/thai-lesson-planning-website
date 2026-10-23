// 開發模式專用：聽寫片段審查頁讀寫 data/dictation/candidates/lesson-NN.json
//   GET  /__dictation/lessons      → [{ lesson, clips }]
//   GET  /__dictation/videos       → data/dictation/videos.json（影片清單）
//   GET  /__dictation/lesson/<n>   → 該課檔案內容
//   POST /__dictation/lesson/<n>   → 整份覆寫（先驗證格式）
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'dictation', 'candidates')
const videosFile = join(dir, '..', 'videos.json')
const fileOf = n => join(dir, `lesson-${String(n).padStart(2, '0')}.json`)
const num = v => typeof v === 'number' && Number.isFinite(v)

function validate(n, j) {
  if (!j || j.lesson !== n || !Array.isArray(j.clips) || !Array.isArray(j.rejected)) throw new Error('檔案格式不正確')
  for (const c of j.clips) {
    if (typeof c.id !== 'string' || typeof c.videoId !== 'string' || !/^[\w-]{6,20}$/.test(c.videoId)) throw new Error('片段 id／videoId 不正確')
    if (!num(c.start) || !num(c.end) || c.start < 0 || c.end <= c.start) throw new Error(`${c.id}：起訖秒數不正確`)
    if (typeof c.text !== 'string') throw new Error(`${c.id}：缺少句子`)
    if (!Array.isArray(c.hits)) throw new Error(`${c.id}：缺少 hits`)
    for (const h of c.hits) {
      if (typeof h.word !== 'string' || !num(h.from) || !num(h.to) || h.from < 0 || h.to > c.text.length || h.from >= h.to) throw new Error(`${c.id}：hits 位置不正確`)
      if (!['講義', '規則', '自選'].includes(h.source)) throw new Error(`${c.id}：hits.source 不正確`)
    }
  }
  if (!j.rejected.every(r => typeof r === 'string')) throw new Error('rejected 格式不正確')
}

export default function dictationSave() {
  return {
    name: 'dictation-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dictation', (req, res) => {
        const send = (code, body) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }
        try {
          const url = (req.url ?? '').split('?')[0]
          if (url === '/lessons' && req.method === 'GET') {
            const list = existsSync(dir) ? readdirSync(dir).flatMap(f => {
              const m = /^lesson-(\d+)\.json$/.exec(f)
              if (!m) return []
              const j = JSON.parse(readFileSync(join(dir, f), 'utf8'))
              return Array.isArray(j.clips) ? [{ lesson: Number(m[1]), clips: j.clips.length }] : []
            }) : []
            return send(200, list.sort((a, b) => a.lesson - b.lesson))
          }
          if (url === '/videos' && req.method === 'GET') {
            return send(200, existsSync(videosFile) ? JSON.parse(readFileSync(videosFile, 'utf8')) : { videos: [] })
          }
          const m = /^\/lesson\/(\d{1,2})$/.exec(url)
          if (!m) return send(404, { ok: false, error: 'not found' })
          const n = Number(m[1])
          if (req.method === 'GET') {
            if (!existsSync(fileOf(n))) return send(404, { ok: false, error: '這一課還沒有候選片段' })
            res.setHeader('Content-Type', 'application/json')
            return res.end(readFileSync(fileOf(n), 'utf8'))
          }
          if (req.method !== 'POST') return send(405, { ok: false, error: 'method' })
          let body = ''
          req.on('data', c => { body += c })
          req.on('end', () => {
            try {
              const j = JSON.parse(body)
              validate(n, j)
              mkdirSync(dir, { recursive: true })
              writeFileSync(fileOf(n), JSON.stringify(j, null, 1) + '\n')
              send(200, { ok: true, file: `data/dictation/candidates/lesson-${String(n).padStart(2, '0')}.json` })
            } catch (e) {
              send(400, { ok: false, error: String(e.message ?? e) })
            }
          })
        } catch (e) {
          send(500, { ok: false, error: String(e.message ?? e) })
        }
      })
    },
  }
}
