// 音標寫法依 thai2english.com。依聲調符號上色：
// 無符號＝平、` 低、^ 降、´ 高、˘ 升（也接受 ˇ）。
export type Tone = 'mid' | 'low' | 'fall' | 'high' | 'rise'

export function toneOf(syllable: string): Tone {
  const d = syllable.normalize('NFD')
  if (d.includes('\u0300')) return 'low'
  if (d.includes('\u0302')) return 'fall'
  if (d.includes('\u0301')) return 'high'
  if (d.includes('\u0306') || d.includes('\u030C')) return 'rise'
  return 'mid'
}

export function Rom({ text }: { text: string }) {
  return (
    <span className="rom">
      {text.split(/([-\s]+)/).map((p, i) =>
        /^[-\s]+$/.test(p) ? p : <span key={i} className={`tn-${toneOf(p)}`}>{p}</span>,
      )}
    </span>
  )
}
