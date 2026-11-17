import type { Phase, Crowd } from '../data/types'

export function targetEnergy(phase: Phase, crowd: Crowd, i: number, n: number): number {
  const t = n <= 1 ? 0 : i / (n - 1) // 0..1 through the batch
  let e: number
  switch (phase) {
    case 'warming':
      e = 4 + 3 * t // 4 -> 7
      break
    case 'peak':
      e = 9 + Math.sin(i * 0.9) // ~8..10 with small waves
      break
    case 'winding':
      e = 7 - 4 * t // 7 -> 3
      break
    case 'bangers':
      e = 10
      break
  }
  const crowdBoost = crowd === 'large' ? 1 : crowd === 'small' ? -0.5 : 0
  return Math.min(10, Math.max(1, e + crowdBoost))
}
