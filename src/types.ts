// 資料型別：日後若改接資料庫/API，只要回傳同樣的形狀，前端不用改。
// 內容來源：泰語認字講義 L1–L10（拼音、解釋、單元規劃皆依講義）。
export type ConsonantGroup = 'mid' | 'high' | 'lcp' | 'lcs'

export interface WordItem { thai: string; zh: string; roman?: string; star?: boolean; group?: string; audioUrl?: string | null; image?: ExtraImage }
export interface DemoTile { th: string; sub?: string; op?: string; icon?: string; speak?: string }
export interface Rule { id: string; title: string; body: string; demo?: DemoTile[] }
export interface Consonant {
  id: string; char: string; name: string; roman: string; zh: string
  sound: string; group: ConsonantGroup; sameHigh: string; words: WordItem[]; audioUrl?: string | null
}
export interface Vowel {
  id: string; ipa: string; short: string; long: string
  shortSyllables: string[]; longSyllables: string[]; words: WordItem[]; note: string
  /** 顯示在這個母音卡「前面」的說明卡（例如拼讀範例） */
  preface?: Rule[]
}
export interface ToneRow { label: string; cells: string[] }
export interface ToneTable { title: string; note?: string; rows: ToneRow[] }
export interface PracticeItem { thai: string; zh?: string; note?: string }
export interface PracticeGroup { title: string; items: PracticeItem[] }
export interface Pattern { thai: string; zh: string }
export interface LinkItem { title: string; url: string }
/** imageUrl：沒填＝顯示「圖片待補」；明確填 null＝這張卡本來就不需要圖（只有文字） */
export interface Meme { title: string; desc: string; imageUrl?: string | null; big?: string }  // big：標題下方用大字顯示的泰文
export interface ExtraImage { src: string; alt: string }
export interface Extra { title: string; lines: string[]; images?: ExtraImage[] }

export interface DiagramTile { label: string; count?: string; color: 'pink' | 'yellow' | 'green' | 'blue'; dashed?: boolean; wide?: boolean; sub: { t?: string; b?: string; th?: string; i?: boolean }[] }
export interface Diagram { title: string; intro: string; tiles: DiagramTile[]; result: string }

export interface Lesson {
  id: string; number: number; title: string; summary: string; status: 'draft' | 'ready'
  rules: Rule[]; consonants: Consonant[]; vowels: Vowel[]; toneTables: ToneTable[]
  vocab: WordItem[]; practice: PracticeGroup[]; patterns: Pattern[]
  homework: string[]; links: LinkItem[]; memes: Meme[]; extras: Extra[]; diagram?: Diagram; toneIntro?: boolean; vowelIntro?: boolean
}
