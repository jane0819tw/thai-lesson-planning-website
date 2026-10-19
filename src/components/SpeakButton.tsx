import { speak } from '../audio/speak'

export const SpeakIcon = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" />
    <path d="M15.5 9a4 4 0 0 1 0 6" />
    <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
  </svg>
)

export default function SpeakButton({ text, audioUrl }: { text: string; audioUrl?: string | null }) {
  return (
    <button className="speak" aria-label={`播放發音：${text}`} onClick={() => speak(text, audioUrl)}>
      <SpeakIcon />
    </button>
  )
}
