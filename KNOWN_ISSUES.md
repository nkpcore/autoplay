# PartyAux · Known Issues & Platform Nuances

This document tracks known browser, OS, and API behaviors documented during QA.

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
