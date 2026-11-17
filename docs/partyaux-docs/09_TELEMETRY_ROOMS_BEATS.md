# 09 — Telemetry (Phase 7), Guest Rooms (Phase 8), Beat Analysis (Phase 9)

# PART A — TELEMETRY AND SELF-IMPROVING CUES

## A1. What we log
Every `EngineEvent` becomes a small JSON row. Only these fields: `type`, `song_id`, `from_sec`, `to_sec`, `session`. No names, no emails, no IPs from our side.

`session` = random UUID created once per page load (`crypto.randomUUID()`), stored in memory only.

## A2. Client logger — `src/services/telemetry.ts`

```ts
import type { EngineEvent } from '../data/types'
import { supabase } from './supabase'

const session = crypto.randomUUID()
const buffer: Record<string, unknown>[] = []
let timer: number | undefined

export function logEvent(e: EngineEvent) {
  if (!supabase) return                       // telemetry off when no env vars
  const row: Record<string, unknown> = { type: e.type, song_id: e.cue.song_id, session }
  if (e.type === 'seek') { row.from_sec = e.from; row.to_sec = e.to }
  if (e.type === 'skip') { row.from_sec = e.at }
  buffer.push(row)
  if (!timer) timer = window.setTimeout(flush, 5000)   // batch every 5 s
}

async function flush() {
  timer = undefined
  if (!supabase || buffer.length === 0) return
  const rows = buffer.splice(0, buffer.length)
  try { await supabase.from('events').insert(rows) } catch { /* drop on failure */ }
}

window.addEventListener('pagehide', () => { void flush() })
```
Rules: sample `live` events at 100% but cap at 200 rows per session; never block the UI; failures are silent.

## A3. `src/services/supabase.ts`
```ts
import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabase = url && key ? createClient(url, key) : null
```

## A4. Aggregation script — `scripts/tuneFromEvents.mjs`
Runs in GitHub Actions nightly. It READS events with the service-role key and WRITES a changed `public/songs.json`. A second action step opens a Pull Request so a human reviews.

Algorithm per `song_id`:
1. Take `seek` events of the last 30 days.
2. Keep deliberate seeks: `to_sec - from_sec` absolute >= 3, and `to_sec` between 5 and `duration_sec - 15`.
3. Per `session` keep only the LAST seek (one vote per person).
4. Need at least `MIN_VOTES = 15` sessions, else skip the song.
5. Compute the **median** of `to_sec`. Remove votes further than 20 s from the median, recompute median.
6. If `|median - entry_sec| >= 3` and `median < exit_sec - 20`:
   - `newEntry = entry_sec + clamp(median - entry_sec, -10, +10)` (never move more than 10 s per run)
   - round to 0.5 s
   - set `crowd_tuned: true`, keep `verified` unchanged (a human verified cue is only changed through the PR review).
7. Write a `tune-report.md` listing each change: song, old, new, votes.

Skeleton:
```js
import { readFile, writeFile } from 'node:fs/promises'
const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const since = new Date(Date.now() - 30 * 864e5).toISOString()

async function fetchSeeks() {
  const res = await fetch(`${URL}/rest/v1/events?type=eq.seek&created_at=gte.${since}&select=song_id,from_sec,to_sec,session,created_at&limit=100000`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
  if (!res.ok) throw new Error('fetch failed ' + res.status)
  return res.json()
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
// ... group by song, apply the algorithm above, write songs.json and tune-report.md
```

## A5. GitHub Action — `.github/workflows/tune.yml`
```yaml
name: tune-cues
on:
  schedule: [{ cron: '30 21 * * *' }]   # nightly
  workflow_dispatch: {}
permissions: { contents: write, pull-requests: write }
jobs:
  tune:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: node scripts/tuneFromEvents.mjs
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      - uses: peter-evans/create-pull-request@v6
        with:
          title: 'Proposed cue tuning'
          body-path: tune-report.md
          branch: bot/tune-cues
          commit-message: 'tune cues from crowd seeks'
```
Also `.github/workflows/keepalive.yml`: weekly cron that does a harmless `curl` GET to the Supabase REST URL (with the anon key) so the free project does not pause.

# PART B — GUEST ROOMS (Phase 8)

## B1. Idea
Host creates a room. Guests scan a QR code, open `/join/<roomId>`, search songs, request them, and vote. The host's browser is the single source of truth. We use **Supabase Realtime Broadcast** (no database table needed, free).

## B2. Room id
6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no confusing characters), generated on the host device. Channel name: `room:<id>`.

## B3. Messages (all JSON, always validated)
| Event name | From | Payload | Meaning |
|---|---|---|---|
| `hello` | guest | `{ guestId }` | guest joined; host replies with `state` |
| `state` | host | `{ now: songId, queue: [{songId, votes, by}], rules }` | full snapshot (send at most once per second) |
| `request` | guest | `{ guestId, songId }` | wants this song |
| `vote` | guest | `{ guestId, songId, dir: 1 \| -1 }` | upvote / downvote a queued song |
| `veto` | guest | `{ guestId, songId }` | wants current/queued song skipped |

## B4. Host code — `src/services/rooms.ts` (shape)
```ts
export function createRoom(onMessage: (m: RoomMsg) => void) {
  const id = makeRoomId()
  const channel = supabase!.channel(`room:${id}`, { config: { broadcast: { self: false } } })
  channel
    .on('broadcast', { event: 'request' }, ({ payload }) => onMessage({ kind: 'request', ...payload }))
    .on('broadcast', { event: 'vote' },    ({ payload }) => onMessage({ kind: 'vote', ...payload }))
    .on('broadcast', { event: 'veto' },    ({ payload }) => onMessage({ kind: 'veto', ...payload }))
    .on('broadcast', { event: 'hello' },   ({ payload }) => onMessage({ kind: 'hello', ...payload }))
    .subscribe()
  return {
    id,
    sendState: (s: RoomState) => channel.send({ type: 'broadcast', event: 'state', payload: s }),
    close: () => supabase!.removeChannel(channel),
  }
}
```
Guest mirrors this with `request/vote/veto/hello` sends and a `state` listener.

## B5. Host rules (validated on the host only)
```ts
interface RoomRules {
  maxRequestsPerGuest: number      // default 3 in the queue at once
  approveAll: boolean              // default false; if true host must tap OK on each request
  blockedSubtypes: string[]
  vetoThreshold: number            // default 3 distinct guests
  cooldownSec: number              // default 20 between requests from the same guest
}
```
Host logic when `request` arrives:
1. Look up song by `songId` in loaded songs. If unknown -> ignore.
2. Check rules (max per guest, cooldown, blocked subtypes, duplicate in queue -> add one vote instead).
3. If `approveAll` -> put in a "pending" list shown to host; else insert into queue.
4. Insertion position: after the current song and after any songs already requested by guests (so requests are FIFO among themselves), before planner songs. Call `engine.playNext(cue)` or `queue.splice` + `preloadNext`.
5. Mark `source: 'guest'` and `requestedBy`.
`vote`: +1/-1 on a guest-requested song; sort guest songs by votes desc (ties by time). `veto`: collect distinct guestIds for the current song; when count >= `vetoThreshold` call `engine.skip()`.

## B6. Join page (`/join/:roomId`)
Mobile page: search box, results with "Request" button, list of the room queue (from `state`) with up/down vote buttons, "Skip this song" veto button. Show friendly states: "Connecting...", "Room not found / host offline", "You can request again in 12 s".
Guest id: `localStorage['pa.guestId']` (UUID). Guests do NOT need to load YouTube or the engine. They only need `songs.json` for search.

## B7. QR code
```ts
import QRCode from 'qrcode'
const url = `${location.origin}/join/${roomId}`
const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320 })
```
Show the QR in a modal on the Player page with the short code under it.

## B8. Limits (free tier)
Keep payloads under 2 KB. Send `state` at most once per second and only when it changed. No chat messages.

# PART C — BEAT ANALYSIS (Phase 9) — Local files only

YouTube audio cannot be analyzed in the browser (cross-origin). Analysis works only for local files decoded into an `AudioBuffer`.

## C1. Why
- Snap `entry_sec` and `exit_sec` to the nearest downbeat so the mix lands on the beat.
- Know BPM to pick compatible next songs and to nudge tempo.
- Measure loudness for `gain_db`.

## C2. Loudness (`src/analysis/loudness.ts`)
```ts
/** Rough loudness in dBFS using RMS of the mono mix. Good enough to even out songs. */
export function measureRmsDb(buf: AudioBuffer): number {
  const ch0 = buf.getChannelData(0)
  const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch0
  let sum = 0
  const step = 4                       // skip samples for speed
  let n = 0
  for (let i = 0; i < ch0.length; i += step) {
    const m = (ch0[i]! + ch1[i]!) * 0.5
    sum += m * m
    n++
  }
  const rms = Math.sqrt(sum / Math.max(1, n))
  return 20 * Math.log10(Math.max(rms, 1e-6))
}

export const TARGET_DB = -16
export function gainDbFor(buf: AudioBuffer): number {
  const g = TARGET_DB - measureRmsDb(buf)
  return Math.max(-9, Math.min(9, Math.round(g * 10) / 10))   // clamp +-9 dB
}
```
(This is RMS, not true LUFS. Say so in a code comment.)

## C3. BPM + first beat (`src/analysis/bpm.ts`, run inside a Web Worker `bpm.worker.ts`)
Algorithm (simple and reliable enough for party music):
1. Mix to mono. Take the first 90 s (or whole song if shorter) to save time.
2. Frame size 1024, hop 512. For each frame compute energy `e[k] = sum(x^2)`.
3. Onset strength `o[k] = max(0, e[k] - e[k-1])`. Normalize so max = 1.
4. Frame rate `fr = sampleRate / 512`.
5. Autocorrelation of `o` for lags between `fr*60/180` and `fr*60/70` (BPM 180 down to 70). Pick lag with max value.
6. `bpm = 60 * fr / bestLag`. If `bpm < 80` double it; if `bpm > 170` halve it.
7. First downbeat phase: for each offset in `[0, beatPeriodFrames)`, sum `o[offset + k*beatPeriodFrames]` over all k; the offset with the largest sum is the beat phase. `firstBeatSec = offset / fr`.

```ts
export function estimateBpm(mono: Float32Array, sampleRate: number) {
  const frame = 1024, hop = 512
  const frames = Math.floor((mono.length - frame) / hop)
  const e = new Float32Array(frames)
  for (let k = 0; k < frames; k++) {
    let s = 0
    const start = k * hop
    for (let i = 0; i < frame; i++) { const v = mono[start + i]!; s += v * v }
    e[k] = s
  }
  const o = new Float32Array(frames)
  let max = 1e-9
  for (let k = 1; k < frames; k++) { o[k] = Math.max(0, e[k]! - e[k - 1]!); if (o[k]! > max) max = o[k]! }
  for (let k = 0; k < frames; k++) o[k] = o[k]! / max

  const fr = sampleRate / hop
  const minLag = Math.floor(fr * 60 / 180)
  const maxLag = Math.ceil(fr * 60 / 70)
  let best = minLag, bestVal = -1
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    for (let k = lag; k < frames; k++) sum += o[k]! * o[k - lag]!
    if (sum > bestVal) { bestVal = sum; best = lag }
  }
  let bpm = 60 * fr / best
  if (bpm < 80) bpm *= 2
  if (bpm > 170) bpm /= 2

  const period = (60 / bpm) * fr
  let bestOff = 0, bestSum = -1
  for (let off = 0; off < period; off++) {
    let sum = 0
    for (let p = off; p < frames; p += period) sum += o[Math.round(p)] ?? 0
    if (sum > bestSum) { bestSum = sum; bestOff = off }
  }
  return { bpm: Math.round(bpm * 10) / 10, firstBeatSec: bestOff / fr }
}
```

## C4. Snap to beat
```ts
export function snapToBeat(sec: number, bpm: number, firstBeatSec: number): number {
  const beat = 60 / bpm
  const bar = beat * 4
  const k = Math.round((sec - firstBeatSec) / bar)
  return Math.max(0, firstBeatSec + k * bar)
}
```
Apply to local-file songs: `entry_sec = snapToBeat(entry_sec)`, `exit_sec = snapToBeat(exit_sec)` (bar-level snap), keep `exit > entry + 20`.

## C5. Tempo nudge (WebAudioDeck only)
Add `setRate(r: number)` to `WebAudioDeck`: set `src.playbackRate.value = r` (and remember it for `getTime()`: time advances `r` times faster, so `getTime = offset + (ctx.currentTime - startedAt) * rate`; when rate changes mid-play recompute offset first).
During a crossfade: if both songs have `bpm` and `|a-b|/a <= 0.06` (check also half/double), set incoming rate = `outgoing.bpm / incoming.bpm` at the start and ramp it linearly back to 1.0 over the next 8 seconds. Skip if ratio is outside 0.94–1.06.

## C6. Transition styles (choose per handoff)
| Situation | Style |
|---|---|
| tempo compatible (within 6%) | long blend 3 s + tempo nudge |
| energy jump up >= 3 | quick 0.8 s cut with a small filter sweep up |
| energy drop >= 3 | 2 s fade, outgoing low-pass filtering down (BiquadFilter lowpass 20 kHz -> 400 Hz) |
| otherwise | standard equal-power 1.5 s |
Filters only exist in Web Audio mode. In YouTube mode always use the standard fade.

## C7. Manual QA for Phase 9
Drop 4 local songs with known BPM (e.g. 100, 128, 128, 150). Check that estimated BPM is within 3 BPM (or exactly double/half). Listen to the transitions: beats should not "flam".
