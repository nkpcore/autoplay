import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { processLocalFiles } from '../state/localFiles'
import { useStore } from '../state/useStore'
import { showToast } from '../components/Toast'

export default function Home() {
  const navigate = useNavigate()
  const setQueue = useStore((s) => s.setQueue)
  const setCurrentCue = useStore((s) => s.setCurrentCue)
  const [importing, setImporting] = useState(false)
  const [progressText, setProgressText] = useState('')

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    try {
      setImporting(true)
      const fileList = Array.from(files)
      setProgressText(`Processing 0/${fileList.length} tracks...`)

      const cues = await processLocalFiles(fileList, (cur, total) => {
        setProgressText(`Analyzing & equalizing track ${cur}/${total}...`)
      })

      if (cues.length > 0) {
        setQueue(cues.map((c) => ({ cue: c, source: 'planner' })))
        setCurrentCue(cues[0] ?? null)
        navigate('/play?mode=local')
      }
    } catch (err) {
      showToast(`Error importing local files: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setImporting(false)
      setProgressText('')
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between p-6 max-w-lg mx-auto relative overflow-hidden">
      {/* Background Neon Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-pink-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 flex justify-between items-center pt-2">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/30">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
          <span className="text-xl font-black tracking-tight text-white">PartyAux</span>
        </div>

        <button
          onClick={() => navigate('/tune')}
          className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 transition-colors cursor-pointer"
        >
          Curator Tool
        </button>
      </header>

      {/* Hero Body */}
      <main className="relative z-10 space-y-6 my-auto py-12 text-center">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-pink-950/60 border border-pink-700/50 text-pink-300 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping" />
          <span>The aux, handled autonomously</span>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Never let the party vibe die.
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base max-w-sm mx-auto leading-relaxed">
            Continuous, equal-power hook-to-hook crossfading for YouTube &amp; local music. No awkward silence. Zero song bloat.
          </p>
        </div>

        {/* CTA Stack */}
        <div className="space-y-3 pt-4 max-w-xs mx-auto">
          <button
            onClick={() => navigate('/wizard')}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-400 hover:via-purple-500 hover:to-indigo-500 text-white font-extrabold text-base shadow-lg shadow-purple-500/25 transition-all transform active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Start a Party</span>
            <span>&rarr;</span>
          </button>

          <button
            onClick={() => navigate('/sets')}
            className="w-full py-3 px-6 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 font-bold text-sm transition-all cursor-pointer"
          >
            My Saved Sets
          </button>

          {/* Local Music File Picker (T32) */}
          <label className="block w-full py-3 px-6 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80 font-semibold text-xs transition-all cursor-pointer">
            {importing ? progressText : 'Use my own music (MP3/WAV/FLAC)'}
            <input
              type="file"
              accept="audio/*"
              multiple
              disabled={importing}
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 border-t border-zinc-900 text-center text-xs text-zinc-500">
        Engineered for clubs, house parties &amp; living rooms &bull; Gapless mixing
      </footer>
    </div>
  )
}
