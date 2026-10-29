import type { Song } from '../song/types'

// 與 videoRepository.ts 相同的做法：建置時把 data/songs/*.json 打包進來；草稿只在本機 dev 列出。
const modules = import.meta.glob<Song>('../../data/songs/*.json', { eager: true, import: 'default' })
const songs = Object.values(modules).filter(s => !s.draft || import.meta.env.DEV).sort((a, b) => a.id.localeCompare(b.id))

export const listSongs = () => songs
export const getSong = (id: string) => songs.find(s => s.id === id)
