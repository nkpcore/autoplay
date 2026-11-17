import type { Cue } from '../data/types'
import { gainDbFor } from '../analysis/loudness'

const fileMap = new Map<string, File>()

export function registerLocalFile(songId: string, file: File): void {
  fileMap.set(songId, file)
}

export async function resolveLocalFile(cue: Cue): Promise<ArrayBuffer> {
  const file = fileMap.get(cue.song_id)
  if (!file) {
    throw new Error(`Local audio file not found for cue: ${cue.song_id}`)
  }
  return file.arrayBuffer()
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `track-${Date.now()}`
}

export async function processLocalFiles(
  files: File[],
  onProgress?: (index: number, total: number) => void,
): Promise<Cue[]> {
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  const cues: Cue[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file) continue
    onProgress?.(i + 1, files.length)

    const baseName = file.name.replace(/\.[^/.]+$/, '')
    const songId = `local-${slugify(baseName)}-${i}`
    registerLocalFile(songId, file)

    let durationSec = 180
    let gainDb = 0
    let bpm: number | undefined

    try {
      const buffer = await file.arrayBuffer()
      const decoded = await ctx.decodeAudioData(buffer.slice(0))
      durationSec = Math.round(decoded.duration)
      gainDb = gainDbFor(decoded)
    } catch (err) {
      console.warn(`Could not decode audio metadata for ${file.name}:`, err)
    }

    const cue: Cue = {
      song_id: songId,
      title: baseName,
      artist: 'Local Artist',
      youtube_ids: [],
      duration_sec: durationSec,
      entry_sec: 0,
      exit_sec: Math.max(20, durationSec - 2),
      play_full: false,
      era: '2020s',
      language: 'local',
      subtype: 'local',
      energy: 8,
      tags: ['local', 'offline'],
      gain_db: gainDb,
      bpm,
      verified: true,
    }

    cues.push(cue)
  }

  void ctx.close()
  return cues
}
