import type { Cue } from '../data/types'
import type { Deck } from './types'
import { YouTubeDeck } from './YouTubeDeck'
import { WebAudioDeck } from './WebAudioDeck'

export type Mode = 'youtube' | 'local'

export async function createDecks(
  mode: Mode,
  mount: HTMLElement,
  resolveFile?: (cue: Cue) => Promise<ArrayBuffer>,
  ctx?: AudioContext,
): Promise<[Deck, Deck]> {
  if (mode === 'youtube') {
    const a = await YouTubeDeck.create('A', mount)
    const b = await YouTubeDeck.create('B', mount)
    return [a, b]
  }

  if (!ctx || !resolveFile) {
    throw new Error('AudioContext and resolveFile callback are required for local WebAudio decks')
  }

  const a = new WebAudioDeck('A', ctx, resolveFile)
  const b = new WebAudioDeck('B', ctx, resolveFile)
  return [a, b]
}
