export interface Category { key: string; title: string; desc: string; to?: string; /** 開發這門課用的 skill（.claude/skills/），只在 admin 課程入口顯示 */ skills?: string[] }
// to 有值＝已開放；沒有＝即將推出
export const CATEGORIES: Category[] = [
  { key: 'reading', title: '泰文認字課程', desc: '子音、母音、聲調規則，L1–L10', to: '/reading', skills: ['reading-lesson', 'lesson-slides', 'lesson-handout', 'dictation-clips'] },
  { key: 'video', title: '影片教學', desc: '跟著影片逐句精讀', to: '/video', skills: ['video-song-lesson'] },
  { key: 'lyrics', title: '歌詞', desc: '用歌詞學泰文', to: '/song', skills: ['video-song-lesson'] },
  { key: 'news', title: '時事補充', desc: '節日與時事：單字、簡單句子、泰國網路金句', to: '/news', skills: ['news-supplement'] },
  { key: 'news-reading', title: '短文時事閱讀', desc: '讀真實的泰文短文：貼文、廣告、短新聞', to: '/news-reading', skills: ['news-reading'] },
  { key: 'culture', title: '文教', desc: '泰國文化與生活' },
  { key: 'conversation', title: '泰語會話', desc: '自我介紹、點餐、殺價、問路，每 5 課一個單元', to: '/conversation', skills: ['conversation-lesson'] },
  { key: 'artfont', title: '藝術字', desc: '泰文藝術字' },
]
