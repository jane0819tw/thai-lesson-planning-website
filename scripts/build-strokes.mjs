// 把 data/strokes/chars/*.json（一個字母一個檔）合併成 data/strokes/strokes.json
// 每個檔案格式與筆順錄製工具匯出的相同：{ "ก": { "strokes": [...] } }
// 用法：npm run strokes（dev / build 會自動先執行）
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

export const strokesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'strokes')

export function buildStrokes() {
  const files = readdirSync(join(strokesDir, 'chars')).filter(f => f.endsWith('.json')).sort()
  const merged = {}
  for (const f of files) {
    const data = JSON.parse(readFileSync(join(strokesDir, 'chars', f), 'utf8'))
    for (const [char, v] of Object.entries(data)) {
      if (char in merged) throw new Error(`字母重複：${char}（${f}）`)
      merged[char] = v
    }
  }
  writeFileSync(join(strokesDir, 'strokes.json'), JSON.stringify(merged, null, 1) + '\n')
  return { files: files.length, chars: Object.keys(merged).length }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = buildStrokes()
  console.log(`strokes.json：合併 ${r.files} 個檔案，共 ${r.chars} 個字母`)
}
