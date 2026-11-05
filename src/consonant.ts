import type { Consonant } from './types'
// 子音卡「發音 X」那一段；有 soundNote 就改顯示說明（L1 อ：當子音不發音，當母音發 or 音）
export const soundLabel = (c: Pick<Consonant, 'sound' | 'soundNote'>) => c.soundNote ?? `發音 ${c.sound}`
