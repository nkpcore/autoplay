# 03 — Setup and Folder Layout

## 1. Requirements on the human's computer
- Node.js 20 or newer (`node -v`)
- npm (comes with Node)
- Git
- A Chrome-based browser for testing. Also test on a real iPhone before finishing.

## 2. Create the project (run exactly these commands)

```bash
npm create vite@latest partyaux -- --template react-ts
cd partyaux
npm install
npm install zustand react-router-dom
npm install tailwindcss @tailwindcss/vite
npm install vite-plugin-pwa -D
npm install @supabase/supabase-js qrcode
npm install -D @types/youtube @types/qrcode
```

Allowed libraries (nothing else without asking the human):
`react`, `react-dom`, `react-router-dom`, `zustand`, `tailwindcss`, `@tailwindcss/vite`, `vite-plugin-pwa`, `@supabase/supabase-js`, `qrcode`, `@types/youtube`, `@types/qrcode`.

## 3. Tailwind setup (Tailwind v4 style)

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

`src/index.css` (replace everything):
```css
@import "tailwindcss";

:root { color-scheme: dark; }
html, body, #root { height: 100%; }
body { background: #07060b; color: #f4f1ff; font-family: system-ui, sans-serif; }
```

Make sure `src/main.tsx` has `import './index.css'`.

## 4. TypeScript strictness
In `tsconfig.app.json` keep `"strict": true`. Add under `compilerOptions`:
```json
"noUncheckedIndexedAccess": true
```
(This makes array access return `T | undefined`, so you must handle missing items. This prevents many crashes.)

## 5. Environment variables
Create `.env.local` (never commit):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
Create `.env.example` with the same keys but empty. Add `.env.local` to `.gitignore`.
Code must work when these are empty: telemetry and rooms simply turn off.

## 6. Folder layout to create now (empty files are fine)

```
partyaux/
  public/
    songs.json
    _redirects                 -> content: /*  /index.html  200
  scripts/
    tuneFromEvents.mjs
  .github/workflows/
    tune.yml
    keepalive.yml
  src/
    main.tsx
    App.tsx
    index.css
    config.ts
    data/      types.ts  loadSongs.ts  validate.ts
    engine/    types.ts  Engine.ts  YouTubeDeck.ts  WebAudioDeck.ts
               youtubeApi.ts  crossfade.ts  platform.ts
    planner/   prng.ts  filters.ts  arc.ts  planSet.ts  searchSongs.ts
    analysis/  bpm.ts  bpm.worker.ts  loudness.ts
    state/     useStore.ts
    services/  telemetry.ts  supabase.ts  rooms.ts  mySets.ts
    ui/        Waveform.tsx  Glow.tsx  QueueList.tsx  SongRow.tsx
               Hotkeys.tsx  StartGate.tsx  NowPlaying.tsx  PlayerTiles.tsx
    pages/     Home.tsx  Wizard.tsx  Player.tsx  Tune.tsx  Join.tsx  MySets.tsx
  docs/        (copy this documentation pack here)
```

## 7. config.ts (constants in ONE place)

```ts
export const CONFIG = {
  SHOW_PLAYERS: true,          // keep true. Visible players at least 200x200 px.
  FADE_MS: 1500,               // crossfade length
  TICK_MS: 200,                // master timer
  FADE_STEP_MS: 40,            // volume update interval during fade
  CUT_GUARD_SEC: 1.5,          // never cut closer than this to the song's end
  LOAD_WATCHDOG_MS: 20000,     // give up on a source after this
  SET_SIZE: 30,                // songs per generated batch
  MIN_VOTES_TO_TUNE: 15,       // sessions needed to move a cue
} as const
```

## 8. Scripts to expect in package.json
- `npm run dev` start dev server (http://localhost:5173)
- `npm run build` production build into `dist/`
- `npm run preview` serve the build locally

## 9. Git
```bash
git init
git add .
git commit -m "scaffold"
```
Commit after every finished task with message `T<number>: <short title>`.
