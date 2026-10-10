import { getIconUrl } from '../icons'

export default function WordIcon({ char, label, size = 56 }: { char: string; label?: string; size?: number }) {
  const url = getIconUrl(char)
  if (!url) return null
  return <img className="wordicon" src={url} width={size} height={size} alt={label ?? ''} loading="lazy" />
}
