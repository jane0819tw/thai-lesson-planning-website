// 延伸影片挑戰用的聽寫片段：讀 data/dictation/candidates/lesson-NN.json 裡老師審查過（reviewed）的句子
export interface ClipHit { word: string; from: number; to: number; source: string }
export interface DictClip { id: string; videoId: string; start: number; end: number; text: string; hits: ClipHit[]; reviewed?: boolean }

const files = import.meta.glob('../data/dictation/candidates/lesson-*.json', { eager: true, import: 'default' }) as Record<string, { lesson: number; clips: DictClip[] }>

const byLesson = new Map<number, DictClip[]>()
for (const f of Object.values(files)) byLesson.set(f.lesson, f.clips.filter(c => c.reviewed && c.hits.length > 0))

interface VideoInfo { id: string; title?: string; channel?: string; url: string }
const videoFile = import.meta.glob('../data/dictation/videos.json', { eager: true, import: 'default' }) as Record<string, { videos: VideoInfo[] }>
/** 影片來源（標題、頻道、YouTube 連結），給影片挑戰頁標示出處 */
export const videoInfoOf = (id: string): VideoInfo | undefined => Object.values(videoFile)[0]?.videos.find(v => v.id === id)

export const dictClipsOf = (lesson: number): DictClip[] => byLesson.get(lesson) ?? []
/** 影片挑戰的作業紀錄課別代號：L3 → V3 */
export const videoKey = (lesson: number) => `V${lesson}`
