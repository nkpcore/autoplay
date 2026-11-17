import type { Cue } from './types'

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

export function cutPoint(cue: Cue, liveDuration: number, guard = 1.5): number {
  const fullEnd = liveDuration - guard
  if (cue.play_full) return fullEnd
  return Math.min(cue.exit_sec, fullEnd)
}

export function validateCue(x: unknown): Cue | null {
  if (!x || typeof x !== 'object') {
    console.warn('Dropped cue: not an object', x)
    return null
  }
  const c = x as Partial<Cue>

  if (!c.song_id || typeof c.song_id !== 'string' || !c.song_id.trim()) {
    console.warn('Dropped cue: invalid song_id', c)
    return null
  }
  if (!c.title || typeof c.title !== 'string' || !c.title.trim()) {
    console.warn(`Dropped cue (${c.song_id}): invalid title`, c)
    return null
  }
  if (!c.artist || typeof c.artist !== 'string' || !c.artist.trim()) {
    console.warn(`Dropped cue (${c.song_id}): invalid artist`, c)
    return null
  }
  if (!Array.isArray(c.youtube_ids) || c.youtube_ids.length === 0) {
    console.warn(`Dropped cue (${c.song_id}): empty youtube_ids`, c)
    return null
  }
  for (const id of c.youtube_ids) {
    if (typeof id !== 'string' || id.length !== 11 || id.startsWith('FILL_ME') || id.includes('FILL')) {
      console.warn(`Dropped cue (${c.song_id}): invalid youtube_id "${id}" (must be 11 chars)`, c)
      return null
    }
  }
  if (typeof c.duration_sec !== 'number' || c.duration_sec <= 0 || isNaN(c.duration_sec)) {
    console.warn(`Dropped cue (${c.song_id}): invalid duration_sec`, c)
    return null
  }
  if (
    typeof c.entry_sec !== 'number' ||
    typeof c.exit_sec !== 'number' ||
    c.entry_sec < 0 ||
    c.entry_sec >= c.exit_sec ||
    c.exit_sec > c.duration_sec
  ) {
    console.warn(`Dropped cue (${c.song_id}): invalid entry/exit timing (entry: ${c.entry_sec}, exit: ${c.exit_sec}, dur: ${c.duration_sec})`, c)
    return null
  }
  if (c.exit_sec - c.entry_sec < 20) {
    console.warn(`Dropped cue (${c.song_id}): hook length < 20s (${c.exit_sec - c.entry_sec}s)`, c)
    return null
  }
  if (typeof c.energy !== 'number' || !Number.isInteger(c.energy) || c.energy < 1 || c.energy > 10) {
    console.warn(`Dropped cue (${c.song_id}): invalid energy (must be int 1..10)`, c)
    return null
  }
  if (!c.language || typeof c.language !== 'string' || !c.language.trim()) {
    console.warn(`Dropped cue (${c.song_id}): invalid language`, c)
    return null
  }
  if (!c.subtype || typeof c.subtype !== 'string' || !c.subtype.trim()) {
    console.warn(`Dropped cue (${c.song_id}): invalid subtype`, c)
    return null
  }

  return {
    song_id: c.song_id,
    title: c.title,
    artist: c.artist,
    youtube_ids: c.youtube_ids,
    duration_sec: c.duration_sec,
    entry_sec: c.entry_sec,
    exit_sec: c.exit_sec,
    play_full: Boolean(c.play_full),
    era: c.era ?? 'pre2020',
    language: c.language,
    subtype: c.subtype,
    energy: c.energy,
    tags: Array.isArray(c.tags) ? c.tags : [],
    bpm: c.bpm,
    camelot: c.camelot,
    gain_db: c.gain_db,
    heat: c.heat,
    unsure: c.unsure,
    verified: c.verified,
  }
}
