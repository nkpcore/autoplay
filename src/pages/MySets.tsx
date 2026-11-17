import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSavedSets, renameSet, deleteSet, buildShareLink, type SavedSet } from '../data/mySets'
import { showToast } from '../state/useToast'

export default function MySets() {
  const navigate = useNavigate()
  const [sets, setSets] = useState<SavedSet[]>(() => getSavedSets())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handlePlay = (set: SavedSet) => {
    navigate(`/play?ids=${set.songIds.join(',')}`)
  }

  const handleStartRename = (set: SavedSet) => {
    setEditingId(set.id)
    setEditName(set.name)
  }

  const handleSaveRename = (id: string) => {
    renameSet(id, editName)
    setSets(getSavedSets())
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    if (confirm('Delete this saved set?')) {
      deleteSet(id)
      setSets(getSavedSets())
    }
  }

  const handleCopyLink = async (set: SavedSet) => {
    const link = buildShareLink(set.songIds)
    try {
      await navigator.clipboard.writeText(link)
      setCopiedId(set.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      showToast(`Share link:\n${link}`)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">My Sets</h1>
          <p className="text-zinc-400 text-sm">Saved party setlists and shareable mixes.</p>
        </div>
        <button
          onClick={() => navigate('/wizard')}
          className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow"
        >
          + New Set
        </button>
      </div>

      {sets.length === 0 ? (
        <div className="p-12 text-center bg-zinc-950 border border-zinc-800/80 rounded-2xl space-y-4">
          <p className="text-zinc-400 text-sm">You haven't saved any sets yet.</p>
          <button
            onClick={() => navigate('/wizard')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-sm cursor-pointer shadow-lg shadow-purple-500/20"
          >
            Launch Wizard &rarr;
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sets.map((s) => (
            <div
              key={s.id}
              className="p-5 bg-zinc-900/90 border border-zinc-800 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all"
            >
              <div className="min-w-0 flex-1">
                {editingId === s.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-zinc-950 border border-zinc-700 px-3 py-1 rounded text-sm text-white focus:outline-none"
                    />
                    <button
                      onClick={() => handleSaveRename(s.id)}
                      className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div>
                    <h3 className="font-bold text-lg text-white truncate">{s.name}</h3>
                    <div className="text-xs text-zinc-400 mt-1 flex flex-wrap gap-2 items-center">
                      <span>{s.songIds.length} tracks</span>
                      <span>&bull;</span>
                      <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                      {s.answers && (
                        <>
                          <span>&bull;</span>
                          <span className="capitalize text-zinc-500">
                            {s.answers.time} &bull; {s.answers.languages.join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => handlePlay(s)}
                  className="px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold shadow cursor-pointer"
                >
                  Play
                </button>
                <button
                  onClick={() => handleCopyLink(s)}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {copiedId === s.id ? 'Copied!' : 'Share link'}
                </button>
                <button
                  onClick={() => handleStartRename(s)}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Rename
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="px-3 py-2 bg-zinc-800 hover:bg-red-950/50 hover:text-red-400 text-zinc-400 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
