import React, { useState } from 'react'
import type { Engine } from '../engine/Engine'
import type { Cue } from '../data/types'

interface DebugPanelProps {
  engine: Engine | null
  currentCue: Cue | null
  queueLength: number
  engineState: string
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  engine,
  currentCue,
  queueLength,
  engineState,
}) => {
  const [collapsed, setCollapsed] = useState(true)

  if (!import.meta.env.DEV) return null

  const liveTime = engine ? engine.live.getTime() : 0
  const cutPoint = engine ? engine.cutPointNow() : 0
  const liveDeck = engine ? engine.live.name : 'none'
  const idleDeckStatus = engine ? engine.idle.status : 'none'

  return (
    <div className="fixed bottom-0 right-0 z-40 max-w-sm w-full bg-zinc-950/95 border-t border-l border-zinc-800 text-xs text-zinc-300 font-mono shadow-2xl">
      <div
        onClick={() => setCollapsed(!collapsed)}
        className="px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center cursor-pointer hover:bg-zinc-850"
      >
        <span className="font-bold text-pink-400">DEV PANEL &bull; {engineState.toUpperCase()}</span>
        <span className="text-zinc-500">{collapsed ? '▲ Expand' : '▼ Collapse'}</span>
      </div>

      {!collapsed && (
        <div className="p-3 space-y-1.5 max-h-56 overflow-y-auto">
          <div>
            Live Deck: <strong className="text-pink-400">{liveDeck}</strong> (idle: {idleDeckStatus})
          </div>
          <div>
            Time / Cut: {liveTime.toFixed(1)}s / {cutPoint.toFixed(1)}s
          </div>
          <div>Queue Length: {queueLength}</div>
          <div>Current Cue: {currentCue?.song_id ?? 'none'}</div>
          <div>Engine State: {engineState}</div>
        </div>
      )}
    </div>
  )
}
export default DebugPanel
