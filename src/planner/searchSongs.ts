import type { Cue } from '../data/types'

export function searchSongs(all: Cue[], query: string, limit = 20): Cue[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return []

  const tokens = trimmed.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  // Filter candidates matching all tokens
  const matches = all.filter((cue) => {
    const haystack = `${cue.title} ${cue.artist} ${(cue.tags || []).join(' ')} ${cue.language} ${cue.subtype}`.toLowerCase()
    return tokens.every((token) => haystack.includes(token))
  })

  // Rank:
  // 1. title starts with query
  // 2. title contains query
  // 3. artist starts with query
  // 4. artist contains query
  // 5. alphabetical by title
  matches.sort((a, b) => {
    const aTitle = a.title.toLowerCase()
    const bTitle = b.title.toLowerCase()
    const aArtist = a.artist.toLowerCase()
    const bArtist = b.artist.toLowerCase()

    const aTitleStarts = aTitle.startsWith(trimmed)
    const bTitleStarts = bTitle.startsWith(trimmed)
    if (aTitleStarts && !bTitleStarts) return -1
    if (!aTitleStarts && bTitleStarts) return 1

    const aTitleContains = aTitle.includes(trimmed)
    const bTitleContains = bTitle.includes(trimmed)
    if (aTitleContains && !bTitleContains) return -1
    if (!aTitleContains && bTitleContains) return 1

    const aArtistStarts = aArtist.startsWith(trimmed)
    const bArtistStarts = bArtist.startsWith(trimmed)
    if (aArtistStarts && !bArtistStarts) return -1
    if (!aArtistStarts && bArtistStarts) return 1

    const aArtistContains = aArtist.includes(trimmed)
    const bArtistContains = bArtist.includes(trimmed)
    if (aArtistContains && !bArtistContains) return -1
    if (!aArtistContains && bArtistContains) return 1

    return a.title.localeCompare(b.title)
  })

  return matches.slice(0, limit)
}
