import type { Lesson } from '../types'

/**
 * 資料存取層。目前實作：從建置時打包的 JSON 讀取（零後端，適合 GitHub Pages）。
 * 之後上 GCP：新增 ApiLessonRepository（fetch Cloud Run API → Firestore / Cloud SQL），
 * 並在 getRepository() 切換即可，畫面元件完全不用動。
 */
export interface LessonRepository {
  listLessons(): Promise<Lesson[]>
  getLesson(id: string): Promise<Lesson | undefined>
}

const modules = import.meta.glob<Lesson>('../../data/lessons/*.json', {
  eager: true,
  import: 'default',
})

class StaticJsonRepository implements LessonRepository {
  private lessons = Object.values(modules).sort((a, b) => a.number - b.number)
  async listLessons() { return this.lessons }
  async getLesson(id: string) { return this.lessons.find(l => l.id === id) }
}

let repo: LessonRepository | null = null
export function getRepository(): LessonRepository {
  // 未來：if (import.meta.env.VITE_API_URL) return new ApiLessonRepository(...)
  return (repo ??= new StaticJsonRepository())
}
