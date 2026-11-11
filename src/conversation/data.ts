import type { ConvLesson } from './types'

// 會話課程資料：data/conversation/<級>/lesson-NN.json，建置時打包（同認字課 src/data/repository.ts）
const modules = import.meta.glob<Omit<ConvLesson, 'id'>>('../../data/conversation/*/lesson-*.json', { eager: true, import: 'default' })

const ALL: ConvLesson[] = Object.values(modules)
  .map(l => ({ ...l, id: `conv${l.level}-${String(l.number).padStart(2, '0')}` }))
  .sort((a, b) => a.level - b.level || a.number - b.number)

export const convLevels = (): number[] => [...new Set(ALL.map(l => l.level))]
export const convLessons = (level: number): ConvLesson[] => ALL.filter(l => l.level === level)
export const convLesson = (level: number, number: number): ConvLesson | undefined => ALL.find(l => l.level === level && l.number === number)

/** 會話課每級的名稱 */
export const levelTitle = (level: number) => `泰語會話 ${level}`

/** 發音用的文字：去掉 {{ }}、[[ ]] 標記、模板的 [名字] 這類中文空格，／換成空格（scripts/gen-audio.py 的 conv_plain 要同步） */
export const plain = (s: string) => s.replace(/\{\{|\}\}|\[\[|\]\]/g, '').replace(/\[[^\]]*\]/g, '').replace(/／/g, ' ').replace(/\s+/g, ' ').trim()
