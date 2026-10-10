import { getStrokes } from '../strokes'

// 以筆畫資料畫出聲調符號（不依賴字型），裁切到符號所在的位置。
export default function MarkGlyph({ char, size = 44 }: { char: string; size?: number }) {
  const d = getStrokes(char)
  if (!d) return <span className="th">{char}</span>
  return (
    <svg viewBox="112 52 76 51" width={size * 1.5} height={size} role="img" aria-label="聲調符號" style={{ display: 'block' }}>
      {d.strokes.map((p, i) => <path key={i} d={p} fill="none" stroke="currentColor" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  )
}
