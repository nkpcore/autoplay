import type { Cue } from '../data/types'
import { gainDbFor } from '../analysis/loudness'
import { estimateBpm, snapToBeat } from '../analysis/bpm'

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

export async function runEstimateBpmWorker(
  mono: Float32Array,
  sampleRate: number,
): Promise<{ bpm: number; firstBeatSec: number }> {
  if (typeof Worker !== 'undefined') {
    try {
      return await new Promise((resolve, reject) => {
        const worker = new Worker(new URL('../analysis/bpm.worker.ts', import.meta.url), {
          type: 'module',
        })
        worker.onmessage = (e: MessageEvent<{ bpm: number; firstBeatSec: number }>) => {
          worker.terminate()
          resolve(e.data)
        }
        worker.onerror = (err) => {
          worker.terminate()
          reject(err)
        }
        const copy = new Float32Array(mono)
        worker.postMessage({ mono: copy, sampleRate }, [copy.buffer])
      })
    } catch {
      // Fallback to direct estimation if Web Worker is not available
    }
  }
  return estimateBpm(mono, sampleRate)
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
    let detectedBpm: number | undefined
    let entrySec = 0
    let exitSec = 178

    try {
      const buffer = await file.arrayBuffer()
      const decoded = await ctx.decodeAudioData(buffer.slice(0))
      durationSec = Math.round(decoded.duration)
      gainDb = gainDbFor(decoded)
      exitSec = Math.max(20, durationSec - 2)

      // Mix up to 90s to mono for BPM detection
      const maxSec = Math.min(90, decoded.duration)
      const samplesToAnalyze = Math.floor(maxSec * decoded.sampleRate)
      if (samplesToAnalyze > 1024) {
        const mono = new Float32Array(samplesToAnalyze)
        const ch0 = decoded.getChannelData(0)
        const ch1 = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : ch0
        for (let s = 0; s < samplesToAnalyze; s++) {
          mono[s] = ((ch0[s] ?? 0) + (ch1[s] ?? 0)) * 0.5
        }

        const { bpm, firstBeatSec } = await runEstimateBpmWorker(mono, decoded.sampleRate)
        if (bpm > 0) {
          detectedBpm = Math.round(bpm)
          entrySec = snapToBeat(0, bpm, firstBeatSec)
          const rawExit = Math.max(20, durationSec - 2)
          exitSec = snapToBeat(rawExit, bpm, firstBeatSec)
          if (exitSec <= entrySec + 20) {
            exitSec = Math.min(durationSec, entrySec + 20)
          }
        }
      }
    } catch (err) {
      console.warn(`Could not decode audio metadata for ${file.name}:`, err)
    }

    const cue: Cue = {
      song_id: songId,
      title: baseName,
      artist: 'Local Artist',
      youtube_ids: [],
      duration_sec: durationSec,
      entry_sec: entrySec,
      exit_sec: exitSec,
      play_full: false,
      era: '2020s',
      language: 'local',
      subtype: 'local',
      energy: 8,
      tags: ['local', 'offline'],
      bpm: detectedBpm,
      gain_db: gainDb,
      verified: false,
      unsure: true,
    }

    cues.push(cue)
  }

  void ctx.close()
  return cues
}
