import React, { useRef, useEffect, useState, useMemo } from 'react'
import type { Cue } from '../data/types'
import type { Engine } from '../engine/Engine'
import { fallbackBars } from '../utils/waveformFallback'

function resampleHeat(heat: number[]): number[] {
  const result: number[] = []
  const targetLen = 88
  for (let i = 0; i < targetLen; i++) {
    const startIdx = (i / targetLen) * heat.length
    const endIdx = ((i + 1) / targetLen) * heat.length
    let sum = 0
    let count = 0
    for (let j = Math.floor(startIdx); j < Math.ceil(endIdx) && j < heat.length; j++) {
      const val = heat[j]
      if (typeof val === 'number') {
        sum += val
        count++
      }
    }
    result.push(count > 0 ? sum / count : 0.5)
  }
  const max = Math.max(...result, 0.01)
  return result.map((v) => Math.max(0.08, v / max))
}

interface WaveformProps {
  cue: Cue | null
  engine: Engine | null
  onSeek: (toSec: number) => void
}

export const Waveform: React.FC<WaveformProps> = ({ cue, engine, onSeek }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDraggingRef = useRef(false)
  const dragSecRef = useRef(0)
  const [displayTime, setDisplayTime] = useState({ cur: 0, dur: 0 })

  const bars = useMemo(() => {
    if (!cue) return Array(88).fill(0.1) as number[]
    if (Array.isArray(cue.heat) && cue.heat.length >= 10) {
      return resampleHeat(cue.heat)
    }
    return fallbackBars(cue)
  }, [cue])

  // Canvas render loop via rAF
  useEffect(() => {
    let animId: number
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let lastSecUpdate = 0

    const render = (timeMs: number) => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const w = rect.width
      const h = rect.height

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, w, h)

      const liveDuration = (cue ? (engine ? engine.live.getDuration() || cue.duration_sec : cue.duration_sec) : 180) || 180
      const currentSec = isDraggingRef.current
        ? dragSecRef.current
        : engine
        ? engine.live.getTime()
        : 0

      // Update React time labels roughly 4 times a second
      if (timeMs - lastSecUpdate > 250) {
        lastSecUpdate = timeMs
        setDisplayTime({ cur: currentSec, dur: liveDuration })
      }

      // 1. Draw Hook Highlight Background
      if (cue && liveDuration > 0 && cue.exit_sec > cue.entry_sec) {
        const hookStartX = (cue.entry_sec / liveDuration) * w
        const hookEndX = (Math.min(cue.exit_sec, liveDuration) / liveDuration) * w
        ctx.fillStyle = 'rgba(168, 85, 247, 0.15)'
        ctx.fillRect(hookStartX, 0, Math.max(2, hookEndX - hookStartX), h)

        // Draw boundary lines for entry and exit
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.4)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(hookStartX, 0)
        ctx.lineTo(hookStartX, h)
        ctx.moveTo(hookEndX, 0)
        ctx.lineTo(hookEndX, h)
        ctx.stroke()
      }

      // 2. Draw 88 Bars
      const numBars = 88
      const barSpacing = w / numBars
      const barWidth = Math.max(1, barSpacing - 1.5)

      for (let i = 0; i < numBars; i++) {
        const barX = i * barSpacing
        const barTime = (i / numBars) * liveDuration
        const barVal = bars[i] ?? 0.1
        const barHeight = Math.max(3, barVal * h * 0.85)
        const barY = (h - barHeight) / 2

        if (barTime <= currentSec) {
          // Played: bright magenta to purple gradient
          ctx.fillStyle = '#ec4899'
        } else {
          // Unplayed: dim subtle white/zinc
          ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
        }

        ctx.beginPath()
        ctx.roundRect(barX, barY, barWidth, barHeight, 1.5)
        ctx.fill()
      }

      // 3. Draw Playhead Needle
      const playheadX = liveDuration > 0 ? (currentSec / liveDuration) * w : 0
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = '#ec4899'
      ctx.shadowBlur = 8
      ctx.fillRect(Math.max(0, playheadX - 1), 0, 2, h)

      ctx.restore()
      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [cue, engine, bars])

  // Scrubbing events
  const computeSecFromPointer = (e: React.PointerEvent<HTMLCanvasElement>): number => {
    const canvas = canvasRef.current
    if (!canvas) return 0
    const rect = canvas.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const liveDuration = (cue ? (engine ? engine.live.getDuration() || cue.duration_sec : cue.duration_sec) : 180) || 180
    return (x / rect.width) * liveDuration
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    const sec = computeSecFromPointer(e)
    dragSecRef.current = sec
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return
    const sec = computeSecFromPointer(e)
    dragSecRef.current = sec
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    const sec = computeSecFromPointer(e)
    onSeek(sec)
  }

  const formatMinSec = (s: number) => {
    const total = Math.max(0, Math.floor(s))
    const m = Math.floor(total / 60)
    const sec = total % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-1.5 w-full">
      <div className="relative h-20 w-full bg-zinc-950/60 rounded-xl overflow-hidden border border-zinc-800/80 cursor-ew-resize">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full block"
        />
      </div>
      <div className="flex justify-between items-center text-xs text-zinc-400 font-mono px-1">
        <span>{formatMinSec(displayTime.cur)}</span>
        {cue && (
          <span className="text-zinc-500 text-[10px]">
            Hook: {formatMinSec(cue.entry_sec)} &rarr; {formatMinSec(cue.exit_sec)}
          </span>
        )}
        <span>{formatMinSec(displayTime.dur)}</span>
      </div>
    </div>
  )
}
export default Waveform
