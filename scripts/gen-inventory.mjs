// 產生「第N課內容清單」Markdown：node scripts/gen-inventory.mjs [lesson-01]
import { readFileSync, writeFileSync } from 'node:fs'
const id = process.argv[2] ?? 'lesson-01'
const L = JSON.parse(readFileSync(`data/lessons/${id}.json`, 'utf8'))
const cls = { mid: '中輩', high: '高輩', low: '低輩' }
const out = []
out.push(`# 第 ${L.number} 課：${L.title}`, '', L.summary, '')
out.push('## 規則認知', ...L.rules.map(r => `- **${r.title}**：${r.body}`), '')
out.push('## 子音', '| 字 | 名稱 | 拼音 | 意思 | 輩 | 頭音 | 尾音 |', '|---|---|---|---|---|---|---|')
for (const c of L.consonants) out.push(`| ${c.char} | ${c.name} | ${c.nameRoman} | ${c.nameZh} | ${cls[c.class]} | ${c.initial} | ${c.final} |`)
out.push('', '## 母音', '| 母音 | 拼法 | 發音 | 長短 | 位置 | 例字 |', '|---|---|---|---|---|---|')
for (const v of L.vowels) out.push(`| ${v.char} | ${v.withCarrier} | ${v.roman} | ${v.length === 'long' ? '長' : '短'} | ${v.position} | ${v.example} |`)
out.push('', `## 單字（${L.words.length}）`, '| 泰文 | 拼音 | 意思 | 拆解 |', '|---|---|---|---|')
for (const w of L.words) out.push(`| ${w.thai} | ${w.roman} | ${w.zh} | ${w.parts.join(' + ')} |`)
out.push('', `## 例句（${L.sentences.length}）`, '| 泰文 | 拼音 | 中文 |', '|---|---|---|')
for (const s of L.sentences) out.push(`| ${s.segments.join(' ')} | ${s.roman} | ${s.zh} |`)
out.push('', '## 梗圖', `- ${L.meme.idea}`, `- 圖說：${L.meme.caption}`, '')
const md = out.join('\n')
writeFileSync(`docs/${id}-inventory.md`, md)
console.log(`wrote docs/${id}-inventory.md`)
