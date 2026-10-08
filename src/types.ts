// 資料型別：日後若改接資料庫/API，只要回傳同樣的形狀，前端不用改。
export type ConsonantClass = 'mid' | 'high' | 'low'
export type Tone = 'mid' | 'low' | 'falling' | 'high' | 'rising'

export interface Rule { id: string; title: string; body: string; strokes: unknown | null }
export interface Consonant {
  id: string; char: string; name: string; nameRoman: string; nameZh: string
  initial: string; final: string; class: ConsonantClass; audioUrl?: string | null
}
export interface Vowel {
  id: string; char: string; withCarrier: string; roman: string
  length: 'short' | 'long'; position: string; example: string; audioUrl?: string | null
}
export interface Word {
  id: string; thai: string; roman: string; zh: string; tone: Tone
  parts: string[]; note?: string; audioUrl?: string | null
}
export interface Sentence {
  id: string; segments: string[]; roman: string; zh: string; audioUrl?: string | null
}
export interface Meme { idea: string; caption: string; imageUrl: string | null }
export interface Lesson {
  id: string; number: number; title: string; summary: string
  status: 'draft' | 'ready'
  rules: Rule[]; consonants: Consonant[]; vowels: Vowel[]
  words: Word[]; sentences: Sentence[]; meme: Meme
}
