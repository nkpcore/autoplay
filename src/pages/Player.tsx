import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import type { Cue, Answers, Phase, Crowd, EngineEvent } from '../data/types'
import { loadSongs } from '../data/loadSongs'
import { planSet } from '../planner/planSet'
import { Engine } from '../engine/Engine'
import { createDecks, type Mode } from '../engine/deckFactory'
import { resolveLocalFile } from '../state/localFiles'
import { isIOS } from '../engine/platform'
import { useStore } from '../state/useStore'
import { saveSet } from '../data/mySets'
import { keepAwake, setMediaSession } from '../utils/mediaSession'
import { logEvent } from '../services/telemetry'

import Glow from '../components/Glow'
import Waveform from '../components/Waveform'
import QueueList from '../components/QueueList'
import SearchModal from '../components/SearchModal'
import Hotkeys from '../components/Hotkeys'
import StartGate from '../components/StartGate'

export default function Player() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // Store state
  const {
    queue,
    index,
    engineState,
    currentCue,
    statusMessage,
    setEngine,
    setQueue,
    setIndex,
    setEngineState,
    setCurrentCue,
    setStatusMessage,
    addToQueue,
    playNext,
    removeFromQueue,
  } = useStore()

  // Local state
  const [catalog, setCatalog] = useState<Cue[]>([])
  const [loading, setLoading] = useState(true)
  const [started, setStarted] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [showDecks, setShowDecks] = useState(false)
  const [saveSetName, setSaveSetName] = useState('')
  const [isSavingSet, setIsSavingSet] = useState(false)

  // Decks & Engine references
  const mountARef = useRef<HTMLDivElement>(null)
  const mountBRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<Engine | null>(null)

  // URL Query Parameters
  const idsParam = searchParams.get('ids')
  const langParam = searchParams.get('l')
  const subParam = searchParams.get('s')
  const timeParam = searchParams.get('t') as Phase | null
  const crowdParam = searchParams.get('c') as Crowd | null
  const seedParam = searchParams.get('seed')
  const batchNParam = parseInt(searchParams.get('n') || '1', 10)

  const modeParam = (searchParams.get('mode') as Mode) || 'youtube'
  const isHardCut = modeParam === 'local' ? false : isIOS || searchParams.get('hardcut') === '1'

  // 1. Initial Queue Resolution
  useEffect(() => {
    let unmounted = false
    async function init() {
      try {
        const songs = await loadSongs()
        if (unmounted) return
        setCatalog(songs)

        let resolvedCues: Cue[] = []

        if (idsParam) {
          // Manual set from IDs
          const idList = idsParam.split(',').map((s) => s.trim())
          const songMap = new Map<string, Cue>()
          songs.forEach((s) => songMap.set(s.song_id, s))
          resolvedCues = idList.map((id) => songMap.get(id)).filter((c): c is Cue => Boolean(c))
        } else if (langParam && seedParam) {
          // Generated from wizard answers & seed
          const answers: Answers = {
            languages: langParam.split(',').filter(Boolean),
            subtypes: subParam ? subParam.split(',').filter(Boolean) : [],
            time: timeParam ?? 'peak',
            crowd: crowdParam ?? 'medium',
          }
          const seed = parseInt(seedParam, 10) || 42
          const result = planSet(songs, answers, seed)
          resolvedCues = result.cues
          if (result.note) setStatusMessage(result.note)
        } else if (queue.length > 0) {
          resolvedCues = queue.map((item) => item.cue)
        }

        if (resolvedCues.length === 0) {
          // If no songs can be resolved, redirect to Wizard
          navigate('/wizard')
          return
        }

        setQueue(resolvedCues.map((c) => ({ cue: c, source: 'planner' })))
        setCurrentCue(resolvedCues[0] ?? null)
      } catch (err) {
        console.error('Failed to init player:', err)
      } finally {
        if (!unmounted) setLoading(false)
      }
    }

    void init()
    return () => {
      unmounted = true
    }
  }, [idsParam, langParam, subParam, timeParam, crowdParam, seedParam, navigate])

  // 2. Start the Party via StartGate User Gesture
  const handleStartParty = async () => {
    if (!mountARef.current || !mountBRef.current || queue.length === 0) return

    try {
      await keepAwake()

      let audioCtx: AudioContext | undefined
      if (modeParam === 'local') {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        audioCtx = new AudioContextClass()
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume()
        }
      }

      const [deckA, deckB] = await createDecks(
        modeParam,
        mountARef.current,
        resolveLocalFile,
        audioCtx,
      )

      const engine = new Engine([deckA, deckB], { hardCut: isHardCut })
      engineRef.current = engine
      setEngine(engine)

      // Engine Event Listeners
      engine.on((e: EngineEvent) => {
        logEvent(e)
        setEngineState(engine.state)
        setCurrentCue(engine.current ?? null)
        setIndex(engine.index)

        if (e.type === 'holding') {
          setStatusMessage('Next track is still loading, riding this one a little longer...')
        } else if (e.type === 'unavailable') {
          setStatusMessage(`Skipped "${e.cue.title}" (playback unavailable).`)
          setTimeout(() => setStatusMessage(null), 4000)
        } else if (e.type === 'live') {
          setStatusMessage(null)
          setMediaSession(e.cue, {
            play: () => engine.resume(),
            pause: () => engine.pause(),
            next: () => engine.skip(),
          })
        }
      })

      const cuesToPlay = queue.map((item) => item.cue)
      await engine.start(cuesToPlay, 0)
      setStarted(true)
    } catch (err) {
      console.error('Error starting party engine:', err)
      alert(`Could not start party: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // 3. Infinite Set / Load More Check (T23)
  useEffect(() => {
    if (!started || !engineRef.current || catalog.length === 0 || !langParam || !seedParam) return

    // Trigger load more when 5 or fewer songs remain in the queue
    const remaining = queue.length - index
    if (remaining <= 5) {
      const nextBatchN = batchNParam + 1
      const seed = parseInt(seedParam, 10) || 42
      const nextSeed = seed + nextBatchN * 7919

      const answers: Answers = {
        languages: langParam.split(',').filter(Boolean),
        subtypes: subParam ? subParam.split(',').filter(Boolean) : [],
        time: timeParam ?? 'peak',
        crowd: crowdParam ?? 'medium',
      }

      const allPlayedIds = queue.map((item) => item.cue.song_id)
      const last5 = queue.slice(-5).map((item) => item.cue)

      const nextBatch = planSet(catalog, answers, nextSeed, {
        exclude: allPlayedIds,
        previous: last5,
      })

      if (nextBatch.cues.length > 0) {
        const newItems = nextBatch.cues.map((c) => ({ cue: c, source: 'planner' as const }))
        setQueue([...queue, ...newItems])
        if (engineRef.current) {
          engineRef.current.queue.push(...nextBatch.cues)
        }

        // Update URL query with next batch number
        const updatedParams = new URLSearchParams(searchParams)
        updatedParams.set('n', nextBatchN.toString())
        setSearchParams(updatedParams, { replace: true })
      }
    }
  }, [
    started,
    index,
    queue,
    catalog,
    langParam,
    subParam,
    timeParam,
    crowdParam,
    seedParam,
    batchNParam,
    searchParams,
    setSearchParams,
    setQueue,
  ])

  // Save Set
  const handleSaveSet = () => {
    if (!saveSetName.trim()) return
    const songIds = queue.map((item) => item.cue.song_id)
    saveSet(saveSetName, songIds)
    setIsSavingSet(false)
    setSaveSetName('')
    alert('Set saved to My Sets!')
  }

  // Seek handler
  const handleSeek = useCallback((toSec: number) => {
    engineRef.current?.seekLive(toSec)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-x-hidden flex flex-col justify-between">
      {/* Dynamic Pulsing Ambient Glow (T25) */}
      <Glow cue={currentCue} state={engineState} />

      {/* Global Hotkeys (Space, s, f, /) */}
      <Hotkeys engine={engineRef.current} onFocusSearch={() => setIsSearchOpen(true)} />

      {/* StartGate Screen Overlay (T14) */}
      {!started && (
        <StartGate
          onStart={handleStartParty}
          title="The Aux is Ready"
          subtitle="Tap to unlock continuous party playback & visuals."
        />
      )}

      {/* Search Modal (T28) */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        catalog={catalog}
        onPlayNext={(cue) => playNext(cue, 'host')}
        onAddToEnd={(cue) => addToQueue(cue, 'host')}
      />

      {/* Hidden/Collapsible YouTube Player Decks (T08, T09) */}
      <div
        className={`fixed z-30 transition-all duration-300 ${
          showDecks
            ? 'top-4 right-4 bg-zinc-950/90 border border-zinc-800 p-2 rounded-xl shadow-2xl flex gap-2'
            : 'opacity-0 pointer-events-none -top-96 -left-96'
        }`}
      >
        <div ref={mountARef} className="w-[180px] h-[180px] bg-black rounded overflow-hidden" />
        <div ref={mountBRef} className="w-[180px] h-[180px] bg-black rounded overflow-hidden" />
      </div>

      {/* Top Navigation Bar */}
      <header className="relative z-10 px-6 py-4 flex justify-between items-center border-b border-zinc-900/80 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/')}
            className="text-lg font-black tracking-tight text-white flex items-center gap-1.5 cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" />
            <span>PartyAux</span>
          </button>
          {isHardCut && (
            <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60 font-mono">
              Hard Cut
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowDecks((prev) => !prev)}
            title="Toggle video tiles"
            className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg cursor-pointer"
          >
            {showDecks ? 'Hide Decks' : 'Decks'}
          </button>
          <button
            onClick={() => setIsSavingSet(true)}
            className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-semibold rounded-lg cursor-pointer"
          >
            Save Set
          </button>
          <button
            onClick={() => navigate('/wizard')}
            className="px-3 py-1 bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            New
          </button>
        </div>
      </header>

      {/* Main Player Core Content */}
      <main className="relative z-10 flex-1 max-w-xl w-full mx-auto p-6 flex flex-col justify-center space-y-6">
        {/* Save Set Popup */}
        {isSavingSet && (
          <div className="p-4 bg-zinc-900/95 border border-purple-500/50 rounded-2xl shadow-xl space-y-3 animate-fadeIn">
            <h4 className="text-sm font-bold text-white">Save this Party Mix</h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Give your set a name..."
                value={saveSetName}
                onChange={(e) => setSaveSetName(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
              />
              <button
                onClick={handleSaveSet}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Save
              </button>
              <button
                onClick={() => setIsSavingSet(false)}
                className="px-2 py-1.5 bg-zinc-800 text-zinc-400 text-xs rounded-lg cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Now Playing Header */}
        <div className="space-y-3 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="text-[11px] font-black tracking-widest uppercase text-pink-500">
              Now Playing
            </span>
            {engineState === 'fading' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/80 text-purple-200 border border-purple-700 font-bold animate-pulse">
                CROSSFADING
              </span>
            )}
          </div>

          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              {currentCue?.title ?? 'No Track Playing'}
            </h1>
            <p className="text-base sm:text-lg text-zinc-300 font-medium mt-1">
              {currentCue?.artist ?? 'Select a mix or launch the wizard.'}
            </p>
          </div>

          {/* Chips */}
          {currentCue && (
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 font-bold uppercase text-zinc-200">
                {currentCue.language}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 font-bold uppercase text-zinc-300">
                {currentCue.subtype}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-950/80 border border-pink-700/60 font-mono font-bold text-pink-300">
                E{currentCue.energy}
              </span>
              {currentCue.play_full && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-700/60 font-bold text-indigo-300">
                  Full Track
                </span>
              )}
            </div>
          )}

          {/* Status line (Doc 07 section 4: holding, unavailable) */}
          {statusMessage && (
            <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-800/80 text-purple-200 text-xs text-center font-medium">
              {statusMessage}
            </div>
          )}
        </div>

        {/* Waveform Scrubber (T26) */}
        <div className="pt-2">
          <Waveform cue={currentCue} engine={engineRef.current} onSeek={handleSeek} />
        </div>

        {/* Playback Controls (T15) */}
        <div className="flex items-center justify-center gap-4 py-2">
          {/* Pause / Resume Button */}
          <button
            onClick={() => engineRef.current?.togglePause()}
            type="button"
            aria-label={engineState === 'paused' ? 'Resume' : 'Pause'}
            className="w-16 h-16 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/30 cursor-pointer transition-transform transform active:scale-95"
          >
            {engineState === 'paused' ? (
              <svg className="w-7 h-7 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
          </button>

          {/* Skip Button */}
          <button
            onClick={() => engineRef.current?.skip()}
            type="button"
            aria-label="Skip track"
            className="p-4 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 shadow cursor-pointer transition-all active:scale-95"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
            </svg>
          </button>

          {/* Full Track Toggle Button */}
          <button
            onClick={() => engineRef.current?.togglePlayFull()}
            type="button"
            aria-label="Toggle full track"
            className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              currentCue?.play_full
                ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
            }`}
          >
            {currentCue?.play_full ? 'Full Track: ON' : 'Full Track: OFF'}
          </button>
        </div>

        {/* Up Next Queue List (T27) */}
        <div className="pt-2">
          <QueueList
            queue={queue}
            currentIndex={index}
            onPlayNext={(itemIdx) => {
              const item = queue[itemIdx]
              if (item) {
                removeFromQueue(itemIdx)
                playNext(item.cue, item.source)
              }
            }}
            onRemove={(itemIdx) => removeFromQueue(itemIdx)}
            onOpenSearch={() => setIsSearchOpen(true)}
          />
        </div>
      </main>

      {/* Footer Hotkey Helper */}
      <footer className="relative z-10 py-3 text-center text-[11px] text-zinc-600">
        Hotkeys: <kbd className="px-1 bg-zinc-900 border border-zinc-800 rounded">Space</kbd>{' '}
        Pause &bull; <kbd className="px-1 bg-zinc-900 border border-zinc-800 rounded">s</kbd> Skip
        &bull; <kbd className="px-1 bg-zinc-900 border border-zinc-800 rounded">f</kbd> Full &bull;{' '}
        <kbd className="px-1 bg-zinc-900 border border-zinc-800 rounded">/</kbd> Search
      </footer>
    </div>
  )
}
