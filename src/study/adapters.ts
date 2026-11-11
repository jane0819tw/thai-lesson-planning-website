import type { Song } from '../song/types'
import type { VideoLesson } from '../video/types'
import { noteLines } from '../song/lines'
import type { StudyDoc, StudyNote } from './types'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function fromSong(song: Song): StudyDoc {
  const src = [...(song.notes ?? [])].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'word' ? -1 : 1))
  const notes: StudyNote[] = src.map(n => ({
    id: n.th, kind: n.kind, th: n.th, rom: n.rom, zh: n.zh, explain: n.explain, examples: [n.example],
  }))
  return {
    kind: 'song', id: song.id, title: song.title,
    subtitle: [song.titleZh, song.artist, mmss(song.duration)].filter(Boolean).join('・'),
    youtubeId: song.youtubeId, duration: song.duration,
    lines: song.lines, notes, noteAt: noteLines(song.lines, src),
    quiz: song.quiz, images: song.images, pagePath: `/song/${song.id}`,
  }
}

/** 影片：單字只列 vocab（老師挑的、要講解的字）；單字、句型都在第一次出現的那句講解 */
export function fromVideo(v: VideoLesson): StudyDoc {
  const lines = v.lines.map((L, i) => ({
    start: L.start,
    end: i + 1 < v.lines.length ? v.lines[i + 1].start : v.duration,
    th: L.words.map(w => w.th).join(''),
    zh: L.zh,
    words: L.words,
  }))
  const words: StudyNote[] = (v.vocab ?? []).map(w => ({
    id: `w-${w.th}`, kind: 'word', th: w.th, rom: w.rom, zh: w.zh, explain: w.explain,
    examples: w.examples ?? (w.example ? [w.example] : []),
  }))
  const pats: StudyNote[] = v.patterns.map(p => ({ id: p.id, kind: 'pattern', th: p.th, zh: p.zh, explain: p.cmp, examples: p.examples }))
  return {
    kind: 'video', id: v.id, title: v.title,
    subtitle: [v.titleZh, v.topic, v.level, mmss(v.duration)].filter(Boolean).join('・'),
    youtubeId: v.youtubeId, duration: v.duration,
    lines,
    notes: [...words, ...pats],
    noteAt: [...noteLines(lines, words), ...pats.map(p => v.lines.findIndex(L => L.patterns.includes(p.id)))],
    tips: v.tips, pagePath: `/video/${v.id}`,
  }
}
