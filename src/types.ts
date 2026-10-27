// 資料型別：日後若改接資料庫/API，只要回傳同樣的形狀，前端不用改。
// 內容來源：泰語認字講義 L1–L10（拼音、解釋、單元規劃皆依講義）。
export type ConsonantGroup = 'mid' | 'high' | 'lcp' | 'lcs'

export interface WordItem { thai: string; zh: string; roman?: string; star?: boolean; group?: string; audioUrl?: string | null; image?: ExtraImage }
export interface DemoTile { th: string; sub?: string; op?: string; icon?: string; speak?: string }
export interface Rule { id: string; title: string; body: string; demo?: DemoTile[]; toneTable?: ToneTable }  // toneTable：說明卡內直接顯示聲調表
export interface Consonant {
  id: string; char: string; name: string; roman: string; zh: string
  sound: string; group: ConsonantGroup; sameHigh: string; words: WordItem[]; audioUrl?: string | null
}
export interface Vowel {
  id: string; ipa: string; short: string; long: string
  shortSyllables: string[]; longSyllables: string[]; words: WordItem[]; note: string
  /** 顯示在這個母音卡「前面」的說明卡（例如拼讀範例） */
  preface?: Rule[]
  /** 顯示在這張母音卡「前面」的小標題（例如把複合母音、特殊母音分成兩組） */
  heading?: string
  /** 連續幾張標 inRow 的母音卡會排在同一列（特殊母音只有短音，卡片很小） */
  inRow?: boolean
}
export interface ToneRow { label: string; cells: string[]; fill?: boolean; group?: string }  // fill：ห 補齊的那一列（黃底、藍字），空字串＝空白格；group：最左側多一欄子音類型，相鄰同 group 的列合併成一格
export interface ToneTable { title: string; note?: string; rows: ToneRow[]; corner?: boolean; tint?: boolean }  // corner：標題放在表格左上角那一格（同講義排版）；tint：短母音列淺藍底、長母音列淺黃底
/** 短句斷句作業的一個音節：c 子音、v 母音（用 - 標子音位置，例如 เ-า）、m 聲調符號（沒有就省略）、t 念第幾聲（1–5） */
export interface Syllable { syl: string; c: string; v: string; m?: string; t: number }
/** parts：有填就變成作業頁的斷句題；demo：示範題（答案直接顯示、不計分） */
export interface PracticeItem { thai: string; zh?: string; note?: string; parts?: Syllable[]; demo?: boolean }
export interface PracticeGroup { title: string; items: PracticeItem[]; homework?: boolean; half?: boolean; third?: boolean }  // homework：改放在作業頁、不顯示在課程頁；half：每格佔半列（一列兩個）；third：一列三個
export interface Pattern { thai: string; zh: string }
export interface LinkItem { title: string; url: string }
/** imageUrl：沒填＝顯示「圖片待補」；明確填 null＝這張卡本來就不需要圖（只有文字） */
export interface Meme { title: string; desc: string; imageUrl?: string | null; big?: string; half?: boolean }  // big：標題下方用大字顯示的泰文；half：只佔半列（兩張 half 卡並排，圖片縮小）
export interface ExtraImage { src: string; alt: string }
export interface Extra { title: string; lines: string[]; images?: ExtraImage[]; toneTables?: ToneTable[] }  // toneTables：補充卡內直接顯示聲調表（例如複習總表）

export interface DiagramTile { label: string; count?: string; color: 'pink' | 'yellow' | 'green' | 'blue'; dashed?: boolean; wide?: boolean; sub: { t?: string; b?: string; th?: string; i?: boolean }[] }
export interface Diagram { title: string; intro: string; tiles: DiagramTile[]; result: string }

/** 母音種類說明卡：focus＝這課要學（紅）、done＝學過（灰）、notes:false＝不顯示下方補充說明 */
export interface VowelIntroConfig { focus: ('single' | 'compound' | 'special' | 'sanskrit')[]; done?: ('single' | 'compound' | 'special' | 'sanskrit')[]; notes?: boolean }

export interface Lesson {
  id: string; number: number; title: string; summary: string; status: 'draft' | 'ready'
  rules: Rule[]; consonants: Consonant[]; vowels: Vowel[]; toneTables: ToneTable[]
  vocab: WordItem[]; practice: PracticeGroup[]; patterns: Pattern[]
  /** 顯示在「母音」區塊最上面（種類說明卡之後）的說明卡 */
  vowelNotes?: Rule[]
  /** 設了母音卡的 id：「單字」清單改放在「母音」區塊裡、這張卡所屬的那一組之後（不再單獨一個區塊） */
  vocabAfterVowel?: string
  /** 作業頁「延伸影片挑戰」按鈕的連結（站內路徑，例如 /video/xxx）；沒設就顯示「即將開放」 */
  videoChallenge?: string
  homework: string[]; links: LinkItem[]; memes: Meme[]; extras: Extra[]; diagram?: Diagram; toneIntro?: boolean; vowelIntro?: boolean | VowelIntroConfig
}
