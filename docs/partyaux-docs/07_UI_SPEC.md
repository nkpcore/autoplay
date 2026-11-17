# 07 — UI Spec

Design feel: dark, neon, party. Mobile first (host often uses a phone). Big tap targets (min 44 px). Tailwind utility classes only.

## 1. Routes (react-router)
| Path | Page | Purpose |
|---|---|---|
| `/` | Home | Logo, "Start" -> wizard, "My sets", "Use my own music" |
| `/wizard` | Wizard | 4 questions, shows result count |
| `/play` | Player | Now playing + queue (needs a queue in store; else redirect to `/`) |
| `/tune` | Tune | Curator tool (see 08) |
| `/sets` | MySets | Saved sets |
| `/join/:roomId` | Join | Guest page (Phase 8) |
| `/engine-test` | EngineTest | Temporary dev page (remove before deploy) |

## 2. Wizard (4 steps, one question per screen, big buttons)
1. **Languages** (multi-select chips; options come from the languages present in `songs.json`, with counts).
2. **Vibe** (multi-select; options come from subtypes of the chosen languages).
3. **Night phase** (single): Warming up, Peak, Winding down, Only bangers.
4. **Crowd** (single): Small (4–6), Medium (10–20), Large (20+).
Bottom: "Build my set" button disabled until step 1 has a choice. Show a back button. Save answers to `pa.lastAnswers`.

## 3. StartGate (the user-gesture screen)
Full-screen overlay: big button "Start the party". On click (this click is the gesture that unlocks audio):
1. Create decks (`createDecks`), for local mode also create `AudioContext` and `resume()` it.
2. Call `engine.start(queue)`.
Only after this click may any video play.

## 4. Player page layout (portrait phone)
```
+--------------------------------------+
| [glow background, full screen]       |
|  A  B  player tiles (small, 200x200) |
|                                      |
|   NOW PLAYING                        |
|   Kala Chashma                       |
|   Amar Arshi, Badshah...             |
|   chips: HINDI  DANCE  E10           |
|                                      |
|   [ waveform, 88 bars, tap/drag ]    |
|   0:22 ----------------------- 2:09  |
|                                      |
|   [Pause] [Skip] [Full track]        |
|                                      |
|   UP NEXT (list)   [+ Add song]      |
+--------------------------------------+
```
Status line under the title: normal -> nothing; `holding` -> "Next track is still loading, riding this one a little longer"; `unavailable` -> toast "Skipped a song that can't be played".

## 5. Glow — `Glow.tsx`
A fixed full-screen radial gradient behind everything that pulses.
Pulse duration in seconds: `2.6 - 0.17 * energy` (energy 10 -> 0.9 s, energy 2 -> 2.26 s).
Implementation: CSS keyframes `pulse` scaling 1 -> 1.15 and opacity 0.35 -> 0.7. Set `style={{ animationDuration: `${2.6 - 0.17 * energy}s` }}`. Hue by language (hindi = magenta, punjabi = orange, english = cyan, other = violet). Pause the animation when engine state is `paused`.

## 6. Waveform — `Waveform.tsx`
88 vertical bars drawn on a `<canvas>` (or 88 divs).
- If `cue.heat` exists (length 100): resample to 88 bars by averaging, normalize to 0..1.
- Else procedural fallback seeded by `song_id` so the same song always looks the same:

```ts
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export function fallbackBars(cue: Cue): number[] {
  let l = hash(cue.song_id) || 1
  const scale = 0.45 + 0.05 * cue.energy
  const titleShift = hash(cue.title) % 7
  return Array.from({ length: 88 }, (_, n) => {
    const r = n / 87
    l = Math.imul(l ^ (l >>> 13), 0x5bd1e995) >>> 0
    const envelope = Math.min(1, 6 * r, (1 - r) * 8)
    const wobble = 0.65 + 0.35 * Math.sin(r * Math.PI * 5 + titleShift)
    const noise = 0.55 + 0.45 * ((l % 1000) / 1000)
    return Math.max(0.08, envelope * wobble * scale * noise)
  })
}
```
- Bars before the playhead are bright; after are dim. The region between `entry_sec` and `exit_sec` has a subtle highlighted background so the user can see the planned hook.
- Pointer events: on pointerdown/move compute `sec = (x / width) * duration`; on pointerup call `engine.seekLive(sec)` (one call per drag, on release).
- Update the playhead with `requestAnimationFrame` reading `engine.live.getTime()` (do NOT put the time in React state each frame; use a ref and draw to canvas).

## 7. Hotkeys — `Hotkeys.tsx` (attach `keydown` on `window`, ignore when focus is in an input)
| Key | Action |
|---|---|
| Space or `k` or MediaPlayPause | `engine.togglePause()` |
| `s` or MediaTrackNext | `engine.skip()` |
| `f` | `engine.togglePlayFull()` |
| `/` | focus search box |
Always `preventDefault()` for Space so the page does not scroll.

## 8. Queue list
Each row: title, artist, energy badge, a small tag if `source` is `guest`. Buttons: "Play next", "Remove" (not for the song currently loaded in the idle deck; if removed, call `playNext` logic to reload). Drag-reorder is NOT required.

## 9. Search
Input at top of queue. Results list (max 20) with "Add to end" and "Play next".

## 10. My sets
- Save: name input -> store `{id, name, answers, songIds}` in `pa.mySets`.
- List: each set has Play, Rename, Delete, Copy link.
- Share link format: `/play?ids=a,b,c` (comma-separated song_ids). On load, map ids to cues, ignore unknown ids.

## 11. Wake lock + Media Session (T30)
```ts
let lock: WakeLockSentinel | null = null
export async function keepAwake() {
  try { lock = await navigator.wakeLock.request('screen') } catch { /* unsupported or denied */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && lock?.released) void keepAwake() })

export function setMediaSession(cue: Cue, h: { play: () => void; pause: () => void; next: () => void }) {
  if (!('mediaSession' in navigator)) return
  navigator.mediaSession.metadata = new MediaMetadata({ title: cue.title, artist: cue.artist })
  navigator.mediaSession.setActionHandler('play', h.play)
  navigator.mediaSession.setActionHandler('pause', h.pause)
  navigator.mediaSession.setActionHandler('nexttrack', h.next)
}
```
Call `keepAwake()` on Start. Call `setMediaSession` on every `live` event.

## 12. PWA (T31)
Use `vite-plugin-pwa` with `registerType: 'autoUpdate'`, a manifest (name, short_name, `display: 'standalone'`, `theme_color: '#07060b'`, 192 and 512 px icons). Cache the app shell and `songs.json` (StaleWhileRevalidate). Never cache YouTube or Supabase requests.

## 13. Accessibility and polish checklist
- Buttons have `aria-label`s. Focus ring visible.
- Color contrast readable on dark.
- Respect `prefers-reduced-motion`: disable glow animation.
- Loading states: skeleton for song list; spinner on "Build my set".
- Empty states: "No songs match. Try more languages."
