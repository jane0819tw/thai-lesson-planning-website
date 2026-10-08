import { speak } from '../audio/speak'

export default function SpeakButton({ text, audioUrl }: { text: string; audioUrl?: string | null }) {
  return (
    <button className="speak" aria-label={`播放發音：${text}`} onClick={() => speak(text, audioUrl)}>
      🔊
    </button>
  )
}
