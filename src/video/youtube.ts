// YouTube IFrame Player API 的最小封裝（不需要額外套件）。
export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  loadVideoById(opts: { videoId: string; startSeconds?: number }): void
  getCurrentTime(): number
  getDuration(): number
  /** -1 未開始, 0 結束, 1 播放中, 2 暫停, 3 緩衝, 5 已排入 */
  getPlayerState(): number
  setPlaybackRate(rate: number): void
  /** 0–100。iPhone／iPad 的 Safari 不支援，只能用機身音量鍵 */
  setVolume(volume: number): void
  mute(): void
  unMute(): void
  destroy(): void
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: {
    videoId: string; width?: string; height?: string
    playerVars?: Record<string, string | number>
    events?: { onReady?: () => void; onError?: (e: { data: number }) => void; onStateChange?: (e: { data: number }) => void }
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

/** 本機影片（public/ 底下的 mp4）：用 <video> 模擬 YTPlayer 介面，頁面其他程式不用分兩套 */
function html5Player(video: HTMLVideoElement): YTPlayer {
  return {
    playVideo: () => { void video.play().catch(() => {}) },
    pauseVideo: () => video.pause(),
    seekTo: s => { video.currentTime = s },
    loadVideoById: ({ startSeconds }) => { video.currentTime = startSeconds ?? 0 },
    getCurrentTime: () => video.currentTime,
    getDuration: () => video.duration || 0,
    getPlayerState: () => {
      if (video.ended) return 0
      if (video.paused) return video.currentTime > 0 ? 2 : -1
      return video.readyState < 3 ? 3 : 1
    },
    setPlaybackRate: r => { video.playbackRate = r },
    setVolume: v => { video.volume = Math.min(1, Math.max(0, v / 100)) },
    mute: () => { video.muted = true },
    unMute: () => { video.muted = false },
    destroy: () => { video.pause(); video.removeAttribute('src'); video.load(); video.remove() },
  }
}

/**
 * 在 host 裡建立播放器：有 videoSrc 用本機影片，否則用 YouTube。
 * 回傳清除函式（換頁、卸載時呼叫）。
 */
export function mountPlayer(
  host: HTMLElement,
  src: { youtubeId: string; videoSrc?: string },
  onReady: (p: YTPlayer) => void,
  onError: (msg: string) => void,
): () => void {
  let cancelled = false
  let player: YTPlayer | null = null
  if (src.videoSrc) {
    const v = document.createElement('video')
    v.src = `${import.meta.env.BASE_URL}${src.videoSrc.replace(/^\//, '')}`
    v.playsInline = true
    v.controls = true
    v.preload = 'auto'
    host.appendChild(v)
    player = html5Player(v)
    v.addEventListener('loadedmetadata', () => { if (!cancelled) onReady(player!) }, { once: true })
    v.addEventListener('error', () => { if (!cancelled) onError('無法載入影片檔。') }, { once: true })
  } else {
    const mount = document.createElement('div')
    host.appendChild(mount)
    loadYouTubeApi()
      .then(() => {
        if (cancelled || !window.YT) return
        player = new window.YT.Player(mount, {
          videoId: src.youtubeId, width: '100%', height: '100%',
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => { if (!cancelled) onReady(player!) },
            onError: e => { if (!cancelled) onError(PLAYER_ERRORS[e.data] ?? '無法播放這支影片。') },
          },
        })
      })
      .catch(() => { if (!cancelled) onError('無法載入 YouTube 播放器（可能被網路或瀏覽器擋住）。') })
  }
  return () => {
    cancelled = true
    try { player?.destroy() } catch { /* 已被移除 */ }
    host.innerHTML = ''
  }
}
