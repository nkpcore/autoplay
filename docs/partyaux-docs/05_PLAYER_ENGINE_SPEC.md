# 05 — Player Engine Spec (MOST IMPORTANT FILE)

The engine is plain TypeScript in `src/engine`. No React inside. Build it in small steps (tasks T07–T16, T33, T35). The code below is a **reference implementation**. Type it in, then make it compile and test it. Do not redesign it.

## 1. Interfaces — `src/engine/types.ts`

```ts
import type { Cue, EngineEvent } from '../data/types'

export type DeckStatus = 'empty' | 'loading' | 'ready' | 'playing' | 'paused' | 'error'

export interface Deck {
  readonly name: 'A' | 'B'
  status: DeckStatus
  cue: Cue | null
  /** Load cue, start muted, end up PAUSED at startSec with status 'ready'.
   *  Rejects only if ALL sources failed. */
  load(cue: Cue, startSec: number): Promise<void>
  play(): void
  pause(): void
  /** 0..1 */
  setGain(g: number): void
  getTime(): number
  getDuration(): number
  seek(sec: number): void
  stop(): void            // pause + status 'empty' + cue null
}

export type EngineState = 'idle' | 'playing' | 'paused' | 'fading' | 'holding' | 'ended'

export type EngineListener = (e: EngineEvent) => void
```

## 2. Platform detection — `src/engine/platform.ts`

```ts
export const isIOS =
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** YouTube setVolume does nothing on iOS Safari. */
export const canCrossfadeYouTube = !isIOS
```

## 3. YouTube API loader — `src/engine/youtubeApi.ts`

```ts
let promise: Promise<void> | null = null

export function loadYouTubeApi(): Promise<void> {
  if (promise) return promise
  promise = new Promise((resolve, reject) => {
    if ((window as any).YT && (window as any).YT.Player) { resolve(); return }
    const prev = (window as any).onYouTubeIframeAPIReady
    ;(window as any).onYouTubeIframeAPIReady = () => { prev?.(); resolve() }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.onerror = () => reject(new Error('YouTube API failed to load'))
    document.head.appendChild(s)
  })
  return promise
}
```

## 4. YouTubeDeck — `src/engine/YouTubeDeck.ts`

How loading works (this is the trick that makes gapless starts):
1. Call `loadVideoById({ videoId, startSeconds })` with player muted and volume 0.
2. The video begins to play. The moment YouTube reports state PLAYING (1) and we are in "preloading" mode, we call `pauseVideo()` and `seekTo(startSec, true)`. Now the deck is waiting exactly at the hook. Status `ready`.
3. Later `play()` starts it instantly (already buffered).
4. If YouTube reports an error (2, 5, 100, 101, 150) or 20 seconds pass without PLAYING, try the next ID in `cue.youtube_ids`. If none left, reject.

```ts
import type { Cue } from '../data/types'
import type { Deck, DeckStatus } from './types'
import { loadYouTubeApi } from './youtubeApi'
import { CONFIG } from '../config'

export class YouTubeDeck implements Deck {
  status: DeckStatus = 'empty'
  cue: Cue | null = null
  private player!: YT.Player
  private idIndex = 0
  private startSec = 0
  private preloading = false
  private watchdog: number | undefined
  private resolveLoad?: () => void
  private rejectLoad?: (e: Error) => void

  private constructor(readonly name: 'A' | 'B') {}

  static async create(name: 'A' | 'B', mount: HTMLElement): Promise<YouTubeDeck> {
    await loadYouTubeApi()
    const deck = new YouTubeDeck(name)
    const slot = document.createElement('div')
    mount.appendChild(slot)
    await new Promise<void>((resolve) => {
      deck.player = new YT.Player(slot, {
        width: '100%', height: '100%',
        playerVars: {
          autoplay: 0, controls: 0, disablekb: 1, fs: 0,
          iv_load_policy: 3, playsinline: 1, rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => resolve(),
          onStateChange: (e) => deck.onState(e.data),
          onError: (e) => deck.onError(e.data),
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
    if (!videoId) { this.fail(new Error('all sources failed')); return }
    this.preloading = true
    this.player.mute()
    this.player.setVolume(0)
    this.player.loadVideoById({ videoId, startSeconds: this.startSec })
    window.clearTimeout(this.watchdog)
    this.watchdog = window.setTimeout(() => this.nextId('timeout'), CONFIG.LOAD_WATCHDOG_MS)
  }

  private nextId(_reason: string) {
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
    if (state === YT.PlayerState.PLAYING && this.preloading) {
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
    if (this.status === 'loading') this.nextId('error ' + code)
  }

  play() { this.player.playVideo(); this.status = 'playing' }
  pause() { this.player.pauseVideo(); this.status = 'paused' }
  setGain(g: number) {
    const v = Math.round(Math.min(1, Math.max(0, g)) * 100)
    if (v > 0) this.player.unMute()
    this.player.setVolume(v)
  }
  getTime() { return this.player.getCurrentTime?.() ?? 0 }
  getDuration() { return this.player.getDuration?.() ?? this.cue?.duration_sec ?? 0 }
  seek(sec: number) { this.player.seekTo(sec, true) }
  stop() {
    window.clearTimeout(this.watchdog)
    try { this.player.pauseVideo() } catch { /* ignore */ }
    this.status = 'empty'
    this.cue = null
  }
}
```

Known quirk: `getDuration()` returns 0 until metadata loads. Always fall back to `cue.duration_sec`.

## 5. Crossfade helper — `src/engine/crossfade.ts`

```ts
export interface FadeHandle { cancel: () => void; finishNow: () => void }

export function equalPowerFade(opts: {
  durationMs: number
  stepMs: number
  onStep: (inGain: number, outGain: number) => void
  onDone: () => void
}): FadeHandle {
  const t0 = performance.now()
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    window.clearInterval(id)
    opts.onStep(1, 0)
    opts.onDone()
  }
  const id = window.setInterval(() => {
    const p = Math.min(1, (performance.now() - t0) / opts.durationMs)
    opts.onStep(Math.sin(p * Math.PI / 2), Math.cos(p * Math.PI / 2))
    if (p >= 1) finish()
  }, opts.stepMs)
  return {
    cancel: () => { finished = true; window.clearInterval(id) },
    finishNow: finish,
  }
}
```

## 6. Engine — `src/engine/Engine.ts` (reference)

```ts
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

  on(l: EngineListener) { this.listeners.add(l); return () => this.listeners.delete(l) }
  private emit(e: EngineEvent) { this.listeners.forEach((l) => l(e)) }

  get live(): Deck { return this.decks[this.liveIdx]! }
  get idle(): Deck { return this.decks[1 - this.liveIdx]! }
  get current(): Cue | undefined { return this.queue[this.index] }

  /** Replace the queue and start playing from startIndex. MUST be called from a user tap. */
  async start(queue: Cue[], startIndex = 0) {
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
      return this.start(this.queue, this.index)   // try next song
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

  private cutPointNow(): number {
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
    if (this.live.getTime() >= this.cutPointNow()) this.requestHandoff('exit')
  }

  requestHandoff(reason: 'exit' | 'skip') {
    if (this.state === 'fading') return
    const next = this.queue[this.index + 1]
    if (!next) {
      // Nothing left. Let the live song run to its end.
      if (this.live.getTime() >= (this.live.getDuration() - 0.5)) this.finish()
      return
    }
    if (this.idle.status !== 'ready') {
      if (this.state !== 'holding') {
        this.state = 'holding'
        if (this.current) this.emit({ type: 'holding', cue: this.current })
      }
      return                       // tick will retry in 200 ms
    }
    if (reason === 'exit' && this.current) this.emit({ type: 'cut', cue: this.current })
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
      onStep: (inG, outG) => { incoming.setGain(inG); outgoing.setGain(outG) },
      onDone: () => { outgoing.pause(); this.completeHandoff(outgoing) },
    })
  }

  private completeHandoff(outgoing: Deck) {
    this.fade = null
    outgoing.stop()
    this.liveIdx = 1 - this.liveIdx
    this.index++
    this.state = 'playing'
    if (this.current) this.emit({ type: 'live', cue: this.current })
    void this.preloadNext()
  }

  /** Load the next playable song into the idle deck. Skips unavailable ones. */
  private async preloadNext() {
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
        this.queue.splice(i, 1)          // remove the dead song, try the next
        attempt++
      }
    }
  }

  // ---- user controls ----
  skip() {
    if (this.state === 'fading' || this.state === 'idle') return
    if (this.current) this.emit({ type: 'skip', cue: this.current, at: this.live.getTime() })
    this.requestHandoff('skip')
  }

  pause() {
    if (this.state === 'fading') this.fade?.finishNow()
    if (this.state !== 'playing' && this.state !== 'holding') return
    this.live.pause()
    this.state = 'paused'
    if (this.current) this.emit({ type: 'paused', cue: this.current })
  }

  resume() {
    if (this.state !== 'paused') return
    this.live.play()
    this.state = 'playing'
    if (this.current) this.emit({ type: 'resumed', cue: this.current })
  }

  togglePause() { this.state === 'paused' ? this.resume() : this.pause() }

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
    cue.play_full = !cue.play_full           // runtime only, do not save to songs.json
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
    if (this.current) this.emit({ type: 'finished', cue: this.current })
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
```

### Edge cases the engine MUST handle (test each)
1. Next song not ready at cut time -> `holding`, live keeps playing, retries every tick. UI shows "riding this one a little longer".
2. First song unavailable -> skip to next automatically.
3. Next song unavailable during preload -> removed from queue, next one tried (max 5 tries).
4. User skips while fading -> ignored.
5. User pauses while fading -> fade finishes instantly, then pause.
6. Last song in queue -> plays to its end then `ended`. The UI then asks the planner for more (Phase 4 "load more") **before** this point: when `queue.length - index <= 5`, fetch more.
7. `playNext()` while idle deck already ready for a different song -> `preloadNext` reloads the idle deck with the new song (token logic prevents stale results).
8. Tab hidden: timers slow down in background tabs (browsers throttle to ~1 s). The 200 ms tick is still OK; fade may be choppier. Documented limitation; Media Session + wake lock help.

## 7. WebAudioDeck (Phase 6) — `src/engine/WebAudioDeck.ts`

Why: exact volume control, works on iPhone, allows analysis. The file comes from the user's disk (`File` object), decoded fully into an `AudioBuffer`.

Important rule: an `AudioBufferSourceNode` can be started only ONCE. To pause/seek you create a new one. Track `startedAtCtxTime` and `offsetSec` to compute the current time.

```ts
import type { Cue } from '../data/types'
import type { Deck, DeckStatus } from './types'

export class WebAudioDeck implements Deck {
  status: DeckStatus = 'empty'
  cue: Cue | null = null
  private buffer: AudioBuffer | null = null
  private src: AudioBufferSourceNode | null = null
  private gain: GainNode
  private offset = 0          // song position (sec) when paused / before play
  private startedAt = 0       // ctx.currentTime when play started
  private baseGain = 1        // from cue.gain_db
  private userGain = 1

  constructor(readonly name: 'A' | 'B', private ctx: AudioContext,
              private resolveFile: (cue: Cue) => Promise<ArrayBuffer>) {
    this.gain = ctx.createGain()
    this.gain.connect(ctx.destination)
  }

  async load(cue: Cue, startSec: number) {
    this.cue = cue
    this.status = 'loading'
    try {
      const bytes = await this.resolveFile(cue)
      this.buffer = await this.ctx.decodeAudioData(bytes.slice(0))
      this.offset = startSec
      this.baseGain = Math.pow(10, (cue.gain_db ?? 0) / 20)
      this.applyGain(0)
      this.status = 'ready'
    } catch (e) {
      this.status = 'error'
      throw e
    }
  }

  private applyGain(g: number) {
    this.userGain = g
    this.gain.gain.value = g * this.baseGain
  }

  play() {
    if (!this.buffer) return
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    this.src = this.ctx.createBufferSource()
    this.src.buffer = this.buffer
    this.src.connect(this.gain)
    this.src.start(0, this.offset)
    this.startedAt = this.ctx.currentTime
    this.status = 'playing'
  }

  pause() {
    if (this.src) {
      this.offset = this.getTime()
      try { this.src.stop() } catch { /* already stopped */ }
      this.src.disconnect()
      this.src = null
    }
    this.status = 'paused'
  }

  setGain(g: number) { this.applyGain(g) }

  getTime() {
    if (this.status === 'playing' && this.src) return this.offset + (this.ctx.currentTime - this.startedAt)
    return this.offset
  }
  getDuration() { return this.buffer?.duration ?? this.cue?.duration_sec ?? 0 }

  seek(sec: number) {
    const wasPlaying = this.status === 'playing'
    if (wasPlaying) this.pause()
    this.offset = sec
    if (wasPlaying) this.play()
  }

  stop() {
    this.pause()
    this.buffer = null
    this.cue = null
    this.status = 'empty'
  }
}
```

Rules:
- ONE shared `AudioContext` created inside the Start button click handler: `new AudioContext()` then `ctx.resume()`.
- `resolveFile(cue)` looks up the `File` by `cue.song_id` in an in-memory `Map<string, File>` filled by the import UI, and returns `file.arrayBuffer()`.
- For local files, `cue.duration_sec` comes from decoding; entry/exit come from analysis or the Tune tool.
- Memory: a 4-minute stereo song decoded is ~40 MB. Decoded buffers must be released (`stop()` sets `buffer = null`). Only two decks exist, so at most ~2 buffers in memory.

## 8. Deck factory (T35)
```ts
export type Mode = 'youtube' | 'local'
export async function createDecks(mode: Mode, mount: HTMLElement, ctx?: AudioContext) {
  if (mode === 'youtube') {
    const a = await YouTubeDeck.create('A', mount)
    const b = await YouTubeDeck.create('B', mount)
    return [a, b] as [Deck, Deck]
  }
  return [new WebAudioDeck('A', ctx!, resolve), new WebAudioDeck('B', ctx!, resolve)] as [Deck, Deck]
}
```
In local mode the Engine is created with `{ hardCut: false }`, because Web Audio can fade on every platform.

## 9. Visible player tiles (YouTube mode)
`PlayerTiles.tsx` renders a container `div` with two children each at least 200x200 px (for example a flex row at the bottom of the page, each 200x200, with a small label "A"/"B"). Live tile gets a colored ring. When `CONFIG.SHOW_PLAYERS` is false (human choice only), set `position:fixed; left:0; bottom:0; width:320px; height:180px; opacity:0; pointer-events:none; z-index:-1`. Note in the README that this may violate YouTube's terms.

## 10. Testing the engine without the UI
Create a temporary page `/engine-test` with: Start button, Skip button, a log area that prints every engine event with a timestamp, and a hardcoded list of 5 cues. Verify the 8 edge cases in section 6 before moving on.
