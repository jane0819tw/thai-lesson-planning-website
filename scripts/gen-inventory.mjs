// 產生課程內容清單 Markdown：node scripts/gen-inventory.mjs  → docs/curriculum-inventory.md
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
const files = readdirSync('data/lessons').filter(f => f.endsWith('.json')).sort()
const out = ['# 泰文認字課程內容清單', '']
for (const f of files) {
  const L = JSON.parse(readFileSync(`data/lessons/${f}`, 'utf8'))
  out.push(`## L${L.number} ${L.title}`, '', ...(L.summary.includes('\n') ? L.summary.split('\n').map(l => `- ${l}`) : [L.summary]), '')
  if (L.consonants.length) {
    out.push('| 字 | 名稱 | 拼音 | 意思 | 發音 | 同音高子音 |', '|---|---|---|---|---|---|')
    for (const c of L.consonants) out.push(`| ${c.char} | ${c.name} | ${c.roman} | ${c.zh} | ${c.sound} | ${c.sameHigh} |`)
    out.push('')
  }
  for (const v of L.vowels) out.push(`- 母音 ${v.ipa}：${v.short} / ${v.long || '—'}　例字：${v.words.map(w => `${w.thai} ${w.zh}`).join('、')}`)
  if (L.vocab.length) out.push('', '單字：' + L.vocab.map(w => `${w.thai} ${w.zh}`.trim()).join('、'))
  if (L.homework.length) out.push('', '作業：' + L.homework.join('、'))
  out.push('')
}
writeFileSync('docs/curriculum-inventory.md', out.join('\n'))
console.log('wrote docs/curriculum-inventory.md')
