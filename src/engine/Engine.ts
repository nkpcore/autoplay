import type { Cue, EngineEvent } from '../data/types'
import type { Deck, EngineListener, EngineState } from './types'
import { equalPowerFade, type FadeHandle } from './crossfade'
import { CONFIG } from '../config'
import { canCrossfadeYouTube } from './platform'

export class Engine {
  private decks: [Deck, Deck]
  private liveIdx = 0
  private tickId: number | undefined
  private fade: FadeHandle | null = null
  private listeners = new Set<EngineListener>()
  private preloadToken = 0
  private useHardCut: boolean

  queue: Cue[] = []
  index = 0
  state: EngineState = 'idle'

  constructor(decks: [Deck, Deck], opts?: { hardCut?: boolean }) {
    this.decks = decks
    this.useHardCut = opts?.hardCut ?? !canCrossfadeYouTube
  }

  on(l: EngineListener): () => void {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }

  private emit(e: EngineEvent) {
    this.listeners.forEach((l) => l(e))
  }

  get live(): Deck {
    const deck = this.decks[this.liveIdx]
    if (!deck) throw new Error('Deck index out of bounds')
    return deck
  }

  get idle(): Deck {
    const deck = this.decks[1 - this.liveIdx]
    if (!deck) throw new Error('Deck index out of bounds')
    return deck
  }

  get current(): Cue | undefined {
    return this.queue[this.index]
  }

  /** Replace the queue and start playing from startIndex. MUST be called from a user tap. */
  async start(queue: Cue[], startIndex = 0): Promise<void> {
    this.stopAll()
    this.queue = queue
    this.index = startIndex
    const first = this.queue[this.index]
    if (!first) return
    try {
      await this.live.load(first, first.entry_sec)
    } catch {
      this.emit({ type: 'unavailable', cue: first })
      this.index++
      return this.start(this.queue, this.index) // try next song
    }
    this.live.setGain(1)
    this.live.play()
    this.state = 'playing'
    this.emit({ type: 'live', cue: first })
    this.startTick()
    void this.preloadNext()
  }

  private startTick() {
    window.clearInterval(this.tickId)
    this.tickId = window.setInterval(() => this.tick(), CONFIG.TICK_MS)
  }

  cutPointNow(): number {
    const cue = this.current
    if (!cue) return Infinity
    const dur = this.live.getDuration() || cue.duration_sec
    const end = dur - CONFIG.CUT_GUARD_SEC
    return cue.play_full ? end : Math.min(cue.exit_sec, end)
  }

  private tick() {
    if (this.state !== 'playing' && this.state !== 'holding') return
    const cue = this.current
    if (!cue) return
    if (this.live.getTime() >= this.cutPointNow()) {
      this.requestHandoff('exit')
    }
  }

  requestHandoff(reason: 'exit' | 'skip') {
    if (this.state === 'fading') return
    const next = this.queue[this.index + 1]
    if (!next) {
      // Nothing left. Let the live song run to its end.
      if (this.live.getTime() >= this.live.getDuration() - 0.5) {
        this.finish()
      }
      return
    }
    if (this.idle.status !== 'ready') {
      if (this.state !== 'holding') {
        this.state = 'holding'
        if (this.current) {
          this.emit({ type: 'holding', cue: this.current })
        }
      }
      return // tick will retry in 200 ms
    }
    if (reason === 'exit' && this.current) {
      this.emit({ type: 'cut', cue: this.current })
    }
    this.crossfade(reason === 'skip' ? 800 : CONFIG.FADE_MS)
  }

  private crossfade(durationMs: number) {
    const outgoing = this.live
    const incoming = this.idle
    this.state = 'fading'
    incoming.setGain(0)
    incoming.play()

    if (this.useHardCut) {
      // iPhone YouTube: no volume control. Quick hard cut.
      outgoing.pause()
      incoming.setGain(1)
      this.completeHandoff(outgoing)
      return
    }

    this.fade = equalPowerFade({
      durationMs,
      stepMs: CONFIG.FADE_STEP_MS,
      onStep: (inG, outG) => {
        incoming.setGain(inG)
        outgoing.setGain(outG)
      },
      onDone: () => {
        outgoing.pause()
        this.completeHandoff(outgoing)
      },
    })
  }

  private completeHandoff(outgoing: Deck) {
    this.fade = null
    outgoing.stop()
    this.liveIdx = 1 - this.liveIdx
    this.index++
    this.state = 'playing'
    if (this.current) {
      this.emit({ type: 'live', cue: this.current })
    }
    void this.preloadNext()
  }

  /** Load the next playable song into the idle deck. Skips unavailable ones. */
  async preloadNext(): Promise<void> {
    const token = ++this.preloadToken
    let attempt = 0
    while (attempt < 5) {
      const i = this.index + 1
      const cue = this.queue[i]
      if (!cue) return
      try {
        await this.idle.load(cue, cue.entry_sec)
        if (token !== this.preloadToken) return
        return
      } catch {
        if (token !== this.preloadToken) return
        this.emit({ type: 'unavailable', cue })
        this.queue.splice(i, 1) // remove the dead song, try the next
        attempt++
      }
    }
  }

  // ---- user controls ----
  skip() {
    if (this.state === 'fading' || this.state === 'idle') return
    if (this.current) {
      this.emit({ type: 'skip', cue: this.current, at: this.live.getTime() })
    }
    this.requestHandoff('skip')
  }

  pause() {
    if (this.state === 'fading') {
      this.fade?.finishNow()
    }
    if (this.state !== 'playing' && this.state !== 'holding') return
    this.live.pause()
    this.state = 'paused'
    if (this.current) {
      this.emit({ type: 'paused', cue: this.current })
    }
  }

  resume() {
    if (this.state !== 'paused') return
    this.live.play()
    this.state = 'playing'
    if (this.current) {
      this.emit({ type: 'resumed', cue: this.current })
    }
  }

  togglePause() {
    this.state === 'paused' ? this.resume() : this.pause()
  }

  /** User dragged the waveform. */
  seekLive(toSec: number) {
    const cue = this.current
    if (!cue) return
    const from = this.live.getTime()
    const to = Math.max(0, Math.min(toSec, (this.live.getDuration() || cue.duration_sec) - 2))
    this.live.seek(to)
    this.emit({ type: 'seek', cue, from, to })
  }

  togglePlayFull() {
    const cue = this.current
    if (!cue) return
    cue.play_full = !cue.play_full // runtime only, do not save to songs.json
    this.emit({ type: 'playfull', cue, on: cue.play_full })
  }

  /** Insert a song to play right after the current one. */
  playNext(cue: Cue) {
    this.queue.splice(this.index + 1, 0, cue)
    void this.preloadNext()
  }

  private finish() {
    this.state = 'ended'
    window.clearInterval(this.tickId)
    if (this.current) {
      this.emit({ type: 'finished', cue: this.current })
    }
  }

  stopAll() {
    window.clearInterval(this.tickId)
    this.fade?.cancel()
    this.fade = null
    this.preloadToken++
    this.decks.forEach((d) => d.stop())
    this.state = 'idle'
  }
}
