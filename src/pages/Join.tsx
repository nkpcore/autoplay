import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Cue } from '../data/types'
import { loadSongs } from '../data/loadSongs'
import { searchSongs } from '../planner/searchSongs'
import { connectGuestRoom, type RoomState, type GuestRoomConnection } from '../services/rooms'

const GUEST_ID_KEY = 'pa.guestId'

function getOrCreateGuestId(): string {
  try {
    let id = localStorage.getItem(GUEST_ID_KEY)
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `guest-${Date.now()}`
      localStorage.setItem(GUEST_ID_KEY, id)
    }
    return id
  } catch {
    return `guest-${Date.now()}`
  }
}

export default function Join() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const guestId = getOrCreateGuestId()

  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [catalog, setCatalog] = useState<Cue[]>([])
  const [connecting, setConnecting] = useState(true)
  const [query, setQuery] = useState('')
  const [cooldownSec, setCooldownSec] = useState(0)
  const [statusNotice, setStatusNotice] = useState<string | null>(null)
  const [hasVotedCurrent, setHasVotedCurrent] = useState(false)

  const roomConnRef = useRef<GuestRoomConnection | null>(null)

  // 1. Load catalog & Connect to Room Channel
  useEffect(() => {
    if (!roomId) {
      navigate('/')
      return
    }

    loadSongs()
      .then((songs) => setCatalog(songs))
      .catch((err) => console.error('Failed to load catalog on Join:', err))

    const conn = connectGuestRoom(roomId.toUpperCase(), (state) => {
      setRoomState(state)
      setConnecting(false)
    })
    roomConnRef.current = conn

    if (conn) {
      conn.sendHello(guestId)
    } else {
      setConnecting(false)
    }

    // Cooldown ticker
    const timer = setInterval(() => {
      setCooldownSec((c) => Math.max(0, c - 1))
    }, 1000)

    return () => {
      conn?.close()
      clearInterval(timer)
    }
  }, [roomId, guestId, navigate])

  const handleRequest = (cue: Cue) => {
    if (cooldownSec > 0) {
      setStatusNotice(`Cooldown active: wait ${cooldownSec}s to request again.`)
      setTimeout(() => setStatusNotice(null), 3000)
      return
    }

    if (!roomConnRef.current) {
      setStatusNotice('Live host connection is not active.')
      return
    }

    roomConnRef.current.sendRequest(guestId, cue.song_id)
    const cool = roomState?.rules.cooldownSec ?? 20
    setCooldownSec(cool)
    setStatusNotice(`Requested "${cue.title}"!`)
    setQuery('')
    setTimeout(() => setStatusNotice(null), 4000)
  }

  const handleVote = (songId: string, dir: 1 | -1) => {
    roomConnRef.current?.sendVote(guestId, songId, dir)
    setStatusNotice(dir === 1 ? 'Upvoted track!' : 'Downvoted track!')
    setTimeout(() => setStatusNotice(null), 2500)
  }

  const handleVeto = () => {
    if (!roomState?.nowPlayingId || hasVotedCurrent) return
    roomConnRef.current?.sendVeto(guestId, roomState.nowPlayingId)
    setHasVotedCurrent(true)
    setStatusNotice('Voted to skip current track!')
    setTimeout(() => setStatusNotice(null), 3000)
  }

  const searchResults = searchSongs(catalog, query, 15)

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-md mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">PartyAux Jukebox</h1>
          <p className="text-zinc-400 text-xs">Room: <strong className="text-purple-400 font-mono text-sm">{roomId?.toUpperCase()}</strong></p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${connecting ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
          <span className="text-xs text-zinc-400 font-mono">{connecting ? 'Connecting...' : 'Live'}</span>
        </div>
      </div>

      {/* Notice Banner */}
      {statusNotice && (
        <div className="p-3 bg-purple-950/80 border border-purple-700 text-purple-200 rounded-xl text-xs font-semibold text-center animate-fadeIn">
          {statusNotice}
        </div>
      )}

      {/* Now Playing Widget */}
      <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-pink-400">Now Playing on Aux</div>
        <div>
          <div className="text-lg font-bold text-white truncate">
            {roomState?.nowPlayingTitle || 'Party Starting Soon...'}
          </div>
          <div className="text-xs text-zinc-400 truncate">
            {roomState?.nowPlayingArtist || 'Host is preparing the decks.'}
          </div>
        </div>

        {roomState?.nowPlayingId && (
          <button
            onClick={handleVeto}
            disabled={hasVotedCurrent}
            className="w-full py-2 bg-zinc-800 hover:bg-red-950/40 hover:text-red-300 text-zinc-300 rounded-xl text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
          >
            {hasVotedCurrent ? 'Voted to Skip ✓' : 'Veto / Skip this song'}
          </button>
        )}
      </div>

      {/* Request Song Search */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Request a Song</h2>
          {cooldownSec > 0 && (
            <span className="text-xs text-amber-400 font-mono">Next in {cooldownSec}s</span>
          )}
        </div>

        <input
          type="text"
          placeholder="Search catalog by title or artist..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
        />

        {query.trim().length > 0 && (
          <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-2xl max-h-60 overflow-y-auto space-y-1">
            {searchResults.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500">No matching songs.</div>
            ) : (
              searchResults.map((cue) => (
                <div
                  key={cue.song_id}
                  className="p-2.5 rounded-xl bg-zinc-950 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="truncate flex-1">
                    <div className="font-semibold text-white truncate">{cue.title}</div>
                    <div className="text-[11px] text-zinc-400 truncate">{cue.artist}</div>
                  </div>
                  <button
                    onClick={() => handleRequest(cue)}
                    disabled={cooldownSec > 0}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Request
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Live Guest Queue */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
          Requested Tracks ({roomState?.queue.length ?? 0})
        </h2>

        {!roomState || roomState.queue.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500 bg-zinc-950 border border-zinc-800 rounded-2xl">
            No guest requests in queue yet. Be the first to add one!
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {roomState.queue.map((req) => (
              <div
                key={req.songId}
                className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between gap-3 text-xs"
              >
                <div className="truncate flex-1">
                  <div className="font-semibold text-white truncate">{req.title}</div>
                  <div className="text-[11px] text-zinc-400 truncate">{req.artist}</div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-purple-400">{req.votes > 0 ? `+${req.votes}` : req.votes}</span>
                  <button
                    onClick={() => handleVote(req.songId, 1)}
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-emerald-400 font-bold"
                    title="Upvote"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => handleVote(req.songId, -1)}
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-red-400 font-bold"
                    title="Downvote"
                  >
                    ▼
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
