import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Cue, Answers, Phase, Crowd } from '../data/types'
import { loadSongs } from '../data/loadSongs'
import { randomSeed } from '../planner/prng'

const LAST_ANSWERS_KEY = 'pa.lastAnswers'

export default function Wizard() {
  const navigate = useNavigate()
  const [songs, setSongs] = useState<Cue[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Answers state
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [selectedSubtypes, setSelectedSubtypes] = useState<string[]>([])
  const [selectedPhase, setSelectedPhase] = useState<Phase>('peak')
  const [selectedCrowd, setSelectedCrowd] = useState<Crowd>('medium')

  // Load catalog on mount
  useEffect(() => {
    loadSongs()
      .then((loaded) => {
        setSongs(loaded)
        // Pre-fill from lastAnswers if available
        try {
          const raw = localStorage.getItem(LAST_ANSWERS_KEY)
          if (raw) {
            const last = JSON.parse(raw) as Partial<Answers>
            if (Array.isArray(last.languages) && last.languages.length > 0) {
              setSelectedLanguages(last.languages)
            }
            if (Array.isArray(last.subtypes)) {
              setSelectedSubtypes(last.subtypes)
            }
            if (last.time) setSelectedPhase(last.time)
            if (last.crowd) setSelectedCrowd(last.crowd)
          }
        } catch {
          /* ignore */
        }
      })
      .catch((err) => console.error('Failed to load songs in Wizard:', err))
      .finally(() => setLoading(false))
  }, [])

  // Aggregate languages from catalog
  const languageCounts = songs.reduce<Record<string, number>>((acc, s) => {
    const lang = s.language.toLowerCase()
    acc[lang] = (acc[lang] ?? 0) + 1
    return acc
  }, {})

  const availableLanguages = Object.entries(languageCounts).sort((a, b) => b[1] - a[1])

  // Aggregate subtypes for chosen languages
  const availableSubtypes = Array.from(
    new Set(
      songs
        .filter(
          (s) =>
            selectedLanguages.length === 0 ||
            selectedLanguages.includes(s.language.toLowerCase()),
        )
        .map((s) => s.subtype.toLowerCase())
        .filter(Boolean),
    ),
  ).sort()

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    )
  }

  const toggleSubtype = (sub: string) => {
    setSelectedSubtypes((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub],
    )
  }

  const handleBuildSet = () => {
    const answers: Answers = {
      languages: selectedLanguages.length > 0 ? selectedLanguages : ['hindi'],
      subtypes: selectedSubtypes,
      time: selectedPhase,
      crowd: selectedCrowd,
    }

    try {
      localStorage.setItem(LAST_ANSWERS_KEY, JSON.stringify(answers))
    } catch {
      /* ignore */
    }

    const seed = randomSeed()
    const params = new URLSearchParams({
      l: answers.languages.join(','),
      s: answers.subtypes.join(','),
      t: answers.time,
      c: answers.crowd,
      seed: seed.toString(),
      n: '1',
    })

    navigate(`/play?${params.toString()}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm">Loading music catalog...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col justify-between max-w-xl mx-auto">
      {/* Top Bar with Step Indicators */}
      <div className="space-y-4">
        <div className="flex justify-between items-center text-xs text-zinc-500 uppercase tracking-wider font-semibold">
          <span>Question {step} of 4</span>
          <button
            onClick={() => navigate('/')}
            className="text-zinc-400 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
        </div>
        <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden flex">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`flex-1 transition-all duration-300 ${
                i <= step ? 'bg-gradient-to-r from-pink-500 to-purple-600' : 'bg-transparent'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step Contents */}
      <div className="py-8 space-y-6 flex-1 flex flex-col justify-center">
        {/* Step 1: Languages */}
        {step === 1 && (
          <div className="space-y-5 animate-fadeIn">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white">What languages?</h2>
              <p className="text-zinc-400 text-sm mt-1">Select all that apply for your party crowd.</p>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              {availableLanguages.map(([lang, count]) => {
                const selected = selectedLanguages.includes(lang)
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleLanguage(lang)}
                    className={`px-4 py-3 rounded-xl font-bold text-sm capitalize transition-all cursor-pointer flex items-center space-x-2 border ${
                      selected
                        ? 'bg-gradient-to-r from-pink-600 to-purple-600 border-pink-400 text-white shadow-lg shadow-pink-500/20'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span>{lang}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-black/30 font-normal">
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 2: Vibe / Subtypes */}
        {step === 2 && (
          <div className="space-y-5 animate-fadeIn">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white">What's the vibe?</h2>
              <p className="text-zinc-400 text-sm mt-1">
                Pick specific genres or leave empty for an eclectic party blend.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2 max-h-72 overflow-y-auto">
              {availableSubtypes.length === 0 ? (
                <div className="text-zinc-500 text-sm">
                  No specific vibes found for chosen languages; a general party mix will play.
                </div>
              ) : (
                availableSubtypes.map((sub) => {
                  const selected = selectedSubtypes.includes(sub)
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => toggleSubtype(sub)}
                      className={`px-4 py-2.5 rounded-xl font-bold text-sm capitalize transition-all cursor-pointer border ${
                        selected
                          ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-500/20'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      {sub}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Step 3: Night Phase */}
        {step === 3 && (
          <div className="space-y-5 animate-fadeIn">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white">What part of the night?</h2>
              <p className="text-zinc-400 text-sm mt-1">Sets the energy trajectory and arc.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2">
              {[
                { id: 'warming', label: 'Warming up', desc: 'Starting chill and building momentum' },
                { id: 'peak', label: 'Peak party', desc: 'High energy dancefloor bangers' },
                { id: 'winding', label: 'Winding down', desc: 'Cooling off, late night singalongs' },
                { id: 'bangers', label: 'Only bangers', desc: 'Maximum 10/10 hype with zero cooldown' },
              ].map((p) => {
                const selected = selectedPhase === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPhase(p.id as Phase)}
                    className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
                      selected
                        ? 'bg-gradient-to-r from-pink-950/80 to-purple-950/80 border-pink-500 text-white shadow-md'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-bold text-base">{p.label}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{p.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 4: Crowd Size */}
        {step === 4 && (
          <div className="space-y-5 animate-fadeIn">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white">How big is the crowd?</h2>
              <p className="text-zinc-400 text-sm mt-1">Calibrates track selections and boldness.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2">
              {[
                { id: 'small', label: 'Small crew (4–6 people)', desc: 'Intimate vibes, familiar tunes' },
                { id: 'medium', label: 'Party group (10–20 people)', desc: 'Balanced popular favorites' },
                { id: 'large', label: 'Rager (20+ people)', desc: 'Big crowd-pleasers and anthem singalongs' },
              ].map((c) => {
                const selected = selectedCrowd === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCrowd(c.id as Crowd)}
                    className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
                      selected
                        ? 'bg-gradient-to-r from-purple-950/80 to-indigo-950/80 border-purple-500 text-white shadow-md'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-bold text-base">{c.label}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{c.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="pt-6 border-t border-zinc-800 flex gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
            className="px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-sm cursor-pointer"
          >
            &larr; Back
          </button>
        )}

        {step < 4 ? (
          <button
            type="button"
            disabled={step === 1 && selectedLanguages.length === 0}
            onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
            className="flex-1 py-3 px-6 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow cursor-pointer transition-all"
          >
            Continue &rarr;
          </button>
        ) : (
          <button
            type="button"
            onClick={handleBuildSet}
            className="flex-1 py-4 px-6 rounded-xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-400 hover:via-purple-500 hover:to-indigo-500 text-white font-extrabold text-base shadow-lg shadow-purple-500/25 cursor-pointer transition-all transform active:scale-98"
          >
            Build my set &rarr;
          </button>
        )}
      </div>
    </div>
  )
}
