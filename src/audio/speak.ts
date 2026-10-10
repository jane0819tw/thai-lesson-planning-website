/**
 * 發音層。優先順序：
 *   1) 資料裡有 audioUrl（之後 AI 語音生成的 mp3）→ 直接播放
 *   2) 否則用瀏覽器內建 Web Speech API（th-TH；Chrome/Android 上就是 Google 語音）
 * 切換到 AI 語音時：把生成的檔案放進 public/audio/ 並把路徑填進 JSON 的 audioUrl 即可。
 */
let current: HTMLAudioElement | null = null

function pickThaiVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith('th'))
  return voices.find(v => /google/i.test(v.name)) ?? voices[0]
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speak(text: string, audioUrl?: string | null): void {
  if (current) { current.pause(); current = null }
  if (audioUrl) {
    current = new Audio(audioUrl)
    void current.play()
    return
  }
  if (!canSpeak()) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'th-TH'
  u.rate = 0.8
  const v = pickThaiVoice()
  if (v) u.voice = v
  window.speechSynthesis.speak(u)
}

/** 子音名稱（如「กอ ไก่」）中間的空格會讓語音停頓，朗讀時去掉。 */
export const nameText = (name: string): string => name.replace(/\s+/g, '')
