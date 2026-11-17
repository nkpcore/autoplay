import { create } from 'zustand'
import type { Cue, QueueItem } from '../data/types'
import type { Engine } from '../engine/Engine'
import type { EngineState } from '../engine/types'

const metaMap = new Map<string, { source: 'planner' | 'guest' | 'host'; requestedBy?: string }>()

export function resetItemMeta() {
  metaMap.clear()
}

export function registerItemMeta(
  songId: string,
  meta: { source: 'planner' | 'guest' | 'host'; requestedBy?: string },
) {
  metaMap.set(songId, meta)
}

export function syncQueueFromEngine(engine: Engine): QueueItem[] {
  return engine.queue.map((cue, idx) => {
    const meta = metaMap.get(cue.song_id)
    return {
      cue,
      source: meta?.source ?? (idx <= engine.index ? 'host' : 'planner'),
      requestedBy: meta?.requestedBy,
    }
  })
}

interface PlayerStore {
  engine: Engine | null
  queue: QueueItem[]
  index: number
  engineState: EngineState
  currentCue: Cue | null
  statusMessage: string | null

  setEngine: (engine: Engine | null) => void
  setQueue: (items: QueueItem[]) => void
  setIndex: (index: number) => void
  setEngineState: (state: EngineState) => void
  setCurrentCue: (cue: Cue | null) => void
  setStatusMessage: (msg: string | null) => void

  // Queue actions
  addToQueue: (cue: Cue, source?: 'planner' | 'guest' | 'host', requestedBy?: string) => void
  playNext: (cue: Cue, source?: 'planner' | 'guest' | 'host', requestedBy?: string) => void
  removeFromQueue: (queueIndex: number) => void
}

export const useStore = create<PlayerStore>((set, get) => ({
  engine: null,
  queue: [],
  index: 0,
  engineState: 'idle',
  currentCue: null,
  statusMessage: null,

  setEngine: (engine) => set({ engine }),
  setQueue: (queue) => set({ queue }),
  setIndex: (index) => set({ index }),
  setEngineState: (engineState) => set({ engineState }),
  setCurrentCue: (currentCue) => set({ currentCue }),
  setStatusMessage: (statusMessage) => set({ statusMessage }),

  addToQueue: (cue, source = 'host', requestedBy?: string) => {
    const { queue, engine } = get()
    registerItemMeta(cue.song_id, { source, requestedBy })
    if (engine) {
      engine.appendToQueue([cue])
    } else {
      const newItem: QueueItem = { cue, source, requestedBy }
      set({ queue: [...queue, newItem] })
    }
  },

  playNext: (cue, source = 'host', requestedBy?: string) => {
    const { queue, index, engine } = get()
    registerItemMeta(cue.song_id, { source, requestedBy })
    if (engine) {
      engine.playNext(cue)
    } else {
      const newItem: QueueItem = { cue, source, requestedBy }
      const updated = [...queue]
      const insertIdx = index + 1
      updated.splice(insertIdx, 0, newItem)
      set({ queue: updated })
    }
  },

  removeFromQueue: (removeIdx) => {
    const { queue, index, engine } = get()
    if (removeIdx <= index) return // cannot remove already played or live song
    const target = queue[removeIdx]
    if (!target) return

    if (engine) {
      engine.removeUpcoming(target.cue.song_id)
    } else {
      const updated = [...queue]
      updated.splice(removeIdx, 1)
      set({ queue: updated })
    }
  },
}))
