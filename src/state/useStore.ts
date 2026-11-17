import { create } from 'zustand'
import type { Cue, QueueItem } from '../data/types'
import type { Engine } from '../engine/Engine'
import type { EngineState } from '../engine/types'

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
  addToQueue: (cue: Cue, source?: 'planner' | 'guest' | 'host') => void
  playNext: (cue: Cue, source?: 'planner' | 'guest' | 'host') => void
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

  addToQueue: (cue, source = 'host') => {
    const { queue, engine } = get()
    const newItem: QueueItem = { cue, source }
    const updated = [...queue, newItem]
    set({ queue: updated })
    if (engine) {
      engine.queue.push(cue)
    }
  },

  playNext: (cue, source = 'host') => {
    const { queue, index, engine } = get()
    const newItem: QueueItem = { cue, source }
    const updated = [...queue]
    const insertIdx = index + 1
    updated.splice(insertIdx, 0, newItem)
    set({ queue: updated })
    if (engine) {
      engine.playNext(cue)
    }
  },

  removeFromQueue: (removeIdx) => {
    const { queue, index, engine } = get()
    if (removeIdx <= index) return // cannot remove already played or live song

    const updated = [...queue]
    updated.splice(removeIdx, 1)
    set({ queue: updated })

    if (engine) {
      engine.queue.splice(removeIdx, 1)
      // If we removed the item right after index, tell engine to preload next
      if (removeIdx === index + 1) {
        void engine.preloadNext()
      }
    }
  },
}))
