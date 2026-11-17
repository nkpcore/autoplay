# 01 — Project Overview

## 1. The problem
At house parties, whoever holds the aux cord plays full songs. Songs have slow intros, long outros, and silence between them. The party loses energy.

## 2. The idea
PartyAux is a virtual DJ in the browser:
1. **Hook-first playback.** Each song has `entry_sec` (where the best part starts) and `exit_sec` (where it should end). We start at `entry_sec`, cut at `exit_sec`.
2. **Two decks.** Deck A plays now. Deck B silently loads the next song and waits at its start point. At the cut point we crossfade A -> B over ~1.5 seconds.
3. **Smart sets.** A wizard asks languages, genres, night phase (warming up / peak / winding down / only bangers), crowd size. A generator builds a playlist whose energy follows a curve.
4. **Guests.** (Later phase) Guests scan a QR code to request and vote songs.
5. **Self-improving cues.** (Later phase) When people drag the waveform to the real drop, we log it and a nightly script proposes better cue times.

## 3. What makes this BETTER than a plain playlist or the original NAUX idea
| Improvement | Phase |
|---|---|
| Local-files mode with Web Audio: legal, works on iPhone, exact crossfades | 6 |
| Loudness matching so no song is suddenly louder | 6 |
| Energy-arc set planner (not just random) | 4 |
| Guest QR room: requests + votes + vetoes | 8 |
| Beat-aware cut points and BPM matching | 9 |
| Hardened crowd-tuned cues (median, minimum votes, human review by Pull Request) | 7 |
| Visible-player mode (lower terms-of-service risk) | 2 |
| PWA, screen wake lock, lock-screen controls | 5 |

## 4. Non-goals (do NOT build these)
- No audio file hosting or uploading to a server. Local files stay in the browser.
- No downloading or ripping YouTube audio. Ever.
- No user accounts in v1 (optional in Phase 10 only if the human asks).
- No payments.
- No native mobile app. Web only.

## 5. Glossary
- **Cue**: one song record with its timings and metadata.
- **Deck**: one player. We have two (A and B).
- **Live deck**: the deck currently audible. **Idle deck**: the other one.
- **Preload**: load next song muted, pause at its entry time, status `ready`.
- **Handoff / crossfade**: switching live deck from one to the other.
- **Holding**: next deck is not ready at cut time, so the live deck keeps playing a bit longer.
- **Mirror**: an alternative YouTube video ID for the same song.
- **Energy**: number 1 (calm) to 10 (maximum banger).
- **Pack**: a JSON file of songs for one taste (e.g. "Bollywood party").
- **Seed**: a number that makes "random" choices repeatable.
- **Hook**: the most exciting part of the song (drop/chorus).

## 6. Users
- **Host**: runs the party from one device connected to speakers.
- **Guest**: joins a room by QR, requests/votes (Phase 8).
- **Curator**: the human who tunes cue times with the Tune tool.
