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
  stop(): void // pause + status 'empty' + cue null
}

export type EngineState = 'idle' | 'playing' | 'paused' | 'fading' | 'holding' | 'ended'

export type EngineListener = (e: EngineEvent) => void
