import type { Cue, Answers } from '../data/types'

export interface FilterResult {
  candidates: Cue[]
  note: string
}

export function filterCandidates(
  all: Cue[],
  a: Answers,
  excludeIds: Set<string>,
  lastPlayedIds: string[] = [],
): FilterResult {
  // Step 1: Strict matching on language and subtypes, excluding excludeIds
  const strict = all.filter(
    (c) =>
      !excludeIds.has(c.song_id) &&
      a.languages.includes(c.language) &&
      (a.subtypes.length === 0 || a.subtypes.includes(c.subtype)) &&
      c.youtube_ids.length > 0,
  )

  if (strict.length >= 10) {
    return { candidates: strict, note: '' }
  }

  // Step 2: Relax subtypes
  const relaxedSubtypes = all.filter(
    (c) =>
      !excludeIds.has(c.song_id) &&
      a.languages.includes(c.language) &&
      c.youtube_ids.length > 0,
  )

  if (relaxedSubtypes.length >= 10 || relaxedSubtypes.length > strict.length) {
    return {
      candidates: relaxedSubtypes,
      note: 'Not many songs match selected vibes, mixing in more styles.',
    }
  }

  // Step 3: Relax exclude list (only exclude recent 10)
  const recentExcludes = new Set(lastPlayedIds.slice(-10))
  const relaxedExcludes = all.filter(
    (c) =>
      !recentExcludes.has(c.song_id) &&
      a.languages.includes(c.language) &&
      c.youtube_ids.length > 0,
  )

  if (relaxedExcludes.length > 0) {
    return {
      candidates: relaxedExcludes,
      note: 'Limited matches in catalog; reusing previously played tracks.',
    }
  }

  // Fallback: all valid songs in catalog
  return {
    candidates: all.filter((c) => c.youtube_ids.length > 0),
    note: 'Expanding set to all available catalog songs.',
  }
}
