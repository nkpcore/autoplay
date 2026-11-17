import type { Cue } from '../data/types'

let lock: WakeLockSentinel | null = null

export async function keepAwake(): Promise<void> {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
  try {
    lock = await navigator.wakeLock.request('screen')
  } catch {
    /* unsupported or denied */
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && lock?.released) {
      void keepAwake()
    }
  })
}

export function setMediaSession(
  cue: Cue,
  h: { play: () => void; pause: () => void; next: () => void },
): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: cue.title,
      artist: cue.artist,
      album: 'PartyAux Live Mix',
      artwork: [
        { src: '/favicon.svg', sizes: '96x96', type: 'image/svg+xml' },
      ],
    })

    navigator.mediaSession.setActionHandler('play', h.play)
    navigator.mediaSession.setActionHandler('pause', h.pause)
    navigator.mediaSession.setActionHandler('nexttrack', h.next)
  } catch {
    /* ignore unsupported action handlers */
  }
}
