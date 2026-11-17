import type { Cue } from '../data/types'
import type { Deck, DeckStatus } from './types'

export class WebAudioDeck implements Deck {
  readonly name: 'A' | 'B'
  status: DeckStatus = 'empty'
  cue: Cue | null = null

  private ctx: AudioContext
  private resolveFile: (cue: Cue) => Promise<ArrayBuffer>
  private buffer: AudioBuffer | null = null
  private src: AudioBufferSourceNode | null = null
  private gainNode: GainNode
  private offset = 0 // song position (sec)
  private startedAt = 0 // ctx.currentTime when play started
  private baseGain = 1 // from cue.gain_db
  private rate = 1.0

  constructor(
    name: 'A' | 'B',
    ctx: AudioContext,
    resolveFile: (cue: Cue) => Promise<ArrayBuffer>,
  ) {
    this.name = name
    this.ctx = ctx
    this.resolveFile = resolveFile
    this.gainNode = ctx.createGain()
    this.gainNode.connect(ctx.destination)
  }

  async load(cue: Cue, startSec: number): Promise<void> {
    this.cue = cue
    this.status = 'loading'
    try {
      const bytes = await this.resolveFile(cue)
      // decodeAudioData consumes/detaches buffer in some browsers, slice a copy
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
    this.gainNode.gain.value = g * this.baseGain
  }

  setGain(g: number) {
    this.applyGain(g)
  }

  setRate(r: number) {
    // mid-play rate change: capture current time into offset first
    if (this.status === 'playing' && this.src) {
      this.offset = this.getTime()
      this.startedAt = this.ctx.currentTime
      this.src.playbackRate.value = r
    }
    this.rate = r
  }

  play() {
    if (!this.buffer) return
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    this.src = this.ctx.createBufferSource()
    this.src.buffer = this.buffer
    this.src.playbackRate.value = this.rate
    this.src.connect(this.gainNode)
    this.src.start(0, Math.max(0, this.offset))
    this.startedAt = this.ctx.currentTime
    this.status = 'playing'
  }

  pause() {
    if (this.src) {
      this.offset = this.getTime()
      try {
        this.src.stop()
      } catch {
        /* already stopped */
      }
      this.src.disconnect()
      this.src = null
    }
    this.status = 'paused'
  }

  getTime(): number {
    if (this.status === 'playing' && this.src) {
      return this.offset + (this.ctx.currentTime - this.startedAt) * this.rate
    }
    return this.offset
  }

  getDuration(): number {
    return this.buffer?.duration ?? this.cue?.duration_sec ?? 0
  }

  seek(sec: number) {
    const wasPlaying = this.status === 'playing'
    if (wasPlaying) this.pause()
    this.offset = Math.max(0, sec)
    if (wasPlaying) this.play()
  }

  stop() {
    this.pause()
    this.buffer = null
    this.cue = null
    this.status = 'empty'
    this.rate = 1.0
  }
}
