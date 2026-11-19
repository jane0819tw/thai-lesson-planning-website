// 字幕聽打＋斷句解析（認字課每課後面的班級作業）：讀 data/subtitle-practice/lesson-NN.json
// text 是學生頁的整句字幕（可以關掉、不能複製）；zh 只給老師批改參考，學生要自己翻。skip: true 的句子不出給學生。
export interface SubLine { n: number; start: number; end: number; text: string; zh: string; skip?: boolean }
export interface SubPractice {
  lesson: number; title: string; videoId: string
  source: { title: string; channel: string; url: string; page?: string }
  lines: SubLine[]
}

const files = import.meta.glob('../data/subtitle-practice/lesson-*.json', { eager: true, import: 'default' }) as Record<string, SubPractice>
const byLesson = new Map<number, SubPractice>()
for (const f of Object.values(files)) byLesson.set(f.lesson, { ...f, lines: f.lines.filter(l => !l.skip) })

export const subPracticeOf = (lesson: number): SubPractice | undefined => byLesson.get(lesson)
/** 作業紀錄的課別代號：L20 → S20 */
export const subKey = (lesson: number) => `S${lesson}`
/** 老師批改頁用：S20 → 這課的參考句子 */
export const subPracticeByKey = (key: string) => { const m = /^S(\d+)$/.exec(key); return m ? subPracticeOf(Number(m[1])) : undefined }
