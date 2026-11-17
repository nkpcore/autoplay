# 10 — BUILD TASKS (EASY -> HARD)

Do the tasks IN ORDER. For each task: read "Goal", do "Steps", check every "Done when", commit (`T<nn>: title`), tick `PROGRESS_CHECKLIST.md`.
If a task needs data you do not have (YouTube IDs, cue seconds, API keys) -> STOP and ask the human.

Legend: [E] easy, [M] medium, [H] hard.

---
## PHASE 0 — SETUP

### T01 [E] Scaffold project
Steps: run the commands in `03_SETUP_AND_FOLDERS.md` section 2. Run `npm run dev`.
Done when: browser shows the default Vite page at http://localhost:5173 with no console errors.

### T02 [E] Tailwind + config.ts
Steps: apply section 3 and 7 of doc 03. Replace `App.tsx` with a `<h1 className="text-3xl font-bold p-6">PartyAux</h1>`.
Done when: dark background, white bold heading, `CONFIG` file exists and compiles (`npm run build` passes).

### T03 [E] Folders + router skeleton
Steps: create all folders/files from doc 03 section 6 (each page exports a component that renders its name). Add `react-router-dom` routes from doc 07 section 1 in `App.tsx` using `BrowserRouter`.
Done when: visiting `/`, `/wizard`, `/play`, `/tune`, `/sets`, `/engine-test` each shows its page name.

---
## PHASE 1 — DATA

### T04 [E] Types
Steps: copy `src/data/types.ts` from doc 04 section 1 exactly.
Done when: `npm run build` passes.

### T05 [M] Validation + loadSongs
Steps: implement `validateCue` and `loadSongs` (doc 04 section 2) and the helpers `clamp`, `cutPoint` (section 6). Copy `songs.sample.json` to `public/songs.json`.
Done when: on `/engine-test` page, a button "Load songs" prints in the page: number valid, number dropped. The `FILL-ME` sample entry is dropped with a console warning (its YouTube ID is not 11 chars).

### T06 [E] Seed songs (HUMAN SUPPLIES)
Steps: ask the human for at least 5 real songs: YouTube ID(s), entry/exit seconds, language, subtype, energy, era. Put them in `public/songs.json`.
Done when: `loadSongs()` returns >= 5 valid cues.

---
## PHASE 2 — YOUTUBE ENGINE (use doc 05)

### T07 [E] YouTube API loader
Steps: write `youtubeApi.ts` (doc 05 section 3).
Done when: calling `await loadYouTubeApi()` twice in the console resolves both times, and only ONE `<script src="https://www.youtube.com/iframe_api">` exists in the DOM.

### T08 [M] YouTubeDeck: play one cue
Steps: write `types.ts` (engine) and `YouTubeDeck.ts` (doc 05 sections 1 and 4). On `/engine-test` add a visible 200x200 mount div, a "Start" button that creates one deck, `load(cue1, cue1.entry_sec)`, `setGain(1)`, `play()`.
Done when: clicking Start plays song 1 starting at its `entry_sec` (check by ear / by showing `getTime()` on screen updating every 200 ms).

### T09 [M] Preload and pause at entry
Steps: create TWO decks. Deck A plays cue1. Deck B calls `load(cue2, cue2.entry_sec)` while A plays.
Done when: after a few seconds the page shows `Deck B status: ready`, and `B.getTime()` stays constant near cue2.entry_sec (it is paused). You hear nothing from B.

### T10 [M] Manual crossfade button
Steps: write `crossfade.ts`. Add a "Crossfade now" button that calls `equalPowerFade` swapping A->B with 1500 ms.
Done when: pressing it smoothly fades A out and B in with no loudness dip and no gap. Log shows gains reaching exactly 1 and 0.

### T11 [H] Engine + automatic tick handoff
Steps: write `Engine.ts` (doc 05 section 6). Replace the manual test code with `new Engine([deckA, deckB])` and `engine.start(cues)`. Print events in a log.
Done when: with 5 cues, songs change automatically at each `exit_sec`, each new song starts at its `entry_sec`, log shows `live` then `cut` then `live`...

### T12 [M] Holding (buffer guard)
Steps: ensure the `holding` logic works. To test, temporarily add `await new Promise(r => setTimeout(r, 20000))` inside `YouTubeDeck.load` for song 3, then remove it.
Done when: log shows `holding` once, the current song keeps playing past `exit_sec`, and handoff happens as soon as the next deck is ready. Test code removed.

### T13 [M] Fallback IDs + watchdog
Steps: verify `onError` and watchdog logic. Test: make a cue whose first ID is `AAAAAAAAAAA` (invalid) and second is a good ID.
Done when: the song plays using the second ID. Then test a cue with only invalid IDs: log shows `unavailable`, the song is skipped, playback continues.

### T14 [E] Start gate
Steps: `StartGate.tsx` full-screen button "Start the party" that creates decks and starts the engine (doc 07 section 3).
Done when: nothing plays before the click; after the click music starts on desktop Chrome AND on a phone browser.

### T15 [M] Pause / resume / skip / full-track + hotkeys
Steps: implement controls in Engine (already in reference) and `Hotkeys.tsx` (doc 07 section 7). Add buttons on the test page.
Done when: Space toggles pause, `s` skips with a quick 0.8 s fade, `f` toggles full-track (the cut point moves to end - 1.5 s). Pausing during a fade works without glitches.

### T16 [M] iPhone detection + hard-cut fallback
Steps: write `platform.ts` (doc 05 section 2). Engine already chooses `useHardCut`. Add a small banner on iOS YouTube mode: "On iPhone, songs switch with a quick cut. Use 'My own music' for smooth mixing."
Done when: on a desktop you can force hard-cut with `?hardcut=1` and hear a clean cut with no overlap. Test on a real iPhone if the human has one.

---
## PHASE 3 — TUNE TOOL (use doc 08)

### T17 [M] Tune page: player + inputs
Steps: `/tune` page with ID/URL input (extract ID with regex `/(?:v=|youtu\.be\/|embed\/)?([A-Za-z0-9_-]{11})/`), a 16:9 visible YouTube player (a single IFrame player is fine here), time display, form fields.
Done when: pasting a link loads the video, shows duration read from the player, and the form fields exist.

### T18 [M] Tune hotkeys + save + export
Steps: implement all hotkeys, Preview, Save to `pa.tune.edits`, Export and Import JSON (doc 08).
Done when: the human can tune 3 songs, export, replace `public/songs.json`, reload the engine test, and hear the new cue points.

---
## PHASE 4 — SET GENERATOR (use doc 06)

### T19 [E] Seeded PRNG
Steps: `prng.ts` from doc 06.
Done when: `mulberry32(42)` called 5 times gives the same 5 numbers on every run.

### T20 [E] Filters
Steps: `filters.ts` + relax logic.
Done when: filtering by `['hindi']` returns only Hindi songs; with nothing matching returns a relaxed list plus a note.

### T21 [H] Energy-arc planner
Steps: `arc.ts`, `planSet.ts`, `searchSongs.ts`, `selfTest.ts` (doc 06). Run self tests in the console.
Done when: all 5 self-tests print PASS.

### T22 [M] Wizard UI
Steps: 4 steps (doc 07 section 2). On "Build my set": call `planSet`, put queue in store, navigate to `/play`.
Done when: choosing Hindi + Dance + Peak + Medium gives a queue of up to 30 songs and `/play` shows the StartGate.

### T23 [M] Seed in URL + load more
Steps: put answers+seed+n in the URL (doc 06 section 5). When fewer than 5 songs remain after the current, append another batch automatically.
Done when: refreshing the page with the same URL rebuilds the same first 30 songs; the queue grows while playing.

---
## PHASE 5 — MAIN UI (use doc 07)

### T24 [M] Player page layout + store
Steps: `useStore.ts` (Zustand): `queue`, `index`, `engineState`, `nowPlaying`, `status message`. Subscribe store to engine events. Build the layout from doc 07 section 4 (text only first).
Done when: title/artist/chips update on every `live` event; Pause/Skip/Full buttons work.

### T25 [E] Glow
Steps: `Glow.tsx` (doc 07 section 5).
Done when: energy 10 song pulses faster than energy 3; pausing stops the pulse.

### T26 [H] Waveform + scrub
Steps: `Waveform.tsx` with fallback bars and `heat` support, playhead via rAF, hook region highlight, drag to seek (doc 07 section 6).
Done when: bars look identical for the same song after reload; dragging moves the song position; one `seek` event is logged per drag.

### T27 [M] Queue list
Steps: `QueueList.tsx` with Play next, Remove.
Done when: removing the song that is preloaded in the idle deck causes the NEXT song to preload instead (no silence or wrong song).

### T28 [M] Search + add
Steps: search box (`/` hotkey), results with Add / Play next.
Done when: typing "kala" finds the matching song and adding it works.

### T29 [M] My sets
Steps: `mySets.ts` + `MySets.tsx`, share link `/play?ids=...`.
Done when: save a set, reload, play it; copy link opens same songs in a new tab.

### T30 [M] Wake lock + Media Session
Steps: doc 07 section 11.
Done when: the phone screen stays on while playing; lock-screen shows title and working play/pause/next on Android Chrome.

### T31 [M] PWA
Steps: `vite-plugin-pwa` config (doc 07 section 12), icons.
Done when: Lighthouse PWA check passes "installable"; app installs to home screen.

---
## PHASE 6 — LOCAL FILES MODE (use doc 05 sections 7–8 and doc 09 part C)

### T32 [M] File import UI
Steps: on Home add "Use my own music": a file input (`accept="audio/*" multiple`). For each `File` create a Cue with `song_id = slug(filename)`, `title = filename without extension`, `artist = 'Unknown'`, `youtube_ids = []` (allowed ONLY in local mode: relax validation with a `local` flag), `duration_sec` filled after decoding, `entry_sec = 0` temporary, `exit_sec = duration - 1.5`, `energy = 7`, `language = 'local'`, `subtype = 'local'`. Keep `Map<song_id, File>` in memory.
Done when: choosing 5 files shows 5 rows with their durations.

### T33 [H] WebAudioDeck
Steps: write `WebAudioDeck.ts` (doc 05 section 7). Test on `/engine-test` with 2 local files.
Done when: crossfade works with exact timing; seeking and pausing work; memory is released on `stop()`.

### T34 [M] Loudness measure + gain
Steps: `loudness.ts`; when a file is imported, decode once to measure and save `gain_db` into its cue.
Done when: a quiet song and a loud song play at similar loudness.

### T35 [M] Deck factory
Steps: `createDecks(mode)` (doc 05 section 8). Add a mode switch on Home. Local mode disables the hard-cut.
Done when: the full Player page works in both modes, including on an iPhone in local mode with smooth crossfades.

---
## PHASE 7 — TELEMETRY (use doc 09 part A)

### T36 [E] Event logger
Steps: `supabase.ts`, `telemetry.ts`. Hook `engine.on(logEvent)`.
Done when: without env vars nothing breaks; with a dummy URL, failures are silent.

### T37 [M] Supabase table + policy (HUMAN does dashboard steps)
Steps: give the human the SQL from doc 04 section 5 and `.env.local` instructions.
Done when: playing songs creates rows in the `events` table; a SELECT from the browser with the anon key returns nothing.

### T38 [H] tuneFromEvents + Actions
Steps: `scripts/tuneFromEvents.mjs`, `tune.yml`, `keepalive.yml` (doc 09 A4–A5). Test locally with fake JSON input first (write the grouping logic as a pure function and test with a hand-made array).
Done when: running the script on a fake dataset of 20 seeks around 65 s proposes moving `entry_sec` toward 65 by at most 10 s; with only 5 seeks it changes nothing.

---
## PHASE 8 — GUEST ROOMS (use doc 09 part B)

### T39 [H] Room create (host)
Steps: `rooms.ts` host side; "Start a room" button on Player page; broadcast `state` once per second when changed.
Done when: host sees a room code; opening two tabs shows channel messages in the console.

### T40 [M] QR + Join page
Steps: QR modal (doc 09 B7), `Join.tsx` with search and request button.
Done when: scanning the QR on a phone opens the join page and shows the host's queue.

### T41 [H] Requests, votes, vetoes
Steps: host validation and queue insertion (doc 09 B5). Guest buttons.
Done when: a guest request appears right after the current song; 3 different guests vetoing skips the current song; duplicate requests add votes, not copies.

### T42 [M] Host rules panel
Steps: UI for `RoomRules` with sensible defaults; approval queue when `approveAll`.
Done when: changing max-requests or blocked subtypes immediately affects new requests.

---
## PHASE 9 — BEATS (use doc 09 part C)

### T43 [H] BPM estimator in a worker
Steps: `bpm.ts` + `bpm.worker.ts`. Run on import for local files, show BPM in the list.
Done when: test songs of known BPM are estimated within 3 BPM or exact half/double.

### T44 [M] Snap cuts to beats
Steps: `snapToBeat`; apply to local songs' entry/exit.
Done when: both values land on bar lines (checked by comparing to `firstBeatSec + k*4*beat`).

### T45 [H] Tempo nudge + transition styles
Steps: `setRate` in `WebAudioDeck`, filter sweep nodes, style chooser (doc 09 C5–C6).
Done when: two tracks at 124 and 128 BPM blend with the beats staying aligned; abrupt energy jumps use the quick cut style.

---
## PHASE 10 — SHIP

### T46 [M] Error and empty states
Steps: friendly messages for: songs.json failed to load, no songs match, YouTube API blocked, all songs unavailable, room offline.
Done when: each case is triggered once on purpose and shows a clear message, never a blank screen.

### T47 [M] Deploy
Steps: follow doc 12.
Done when: the public URL works on desktop and phone; refreshing `/play` does not 404.

### T48 [M] Full QA
Steps: run the whole checklist in doc 11 section 3.
Done when: every box is ticked, remaining issues are listed in `KNOWN_ISSUES.md`.
