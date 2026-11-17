/**
 * Estimate BPM and first downbeat position from mono audio samples.
 */
export function estimateBpm(
  mono: Float32Array,
  sampleRate: number,
): { bpm: number; firstBeatSec: number } {
  const frame = 1024
  const hop = 512
  const frames = Math.floor((mono.length - frame) / hop)
  if (frames <= 0) {
    return { bpm: 120, firstBeatSec: 0 }
  }

  const e = new Float32Array(frames)
  for (let k = 0; k < frames; k++) {
    let s = 0
    const start = k * hop
    for (let i = 0; i < frame; i++) {
      const v = mono[start + i] ?? 0
      s += v * v
    }
    e[k] = s
  }

  const o = new Float32Array(frames)
  let max = 1e-9
  for (let k = 1; k < frames; k++) {
    const prevE = e[k - 1] ?? 0
    const curE = e[k] ?? 0
    o[k] = Math.max(0, curE - prevE)
    if ((o[k] ?? 0) > max) {
      max = o[k] ?? 0
    }
  }
  for (let k = 0; k < frames; k++) {
    o[k] = (o[k] ?? 0) / max
  }

  const fr = sampleRate / hop
  const minLag = Math.floor((fr * 60) / 180)
  const maxLag = Math.ceil((fr * 60) / 70)
  let best = minLag
  let bestVal = -1

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    for (let k = lag; k < frames; k++) {
      sum += (o[k] ?? 0) * (o[k - lag] ?? 0)
    }
    if (sum > bestVal) {
      bestVal = sum
      best = lag
    }
  }

  let bpm = (60 * fr) / (best || 1)
  if (bpm < 80) bpm *= 2
  if (bpm > 170) bpm /= 2

  const period = (60 / bpm) * fr
  let bestOff = 0
  let bestSum = -1

  for (let off = 0; off < period; off++) {
    let sum = 0
    for (let p = off; p < frames; p += period) {
      sum += o[Math.round(p)] ?? 0
    }
    if (sum > bestSum) {
      bestSum = sum
      bestOff = off
    }
  }

  return {
    bpm: Math.round(bpm * 10) / 10,
    firstBeatSec: Math.round((bestOff / fr) * 100) / 100,
  }
}

/**
 * Snap a timestamp to the nearest 4-beat bar.
 */
export function snapToBeat(sec: number, bpm: number, firstBeatSec: number): number {
  if (bpm <= 0) return sec
  const beat = 60 / bpm
  const bar = beat * 4
  const k = Math.round((sec - firstBeatSec) / bar)
  return Math.max(0, Math.round((firstBeatSec + k * bar) * 10) / 10)
}
