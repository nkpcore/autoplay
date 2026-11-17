import React from 'react'
import type { QueueItem } from '../data/types'

interface QueueListProps {
  queue: QueueItem[]
  currentIndex: number
  onPlayNext: (queueIndex: number) => void
  onRemove: (queueIndex: number) => void
  onOpenSearch: () => void
}

export const QueueList: React.FC<QueueListProps> = ({
  queue,
  currentIndex,
  onPlayNext,
  onRemove,
  onOpenSearch,
}) => {
  const upNext = queue.slice(currentIndex + 1)

  return (
    <div className="space-y-3 w-full">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
          Up Next ({upNext.length})
        </h3>
        <button
          onClick={onOpenSearch}
          type="button"
          className="text-xs font-bold text-pink-400 hover:text-pink-300 flex items-center gap-1 cursor-pointer"
        >
          <span>+ Add song</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
            /
          </kbd>
        </button>
      </div>

      {upNext.length === 0 ? (
        <div className="p-6 bg-zinc-950/40 border border-zinc-800/80 rounded-xl text-center text-zinc-500 text-xs">
          Queue is almost empty &mdash; loading next batch of party tracks...
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {upNext.map((item, relIdx) => {
            const actualIdx = currentIndex + 1 + relIdx
            const isNextPreloaded = relIdx === 0
            return (
              <div
                key={`${item.cue.song_id}-${actualIdx}`}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                  isNextPreloaded
                    ? 'bg-zinc-900/90 border-purple-500/50 shadow-sm'
                    : 'bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-zinc-100 truncate">
                      {item.cue.title}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                      E{item.cue.energy}
                    </span>
                    {item.cue.bpm && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-cyan-300 font-mono">
                        {Math.round(item.cue.bpm)} BPM
                      </span>
                    )}
                    {item.source === 'guest' && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                        Guest
                      </span>
                    )}
                    {isNextPreloaded && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300 border border-purple-700/50 font-semibold">
                        Ready
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 truncate mt-0.5">
                    {item.cue.artist} &bull;{' '}
                    <span className="capitalize">{item.cue.language}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!isNextPreloaded && (
                    <button
                      onClick={() => onPlayNext(actualIdx)}
                      title="Bump to next"
                      type="button"
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer transition-colors"
                    >
                      Play next
                    </button>
                  )}
                  <button
                    onClick={() => onRemove(actualIdx)}
                    title="Remove from queue"
                    type="button"
                    aria-label={`Remove ${item.cue.title}`}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 cursor-pointer transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
export default QueueList
