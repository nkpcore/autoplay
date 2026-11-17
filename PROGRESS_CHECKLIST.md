# PROGRESS CHECKLIST (agent: tick `[x]` after each task is verified)

## Phase 0 — Setup
- [x] T01 Scaffold project
- [x] T02 Tailwind + config.ts
- [x] T03 Folders + router skeleton
## Phase 1 — Data
- [x] T04 Types
- [x] T05 Validation + loadSongs
- [x] T06 Seed songs.json (human supplies data)
## Phase 2 — YouTube engine
- [x] T07 YouTube API loader
- [x] T08 YouTubeDeck: play one cue
- [x] T09 Preload + pause at entry
- [x] T10 Two decks + manual crossfade button
- [x] T11 Tick + automatic handoff
- [x] T12 Holding (buffer guard)
- [x] T13 Fallback IDs + watchdog
- [x] T14 Start gate (user gesture)
- [x] T15 Pause/resume/skip/full-track + hotkeys
- [x] T16 iPhone detection + hard-cut fallback
## Phase 3 — Tune tool
- [x] T17 Tune page basic player
- [x] T18 Tune hotkeys + export
## Phase 4 — Set generator
- [x] T19 Seeded PRNG
- [x] T20 Filters
- [x] T21 Energy-arc planner
- [x] T22 Wizard UI
- [x] T23 Seed in URL + load more
## Phase 5 — Main UI
- [x] T24 Player page layout + store
- [x] T25 Glow
- [x] T26 Waveform + scrub
- [x] T27 Queue list
- [x] T28 Search + add
- [x] T29 My sets (localStorage + share URL)
- [x] T30 Wake lock + Media Session
- [x] T31 PWA
## Phase 6 — Local files (Web Audio)
- [x] T32 File import UI
- [x] T33 WebAudioDeck
- [x] T34 Loudness measure + gain
- [x] T35 Deck factory in Engine
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
