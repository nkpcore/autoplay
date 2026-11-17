let promise: Promise<void> | null = null

export function loadYouTubeApi(): Promise<void> {
  if (promise) return promise
  promise = new Promise((resolve, reject) => {
    const win = window as unknown as {
      YT?: { Player: unknown }
      onYouTubeIframeAPIReady?: () => void
    }
    if (win.YT && win.YT.Player) {
      resolve()
      return
    }
    const prev = win.onYouTubeIframeAPIReady
    win.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.onerror = () => reject(new Error('YouTube API failed to load'))
    document.head.appendChild(s)
  })
  return promise
}
