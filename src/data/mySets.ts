import type { Answers } from './types'

export interface SavedSet {
  id: string
  name: string
  answers?: Answers
  songIds: string[]
  createdAt: number
}

const SETS_STORAGE_KEY = 'pa.mySets'

export function getSavedSets(): SavedSet[] {
  try {
    const raw = localStorage.getItem(SETS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as SavedSet[]) : []
  } catch {
    return []
  }
}

export function saveSet(name: string, songIds: string[], answers?: Answers): SavedSet {
  const sets = getSavedSets()
  const newSet: SavedSet = {
    id: `set-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: name.trim() || `Set ${sets.length + 1}`,
    answers,
    songIds,
    createdAt: Date.now(),
  }
  const updated = [newSet, ...sets]
  localStorage.setItem(SETS_STORAGE_KEY, JSON.stringify(updated))
  return newSet
}

export function renameSet(id: string, newName: string): void {
  const sets = getSavedSets()
  const updated = sets.map((s) => (s.id === id ? { ...s, name: newName.trim() || s.name } : s))
  localStorage.setItem(SETS_STORAGE_KEY, JSON.stringify(updated))
}

export function deleteSet(id: string): void {
  const sets = getSavedSets()
  const updated = sets.filter((s) => s.id !== id)
  localStorage.setItem(SETS_STORAGE_KEY, JSON.stringify(updated))
}

export function buildShareLink(songIds: string[]): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/play?ids=${songIds.join(',')}`
}
