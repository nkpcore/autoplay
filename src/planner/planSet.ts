import type { Cue, Answers } from '../data/types'
import { CONFIG } from '../config'
import { mulberry32 } from './prng'
import { filterCandidates } from './filters'
import { targetEnergy } from './arc'

export interface PlanResult {
  cues: Cue[]
  note: string
  seed: number
}

export function tempoCompatible(a: Cue, b: Cue): boolean {
  if (!a.bpm || !b.bpm) return false
  const direct = Math.abs(a.bpm - b.bpm) / a.bpm
  if (direct <= 0.06) return true
  const double = Math.abs(a.bpm * 2 - b.bpm) / (a.bpm * 2)
  if (double <= 0.06) return true
  const half = Math.abs(a.bpm - b.bpm * 2) / a.bpm
  if (half <= 0.06) return true
  return false
}

export function planSet(
  all: Cue[],
  answers: Answers,
  seed: number,
  opts?: {
    count?: number
    exclude?: string[]
    previous?: Cue[]
  },
): PlanResult {
  const count = opts?.count ?? CONFIG.SET_SIZE
  const excludeList = opts?.exclude ?? []
  const excludeSet = new Set(excludeList)
  const previousList = opts?.previous ? [...opts.previous] : []

  const rng = mulberry32(seed)

  // 1. Get filtered candidates (with relaxed fallback if < 10)
  const filterResult = filterCandidates(
    all,
    answers,
    excludeSet,
    previousList.map((c) => c.song_id),
  )
  const pool = [...filterResult.candidates]

  const chosen: Cue[] = []
  const history: Cue[] = [...previousList]

  for (let slot = 0; slot < count; slot++) {
    if (pool.length === 0) break

    const target = targetEnergy(answers.time, answers.crowd, slot, count)
    const prev = history[history.length - 1]
    const last5 = history.slice(-5)
    const last3 = history.slice(-3)

    // Calculate language frequencies in last 5
    const langCounts: Record<string, number> = {}
    for (const lang of answers.languages) {
      langCounts[lang] = 0
    }
    for (const c of last5) {
      if (c.language in langCounts) {
        langCounts[c.language] = (langCounts[c.language] ?? 0) + 1
      }
    }
    let leastPlayedLang: string | null = null
    if (answers.languages.length >= 2) {
      let minCount = Infinity
      for (const [lang, cnt] of Object.entries(langCounts)) {
        if (cnt < minCount) {
          minCount = cnt
          leastPlayedLang = lang
        }
      }
    }

    // Score all candidates in current pool
    const scored = pool.map((cue) => {
      let score = 0

      // Opening slot constraint
      if (slot === 0 && history.length === 0) {
        if (cue.energy < target - 1) score -= 5
        if (cue.verified) score += 2
      }

      // Closeness to target energy
      score -= Math.abs(cue.energy - target) * 2.0

      // Avoid artist repetition in last 5
      const recentArtists = last5.map((c) => c.artist.toLowerCase())
      if (recentArtists.includes(cue.artist.toLowerCase())) {
        score -= 6
      }

      // Variety: subtype repeat penalty
      if (
        last3.length === 3 &&
        last3.every((c) => c.subtype === last3[0]?.subtype) &&
        cue.subtype === last3[0]?.subtype
      ) {
        score -= 1.5
      }

      // Era bonus
      if (answers.time === 'warming') {
        if (cue.era === 'pre2000' || cue.era === '2000s' || cue.era === 'pre2020') score += 1.5
      } else if (answers.time === 'peak') {
        if (cue.era === '2020s') score += 1.0
        else if (cue.era === 'pre2020') score += 0.5
      }

      // Language balance
      if (leastPlayedLang && cue.language === leastPlayedLang) {
        score += 1.0
      }

      // Avoid sudden energy whiplash
      if (prev && Math.abs(cue.energy - prev.energy) > 4) {
        score -= 3.0
      }

      // BPM / Tempo compatibility
      if (prev && tempoCompatible(prev, cue)) {
        score += 1.5
      }

      // Verified / Unsure bias
      if (cue.verified) score += 0.5
      if (cue.unsure) score -= 0.5

      return { cue, score }
    })

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score)

    // Take top up to 5
    const topN = scored.slice(0, Math.min(5, scored.length))
    const baseWeights = [5, 4, 3, 2, 1].slice(0, topN.length)
    const totalWeight = baseWeights.reduce((sum, w) => sum + w, 0)

    // Weighted random selection using seeded PRNG
    const r = rng() * totalWeight
    let cumulative = 0
    let pickedIndex = 0
    for (let k = 0; k < topN.length; k++) {
      cumulative += baseWeights[k] ?? 1
      if (r <= cumulative) {
        pickedIndex = k
        break
      }
    }

    const picked = topN[pickedIndex]?.cue ?? topN[0]?.cue
    if (!picked) break

    chosen.push(picked)
    history.push(picked)

    // Remove chosen cue from pool
    const poolIdx = pool.findIndex((c) => c.song_id === picked.song_id)
    if (poolIdx >= 0) {
      pool.splice(poolIdx, 1)
    }
  }

  return {
    cues: chosen,
    note: filterResult.note,
    seed,
  }
}
