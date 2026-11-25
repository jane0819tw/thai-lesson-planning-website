import type { ConvText, ConvWord } from '../conversation/types'

// 時事補充一則（data/news/<日期>-<主題>.json，id＝檔名）：大意→關鍵單字→重點句子→文章→延伸單字→金句
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
  /** 大意（中文，可夾 <<泰文|拼音>>）：講這篇在說什麼 */
  intro: string[]
  /** 資料來源 */
  source: { url: string; label: string }
  /** 主圖（public/ 底下的路徑）＋圖上文字逐句解說、關鍵單字（每個字三個例句 examples；舊的一句 ex） */
  image?: { src: string; credit: string; lines: ConvText[]; words?: (ConvWord & { note?: string; ex?: ConvText; /** 三個例句（2026-11 起新做的都用這個） */ examples?: ConvText[]; /** 出自第幾句重點句子（1 起算） */ from?: number[] })[]
    /** 原文分好幾張圖時：一組＝幾張截圖＋出現在這些圖上的句子（有這個就不用 src／lines） */
    groups?: { title: string; images: string[]; lines: ConvText[] }[] }
  /** 圖鑑：網站／圖上出現的東西，一組一類（例：水燈底座、花、供品），每個可附小圖 */
  glossary?: { title: string; th?: string; rom?: string; items: (ConvWord & { note?: string })[] }[]
  /** 重點句子：從原文挑 */
  sentences: ConvText[]
  /** 補充句子：另外造的生活句，放最後面 */
  extra?: ConvText[]
  quotes: NewsQuote[]
}
