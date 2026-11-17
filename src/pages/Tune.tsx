import { useState, useEffect, useRef, useCallback } from 'react'
import type { Cue, Era } from '../data/types'
import { loadSongs } from '../data/loadSongs'
import { validateCue } from '../data/validate'
import { loadYouTubeApi } from '../engine/youtubeApi'

const STORAGE_KEY = 'pa.tune.edits'

export default function Tune() {
  // Catalog & Local edits
  const [songs, setSongs] = useState<Cue[]>([])
  const [edits, setEdits] = useState<Record<string, Cue>>({})
  const [filterUnsure, setFilterUnsure] = useState(false)
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null)

  // YouTube player state
  const playerMountRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const [playerReady, setPlayerReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // URL / ID input
  const [urlInput, setUrlInput] = useState('')

  // Form fields
  const [songId, setSongId] = useState('')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [youtubeIdsText, setYoutubeIdsText] = useState('')
  const [entrySec, setEntrySec] = useState(0)
  const [exitSec, setExitSec] = useState(0)
  const [language, setLanguage] = useState('hindi')
  const [subtype, setSubtype] = useState('dance')
  const [energy, setEnergy] = useState(8)
  const [era, setEra] = useState<Era>('pre2020')
  const [tagsText, setTagsText] = useState('')
  const [playFull, setPlayFull] = useState(false)

  // Feedback & Preview
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const previewTimerRef = useRef<number | undefined>(undefined)

  // 1. Initialize YouTube Player
  useEffect(() => {
    let unmounted = false
    async function init() {
      await loadYouTubeApi()
      if (unmounted || !playerMountRef.current) return

      const slot = document.createElement('div')
      slot.id = 'yt-tune-player'
      playerMountRef.current.innerHTML = ''
      playerMountRef.current.appendChild(slot)

      playerRef.current = new YT.Player(slot, {
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 1,
          disablekb: 0,
          fs: 1,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (!unmounted) setPlayerReady(true)
          },
          onStateChange: (e) => {
            if (!unmounted) {
              setIsPlaying(e.data === 1)
              if (e.data === 1 && playerRef.current) {
                const d = playerRef.current.getDuration?.() ?? 0
                if (d > 0) setDuration(Math.round(d))
              }
            }
          },
        },
      })
    }

    void init()

    // Load edits from localStorage
    try {
      const rawEdits = localStorage.getItem(STORAGE_KEY)
      if (rawEdits) {
        setEdits(JSON.parse(rawEdits) as Record<string, Cue>)
      }
    } catch {
      /* ignore */
    }

    // Load initial songs
    loadSongs()
      .then((s) => setSongs(s))
      .catch((err) => console.error('Failed to load songs in Tune:', err))

    return () => {
      unmounted = true
      window.clearTimeout(previewTimerRef.current)
      try {
        playerRef.current?.destroy()
      } catch {
        /* ignore */
      }
    }
  }, [])

  // 2. Poll current playback time
  useEffect(() => {
    if (!playerReady) return
    const id = window.setInterval(() => {
      if (playerRef.current) {
        const t = playerRef.current.getCurrentTime?.() ?? 0
        setCurrentTime(t)
        const d = playerRef.current.getDuration?.() ?? 0
        if (d > 0 && duration === 0) {
          setDuration(Math.round(d))
        }
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [playerReady, duration])

  // Extract 11-char ID from input
  const extractVideoId = (input: string): string | null => {
    const trimmed = input.trim()
    if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed
    const match = /(?:v=|youtu\.be\/|embed\/)?([A-Za-z0-9_-]{11})/.exec(trimmed)
    return match && match[1] ? match[1] : null
  }

  // Load a video into the player
  const loadVideo = useCallback(
    (vidId: string, start = 0) => {
      if (!playerRef.current) return
      try {
        playerRef.current.loadVideoById({ videoId: vidId, startSeconds: start })
        setIsPlaying(true)
      } catch (err) {
        console.error('Failed to load video:', err)
      }
    },
    [],
  )

  // Handle URL/ID Submit
  const handleLoadUrl = () => {
    const vidId = extractVideoId(urlInput)
    if (!vidId) {
      setErrorMsg('Invalid YouTube URL or 11-character video ID')
      return
    }
    setErrorMsg(null)
    loadVideo(vidId, 0)
    if (!youtubeIdsText.includes(vidId)) {
      setYoutubeIdsText(vidId + (youtubeIdsText ? '\n' + youtubeIdsText : ''))
    }
    if (!songId) {
      setSongId(vidId)
    }
  }

  // Select a song from catalog or edits
  const handleSelectSong = useCallback(
    (cue: Cue) => {
      setSelectedSongId(cue.song_id)
      setSongId(cue.song_id)
      setTitle(cue.title)
      setArtist(cue.artist)
      setYoutubeIdsText(cue.youtube_ids.join('\n'))
      setEntrySec(cue.entry_sec)
      setExitSec(cue.exit_sec)
      setDuration(cue.duration_sec)
      setLanguage(cue.language)
      setSubtype(cue.subtype)
      setEnergy(cue.energy)
      setEra(cue.era)
      setTagsText(cue.tags ? cue.tags.join(', ') : '')
      setPlayFull(Boolean(cue.play_full))
      setErrorMsg(null)
      setSuccessMsg(null)

      const mainId = cue.youtube_ids[0]
      if (mainId) {
        setUrlInput(mainId)
        loadVideo(mainId, cue.entry_sec)
      }
    },
    [loadVideo],
  )

  // Preview both ends (hook entry for 5s, exit cut for 5s)
  const handlePreview = useCallback(() => {
    if (!playerRef.current) return
    window.clearTimeout(previewTimerRef.current)
    setPreviewing(true)
    setErrorMsg(null)

    // Step 1: play from entrySec for 5 seconds
    playerRef.current.seekTo(entrySec, true)
    playerRef.current.playVideo()

    previewTimerRef.current = window.setTimeout(() => {
      if (!playerRef.current) return
      // Step 2: jump to exitSec - 5s
      const jumpTime = Math.max(0, exitSec - 5)
      playerRef.current.seekTo(jumpTime, true)

      previewTimerRef.current = window.setTimeout(() => {
        if (!playerRef.current) return
        playerRef.current.pauseVideo()
        setPreviewing(false)
      }, 5000)
    }, 5000)
  }, [entrySec, exitSec])

  // Save current cue
  const handleSave = useCallback(() => {
    setErrorMsg(null)
    setSuccessMsg(null)

    const ids = youtubeIdsText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length === 11)

    if (ids.length === 0) {
      setErrorMsg('At least one valid 11-char YouTube ID is required.')
      return
    }

    const liveDur = duration > 0 ? duration : Math.max(exitSec + 10, 180)
    const rawCue: Record<string, unknown> = {
      song_id: songId.trim() || ids[0],
      title: title.trim(),
      artist: artist.trim(),
      youtube_ids: ids,
      duration_sec: liveDur,
      entry_sec: Math.round(entrySec * 10) / 10,
      exit_sec: Math.round(exitSec * 10) / 10,
      play_full: playFull,
      era,
      language: language.trim().toLowerCase(),
      subtype: subtype.trim().toLowerCase(),
      energy,
      tags: tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      verified: true,
      unsure: false,
    }

    const valid = validateCue(rawCue)
    if (!valid) {
      setErrorMsg('Validation failed. Check hook timing (exit - entry >= 20s), fields, and IDs.')
      return
    }

    const updatedEdits = { ...edits, [valid.song_id]: valid }
    setEdits(updatedEdits)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEdits))
    setSuccessMsg(`Saved "${valid.title}" (verified: true)!`)
  }, [
    youtubeIdsText,
    duration,
    exitSec,
    songId,
    title,
    artist,
    entrySec,
    playFull,
    era,
    language,
    subtype,
    energy,
    tagsText,
    edits,
  ])

  // Load next unsure song
  const handleNextUnsure = useCallback(() => {
    const mergedList = songs.map((s) => edits[s.song_id] ?? s)
    const next = mergedList.find((s) => s.unsure && s.song_id !== selectedSongId)
    if (next) {
      handleSelectSong(next)
    } else {
      alert('No more unsure songs in catalog!')
    }
  }, [songs, edits, selectedSongId, handleSelectSong])

  // Export merged songs.json
  const handleExport = useCallback(() => {
    // Merge base songs with local edits, and include any newly added songs
    const mergedMap = new Map<string, Cue>()
    for (const song of songs) {
      mergedMap.set(song.song_id, song)
    }
    for (const [id, editedSong] of Object.entries(edits)) {
      mergedMap.set(id, editedSong)
    }
    const result = Array.from(mergedMap.values()).sort((a, b) =>
      a.song_id.localeCompare(b.song_id),
    )

    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'songs.json'
    a.click()
    URL.revokeObjectURL(url)
    setSuccessMsg(`Exported ${result.length} songs to songs.json!`)
  }, [songs, edits])

  // Import JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const raw = JSON.parse(evt.target?.result as string)
        if (!Array.isArray(raw)) throw new Error('Root must be an array')
        const validList: Cue[] = []
        for (const item of raw) {
          const v = validateCue(item)
          if (v) validList.push(v)
        }
        setSongs(validList)
        setSuccessMsg(`Imported ${validList.length} valid songs from file.`)
      } catch (err) {
        setErrorMsg(`Failed to import JSON: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    reader.readAsText(file)
  }

  // Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }

      if (e.key === ' ') {
        e.preventDefault()
        if (playerRef.current) {
          if (isPlaying) playerRef.current.pauseVideo()
          else playerRef.current.playVideo()
        }
      } else if (e.key === 'i' || e.key === 'I') {
        const t = Math.round(currentTime * 10) / 10
        setEntrySec(t)
      } else if (e.key === 'o' || e.key === 'O') {
        const t = Math.round(currentTime * 10) / 10
        setExitSec(t)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        const delta = e.shiftKey ? 5 : 1
        playerRef.current?.seekTo(Math.max(0, currentTime - delta), true)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        const delta = e.shiftKey ? 5 : 1
        playerRef.current?.seekTo(currentTime + delta, true)
      } else if (e.key === 'p' || e.key === 'P') {
        handlePreview()
      } else if (e.key === 'Enter') {
        handleSave()
      } else if (e.key === 'n' || e.key === 'N') {
        handleNextUnsure()
      } else if (e.key === 'e' || e.key === 'E') {
        handleExport()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isPlaying,
    currentTime,
    handlePreview,
    handleSave,
    handleNextUnsure,
    handleExport,
  ])

  // Merged song items for sidebar
  const allSongItems = songs.map((s) => edits[s.song_id] ?? s)
  const displayedSongs = filterUnsure ? allSongItems.filter((s) => s.unsure) : allSongItems

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-black text-white min-h-screen">
      {/* Top Header */}
      <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-4 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">PartyAux Cue Tuner</h1>
          <p className="text-zinc-400 text-sm">
            Curate hook entry and exit points with precision. Hotkeys: [Space] Play/Pause, [i] Set Entry, [o] Set Exit, [p] Preview, [Enter] Save, [n] Next unsure, [e] Export.
          </p>
        </div>
        <div className="flex gap-3">
          <label className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold cursor-pointer">
            Import JSON
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold shadow cursor-pointer"
          >
            Export JSON (e)
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {errorMsg && (
        <div className="p-3 bg-red-900/60 border border-red-700 text-red-200 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-900/60 border border-emerald-700 text-emerald-200 rounded-lg text-sm">
          {successMsg}
        </div>
      )}

      {/* Main Grid: Player & Form (Left 8 cols), Catalog List (Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Player, Scrubber, Timing, Form */}
        <div className="lg:col-span-8 space-y-6">
          {/* URL Input Bar */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Paste YouTube Video URL or 11-char ID..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={handleLoadUrl}
              className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white font-semibold rounded-lg text-sm cursor-pointer"
            >
              Load Video
            </button>
          </div>

          {/* 16:9 Video Player */}
          <div className="aspect-video w-full bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl relative">
            <div ref={playerMountRef} className="w-full h-full" />
            {previewing && (
              <div className="absolute top-3 right-3 px-3 py-1 bg-amber-500 text-black font-extrabold text-xs rounded-full animate-pulse">
                PREVIEWING TRANSITION
              </div>
            )}
          </div>

          {/* Time & Progress Bar */}
          <div className="space-y-2 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
            <div className="flex justify-between items-center text-sm font-mono">
              <span className="text-zinc-300">
                Current: <strong className="text-pink-400">{currentTime.toFixed(1)}s</strong>
              </span>
              <span className="text-zinc-400">Duration: {duration}s</span>
            </div>

            {/* Clickable timeline scrubber */}
            <div
              onClick={(e) => {
                if (!playerRef.current || duration === 0) return
                const rect = e.currentTarget.getBoundingClientRect()
                const clickX = e.clientX - rect.left
                const targetSec = (clickX / rect.width) * duration
                playerRef.current.seekTo(targetSec, true)
              }}
              className="relative h-6 bg-zinc-800 rounded cursor-pointer overflow-hidden group"
            >
              {/* Hook highlight region */}
              {duration > 0 && exitSec > entrySec && (
                <div
                  style={{
                    left: `${(entrySec / duration) * 100}%`,
                    width: `${((exitSec - entrySec) / duration) * 100}%`,
                  }}
                  className="absolute top-0 bottom-0 bg-purple-500/30 border-x border-purple-400"
                />
              )}
              {/* Playhead position */}
              <div
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                className="h-full bg-pink-500/70 relative"
              />
            </div>

            {/* Cue controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Entry control */}
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs text-zinc-400 font-semibold">ENTRY (Hook Start)</div>
                  <div className="text-xl font-bold font-mono text-purple-400">{entrySec.toFixed(1)}s</div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEntrySec((s) => Math.max(0, Math.round((s - 1) * 10) / 10))}
                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs rounded"
                  >
                    -1s
                  </button>
                  <button
                    onClick={() => setEntrySec(Math.round(currentTime * 10) / 10)}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 font-semibold text-xs rounded"
                  >
                    Set (i)
                  </button>
                  <button
                    onClick={() => setEntrySec((s) => Math.round((s + 1) * 10) / 10)}
                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs rounded"
                  >
                    +1s
                  </button>
                </div>
              </div>

              {/* Exit control */}
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs text-zinc-400 font-semibold">EXIT (Cut Point)</div>
                  <div className="text-xl font-bold font-mono text-indigo-400">{exitSec.toFixed(1)}s</div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setExitSec((s) => Math.max(0, Math.round((s - 1) * 10) / 10))}
                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs rounded"
                  >
                    -1s
                  </button>
                  <button
                    onClick={() => setExitSec(Math.round(currentTime * 10) / 10)}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs rounded"
                  >
                    Set (o)
                  </button>
                  <button
                    onClick={() => setExitSec((s) => Math.round((s + 1) * 10) / 10)}
                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs rounded"
                  >
                    +1s
                  </button>
                </div>
              </div>
            </div>

            <div className="text-xs text-zinc-400 text-center">
              Planned Hook Duration:{' '}
              <strong className={exitSec - entrySec >= 20 ? 'text-emerald-400' : 'text-red-400'}>
                {(exitSec - entrySec).toFixed(1)}s
              </strong>{' '}
              {exitSec - entrySec < 20 && '(Must be at least 20s)'}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handlePreview}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-sm cursor-pointer shadow"
            >
              Preview Transition (p)
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm cursor-pointer shadow"
            >
              Save Cue (Enter)
            </button>
            <button
              onClick={handleNextUnsure}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-lg text-sm cursor-pointer"
            >
              Next Unsure (n)
            </button>
          </div>

          {/* Metadata Form */}
          <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4">
            <h3 className="font-bold text-zinc-200 text-sm uppercase tracking-wider">Song Metadata</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Song ID (Slug)</label>
                <input
                  type="text"
                  value={songId}
                  onChange={(e) => setSongId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Artist</label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Language</label>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Subtype / Vibe</label>
                <input
                  type="text"
                  value={subtype}
                  onChange={(e) => setSubtype(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Energy (1 to 10): {energy}</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={energy}
                  onChange={(e) => setEnergy(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Era</label>
                <select
                  value={era}
                  onChange={(e) => setEra(e.target.value as Era)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-white"
                >
                  <option value="pre2000">pre2000</option>
                  <option value="2000s">2000s</option>
                  <option value="pre2020">pre2020</option>
                  <option value="2020s">2020s</option>
                </select>
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="playFull"
                  checked={playFull}
                  onChange={(e) => setPlayFull(e.target.checked)}
                  className="accent-purple-500 h-4 w-4"
                />
                <label htmlFor="playFull" className="text-xs text-zinc-300">
                  Play full track (disable early cut)
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                YouTube Mirrors / Alternate IDs (one 11-char ID per line)
              </label>
              <textarea
                rows={2}
                value={youtubeIdsText}
                onChange={(e) => setYoutubeIdsText(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-300"
                placeholder="e.g. cCmZ7aFU1xY&#10;hAA9TQyxQxk"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-white"
                placeholder="e.g. party, banger, hype"
              />
            </div>
          </div>

          {/* Collapsible Curator Tips */}
          <details className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-400">
            <summary className="font-semibold text-zinc-200 cursor-pointer">
              Quick Tuning Tips for the Curator
            </summary>
            <div className="mt-3 space-y-2 text-xs">
              <p>
                &bull; <strong>Hook Start:</strong> Pick where a crowd starts dancing (the first chorus/drop), not the slow intro.
              </p>
              <p>
                &bull; <strong>Exit Point:</strong> Right after the chorus ends or before energy drops. 90&ndash;150s per song keeps a party moving.
              </p>
              <p>
                &bull; <strong>Mirrors:</strong> Add 2 extra IDs (official video, lyric video, audio upload) so if one is blocked in any country, the next one plays.
              </p>
              <p>
                &bull; <strong>Energy:</strong> 10 = everyone screams, 7 = peak dance, 5 = groove/background, 2 = slow ballad.
              </p>
            </div>
          </details>
        </div>

        {/* Right Column: Songs Catalog Sidebar */}
        <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col h-[850px]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-sm text-zinc-200">Catalog ({displayedSongs.length})</h3>
            <label className="flex items-center space-x-1.5 text-xs text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={filterUnsure}
                onChange={(e) => setFilterUnsure(e.target.checked)}
                className="accent-purple-500"
              />
              <span>Unsure only</span>
            </label>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {displayedSongs.map((cue) => {
              const isSelected = selectedSongId === cue.song_id
              const isEdited = Boolean(edits[cue.song_id])
              return (
                <div
                  key={cue.song_id}
                  onClick={() => handleSelectSong(cue)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-purple-950/60 border-purple-500 text-white'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                  }`}
                >
                  <div className="flex justify-between items-start font-semibold">
                    <span className="truncate pr-2">{cue.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      E{cue.energy}
                    </span>
                  </div>
                  <div className="text-zinc-500 truncate text-[11px]">{cue.artist}</div>
                  <div className="flex justify-between items-center mt-2 text-[10px] text-zinc-400 font-mono">
                    <span>
                      {cue.entry_sec}s &rarr; {cue.exit_sec}s
                    </span>
                    <div className="flex gap-1">
                      {isEdited && (
                        <span className="text-emerald-400 font-semibold">[edited]</span>
                      )}
                      {cue.unsure && (
                        <span className="text-amber-400 font-semibold">[unsure]</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
