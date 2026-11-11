import type { ConvText, ConvWord } from '../conversation/types'

// 時事補充一則（data/news/<日期>-<主題>.json，id＝檔名）：只放單字、簡單句子、網路金句解說
// 泰文三行（th／rom／zh）沿用會話課格式；說明文字裡夾泰文寫 <<泰文|拼音>>

/** 金句：原文＋白話中文＋解說（文化背景、雙關、押韻） */
export interface NewsQuote extends ConvText {
  /** 小標籤：品牌梗、佛教文化、押韻… */
  tag?: string
  /** 小圖（public/ 底下的路徑），例如品牌商品照 */
  image?: string
  explain: string
}

export interface NewsItem {
  id: string
  /** YYYY-MM-DD */
  date: string
  title: string
  titleZh: string
  /** 導言（中文，可夾 <<泰文|拼音>>） */
  intro: string[]
  /** 資料來源 */
  source: { url: string; label: string }
  /** 主圖（public/ 底下的路徑）＋圖上文字逐句解說、單字說明（每個字一個例句 ex） */
  image?: { src: string; credit: string; lines: ConvText[]; words?: (ConvWord & { note?: string; ex?: ConvText })[] }
  sentences: ConvText[]
  quotes: NewsQuote[]
}
