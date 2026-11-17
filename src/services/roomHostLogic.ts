import type { Cue, QueueItem } from '../data/types'
import type { QueuedGuestSong } from './rooms'

export interface PendingRequest {
  id: string
  cue: Cue
  guestId: string
  requestedAt: number
}

export type GuestVoteMap = Map<string, Map<string, number>> // songId -> (guestId -> dir)

export function getSongVoteScore(votesMap: GuestVoteMap, songId: string): number {
  const songVotes = votesMap.get(songId)
  if (!songVotes) return 0
  let total = 0
  for (const dir of songVotes.values()) {
    total += dir
  }
  return total
}

export function applyGuestVote(
  votesMap: GuestVoteMap,
  songId: string,
  guestId: string,
  dir: 1 | -1,
): number {
  let songVotes = votesMap.get(songId)
  if (!songVotes) {
    songVotes = new Map()
    votesMap.set(songId, songVotes)
  }
  songVotes.set(guestId, dir)
  return getSongVoteScore(votesMap, songId)
}

export function isSubtypeBlocked(subtype: string, blockedSubtypes: string[]): boolean {
  const normalized = subtype.trim().toLowerCase()
  return blockedSubtypes.some((b) => b.trim().toLowerCase() === normalized)
}

export function countGuestActiveRequests(
  queueAfterIndex: QueueItem[],
  pending: PendingRequest[],
  guestId: string,
): number {
  let count = 0
  for (const item of queueAfterIndex) {
    if (item.source === 'guest' && item.requestedBy === guestId) {
      count++
    }
  }
  for (const p of pending) {
    if (p.guestId === guestId) {
      count++
    }
  }
  return count
}

/**
 * Re-sort upcoming queue so guest-requested songs are ordered by votes desc, then requestedAt asc,
 * placed before regular planner songs.
 */
export function reorderGuestQueue(
  queue: QueueItem[],
  currentIndex: number,
  votesMap: GuestVoteMap,
  requestTimeMap?: Map<string, number>,
): QueueItem[] {
  const played = queue.slice(0, currentIndex + 1)
  const remaining = queue.slice(currentIndex + 1)

  const guestItems = remaining.filter((item) => item.source === 'guest')
  const otherItems = remaining.filter((item) => item.source !== 'guest')

  guestItems.sort((a, b) => {
    const scoreA = getSongVoteScore(votesMap, a.cue.song_id)
    const scoreB = getSongVoteScore(votesMap, b.cue.song_id)
    if (scoreB !== scoreA) {
      return scoreB - scoreA // higher votes first
    }
    const timeA = requestTimeMap?.get(a.cue.song_id) ?? 0
    const timeB = requestTimeMap?.get(b.cue.song_id) ?? 0
    return timeA - timeB // FIFO on ties
  })

  return [...played, ...guestItems, ...otherItems]
}

/**
 * Convert guest queue items into snapshot for room broadcast
 */
export function buildGuestSnapshot(
  queueAfterIndex: QueueItem[],
  votesMap: GuestVoteMap,
  requestTimeMap?: Map<string, number>,
): QueuedGuestSong[] {
  return queueAfterIndex
    .filter((item) => item.source === 'guest')
    .map((item) => ({
      songId: item.cue.song_id,
      title: item.cue.title,
      artist: item.cue.artist,
      votes: getSongVoteScore(votesMap, item.cue.song_id),
      byGuestId: item.requestedBy ?? 'guest',
      requestedAt: requestTimeMap?.get(item.cue.song_id) ?? Date.now(),
    }))
}
