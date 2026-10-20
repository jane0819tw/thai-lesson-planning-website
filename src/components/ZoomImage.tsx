import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

// 點圖片放大顯示（點背景、按 ✕ 或 Esc 關閉）。縮圖樣式由呼叫端用 className／style 決定。
export default function ZoomImage({ src, alt, className, style }: { src: string; alt: string; className?: string; style?: CSSProperties }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <>
      <img className={`${className ?? ''} zoomable`.trim()} style={style} src={src} alt={alt} loading="lazy"
        role="button" tabIndex={0} title="點擊放大"
        onClick={() => setOpen(true)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }} />
      {open && createPortal(
        <div className="zoom-overlay" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setOpen(false)}>
          <img src={src} alt={alt} />
          <button type="button" className="zoom-close" aria-label="關閉" onClick={() => setOpen(false)}>✕</button>
        </div>,
        document.body,
      )}
    </>
  )
}
