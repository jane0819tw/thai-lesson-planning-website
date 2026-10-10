import type { VideoLesson } from '../video/types'

// 與 repository.ts 相同的做法：建置時把 data/videos/*.json 打包進來，零後端。
const modules = import.meta.glob<VideoLesson>('../../data/videos/*.json', { eager: true, import: 'default' })

export interface VideoRepository {
  listVideos(): Promise<VideoLesson[]>
  getVideo(id: string): Promise<VideoLesson | undefined>
}

class StaticVideoRepository implements VideoRepository {
  private videos = Object.values(modules).sort((a, b) => a.id.localeCompare(b.id))
  async listVideos() { return this.videos }
  async getVideo(id: string) { return this.videos.find(v => v.id === id) }
}

let repo: VideoRepository | null = null
export function getVideoRepository(): VideoRepository {
  return (repo ??= new StaticVideoRepository())
}
