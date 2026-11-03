// 歌詞跟讀與影片教學共用的「學習文件」：投影片模式、列印講義、單字／句型列表都吃這個形狀。
// 歌曲和影片各自的資料格式不同，用 adapters.ts 轉進來。
import type { SongQuiz } from '../song/types'

export interface StudyExample { th: string; rom: string; zh: string }
export interface StudyNote {
  id: string
  kind: 'word' | 'pattern'
  th: string
  rom?: string
  zh: string
  explain?: string
  examples: StudyExample[]
}
export interface StudyWord { th: string; rom: string; zh: string; p?: string }
export interface StudyLine { start: number; end: number; th: string; zh: string; words: StudyWord[]; hidden?: boolean }
export interface StudyDoc {
  kind: 'song' | 'video'
  id: string
  title: string
  /** 標題下的一行小字（中文名、歌手、主題…） */
  subtitle: string
  youtubeId: string
  duration: number
  lines: StudyLine[]
  /** 單字在前、句型在後 */
  notes: StudyNote[]
  /** 每則 notes 第一次在哪一句講解（投影片放在那句底下）；-1＝只在最後複習 */
  noteAt: number[]
  quiz?: SongQuiz[]
  images?: { src: string; alt: string; caption?: string }[]
  tips?: { title: string; body: string }[]
  /** 回到一般頁面的路徑 */
  pagePath: string
}
