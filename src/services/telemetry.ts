import type { EngineEvent } from '../data/types'
import { supabase } from './supabase'

const session =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `sess-${Date.now()}`

const buffer: Record<string, unknown>[] = []
let timer: number | undefined
let sessionEventCount = 0

export function logEvent(e: EngineEvent): void {
  if (!supabase) return // telemetry off when no env vars configured
  if (sessionEventCount >= 200) return // cap at 200 rows per session to protect free tier
  sessionEventCount++

  const row: Record<string, unknown> = {
    type: e.type,
    song_id: e.cue?.song_id ?? 'unknown',
    session,
    created_at: new Date().toISOString(),
  }

  if (e.type === 'seek') {
    row.from_sec = Math.round(e.from * 10) / 10
    row.to_sec = Math.round(e.to * 10) / 10
  }
  if (e.type === 'skip') {
    row.from_sec = Math.round(e.at * 10) / 10
  }

  buffer.push(row)
  if (!timer && typeof window !== 'undefined') {
    timer = window.setTimeout(() => void flush(), 5000) // batch every 5 s
  }
}

export async function flush(): Promise<void> {
  timer = undefined
  if (!supabase || buffer.length === 0) return
  const rows = buffer.splice(0, buffer.length)
  try {
    await supabase.from('events').insert(rows)
  } catch {
    /* drop on failure silently without blocking UI */
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    void flush()
  })
}
