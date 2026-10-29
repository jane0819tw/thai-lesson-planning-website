// 開發模式專用：歌詞頁的老師編輯寫回 data/songs/<id>.json
//   POST /__songs/<id>  → 整份覆寫；官方字幕原文不能改，只能把相鄰的句子合併（中間補空白，同 SongPage 的 mergeNext）
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'songs')
const num = v => typeof v === 'number' && Number.isFinite(v)

const joinTh = (a, b) => (a.endsWith(' ') ? a + b : `${a} ${b}`)

function validate(old, j) {
  if (!j || j.id !== old.id || !Array.isArray(j.lines) || !j.lines.length) throw new Error('檔案格式不正確')
  let k = 0 // 對到舊檔的第幾句
  j.lines.forEach((l, i) => {
    const n = `第 ${i + 1} 句`
    if (typeof l.th !== 'string' || k >= old.lines.length) throw new Error(`${n}：官方字幕原文不能改`)
    let th = old.lines[k++].th
    while (th !== l.th && k < old.lines.length && l.th.startsWith(th)) th = joinTh(th, old.lines[k++].th)
    if (th !== l.th) throw new Error(`${n}：官方字幕原文不能改`)
    if (!num(l.start) || !num(l.end) || l.start < 0 || l.end <= l.start) throw new Error(`${n}：起訖秒數不正確`)
    if (typeof l.zh !== 'string' || !Array.isArray(l.words)) throw new Error(`${n}：缺少 zh／words`)
    if (!l.words.every(w => typeof w.th === 'string' && w.th && typeof w.rom === 'string' && typeof w.zh === 'string')) throw new Error(`${n}：字的格式不正確`)
    if (l.words.map(w => w.th).join('') !== l.th) throw new Error(`${n}：斷詞接起來和原文不一樣`)
  })
  if (k !== old.lines.length) throw new Error('句子少了，只能合併不能刪除')
}

export default function songSave() {
  return {
    name: 'song-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__songs', (req, res) => {
        const send = (code, body) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }
        const m = /^\/([\w-]{1,60})$/.exec((req.url ?? '').split('?')[0])
        if (!m) return send(404, { ok: false, error: 'not found' })
        if (req.method !== 'POST') return send(405, { ok: false, error: 'method' })
        const file = join(dir, `${m[1]}.json`)
        if (!existsSync(file)) return send(404, { ok: false, error: '找不到這首歌' })
        let body = ''
        req.on('data', c => { body += c })
        req.on('end', () => {
          try {
            const j = JSON.parse(body)
            validate(JSON.parse(readFileSync(file, 'utf8')), j)
            writeFileSync(file, JSON.stringify(j, null, 1) + '\n')
            send(200, { ok: true, file: `data/songs/${m[1]}.json` })
          } catch (e) {
            send(400, { ok: false, error: String(e.message ?? e) })
          }
        })
      })
    },
  }
}
