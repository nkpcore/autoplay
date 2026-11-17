import React, { useState, useEffect, useRef } from 'react'
import type { Cue } from '../data/types'
import { searchSongs } from '../planner/searchSongs'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  catalog: Cue[]
  onPlayNext: (cue: Cue) => void
  onAddToEnd: (cue: Cue) => void
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  catalog,
  onPlayNext,
  onAddToEnd,
}) => {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const results = searchSongs(catalog, query, 20)

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/80 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-zinc-800 flex items-center gap-3">
          <svg className="w-5 h-5 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search by title, artist, vibe, or tag..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-white placeholder-zinc-500 text-sm focus:outline-none"
          />
          <button
            onClick={onClose}
            className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800 cursor-pointer"
          >
            Esc
          </button>
        </div>

        {/* Results List */}
        <div className="p-2 overflow-y-auto flex-1 space-y-1">
          {query.trim().length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              Type keywords to find any track in the party catalog.
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              No matching tracks found in catalog for "{query}".
            </div>
          ) : (
            results.map((cue) => (
              <div
                key={cue.song_id}
                className="p-3 rounded-xl bg-zinc-950/60 hover:bg-zinc-800/60 border border-zinc-800/60 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-zinc-100 truncate">{cue.title}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                      E{cue.energy}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 capitalize">
                      {cue.language}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 truncate mt-0.5">{cue.artist}</div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      onPlayNext(cue)
                      onClose()
                    }}
                    type="button"
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white cursor-pointer shadow"
                  >
                    Play next
                  </button>
                  <button
                    onClick={() => {
                      onAddToEnd(cue)
                      onClose()
                    }}
                    type="button"
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
                  >
                    Add to end
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
export default SearchModal
