import type { Cue } from '../data/types'
import type { Deck, DeckStatus } from './types'
import { loadYouTubeApi } from './youtubeApi'
import { CONFIG } from '../config'

export class YouTubeDeck implements Deck {
  readonly name: 'A' | 'B'
  status: DeckStatus = 'empty'
  cue: Cue | null = null
  private player!: YT.Player
  private idIndex = 0
  private startSec = 0
  private preloading = false
  private watchdog: number | undefined
  private resolveLoad?: () => void
  private rejectLoad?: (e: Error) => void

  private constructor(name: 'A' | 'B') {
    this.name = name
  }

  static async create(name: 'A' | 'B', mount: HTMLElement): Promise<YouTubeDeck> {
    await loadYouTubeApi()
    const deck = new YouTubeDeck(name)
    const slot = document.createElement('div')
    slot.id = `yt-player-${name}`
    mount.appendChild(slot)
    await new Promise<void>((resolve) => {
      deck.player = new YT.Player(slot, {
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => resolve(),
          onStateChange: (e: YT.OnStateChangeEvent) => deck.onState(e.data),
          onError: (e: YT.OnErrorEvent) => deck.onError(e.data),
        },
      })
    })
    return deck
  }

  load(cue: Cue, startSec: number): Promise<void> {
    this.cue = cue
    this.startSec = startSec
    this.idIndex = 0
    this.status = 'loading'
    return new Promise<void>((resolve, reject) => {
      this.resolveLoad = resolve
      this.rejectLoad = reject
      this.tryCurrentId()
    })
  }

  private tryCurrentId() {
    const cue = this.cue
    if (!cue) return
    const videoId = cue.youtube_ids[this.idIndex]
    if (!videoId) {
      this.fail(new Error('all sources failed'))
      return
    }
    this.preloading = true
    try {
      this.player.mute()
      this.player.setVolume(0)
      this.player.loadVideoById({ videoId, startSeconds: this.startSec })
    } catch (err) {
      console.warn(`[YouTubeDeck ${this.name}] loadVideoById failed`, err)
      this.nextId('load-exception')
      return
    }
    window.clearTimeout(this.watchdog)
    this.watchdog = window.setTimeout(() => this.nextId('timeout'), CONFIG.LOAD_WATCHDOG_MS)
  }

  private nextId(reason: string) {
    console.warn(`[YouTubeDeck ${this.name}] Next ID triggered (${reason})`)
    window.clearTimeout(this.watchdog)
    this.idIndex++
    this.tryCurrentId()
  }

  private fail(err: Error) {
    window.clearTimeout(this.watchdog)
    this.preloading = false
    this.status = 'error'
    this.rejectLoad?.(err)
    this.resolveLoad = undefined
    this.rejectLoad = undefined
  }

  private onState(state: number) {
    // 1 is YT.PlayerState.PLAYING
    if (state === 1 && this.preloading) {
      this.preloading = false
      window.clearTimeout(this.watchdog)
      this.player.pauseVideo()
      this.player.seekTo(this.startSec, true)
      this.status = 'ready'
      this.resolveLoad?.()
      this.resolveLoad = undefined
      this.rejectLoad = undefined
    }
  }

  private onError(code: number) {
    // 2 invalid id, 5 html5 error, 100 not found/private, 101/150 embedding disabled
    console.warn(`[YouTubeDeck ${this.name}] Player reported error code: ${code}`)
    if (this.status === 'loading') {
      this.nextId('error ' + code)
    }
  }

  play() {
    this.player.playVideo()
    this.status = 'playing'
  }

  pause() {
    this.player.pauseVideo()
    this.status = 'paused'
  }

  setGain(g: number) {
    const v = Math.round(Math.min(1, Math.max(0, g)) * 100)
    if (v > 0) {
      this.player.unMute()
    }
    this.player.setVolume(v)
  }

  getTime(): number {
    return this.player.getCurrentTime?.() ?? 0
  }

  getDuration(): number {
    return this.player.getDuration?.() ?? this.cue?.duration_sec ?? 0
  }

  seek(sec: number) {
    this.player.seekTo(sec, true)
  }

  stop() {
    window.clearTimeout(this.watchdog)
    try {
      this.player.pauseVideo()
    } catch {
      /* ignore */
    }
    this.status = 'empty'
    this.cue = null
  }
}
