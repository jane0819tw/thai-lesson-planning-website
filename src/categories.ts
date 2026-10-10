export interface Category { key: string; title: string; desc: string; to?: string }
// to 有值＝已開放；沒有＝即將推出
export const CATEGORIES: Category[] = [
  { key: 'reading', title: '泰文認字課程', desc: '子音、母音、聲調規則，L1–L10', to: '/reading' },
  { key: 'video', title: '影片教學', desc: '跟著影片逐句精讀', to: '/video' },
  { key: 'lyrics', title: '歌詞', desc: '用歌詞學泰文' },
  { key: 'culture', title: '文教', desc: '泰國文化與生活' },
  { key: 'conversation', title: '會話', desc: '日常會話' },
  { key: 'artfont', title: '藝術字', desc: '泰文藝術字' },
]
