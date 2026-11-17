# PROGRESS CHECKLIST (agent: tick `[x]` after each task is verified)

## Phase 0 — Setup
- [x] T01 Scaffold project
- [x] T02 Tailwind + config.ts
- [x] T03 Folders + router skeleton
## Phase 1 — Data
- [x] T04 Types
- [x] T05 Validation + loadSongs
- [ ] T06 Seed songs.json (human supplies data)
## Phase 2 — YouTube engine
- [ ] T07 YouTube API loader
- [ ] T08 YouTubeDeck: play one cue
- [ ] T09 Preload + pause at entry
- [ ] T10 Two decks + manual crossfade button
- [ ] T11 Tick + automatic handoff
- [ ] T12 Holding (buffer guard)
- [ ] T13 Fallback IDs + watchdog
- [ ] T14 Start gate (user gesture)
- [ ] T15 Pause/resume/skip/full-track + hotkeys
- [ ] T16 iPhone detection + hard-cut fallback
## Phase 3 — Tune tool
- [ ] T17 Tune page basic player
- [ ] T18 Tune hotkeys + export
## Phase 4 — Set generator
- [ ] T19 Seeded PRNG
- [ ] T20 Filters
- [ ] T21 Energy-arc planner
- [ ] T22 Wizard UI
- [ ] T23 Seed in URL + load more
## Phase 5 — Main UI
- [ ] T24 Player page layout + store
- [ ] T25 Glow
- [ ] T26 Waveform + scrub
- [ ] T27 Queue list
- [ ] T28 Search + add
- [ ] T29 My sets (localStorage + share URL)
- [ ] T30 Wake lock + Media Session
- [ ] T31 PWA
## Phase 6 — Local files (Web Audio)
- [ ] T32 File import UI
- [ ] T33 WebAudioDeck
- [ ] T34 Loudness measure + gain
- [ ] T35 Deck factory in Engine
## Phase 7 — Telemetry
- [ ] T36 Event logger
- [ ] T37 Supabase table + policy
- [ ] T38 tuneFromEvents script + GitHub Action
## Phase 8 — Rooms
- [ ] T39 Supabase client + room create
- [ ] T40 QR + Join page
- [ ] T41 Requests + votes + vetoes
- [ ] T42 Host rules
## Phase 9 — Beats
- [ ] T43 BPM estimator worker
- [ ] T44 Snap cuts to beats
- [ ] T45 Tempo nudge + transition styles
## Phase 10 — Ship
- [ ] T46 Error states + empty states
- [ ] T47 Deploy to Cloudflare Pages
- [ ] T48 Full QA checklist (see 11)
