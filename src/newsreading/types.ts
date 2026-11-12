import type { ConvText, ConvWord } from '../conversation/types'

// 短文時事閱讀一篇（data/news-reading/<日期>-<主題>.json，id＝檔名）：讀一篇真實的泰文短文（貼文、廣告、短新聞）
// 泰文三行（th／rom／zh）沿用會話課格式，{{關鍵字}} 紅字；說明文字裡夾泰文寫 <<泰文|拼音>>

/** 單字：泰文、拼音、中文＋構詞 note＋一個生活化例句 */
export type ReadWord = ConvWord & { note?: string; ex?: ConvText }

/** 句型：句型框（th／rom／zh）＋一句短說明＋例句（第一句通常取自原文） */
export interface ReadPattern extends ConvText { explain: string; examples: ConvText[] }

/** 閱讀理解：題目（中文，可夾 <<泰文|拼音>>）＋答案（講義不印） */
export interface ReadQuestion { q: string; a: string }

export interface ReadArticle {
  id: string
  /** YYYY-MM-DD */
  date: string
  title: string
  titleZh: string
  /** 導言（中文，可夾 <<泰文|拼音>>） */
  intro: string[]
  /** 資料來源（原文連結） */
  source: { url: string; label: string }
  /** 主圖（public/ 底下的路徑）＋圖上文字逐句 */
  image?: { src: string; credit: string; lines: ConvText[] }
  /** 原文：照原貼文一行一行（只有泰文，給學生先自己讀） */
  original: string[]
  /** 逐句解析：分段（label＝小標，例：備註） */
  paragraphs: { label?: string; lines: ConvText[] }[]
  words: ReadWord[]
  patterns?: ReadPattern[]
  questions: ReadQuestion[]
}
