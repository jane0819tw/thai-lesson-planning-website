import type { SongQuiz } from '../song/types'

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
/** 文化補充（放在小測驗後面）：例如劇裡相關職位、稱呼的比較 */
export interface VideoCulture {
  title: string
  intro?: string
  /**
   * 金字塔（由上到下＝由高到低）：左邊是職務（th 常用說法、full 正式名稱），
   * 右邊 ranks 是可能擔任這個職務的官階，call 是大家對這個官階的稱呼；group 決定顏色
   */
  pyramid?: {
    th: string; rom: string; zh: string; full?: string
    /** 這個職務做的事（金字塔最右欄） */
    duty?: string
    /**
     * abbr 泰文縮寫；also＝也能擔任的另一個職務（填那層的 th），底色會一半一半；
     * entry＝從學校畢業後從這個官階開始（顯示成小標籤）
     */
    ranks: { rank: string; abbr?: string; zh: string; call?: string; callRom?: string; also?: string; entry?: string }[]
    group?: 'officer' | 'nco' | 'base'
  }[]
  items?: { th: string; rom: string; zh: string; explain: string }[]
  /** 金字塔下面的小表（例：稱呼的來源）；head 是表頭，rows 每列的格子 */
  table?: { title: string; head: string[]; rows: string[][]; note?: string }
}
/** 需要講解的單字：只列老師挑的字（不是台詞裡每個字），附解釋和例句 */
export interface VideoVocab {
  th: string; rom: string; zh: string; explain: string
  /** 一個例句用 example；要舉多種用法時改用 examples */
  example?: VideoExample; examples?: VideoExample[]
}
export interface VideoLesson {
  id: string; title: string; titleZh: string
  /** 建立日期 YYYY-MM-DD；列表依此排序（舊的在前） */
  createdAt?: string
  /** 列表手動排序（1 最前面）；有填的排在沒填的前面，沒填的照 createdAt */
  order?: number
  /** 本機影片時留空字串，改填 videoSrc */
  youtubeId: string
  /** 本機影片路徑（public/ 底下，例：extras/videos/<id>/video.mp4）；有填就不用 YouTube */
  videoSrc?: string
  duration: number
  topic: string; level: string; note: string
  lines: VideoLine[]; vocab?: VideoVocab[]; patterns: VideoPattern[]; tips?: VideoTip[]
  /** 小測驗（約 3 題）：q 泰文題目、qZh 中文、answer 是正確選項的索引；形狀同歌曲 */
  quiz?: SongQuiz[]
  culture?: VideoCulture
}
