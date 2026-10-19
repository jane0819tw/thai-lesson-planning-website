// 課程開放單位（需與後端 reservation/src/Courses.gs 的代號格式一致）
//   reading:<n>  泰文認字課程，每 5 課一個單位（reading:1 ＝ L1–L5、reading:2 ＝ L6–L10 …）
//   其他         整門開放，代號就是 categories.ts 的 key（例如 video）
import { useEffect, useState } from 'react'
import { CATEGORIES } from '../categories'
import { getRepository } from '../data/repository'
import type { Lesson } from '../types'

export const UNIT_SIZE = 5
export interface Unit { id: string; n: number; from: number; to: number }

/** 依實際課數切成單位（最後一個單位可能不滿 5 課） */
export function readingUnits(lessonNumbers: number[]): Unit[] {
  const max = Math.max(0, ...lessonNumbers)
  return Array.from({ length: Math.ceil(max / UNIT_SIZE) }, (_, i) => ({ id: `reading:${i + 1}`, n: i + 1, from: i * UNIT_SIZE + 1, to: Math.min((i + 1) * UNIT_SIZE, max) }))
}
export const unitLabel = (u: Unit) => `L${u.from}–L${u.to}`

/** 整門開放的課程（已開放、且不是認字課程；認字課程用上面的單位） */
export const WHOLE_COURSES = CATEGORIES.filter(c => c.to && c.key !== 'reading')

export function useLessons(): Lesson[] {
  const [lessons, setLessons] = useState<Lesson[]>([])
  useEffect(() => { getRepository().listLessons().then(setLessons) }, [])
  return lessons
}
