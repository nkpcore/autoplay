/**
 * Rough loudness in dBFS using RMS of the mono mix.
 * Note: This is an RMS estimate, not ITU-R BS.1770 true LUFS,
 * but works well to equalize relative track volume in web parties.
 */
export function measureRmsDb(buf: AudioBuffer): number {
  const ch0 = buf.getChannelData(0)
  const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch0
  let sum = 0
  const step = 4 // skip samples for speed
  let n = 0
  for (let i = 0; i < ch0.length; i += step) {
    const s0 = ch0[i] ?? 0
    const s1 = ch1[i] ?? 0
    const m = (s0 + s1) * 0.5
    sum += m * m
    n++
  }
  const rms = Math.sqrt(sum / Math.max(1, n))
  return 20 * Math.log10(Math.max(rms, 1e-6))
}

export const TARGET_DB = -16

export function gainDbFor(buf: AudioBuffer): number {
  const g = TARGET_DB - measureRmsDb(buf)
  return Math.max(-9, Math.min(9, Math.round(g * 10) / 10)) // clamp +-9 dB
}
