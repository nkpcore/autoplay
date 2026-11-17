import type { Cue } from './types'
import { validateCue } from './validate'

let cachedSongs: Cue[] | null = null

export interface LoadSongsResult {
  valid: Cue[]
  validCount: number
  droppedCount: number
}

export async function loadSongs(forceRefresh = false): Promise<Cue[]> {
  const result = await loadSongsWithDetails(forceRefresh)
  return result.valid
}

export async function loadSongsWithDetails(forceRefresh = false): Promise<LoadSongsResult> {
  if (cachedSongs && !forceRefresh) {
    return {
      valid: cachedSongs,
      validCount: cachedSongs.length,
      droppedCount: 0,
    }
  }

  const res = await fetch('/songs.json')
  if (!res.ok) {
    throw new Error(`Failed to load /songs.json (status ${res.status})`)
  }

  const raw: unknown = await res.json()
  if (!Array.isArray(raw)) {
    throw new Error('songs.json must contain a JSON array')
  }

  const valid: Cue[] = []
  let droppedCount = 0

  for (const item of raw) {
    const cue = validateCue(item)
    if (cue) {
      valid.push(cue)
    } else {
      droppedCount++
    }
  }

  if (droppedCount > 0) {
    console.warn(`[PartyAux] loadSongs: ${droppedCount} invalid songs dropped.`)
  }

  cachedSongs = valid
  return {
    valid,
    validCount: valid.length,
    droppedCount,
  }
}
