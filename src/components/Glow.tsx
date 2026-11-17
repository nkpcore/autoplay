import React from 'react'
import type { Cue } from '../data/types'
import type { EngineState } from '../engine/types'

interface GlowProps {
  cue: Cue | null
  state: EngineState
}

export const Glow: React.FC<GlowProps> = ({ cue, state }) => {
  const energy = cue ? Math.min(10, Math.max(1, cue.energy)) : 5
  const durationSec = Math.max(0.6, 2.6 - 0.17 * energy)
  const isPaused = state === 'paused'

  const lang = (cue?.language || '').toLowerCase()
  let colorCenter = 'rgba(168, 85, 247, 0.45)' // violet
  let colorEdge = 'rgba(139, 92, 246, 0.05)'

  if (lang === 'hindi') {
    colorCenter = 'rgba(236, 72, 153, 0.5)' // magenta
    colorEdge = 'rgba(219, 39, 119, 0.05)'
  } else if (lang === 'punjabi') {
    colorCenter = 'rgba(249, 115, 22, 0.5)' // orange
    colorEdge = 'rgba(234, 88, 12, 0.05)'
  } else if (lang === 'english') {
    colorCenter = 'rgba(6, 182, 212, 0.5)' // cyan
    colorEdge = 'rgba(8, 145, 178, 0.05)'
  } else if (lang === 'spanish') {
    colorCenter = 'rgba(245, 158, 11, 0.5)' // amber
    colorEdge = 'rgba(217, 119, 6, 0.05)'
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="w-full h-full transform-gpu"
        style={{
          background: `radial-gradient(circle at 50% 38%, ${colorCenter} 0%, ${colorEdge} 60%, rgba(7, 6, 11, 1) 100%)`,
          animation: 'glowPulse ease-in-out infinite alternate',
          animationDuration: `${durationSec.toFixed(2)}s`,
          animationPlayState: isPaused ? 'paused' : 'running',
        }}
      />
    </div>
  )
}
export default Glow
