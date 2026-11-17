# PartyAux · Known Issues & Platform Nuances

This document tracks known browser, OS, and API behaviors documented during QA, along with an explicit audit of what has and has not been tested on real hardware.

---

## Manual Test Status (Real Hardware Verification)

> [!IMPORTANT]
> All core mathematical, state machine, and algorithmic logic are verified via automated headless test suites (`npm test` via Vite SSR in `scripts/testEngine.ts`). **PartyAux has NOT been tested on physical mobile phones, tablets, or sound hardware.**

### Items NOT tested on physical hardware:
1. **Physical iOS Safari Audio & YouTube Autoplay:**
   - Dual YouTube IFrames running simultaneously on real physical iPhones/iPads with iOS Safari autoplay and background audio policies.
   - Hard-cut transition behavior when switching audio streams while outputting through a physical lightning/USB-C 3.5mm aux adapter or Bluetooth speaker.
   - Screen Wake Lock API (`navigator.wakeLock`) behavior on iOS when the device enters low-power battery saving mode or auto-locks.
2. **Physical Android Media Session & Lock-Screen UI:**
   - Physical Android pull-down notification shade and lock-screen widget MediaSession controls (play, pause, next).
   - Bluetooth AVRCP metadata and track duration display on automotive head units, smartwatches, or Bluetooth speakers.
3. **PWA Installation & Standalone Mobile Execution:**
   - "Add to Home Screen" installation flow and standalone window rendering on iOS Safari and Android Chrome.
   - Offline Service Worker asset precaching (`workbox-*.js`, `manifest.webmanifest`, `icon-*.png`) on physical mobile devices.
4. **Physical Mobile Web Worker & Codec Limits:**
   - Importing 50+ local audio files (MP3, AAC, FLAC) simultaneously on memory-constrained mobile devices using `AudioContext.decodeAudioData` and the BPM Web Worker.
5. **Live Multi-Device Supabase Realtime in Physical Venue:**
   - Real-world guest QR-code scanning via native camera apps and simultaneous voting/vetoing across mixed cellular (5G/LTE) and venue Wi-Fi networks connected to an active production Supabase project.
6. **Mobile Network Conditions & Ad Blockers:**
   - YouTube IFrame API script load failures under strict content blockers (e.g. Brave, AdGuard, Safari content blockers) or restrictive cellular data savers.

### Items Verified via Automated Test Suites:
- Equal-power fade mathematical power invariant ($\text{inGain}^2 + \text{outGain}^2 = 1$).
- Engine autonomous state transitions: `idle` $\to$ `playing` $\to$ `fading` $\to$ `live` $\to$ `holding` $\to$ `ended`.
- Holding buffer guard during slow asset loading.
- Instantaneous hard-cut mode deck switching.
- Set Planner PRNG determinism, seed reproducibility, energy arc constraints, and artist spacing.
- BPM estimation algorithm (`estimateBpm`) and musical downbeat quantization (`snapToBeat`).
- Room host logic: guest request vote tracking, priority queue re-sorting (votes descending, timestamp ascending), blocked subtype rejection, max requests per guest enforcement, and veto counter reset on every `'live'` event.
- Engine tempo ramp continuity: tempo ramp runs its full 8 seconds across the 3s handoff without cancellation in `completeHandoff`, continuing into live playback until 1.0 is reached at 8s.
- Engine tempo ramp early cancellation: calling `skip()`, `stopAll()`, or altering deck cue/status immediately resets playback rate to 1 (`setRate(1)`) and cancels the timer.
- Engine queue preloading guards: `preloadNext()` returns immediately when `state === 'fading'`, and suppresses redundant loads when the idle deck already contains the next song in `ready` or `loading` status (verified with 10 consecutive votes causing zero extra loads).

---

## Known Platform Behaviors & Architectural Nuances

### 1. iOS Safari YouTube Volume Restriction
- **Symptom:** Programmatic volume changes (`player.setVolume(v)`) on YouTube IFrames are ignored by iOS Safari due to Apple policy.
- **Handling in PartyAux:** PartyAux detects iOS via `isIOS` and automatically falls back to an instantaneous clean cut (`useHardCut: true`) between tracks without volume overlap. For smooth equal-power crossfading on iPhone, PartyAux provides "Use my own music" (Web Audio mode), which offers full crossfading and loudness normalization across all Apple devices.

### 2. Browser Timer Throttling in Inactive Background Tabs
- **Symptom:** Browsers throttle `setInterval` and `requestAnimationFrame` timers when a tab is completely obscured or in the background.
- **Handling in PartyAux:** PartyAux requests the Screen Wake Lock API (`navigator.wakeLock.request('screen')`) upon party start, and registers Media Session handlers (`navigator.mediaSession`) so audio focus remains active.

### 3. Cross-Origin Audio Analysis Limitation on YouTube
- **Symptom:** Web Audio `AnalyserNode` and buffer decoding cannot directly analyze raw YouTube audio streams due to CORS security restrictions.
- **Handling in PartyAux:** Waveforms for YouTube cues use procedural seed hashing (`fallbackBars`) or pre-calculated heat arrays from curation. High-resolution FFT and BPM analysis workers run directly on user-provided local audio files.

### 4. Supabase Free Tier Auto-Pause
- **Symptom:** Free Supabase projects pause after 7 days of inactivity.
- **Handling in PartyAux:** Included a weekly GitHub Action workflow (`.github/workflows/keepalive.yml`) that pings the project REST API to maintain active status.

### 5. Continuous 8-Second Tempo Nudge Across Deck Handoff
- **Nuance:** During Web Audio transitions between tracks within $\pm 6\%$ BPM, the incoming deck starts nudged to the outgoing track's tempo and smoothly returns to nominal speed over 8 seconds.
- **Handling in PartyAux:** The tempo ramp timer is retained when `completeHandoff` executes, allowing the incoming track to finish its ramp seamlessly after becoming live. If a skip or stop is called, or if the deck is repurposed, `setRate(1)` is immediately enforced.

### 6. Idle Deck Preload Throttling Under High-Frequency Guest Voting
- **Nuance:** When guests rapidly cast votes, the upcoming queue may be recalculated repeatedly, triggering queue notifications.
- **Handling in PartyAux:** `Engine.preloadNext` guards against redundant operations by checking if the engine is currently fading (`state === 'fading'`) or if the idle deck is already loaded or loading the target track.
