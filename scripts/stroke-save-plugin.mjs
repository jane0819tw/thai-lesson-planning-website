// 開發模式專用：筆順錄製工具按「儲存」時，POST /__save-stroke 直接寫入 data/strokes/
// 一般字母 → chars/<字母>.json 並重新合併 strokes.json；聲調符號 → marks.json
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildStrokes, strokesDir } from './build-strokes.mjs'

const PATH_RE = /^M [\d. ]+(L [\d. ]+)*$/

const readJson = f => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {})

export default function strokeSave() {
  return {
    name: 'stroke-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-stroke', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        let body = ''
        req.on('data', c => { body += c })
        req.on('end', () => {
          try {
            const { char, strokes } = JSON.parse(body)
            if (typeof char !== 'string' || !/^[ก-๛]{1,2}$/.test(char)) throw new Error('字母格式不正確')
            if (!Array.isArray(strokes) || !strokes.length || !strokes.every(s => typeof s === 'string' && PATH_RE.test(s))) throw new Error('筆畫格式不正確')
            const isMark = /^[่-๋]$/.test(char)
            const file = isMark ? join(strokesDir, 'marks.json') : join(strokesDir, 'chars', `${char}.json`)
            const all = readJson(file)
            const { draft, ...rest } = all[char] ?? {} // 重新錄製後就不再是草稿；fs / gy 等其他欄位保留
            all[char] = { ...rest, strokes }
            writeFileSync(file, isMark ? JSON.stringify(all, null, 1) + '\n' : JSON.stringify({ [char]: all[char] }, null, 1) + '\n')
            if (!isMark) buildStrokes()
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, file: isMark ? 'data/strokes/marks.json' : `data/strokes/chars/${char}.json` }))
          } catch (e) {
            res.statusCode = 400
            res.end(JSON.stringify({ ok: false, error: String(e.message ?? e) }))
          }
        })
      })
    },
  }
}
