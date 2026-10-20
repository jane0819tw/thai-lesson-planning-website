/**
 * 發音層。優先順序：
 *   1) 資料裡有 audioUrl → 直接播放
 *   2) public/audio/manifest.json 有這段泰文的預錄 mp3（scripts/gen-audio.py 產生）→ 播放
 *   3) 否則用瀏覽器內建 Web Speech API（th-TH；Chrome/Android 上就是 Google 語音）
 */
let current: HTMLAudioElement | null = null

const AUDIO_DIR = `${import.meta.env.BASE_URL}audio/`
let manifest: Record<string, string> = {}
// 頁面載入時就預先抓；點擊當下要同步播放（iOS 要求），所以不在 speak() 裡等它
if (typeof window !== 'undefined') {
  fetch(`${AUDIO_DIR}manifest.json`).then(r => (r.ok ? r.json() : {})).then(m => { manifest = m }).catch(() => {})
}

function pickThaiVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith('th'))
  return voices.find(v => /google/i.test(v.name)) ?? voices[0]
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

let seq = 0 // 每次新的 speak / speakSequence 都會讓舊的連續播放失效

export function speak(text: string, audioUrl?: string | null): void {
  seq++
  if (current) { current.pause(); current = null }
  const url = audioUrl ?? (manifest[text] ? AUDIO_DIR + manifest[text] : null)
  if (url) {
    current = new Audio(url)
    current.play().catch(() => speakTts(text))
    return
  }
  speakTts(text)
}

function speakTts(text: string): void {
  if (!canSpeak()) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'th-TH'
  u.rate = 0.8
  const v = pickThaiVoice()
  if (v) u.voice = v
  window.speechSynthesis.speak(u)
}

/** 依序播放多段（例如第一聲到第五聲）。播放中再按任何發音鈕會中斷。 */
export async function speakSequence(texts: string[], gapMs = 450): Promise<void> {
  const mine = ++seq
  if (current) { current.pause(); current = null }
  // 先全部載入，接著播時才不會因為下載而出現空檔
  const preloaded = new Map(texts.map(t => [t, manifest[t] ? Object.assign(new Audio(AUDIO_DIR + manifest[t]), { preload: 'auto' }) : null]))
  for (const text of texts) {
    if (mine !== seq) return
    const a = preloaded.get(text)
    if (a) {
      current = a
      await new Promise<void>(res => { a.onended = () => res(); a.onerror = () => res(); a.play().catch(() => res()) })
    } else if (canSpeak()) {
      await new Promise<void>(res => {
        const u = new SpeechSynthesisUtterance(text)
        u.lang = 'th-TH'; u.rate = 0.8
        const v = pickThaiVoice(); if (v) u.voice = v
        u.onend = () => res(); u.onerror = () => res()
        window.speechSynthesis.cancel(); window.speechSynthesis.speak(u)
      })
    }
    if (mine !== seq) return
    if (gapMs > 0) await new Promise(r => setTimeout(r, gapMs))
  }
}

/** 子音名稱（如「กอ ไก่」）中間的空格會讓語音停頓，朗讀時去掉。 */
export const nameText = (name: string): string => name.replace(/\s+/g, '')
