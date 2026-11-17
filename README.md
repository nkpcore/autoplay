# PartyAux · Autonomous Party DJ

PartyAux is an autonomous continuous party DJ web application designed to keep dancefloor energy alive without awkward silence, intro bloat, or sudden tempo whiplash. It mixes hook-to-hook using dual-deck equal-power crossfading for both YouTube tracks and local user-provided audio files.

---

## Features

- **Continuous Dual-Deck Mixing:** Automated DJ engine alternates between Deck A and Deck B with smooth equal-power crossfading ($\text{inGain}^2 + \text{outGain}^2 = 1$).
- **Smart Set Planner:** Generates deterministic energy arcs (Warming, Peak, Winding Down) based on crowd size and vibe, preventing artist repetition and energy whiplash.
- **Local Audio Engine:** Web Audio API playback with client-side BPM detection (`estimateBpm`), downbeat quantization (`snapToBeat`), and adaptive 8-second tempo ramping.
- **Host & Guest Rooms:** Supabase Realtime rooms allow guests to scan a QR code, browse available tracks, and submit requests or vote on upcoming songs with host rule guardrails.
- **Curator Tool (`/tune`):** In-browser waveform and playback scrubber to calibrate song hook entry and exit cut points with hotkey shortcuts.
- **Offline-Ready PWA:** Installable Progressive Web App with standalone display and background service worker caching.

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation
```bash
git clone <your-repo-url>
cd partyaux
npm install
```

### Development
Start the local Vite development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Headless Verification Tests
Run the automated test suite verifying equal-power mathematics, engine state machine transitions, BPM estimation, and room host rules:
```bash
npm test
```

### Static Analysis
Run Oxlint across all TypeScript and React sources:
```bash
npm run lint
```

### Production Build & Preview
```bash
npm run build
npm run preview
```
Open [http://localhost:4173](http://localhost:4173) to verify the production bundle.

---

## How to Tune Songs in `/tune`

The `/tune` page enables human curators to verify and calibrate song entry (hook start) and exit (cut point) timestamps.

1. Navigate to `/tune`.
2. Select a song from the catalog sidebar or paste a YouTube video ID/URL in the top bar.
3. Use the following keyboard shortcuts to calibrate:
   - `Space`: Play / Pause video.
   - `ArrowLeft` / `ArrowRight`: Seek 1 second backward / forward.
   - `Shift + ArrowLeft` / `Shift + ArrowRight`: Seek 5 seconds backward / forward.
   - `i` / `I`: Set Hook Entry time to current playhead.
   - `o` / `O`: Set Hook Exit time to current playhead.
   - `p` / `P`: Preview transition into the hook.
   - `Enter`: Save calibrated cue to working catalog (marks `verified: true`, `unsure: false`).
   - `n` / `N`: Jump directly to the next unverified song (`unsure: true`).
   - `e` / `E`: Export merged `songs.json` file.

After tuning, copy the exported JSON to `public/songs.json` to publish the verified timings.

---

## Deployment (Cloudflare Pages)

PartyAux is configured for zero-cost static deployment to Cloudflare Pages.

1. Build the production assets:
   ```bash
   npm run build
   ```
2. Deploy using Wrangler CLI:
   ```bash
   npx wrangler login
   npx wrangler pages project create partyaux --production-branch main
   npx wrangler pages deploy dist --project-name partyaux --branch main
   ```
SPA route redirects are handled automatically via `public/_redirects` (`/* /index.html 200`).

### Optional Supabase Integration
For guest room coordination and anonymous telemetry, create a free project at [Supabase](https://supabase.com):
1. Run the database migration in `supabase/migrations/01_events.sql` via the Supabase SQL Editor.
2. In your local `.env.local` (or Cloudflare Pages environment variables):
   ```env
   VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
   ```
3. Set GitHub Action secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` if using the automated weekly crowd-tuning workflow.

---

## Honest Limits & Known Nuances

- **YouTube Terms & Policies:** PartyAux uses the official YouTube IFrame Player API. Audio is never downloaded, stripped, or stored. Playback requires an active internet connection to YouTube's streaming servers.
- **iPhone / iOS Safari YouTube Limitation:** iOS Safari prohibits programmatic volume manipulation (`setVolume` is ignored on mobile IFrames). When running YouTube mode on iOS, PartyAux automatically falls back to clean hard cuts (`useHardCut: true`) between songs. For continuous equal-power crossfading on iPhone, use the "Use my own music" Web Audio mode.
- **Human-Tuned Timestamps:** All cue timings are human-tuned. Unverified songs (`unsure: true`) are initial approximations and may cut early or start late until confirmed in `/tune`.
- **Real-Hardware Testing Status:** Core mathematical invariants, state transitions, BPM quantization, and queue ordering have been verified with automated headless test suites. **Features have not yet been tested on physical mobile phones, Bluetooth speakers, or automotive head units.**
