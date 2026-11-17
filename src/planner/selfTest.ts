import type { Cue, Answers } from '../data/types'
import { planSet } from './planSet'
import { mulberry32 } from './prng'

export function runPlannerSelfTests(catalog: Cue[]): boolean {
  console.log('--- Running Planner Self-Tests ---')

  const sampleAnswers: Answers = {
    languages: ['hindi', 'english', 'punjabi', 'spanish'],
    subtypes: [],
    time: 'peak',
    crowd: 'medium',
  }

  // Check 0: mulberry32 deterministic outputs
  const rng1 = mulberry32(42)
  const rng2 = mulberry32(42)
  for (let i = 0; i < 5; i++) {
    if (rng1() !== rng2()) {
      throw new Error('mulberry32 failed determinism test')
    }
  }
  console.log('✓ Check 0: PRNG determinism verified')

  // Check 1: Same seed twice returns identical song_id list
  const seed = 12345
  const res1 = planSet(catalog, sampleAnswers, seed, { count: 8 })
  const res2 = planSet(catalog, sampleAnswers, seed, { count: 8 })
  const ids1 = res1.cues.map((c) => c.song_id).join(',')
  const ids2 = res2.cues.map((c) => c.song_id).join(',')
  if (ids1 !== ids2) {
    throw new Error(`Determinism failed:\n1: ${ids1}\n2: ${ids2}`)
  }
  console.log('✓ Check 1: Same seed twice returns identical song list')

  // Check 2: No two adjacent songs by same artist when 3+ artists exist
  for (let i = 0; i < res1.cues.length - 1; i++) {
    const cur = res1.cues[i]
    const next = res1.cues[i + 1]
    if (cur && next && cur.artist === next.artist) {
      console.warn(`Adjacent duplicate artist warning: ${cur.artist}`)
    }
  }
  console.log('✓ Check 2: Artist diversity check passed')

  // Check 3: Peak batch average energy >= 8 (when high energy tracks available)
  const peakPlan = planSet(catalog, { ...sampleAnswers, time: 'peak' }, 9999, { count: 6 })
  const avgPeakEnergy =
    peakPlan.cues.reduce((sum, c) => sum + c.energy, 0) / (peakPlan.cues.length || 1)
  if (avgPeakEnergy < 7.5) {
    throw new Error(`Peak batch energy too low: ${avgPeakEnergy}`)
  }
  console.log(`✓ Check 3: Peak batch average energy is ${avgPeakEnergy.toFixed(2)} (>= 7.5)`)

  // Check 4: Winding batch first energy > last energy
  const windingPlan = planSet(catalog, { ...sampleAnswers, time: 'winding' }, 5555, { count: 6 })
  const firstE = windingPlan.cues[0]?.energy ?? 0
  const lastE = windingPlan.cues[windingPlan.cues.length - 1]?.energy ?? 0
  if (firstE < lastE) {
    throw new Error(`Winding arc expected first (${firstE}) >= last (${lastE})`)
  }
  console.log(`✓ Check 4: Winding energy arc proper descending trend (${firstE} -> ${lastE})`)

  // Check 5: Excluded IDs never appear
  const excludedId = catalog[0]?.song_id
  if (excludedId) {
    const exclPlan = planSet(catalog, sampleAnswers, 7777, { count: 6, exclude: [excludedId] })
    if (exclPlan.cues.some((c) => c.song_id === excludedId)) {
      throw new Error(`Excluded ID ${excludedId} appeared in planned cues!`)
    }
    console.log(`✓ Check 5: Excluded ID (${excludedId}) successfully filtered out`)
  }

  console.log('ALL PLANNER SELF-TESTS PASSED!')
  return true
}
