// 影片教學資料型別。換影片時只要新增一個 data/videos/*.json，形狀相同即可。
export interface VideoWord {
  th: string; rom: string; zh: string; p?: string
  /** 這個字開始的秒數（可省略）。整句的字都有 t 就用它；否則依字長在該句範圍內估算 */
  t?: number
}
export interface VideoLine {
  /** 這一句開始的秒數；結束時間＝下一句的開始（最後一句＝影片長度） */
  start: number
  zh: string
  /** true＝字幕不確定，畫面會提醒老師確認 */
  guess?: boolean
  patterns: string[]
  words: VideoWord[]
}
export interface VideoExample { th: string; rom: string; zh: string }
export interface VideoPattern { id: string; th: string; zh: string; cmp: string; examples: VideoExample[] }
export interface VideoTip { title: string; body: string }
export interface VideoLesson {
  id: string; title: string; titleZh: string
  youtubeId: string; duration: number
  topic: string; level: string; note: string
  lines: VideoLine[]; patterns: VideoPattern[]; tips: VideoTip[]
}
