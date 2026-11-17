import { useState } from 'react'
import { loadSongsWithDetails, type LoadSongsResult } from '../data/loadSongs'

export default function EngineTest() {
  const [loadResult, setLoadResult] = useState<LoadSongsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLoadSongs = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await loadSongsWithDetails(true)
      setLoadResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Engine Test Bench</h1>

      <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-3">
        <h2 className="text-lg font-semibold text-zinc-200">Phase 1: Catalog Data Verification</h2>
        <button
          onClick={handleLoadSongs}
          disabled={loading}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-md transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Load songs'}
        </button>

        {error && (
          <div className="p-3 bg-red-900/50 border border-red-700 text-red-200 rounded">
            Error: {error}
          </div>
        )}

        {loadResult && (
          <div className="space-y-2 text-sm text-zinc-300">
            <p>
              Valid songs: <strong className="text-emerald-400">{loadResult.validCount}</strong>
            </p>
            <p>
              Dropped songs: <strong className="text-amber-400">{loadResult.droppedCount}</strong>
            </p>
            <div className="mt-3">
              <h3 className="font-semibold text-zinc-400 mb-1">Loaded Songs:</h3>
              <ul className="list-disc pl-5 space-y-1">
                {loadResult.valid.map((song) => (
                  <li key={song.song_id}>
                    {song.title} - {song.artist} ({song.entry_sec}s &rarr; {song.exit_sec}s, E:{song.energy}, {song.language})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div id="deck-mounts" className="space-y-4">
        {/* Placeholder mounts for Phase 2 Decks */}
      </div>
    </div>
  )
}
