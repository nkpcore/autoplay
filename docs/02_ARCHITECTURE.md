# 02 — Architecture

## 1. Big picture

```
                         BROWSER (the whole app runs here)
 +--------------------------------------------------------------------------+
 |                                                                          |
 |  UI LAYER (React)                                                        |
 |  Start screen | Wizard | NowPlaying | Queue | Search | MySets | Tune     |
 |        |                 ^                                               |
 |        v                 | subscribes to                                 |
 |  STATE (Zustand store)  <---------------+                                |
 |   - session, queue, nowPlaying, status  |                                |
 |        |                                |                                |
 |        v   commands (play, skip, ...)  | events (live, holding, ...)    |
 |  ENGINE LAYER (plain TypeScript, no React)                               |
 |   Engine ----controls----> Deck A      Deck B                            |
 |     |                       |            |                               |
 |     |                 YouTubeDeck or WebAudioDeck (same interface)       |
 |     v                                                                    |
 |  PLANNER (set generator, pure functions + seeded PRNG)                   |
 |                                                                          |
 |  DATA: public/songs.json (static)    localStorage (sets, guest id)      |
 |                                                                          |
 +----------------------------+---------------------------------------------+
                              | optional, free tiers
        +---------------------+------------------------+
        |                     |                        |
   Supabase table         Supabase Realtime       GitHub Actions
   `events` (insert)      (guest rooms)           nightly cue-tuning PR
```

Key point: **there is no custom server.** Everything is a static site plus optional Supabase and GitHub Actions.

## 2. Layers and their rules

| Layer | Folder | May import from | Must NOT import |
|---|---|---|---|
| Types/data | `src/data` | nothing | React, engine |
| Engine | `src/engine` | `src/data` | React, Zustand, UI |
| Planner | `src/planner` | `src/data` | React, engine |
| State | `src/state` | engine, planner, data | UI components |
| UI | `src/ui`, `src/pages` | everything above | — |
| Services | `src/services` (telemetry, rooms) | data | UI |

The engine has no knowledge of React. The UI talks to the engine only through the store or the `Engine` public methods.

## 3. Engine state machine

```
          start()                 tick: time >= cutPoint
 idle ----------> playing ---------------------------------+
                    ^  |                                    |
          resume()  |  | pause()                            v
                    |  v                      next deck status?
                  paused                      |-- ready ----> fading --(1.5s)--> playing (decks swapped)
                                              |-- loading ---> holding (live keeps playing, retry each tick)
                                              |-- error ------> skip that song, preload another
```

States: `idle | playing | paused | fading | holding | ended`.
Rules:
- Only `playing` or `holding` states run the cut-point check.
- `skip()` while `fading` is ignored.
- `pause()` while `fading` first finishes the fade instantly (set final volumes) and then pauses.

## 4. Data flow of one song change
1. Live deck plays song N. Engine immediately preloads song N+1 into the idle deck (muted, volume 0, loaded at `entry_sec`, then paused and sought to `entry_sec`, status `ready`).
2. Every 200 ms `tick()` computes `cutPoint = min(exit_sec, duration - 1.5)`.
3. When `getTime() >= cutPoint` and idle deck is `ready`: `crossfade()`.
4. Crossfade: idle deck `play()`, unmute, then every 40 ms set gains with equal-power curves for 1.5 s.
5. At the end: old deck paused + reset; decks swap roles; `index++`; preload song N+2; emit `live` event.

## 5. Equal-power crossfade (why)
Linear fades dip about 3 dB in the middle. Use:
- incoming gain = `sin(p * PI/2)`
- outgoing gain = `cos(p * PI/2)`
with `p` going 0 -> 1. Because sin² + cos² = 1 the total loudness stays constant.

## 6. Three playback modes behind one interface
All decks implement the same `Deck` interface (see 05). So `Engine` does not care about the source.
1. `YouTubeDeck`: IFrame API. Free catalog. Visible player. No fine volume on iPhone.
2. `WebAudioDeck`: decoded local files via Web Audio API. Best quality.
3. (Optional later) Spotify deck. Do NOT build unless the human asks.

## 7. Modules map (what files exist)

```
src/
  main.tsx, App.tsx, router
  data/        types.ts, loadSongs.ts, validate.ts
  engine/      types.ts, Engine.ts, YouTubeDeck.ts, WebAudioDeck.ts,
               youtubeApi.ts, crossfade.ts, events.ts, platform.ts
  planner/     prng.ts, filters.ts, arc.ts, planSet.ts, searchSongs.ts
  analysis/    bpm.worker.ts, bpm.ts, loudness.ts          (Phase 6/9)
  state/       useStore.ts
  services/    telemetry.ts, supabase.ts, rooms.ts, mySets.ts
  ui/          Waveform.tsx, Glow.tsx, QueueList.tsx, SongRow.tsx, Hotkeys.tsx ...
  pages/       Home.tsx, Wizard.tsx, Player.tsx, Tune.tsx, Join.tsx, MySets.tsx
public/        songs.json, manifest, icons, _redirects
scripts/       tuneFromEvents.mjs
.github/workflows/  tune.yml, keepalive.yml
```

## 8. Security and abuse basics
- Supabase `events` table: anonymous users may only INSERT, never read (Row Level Security).
- Guest messages are validated by the host before they change the queue.
- Never trust numbers from the network: clamp seconds to `[0, duration]`.
