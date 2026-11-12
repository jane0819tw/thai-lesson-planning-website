import type { ReadArticle } from './types'

// 短文時事閱讀：data/news-reading/*.json，建置時打包；新的排前面
const modules = import.meta.glob<Omit<ReadArticle, 'id'>>('../../data/news-reading/*.json', { eager: true, import: 'default' })

const ALL: ReadArticle[] = Object.entries(modules)
  .map(([path, a]) => ({ ...a, id: path.split('/').pop()!.replace(/\.json$/, '') }))
  .sort((a, b) => b.date.localeCompare(a.date))

export const readList = (): ReadArticle[] => ALL
export const readArticle = (id: string): ReadArticle | undefined => ALL.find(a => a.id === id)
