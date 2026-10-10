// YouTube IFrame Player API 的最小封裝（不需要額外套件）。
export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  /** -1 未開始, 0 結束, 1 播放中, 2 暫停, 3 緩衝, 5 已排入 */
  getPlayerState(): number
  setPlaybackRate(rate: number): void
  destroy(): void
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: {
    videoId: string; width?: string; height?: string
    playerVars?: Record<string, string | number>
    events?: { onReady?: () => void; onError?: (e: { data: number }) => void }
  }) => YTPlayer
}
declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<void> | null = null

/** 載入 iframe_api 腳本。被擋住或逾時會 reject，畫面會改顯示「在 YouTube 開啟」。 */
export function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (apiPromise) return apiPromise
  apiPromise = new Promise<void>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve() }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => { apiPromise = null; reject(new Error('blocked')) }
    document.head.appendChild(s)
    window.setTimeout(() => { apiPromise = null; reject(new Error('timeout')) }, 10000)
  })
  return apiPromise
}

export const PLAYER_ERRORS: Record<number, string> = {
  2: '影片網址參數錯誤。',
  5: '這個瀏覽器無法播放這支影片。',
  100: '找不到影片，或影片已設為私人。',
  101: '影片擁有者不允許嵌入播放。',
  150: '影片擁有者不允許嵌入播放。',
}
