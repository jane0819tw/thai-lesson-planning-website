// 歌詞跟讀資料型別：data/songs/*.json，由 scripts/song-build.py 從 YouTube 官方泰文字幕產生。
export interface SongWord { th: string; rom: string; zh: string }
export interface SongLine {
  start: number
  end: number
  /** 官方字幕原文，只讀；words 接起來必須等於它 */
  th: string
  zh: string
  words: SongWord[]
  /** 老師按 × 隱藏的句子（例如不想再解說的重複副歌），學生頁看不到 */
  hidden?: boolean
}
export interface SongExample { th: string; rom: string; zh: string }
/** 補充區塊的單字（word）或句型（pattern）解釋，附一個例句 */
export interface SongNote { kind: 'word' | 'pattern'; th: string; rom: string; zh: string; explain: string; example: SongExample }
/** 歌曲小測驗：泰文題目＋中文翻譯，answer 是正確選項的索引 */
export interface SongQuiz { q: string; qZh: string; options: string[]; answer: number; explain: string }
export interface Song {
  id: string; kind: 'song'
  title: string; titleZh: string; artist: string
  youtubeId: string; duration: number
  subtitleSource: 'official'
  /** 草稿：只在本機 dev 列出 */
  draft?: boolean
  note: string
  lines: SongLine[]
  /** 歌詞下面的補充圖片（public/ 底下的相對路徑） */
  images?: { src: string; alt: string; caption?: string }[]
  notes?: SongNote[]
  quiz?: SongQuiz[]
}
