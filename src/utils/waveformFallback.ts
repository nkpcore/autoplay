import type { Cue } from '../data/types'

function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function fallbackBars(cue: Cue): number[] {
  let l = hash(cue.song_id) || 1
  const scale = 0.45 + 0.05 * cue.energy
  const titleShift = hash(cue.title) % 7
  return Array.from({ length: 88 }, (_, n) => {
    const r = n / 87
    l = Math.imul(l ^ (l >>> 13), 0x5bd1e995) >>> 0
    const envelope = Math.min(1, 6 * r, (1 - r) * 8)
    const wobble = 0.65 + 0.35 * Math.sin(r * Math.PI * 5 + titleShift)
    const noise = 0.55 + 0.45 * ((l % 1000) / 1000)
    return Math.max(0.08, envelope * wobble * scale * noise)
  })
}
