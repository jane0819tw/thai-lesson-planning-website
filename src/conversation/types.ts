// 會話課程的一課（data/conversation/<級>/lesson-NN.json）。規格見 .claude/skills/conversation-lesson/SKILL.md
// 文字標記（泰文、拼音、中文三行位置一一對應）：{{關鍵字}} 紅字粗體（講義的紅字）、[[可替換]] 底線（講義的底線）
// 說明文字（goals、body、練習卡）裡夾泰文時寫 <<泰文|拼音>>：顯示泰文＋（拼音），拼音跟著開關

/** 一句：泰文、拼音、中文 */
export interface ConvText { th: string; rom: string; zh: string; note?: string }

/** 句型例句：who＝說話的人（f 女、m 男，顯示頭像）；q＝問句（開新的一列放左邊，後面的回答放右邊） */
export interface ConvExample extends ConvText { who?: 'f' | 'm'; q?: boolean }

/** 單字：star＝★必學（沒標＝認得就好）；icon＝emoji 圖示 */
export interface ConvWord { th: string; rom: string; zh: string; star?: boolean; icon?: string; /** 講義的圖（public/ 底下的路徑），有的話取代 icon */ image?: string }

/** 短句卡：一組好幾張（講義開頭、中間的「短句」頁） */
export interface PhrasesBlock {
  type: 'phrases'; id: string; title: string; items: (ConvWord & { note?: string })[]
  /** 每列幾張（例：[5, 6]＝1–5 一列、6–0 一列，L3 老師）；沒寫就自動排 */
  rows?: number[]
}

/** 數字表（講義 L3 11–99 的格子表）：橫軸個位數、直軸十位數，格子寫「泰文｜拼音」（可用 {{ }} 標關鍵字），"?" 是給學生想的空格，"" 留白 */
export interface NumTableBlock {
  type: 'numtable'; id: string; title: string
  /** 規則（說明文字，可用 <<泰文|拼音>>） */
  rules?: string[]
  cols: string[]
  rows: { head: string; cells: string[] }[]
}

/** 句型：講義藍底句型框（th、rom、zh＝關鍵字）＋人物 Q/A（examples）＋單字表（vocab）＋接話小工具 */
export interface PatternBlock {
  type: 'pattern'; id: string
  th: string; rom: string; zh: string
  examples: ConvExample[]
  vocab?: ConvWord[]
  /** 單字分好幾排（一排一類，例：L2 甜度一排、冰塊一排）。有這個時句型改成左右排：左邊句型框＋句子、右邊單字 */
  vocabRows?: ConvWord[][]
  /** 講義的圖（public/ 底下的路徑），左右排時放在句子下面（L2 甜度、冰塊對照圖） */
  images?: string[]
  toolbox?: ConvText[]
  /** 列印時問、答不並排，一句一列（L3 กี่：句子長，並排會斷行） */
  printStack?: boolean
  /** 只有圖、不寫字的一排（public/ 底下的路徑），老師指著圖問學生（L3 ใช่ไหม：前面學過的單字） */
  quiz?: string[]
}

/** 模板：一行一句，直的排（例：自我介紹的順序） */
export interface TemplateBlock { type: 'template'; id: string; title: string; body?: string; lines: ConvText[] }

export type ConvBlock = PhrasesBlock | PatternBlock | TemplateBlock | NumTableBlock

/** 對話串：一個人一次說的話可以分好幾段，每段標「回答／補充／反問／接話詞／聽懂就好」 */
/** listen（聽懂就好）L2 老師拿掉了，保留型別只為相容 */
export type ConvTag = 'answer' | 'add' | 'ask' | 'react' | 'listen'
export interface DialogueLine { who: string; avatar?: string; segs: (ConvText & { tag?: ConvTag })[]; /** 投影片從這則訊息開新的一頁（有任何一則設了就照這個分頁，沒設就自動分） */ newSlide?: boolean }
export interface Dialogue { scene: string; body?: string; lines: DialogueLine[] }

/** 練習：roleplay 角色扮演、qa 兩人互問、picture 看圖說話、translate 中翻泰 */
export interface PracticeCard { name?: string; icon?: string; /** 照片（public/ 底下的路徑） */ image?: string; lines: string[] }
export interface Practice {
  kind: 'roleplay' | 'qa' | 'picture' | 'translate'
  title: string
  /** 說明（可省略，投影片上老師口頭講就好） */
  body?: string
  /** 角色卡、看圖卡 */
  cards?: PracticeCard[]
  /** 提示句（可以用的句型） */
  hints?: ConvText[]
  /** 中翻泰的題目 */
  items?: string[]
}

/** 補充（畫面不加「有時間再上」標籤，L2 老師） */
export interface Extra {
  /** 標題（可省略：L3 泰文數字知多少三格只放圖和說明） */
  title?: string
  body?: string
  lines?: ConvText[]
  table?: { head: string[]; rows: string[][] }
  /** 講義的圖（public/ 底下的路徑），排成一列 */
  images?: string[]
  /** 放在圖的位置的大字（L3：๙、ผี，對應講義的圖） */
  bigText?: string
  link?: { url: string; label: string }
  /** 嵌入 YouTube 片段：start／end 秒數 */
  video?: { id: string; start?: number; end?: number; label: string }
  /** 投影片和下一張補充放同一頁（左右並排，中間一條線）；連續幾張都寫就幾張並排（L3：三格） */
  joinNext?: boolean
  /** 講義佔一整排（L1 達人秀） */
  wide?: boolean
  /** 放在最下面的說明（L2：和合併頁另一邊的圖對齊） */
  footnote?: string
}

export interface ConvLesson {
  /** 自動帶入：conv1-01 */
  id: string
  level: number
  number: number
  title: string
  status?: 'draft' | 'ready'
  /** 今日目標：今天上完你可以… */
  goals: string[]
  /** 上一課的快問快答（L1 沒有） */
  review?: { q: ConvText; a: ConvText }[]
  blocks: ConvBlock[]
  dialogue?: Dialogue
  practice: Practice[]
  extras?: Extra[]
  /** 句型總結：對得上 goals */
  recap?: ConvText[]
}
