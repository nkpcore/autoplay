import { useState, useRef, useEffect } from 'react'
import { loadSongs, loadSongsWithDetails, type LoadSongsResult } from '../data/loadSongs'
import type { Cue, EngineEvent } from '../data/types'
import { YouTubeDeck } from '../engine/YouTubeDeck'
import { Engine } from '../engine/Engine'
import { equalPowerFade } from '../engine/crossfade'
import { isIOS } from '../engine/platform'
import { showToast } from '../components/Toast'
import { Hotkeys } from '../components/Hotkeys'
import { StartGate } from '../components/StartGate'

export default function EngineTest() {
  // Phase 1 test state
  const [loadResult, setLoadResult] = useState<LoadSongsResult | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)

  // Phase 2 single deck / two deck state
  const mountARef = useRef<HTMLDivElement>(null)
  const mountBRef = useRef<HTMLDivElement>(null)
  const deckARef = useRef<YouTubeDeck | null>(null)
  const deckBRef = useRef<YouTubeDeck | null>(null)
  const [deckATime, setDeckATime] = useState(0)
  const [deckBTime, setDeckBTime] = useState(0)
  const [deckAStatus, setDeckAStatus] = useState<string>('empty')
  const [deckBStatus, setDeckBStatus] = useState<string>('empty')
  const [gainLog, setGainLog] = useState<string[]>([])

  // Engine state
  const engineRef = useRef<Engine | null>(null)
  const [engineInstance, setEngineInstance] = useState<Engine | null>(null)
  const [engineState, setEngineState] = useState<string>('idle')
  const [currentCue, setCurrentCue] = useState<Cue | null>(null)
  const [eventsLog, setEventsLog] = useState<string[]>([])
  const [showStartGate, setShowStartGate] = useState(false)

  // Hard cut override check
  const searchParams = new URLSearchParams(window.location.search)
  const hardCutForced = searchParams.get('hardcut') === '1'
  const isHardCutMode = isIOS || hardCutForced

  // T05: Test Load Songs
  const handleLoadSongs = async () => {
    try {
      setDataLoading(true)
      setDataError(null)
      const res = await loadSongsWithDetails(true)
      setLoadResult(res)
    } catch (err) {
      setDataError(err instanceof Error ? err.message : String(err))
    } finally {
      setDataLoading(false)
    }
  }

  // T08: Play single cue on Deck A
  const handleStartSingleDeck = async () => {
    if (!mountARef.current) return
    const songs = await loadSongs()
    const first = songs[0]
    if (!first) {
      showToast('No songs available')
      return
    }

    if (!deckARef.current) {
      deckARef.current = await YouTubeDeck.create('A', mountARef.current)
    }
    const deckA = deckARef.current
    await deckA.load(first, first.entry_sec)
    deckA.setGain(1)
    deckA.play()
    setDeckAStatus(deckA.status)
  }

  // T09: Preload Deck B while Deck A plays
  const handlePreloadDeckB = async () => {
    if (!mountBRef.current) return
    const songs = await loadSongs()
    const second = songs[1]
    if (!second) {
      showToast('Need at least 2 songs')
      return
    }

    if (!deckBRef.current) {
      deckBRef.current = await YouTubeDeck.create('B', mountBRef.current)
    }
    const deckB = deckBRef.current
    await deckB.load(second, second.entry_sec)
    setDeckBStatus(deckB.status)
  }

  // T10: Manual crossfade button A -> B
  const handleManualCrossfade = () => {
    const deckA = deckARef.current
    const deckB = deckBRef.current
    if (!deckA || !deckB) {
      showToast('Initialize both decks first')
      return
    }

    deckB.setGain(0)
    deckB.play()
    setGainLog([])

    equalPowerFade({
      durationMs: 1500,
      stepMs: 40,
      onStep: (inGain, outGain) => {
        deckB.setGain(inGain)
        deckA.setGain(outGain)
        setGainLog((prev) => [
          ...prev.slice(-8),
          `inGain: ${inGain.toFixed(3)}, outGain: ${outGain.toFixed(3)}`,
        ])
      },
      onDone: () => {
        deckA.pause()
        deckA.stop()
        setGainLog((prev) => [...prev, 'Crossfade COMPLETE: Deck A stopped, Deck B live (gain=1.0)'])
      },
    })
  }

  // T11: Full Engine Start
  const handleStartEngine = async () => {
    if (!mountARef.current || !mountBRef.current) return
    const songs = await loadSongs()
    if (songs.length === 0) {
      showToast('No songs available')
      return
    }

    if (!deckARef.current) {
      deckARef.current = await YouTubeDeck.create('A', mountARef.current)
    }
    if (!deckBRef.current) {
      deckBRef.current = await YouTubeDeck.create('B', mountBRef.current)
    }

    const engine = new Engine([deckARef.current, deckBRef.current], {
      hardCut: isHardCutMode,
    })
    engineRef.current = engine
    setEngineInstance(engine)

    engine.on((e: EngineEvent) => {
      const msg = `[${new Date().toLocaleTimeString()}] Event: ${e.type}${
        e.cue ? ` - "${e.cue.title}"` : ''
      }${e.type === 'seek' ? ` (${e.from.toFixed(1)}s -> ${e.to.toFixed(1)}s)` : ''}`
      setEventsLog((prev) => [msg, ...prev.slice(0, 25)])
      setCurrentCue(engine.current ?? null)
      setEngineState(engine.state)
    })

    await engine.start(songs)
    setEngineState(engine.state)
    setCurrentCue(engine.current ?? null)
  }

  // T13: Test Fallback IDs & unavailable watchdog
  const handleTestFallback = async () => {
    if (!mountARef.current || !mountBRef.current) return
    const testQueue: Cue[] = [
      {
        song_id: 'test-fallback-cue',
        title: 'Fallback Test Track (Invalid First ID)',
        artist: 'Test Artist',
        youtube_ids: ['INVALID_ID_', 'cCmZ7aFU1xY'], // First is 11 chars but invalid, second is Kala Chashma
        duration_sec: 192,
        entry_sec: 22,
        exit_sec: 50,
        play_full: false,
        era: 'pre2020',
        language: 'hindi',
        subtype: 'dance',
        energy: 10,
        tags: [],
      },
      {
        song_id: 'test-all-invalid-cue',
        title: 'All Invalid Track (Should be skipped)',
        artist: 'Dead Track',
        youtube_ids: ['INVALID1111', 'INVALID2222'],
        duration_sec: 180,
        entry_sec: 20,
        exit_sec: 45,
        play_full: false,
        era: 'pre2020',
        language: 'hindi',
        subtype: 'dance',
        energy: 8,
        tags: [],
      },
      {
        song_id: 'slowly-slowly-guru-randhawa',
        title: 'Slowly Slowly',
        artist: 'Guru Randhawa ft. Pitbull',
        youtube_ids: ['hQC8EGwZuaM'],
        duration_sec: 210,
        entry_sec: 25,
        exit_sec: 60,
        play_full: false,
        era: 'pre2020',
        language: 'punjabi',
        subtype: 'party',
        energy: 9,
        tags: [],
      },
    ]

    if (!deckARef.current) {
      deckARef.current = await YouTubeDeck.create('A', mountARef.current)
    }
    if (!deckBRef.current) {
      deckBRef.current = await YouTubeDeck.create('B', mountBRef.current)
    }

    const engine = new Engine([deckARef.current, deckBRef.current], {
      hardCut: isHardCutMode,
    })
    engineRef.current = engine
    setEngineInstance(engine)

    engine.on((e: EngineEvent) => {
      const msg = `[${new Date().toLocaleTimeString()}] Event: ${e.type}${
        e.cue ? ` - "${e.cue.title}"` : ''
      }`
      setEventsLog((prev) => [msg, ...prev.slice(0, 25)])
      setCurrentCue(engine.current ?? null)
      setEngineState(engine.state)
    })

    await engine.start(testQueue)
  }

  // T08/T09 ticker for UI
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (deckARef.current) {
        setDeckATime(deckARef.current.getTime())
        setDeckAStatus(deckARef.current.status)
      }
      if (deckBRef.current) {
        setDeckBTime(deckBRef.current.getTime())
        setDeckBStatus(deckBRef.current.status)
      }
      if (engineRef.current) {
        setEngineState(engineRef.current.state)
        setCurrentCue(engineRef.current.current ?? null)
      }
    }, 200)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 bg-black text-white min-h-screen">
      <Hotkeys engine={engineInstance} />

      {showStartGate && (
        <StartGate
          onStart={async () => {
            setShowStartGate(false)
            await handleStartEngine()
          }}
        />
      )}

      {/* Header */}
      <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">PartyAux Engine Testbench</h1>
          <p className="text-zinc-400 text-sm">Interactive verification for Phases 1 & 2 (T05–T16)</p>
        </div>
        {isHardCutMode && (
          <div className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded text-xs">
            Hard Cut Mode Active {isIOS ? '(iOS Safari)' : '(?hardcut=1)'}
          </div>
        )}
      </div>

      {/* T16 Banner */}
      {isIOS && (
        <div className="p-4 bg-amber-950/60 border border-amber-800 rounded-lg text-amber-200 text-sm">
          On iPhone, songs switch with a quick cut. Use "My own music" for smooth mixing.
        </div>
      )}

      {/* Section 1: Data Verification (T05, T06) */}
      <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4">
        <h2 className="text-lg font-bold text-zinc-200">Phase 1: Catalog Validation (T05, T06)</h2>
        <div className="flex gap-3">
          <button
            onClick={handleLoadSongs}
            disabled={dataLoading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {dataLoading ? 'Loading...' : 'Load songs (/songs.json)'}
          </button>
        </div>

        {dataError && (
          <div className="p-3 bg-red-900/40 border border-red-700 text-red-300 rounded text-sm">
            {dataError}
          </div>
        )}

        {loadResult && (
          <div className="space-y-2 text-sm text-zinc-300">
            <p>
              Valid count: <strong className="text-emerald-400">{loadResult.validCount}</strong> |{' '}
              Dropped count: <strong className="text-amber-400">{loadResult.droppedCount}</strong>
            </p>
            <div className="max-h-36 overflow-y-auto bg-zinc-950 p-3 rounded border border-zinc-800">
              <ul className="list-disc pl-5 space-y-1">
                {loadResult.valid.map((s) => (
                  <li key={s.song_id}>
                    {s.title} &mdash; {s.artist} ({s.entry_sec}s &rarr; {s.exit_sec}s, Energy {s.energy})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Decks & Players Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deck A */}
        <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-pink-400">Deck A</h3>
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 font-mono">
              Status: {deckAStatus} | Time: {deckATime.toFixed(1)}s
            </span>
          </div>
          <div
            ref={mountARef}
            className="w-[200px] h-[200px] bg-black border border-zinc-700 rounded-lg overflow-hidden flex items-center justify-center mx-auto"
          />
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleStartSingleDeck}
              className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded text-xs font-semibold cursor-pointer"
            >
              T08: Start Deck A (Song 1)
            </button>
          </div>
        </div>

        {/* Deck B */}
        <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-indigo-400">Deck B</h3>
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 font-mono">
              Status: {deckBStatus} | Time: {deckBTime.toFixed(1)}s
            </span>
          </div>
          <div
            ref={mountBRef}
            className="w-[200px] h-[200px] bg-black border border-zinc-700 rounded-lg overflow-hidden flex items-center justify-center mx-auto"
          />
          <div className="flex gap-2 justify-center">
            <button
              onClick={handlePreloadDeckB}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold cursor-pointer"
            >
              T09: Preload Deck B (Song 2)
            </button>
          </div>
        </div>
      </div>

      {/* Section 3: Manual Crossfade (T10) */}
      <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
        <h2 className="text-lg font-bold text-zinc-200">Phase 2: Equal-Power Crossfade (T10)</h2>
        <button
          onClick={handleManualCrossfade}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-sm cursor-pointer"
        >
          T10: Crossfade Now (A &rarr; B, 1500ms)
        </button>
        {gainLog.length > 0 && (
          <div className="p-3 bg-zinc-950 font-mono text-xs text-zinc-400 rounded border border-zinc-800 space-y-1">
            {gainLog.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        )}
      </div>

      {/* Section 4: Full Autonomous Engine (T11 - T16) */}
      <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-zinc-200">Phase 2: Autonomous Engine (T11–T16)</h2>
          <span className="px-3 py-1 bg-zinc-800 rounded font-mono text-xs">
            State: <strong className="text-emerald-400 uppercase">{engineState}</strong>
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleStartEngine}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg text-sm cursor-pointer"
          >
            T11: Start Engine
          </button>
          <button
            onClick={() => setShowStartGate(true)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-lg text-sm cursor-pointer"
          >
            T14: Open StartGate
          </button>
          <button
            onClick={handleTestFallback}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg text-sm cursor-pointer"
          >
            T13: Test Fallback IDs &amp; Skip
          </button>
        </div>

        {/* Playback Controls (T15) */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
          <button
            onClick={() => engineRef.current?.togglePause()}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs font-semibold cursor-pointer"
          >
            Space: Pause / Resume
          </button>
          <button
            onClick={() => engineRef.current?.skip()}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs font-semibold cursor-pointer"
          >
            s: Skip Song
          </button>
          <button
            onClick={() => engineRef.current?.togglePlayFull()}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs font-semibold cursor-pointer"
          >
            f: Toggle Full Track
          </button>
          <button
            onClick={() => engineRef.current?.seekLive(60)}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs font-semibold cursor-pointer"
          >
            Seek to 60s
          </button>
        </div>

        {currentCue && (
          <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 space-y-1">
            <div className="text-xs uppercase tracking-wider text-pink-400 font-bold">Now Playing</div>
            <div className="text-xl font-bold">{currentCue.title}</div>
            <div className="text-sm text-zinc-400">{currentCue.artist}</div>
            <div className="text-xs text-zinc-500">
              Entry: {currentCue.entry_sec}s | Exit: {currentCue.exit_sec}s | Full:{' '}
              {String(currentCue.play_full)}
            </div>
          </div>
        )}

        {/* Events log */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
            Engine Event Stream
          </h4>
          <div className="p-3 bg-zinc-950 font-mono text-xs text-zinc-400 rounded-lg border border-zinc-800 h-40 overflow-y-auto space-y-1">
            {eventsLog.length === 0 ? (
              <div className="text-zinc-600 italic">No events recorded yet. Start engine above.</div>
            ) : (
              eventsLog.map((log, i) => (
                <div key={i} className="text-zinc-300">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
