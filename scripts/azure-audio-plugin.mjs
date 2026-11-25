// 開發模式專用：Azure 候選試聽頁（public/audio/azure-preview/index.html）勾選後按「套用」，
// POST /__azure-apply {choices: {詞: 聲音}} → 執行 scripts/gen-audio-azure.py --apply，把候選蓋到正式音檔
import { execFile } from 'node:child_process'
import { join } from 'node:path'

const VOICES = new Set(['premwadee', 'achara', 'niwat'])

export default function azureAudio() {
  return {
    name: 'azure-audio',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__azure-apply', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        let body = ''
        req.on('data', c => { body += c })
        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json')
          try {
            const { choices } = JSON.parse(body)
            const pairs = Object.entries(choices ?? {})
            if (!pairs.length || !pairs.every(([w, v]) => /^[ก-๛ ]{1,40}$/.test(w) && VOICES.has(v))) throw new Error('勾選格式不正確')
            const script = join(server.config.root, 'scripts', 'gen-audio-azure.py')
            execFile('python3', [script, '--apply', ...pairs.map(([w, v]) => `${w}=${v}`)], (err, stdout, stderr) => {
              if (err) { res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: stderr || String(err) })) }
              res.end(JSON.stringify({ ok: true, log: stdout }))
            })
          } catch (e) {
            res.statusCode = 400
            res.end(JSON.stringify({ ok: false, error: String(e.message ?? e) }))
          }
        })
      })
    },
  }
}
