import { useEffect, useState } from 'react'
import { getRepository } from './repository'
import type { Consonant, Vowel } from '../types'

// 取得所有課程的子音／母音，供總表與鍵盤共用
export function useCatalog() {
  const [consonants, setConsonants] = useState<Consonant[]>([])
  const [vowels, setVowels] = useState<Vowel[]>([])
  useEffect(() => {
    getRepository().listLessons().then(ls => {
      setConsonants(ls.flatMap(l => l.consonants))
      setVowels(ls.flatMap(l => l.vowels))
    })
  }, [])
  return { consonants, vowels }
}
