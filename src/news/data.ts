import type { NewsItem } from './types'

// 時事補充：data/news/*.json，建置時打包；新的排前面
const modules = import.meta.glob<Omit<NewsItem, 'id'>>('../../data/news/*.json', { eager: true, import: 'default' })

const ALL: NewsItem[] = Object.entries(modules)
  .map(([path, n]) => ({ ...n, id: path.split('/').pop()!.replace(/\.json$/, '') }))
  .sort((a, b) => b.date.localeCompare(a.date))

export const newsList = (): NewsItem[] => ALL
export const newsItem = (id: string): NewsItem | undefined => ALL.find(n => n.id === id)
