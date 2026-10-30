// 資料型別：日後若改接資料庫/API，只要回傳同樣的形狀，前端不用改。
// 內容來源：泰語認字講義 L1–L10（拼音、解釋、單元規劃皆依講義）。
export type ConsonantGroup = 'mid' | 'high' | 'lcp' | 'lcs'

export interface WordItem { thai: string; zh: string; roman?: string; star?: boolean; group?: string; audioUrl?: string | null; image?: ExtraImage }
export interface DemoTile { th: string; sub?: string; op?: string; icon?: string; speak?: string }
export interface Rule { id: string; title: string; body: string; demo?: DemoTile[]; toneTable?: ToneTable; unit?: string; at?: 'concept' | 'consonants' }  // toneTable：說明卡內直接顯示聲調表；title 留空＝不顯示標題；unit：放進這個小單元的區塊（見 Lesson.clusters）；at：concept＝放在「基本概念」區塊（和音節組成圖一起，L1），consonants＝放在「子音」區塊最上面
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
/** 尾音卡：一個尾音一張卡；group 對應 vocab 的 group，那幾個單字就排在這張卡裡 */
export interface Final { id: string; sound: string; letters: string[]; group: string; mouth: string; lines?: string[] }  // lines：字母分組、一組一列顯示（每列用空白分隔，例：["ก", "ค ฆ ข"]），有填就取代 letters 的排法
/** 母音加尾音後的寫法（L11 母音變形）：finals＝加尾音的寫法（x＝尾音位置，可有兩種，例：เ-ย、เ-ิx），沒填＝講義的「/」；words 的字要在 vocab 裡才有中文；changed＝寫法會變（講義橘底） */
export interface VowelShift { vowel: string; finals?: string[]; words: string[]; changed?: boolean; note?: string }
/** heads：左右兩組的標題（例如短母音、長母音）；rows：同一列左右對照。一種母音有兩種變形時分兩列：下一列那一邊填 null＝和上一列合併；vowel 填空字串＝只合併母音那一格 */
export interface VowelShiftTable { title?: string; heads: [string, string]; rows: [VowelShift | null, VowelShift | null][] }
export interface ToneRow { label: string; cells: string[]; fill?: boolean; group?: string; mark?: boolean }  // fill：ห 補齊的那一列（黃底、藍字），空字串＝空白格；group：最左側多一欄子音類型，相鄰同 group 的列合併成一格；mark：講義整列橘底標示的重點列（例如濁尾音裡的低子音＋長母音）
export interface ToneTable { title: string; note?: string; rows: ToneRow[]; corner?: boolean; tint?: boolean | 'long' | 'short' }  // corner：標題放在表格左上角那一格（同講義排版）；tint：短母音列淺藍底、長母音列淺黃底；'long'＝全部淺黃底（例如有清尾音時一律依長母音的規則）；'short'＝全部淺藍底（有濁尾音時一律依短母音的規則）
/** 短句斷句作業的一個音節：c 子音、v 母音（用 - 標子音位置，例如 เ-า）、m 聲調符號（沒有就省略）、t 念第幾聲（1–5） */
export interface Syllable { syl: string; c: string; v: string; m?: string; t: number }
/** parts：有填就變成作業頁的斷句題；demo：示範題（答案直接顯示、不計分） */
export interface PracticeItem { thai: string; zh?: string; note?: string; parts?: Syllable[]; demo?: boolean; image?: ExtraImage }
export interface PracticeGroup { title: string; items: PracticeItem[]; homework?: boolean; half?: boolean; third?: boolean; images?: boolean; qa?: boolean; unit?: string }  // unit：放進這個小單元的區塊、不放「練習」；qa：問答排法，第一個 item 是問句放左邊、其他是回答排在右邊；homework：改放在作業頁、不顯示在課程頁；half：每格佔半列（一列兩個）；third：一列三個；images：每個字配一張示意圖（沒圖顯示「圖片待補」）
export interface Pattern { thai: string; zh: string }
export interface LinkItem { title: string; url: string }
/** imageUrl：沒填＝顯示「圖片待補」；明確填 null＝這張卡本來就不需要圖（只有文字） */
export interface Meme { title: string; desc: string; imageUrl?: string | null; big?: string; half?: boolean }  // big：標題下方用大字顯示的泰文；half：只佔半列（兩張 half 卡並排，圖片縮小）
export interface ExtraImage { src: string; alt: string; credit?: string }  // credit：網路公開圖片的作者／授權標示（目前只記錄、不顯示在頁面上）
/** 二選一題：options 兩個寫法，answer＝正確的是第幾個（0 或 1） */
export interface Choice { options: [string, string]; answer: 0 | 1 }
export interface Extra { title: string; tab?: string; lines: string[]; images?: ExtraImage[]; toneTables?: ToneTable[]; choices?: Choice[]; finals?: { sound: string; main: string; others?: string }[] }  // finals：尾音字母小表（一個音一列，main 加底線、others 放括號裡），放在聲調表上面；tab：複習有好幾張卡時用分頁切換，分頁按鈕的短名稱（沒填用 title）；toneTables：補充卡內直接顯示聲調表（例如複習總表）；choices：二選一表格（點選後顯示對錯）

export interface DiagramTile { label: string; count?: string; color: 'pink' | 'yellow' | 'green' | 'blue'; dashed?: boolean; wide?: boolean; sub: { t?: string; b?: string; th?: string; i?: boolean }[] }
export interface Diagram { title: string; intro: string; tiles: DiagramTile[]; result: string; after?: string }  // after：「基本概念」區塊裡，組成圖排在這張說明卡（id）之後；沒填＝排最前面

/** 尾音總表（講義「N 音 M 字」）：kind＝清／濁；rule＝有這種尾音時依長音（long）或短音（short）的規則；rows 一個音一列，main＝主要字母、others＝同音的其他字母（空白分隔）；
 *  或用 lines 分組、一組一列顯示（第一列的第一個字母當主要字母，例：["ก", "ค ฆ ข"]）。音數、字數自動計算 */
export interface FinalsIntroConfig { kind: string; rule: 'long' | 'short'; rows: ({ sound: string; main: string; others?: string } | { sound: string; lines: string[] })[] }

/** 複合子音組合表（L13）：rows 一個 C1 一列，group＝子音類型（中／低／高），tint＝列底色（同講義分色：yellow／gray／pink），combos＝組合，crossed＝講義劃掉、不存在的組合；
 *  c2＝可以當 C2 的字母（合併成一格）；rules＝右邊的規則句；words＝例字拆解（parts＝拆法，用＋分段，母音用 - 標 อ 的位置，例：คร＋-ู；＝後面寫整個字怎麼分音節；tint 同上），中文從 vocab 帶 */
export interface ClusterRow { c1: string; group: string; tint: 'yellow' | 'gray' | 'pink'; combos: string[]; crossed?: string[] }
export interface ClusterWord { thai: string; parts: string; tint: ClusterRow['tint'] }
export interface ClusterIntroConfig { c2: string[]; rows: ClusterRow[]; rules: string[]; words: ClusterWord[]; unit?: string }  // unit：小單元名稱（例「L13-1 複合子音」），有填就自成一個區塊，同 unit 的說明卡、練習也排進來

/** Grouping（L15）：一個小單元一組「結構圖＋音節表＋例字表」。unit＝小單元名稱（自成一個區塊，同 unit 的說明卡、練習也排進來）；
 *  subtitle＝區塊標題下方的副標，直接講規則（例「MC/HC＋LCs：加 ห」），講義的小單元名稱容易混淆時用；c1／c2＝結構圖 C1、C2 下面的小字（例 MC/HC、LCs），空字串＝不寫；caption＝結構圖下方的補充；
 *  consonants＝音節表「子音」列：兩格＝第 1、第 2 個音節各一格，一格＝兩個音節合併；pron＝「音節發音」列，**文字**＝紅字（例 **ห**C2V(F)），\n 後面另起一行；
 *  note＝音節表最下面跨兩欄的紅字（例「＊不以複合子音發音」）；words＝例字，split＝講義「第1個音節-第2個音節」的念法，mark＝講義標紅的念法，中文從 vocab 帶 */
export interface GroupingWord { thai: string; split: string; mark?: boolean }
export interface GroupingUnit { unit: string; subtitle?: string; c1: string; c2: string; caption?: string; consonants: string[]; pron: [string, string]; note?: string; words: GroupingWord[] }

/** 梵文母音表（L14）：一個字母一組，readings 一個念法一列（字母那一格自動合併）；sound＝念法（例 รึ），word＝例字（中文從 vocab 帶），split＝講義的分音節念法（例 รึ-ดู），
 *  沒有 word＝講義的「/」；unused＝講義「現今不使用」；mark＝講義淺黃底的格子（常用的念法） */
export interface SanskritReading { sound: string; word?: string; split?: string; unused?: boolean; mark?: boolean }
export interface SanskritVowel { char: string; readings: SanskritReading[] }

/** 母音種類說明卡：focus＝這課要學（紅）、done＝學過（灰）、notes:false＝不顯示下方補充說明 */
export interface VowelIntroConfig { focus: ('single' | 'compound' | 'special' | 'sanskrit')[]; done?: ('single' | 'compound' | 'special' | 'sanskrit')[]; notes?: boolean }

export interface Lesson {
  id: string; number: number; title: string; summary: string; status: 'draft' | 'ready'  // summary：標題下方的說明，用 \n 分行會列點
  rules: Rule[]; consonants: Consonant[]; vowels: Vowel[]; toneTables: ToneTable[]
  vocab: WordItem[]; practice: PracticeGroup[]; patterns: Pattern[]
  /** 顯示在「母音」區塊最上面（種類說明卡之後）的說明卡 */
  vowelNotes?: Rule[]
  /** 設了母音卡的 id：「單字」清單改放在「母音」區塊裡、這張卡所屬的那一組之後（不再單獨一個區塊） */
  vocabAfterVowel?: string
  /** 有設：「單字」清單改成依尾音分卡（vocab 依 group 排進對應的尾音卡），不再單獨一個區塊 */
  finals?: Final[]
  /** 複習上一課：放在最前面的「複習」分頁（上課一開始先做），格式同補充卡 */
  review?: Extra[]
  /** 「複習」區塊的名稱（例：複習拼讀規則），沒填就叫「複習」 */
  reviewLabel?: string
  /** 母音加尾音的變形表（放在「說明」最上面）；有設就不另開「單字」分頁，例字的中文從 vocab 帶 */
  vowelShifts?: VowelShiftTable[]
  /** 複合子音組合表＋例字拆解（放在「說明」最上面）；有設就不另開「單字」分頁，例字的中文從 vocab 帶 */
  clusters?: ClusterIntroConfig
  /** Grouping 小單元（L15）：每個小單元自成一個區塊；有設就不另開「單字」分頁，例字的中文從 vocab 帶 */
  grouping?: GroupingUnit[]
  /** 梵文母音表（L14，放在「母音」區塊）；有設就不另開「單字」分頁，例字的中文從 vocab 帶 */
  sanskritVowels?: SanskritVowel[]
  /** 「說明」區塊（聲調總覽、聲調表）改排在子音後面、改叫「聲調」（L1：先概念、再子音、最後聲調） */
  tonesAfterConsonants?: boolean
  /** 開放投影片模式（課程頁出現「▶ 投影片模式」按鈕，見 lesson-slides skill） */
  slides?: boolean
  /** 作業頁聽寫取前幾個作業字，沒設＝8（L14 講義作業頁 10 個字都要放） */
  homeworkCount?: number
  /** 作業頁「延伸影片挑戰」按鈕的連結（站內路徑，例如 /video/xxx）；沒設就顯示「即將開放」 */
  videoChallenge?: string
  homework: string[]; links: LinkItem[]; memes: Meme[]; extras: Extra[]; diagram?: Diagram; toneIntro?: boolean; vowelIntro?: boolean | VowelIntroConfig; finalsIntro?: boolean | FinalsIntroConfig  // true＝清尾音總表（L10 的 5 音 10 字）
}
