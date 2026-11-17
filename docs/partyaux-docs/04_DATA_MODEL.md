# 04 — Data Model

## 1. TypeScript types (`src/data/types.ts`) — copy exactly

```ts
export type Era = 'pre2000' | '2000s' | 'pre2020' | '2020s'
export type Phase = 'warming' | 'peak' | 'winding' | 'bangers'
export type Crowd = 'small' | 'medium' | 'large'

export interface Cue {
  song_id: string            // unique, lowercase, dashes: "kala-chashma-amar-arshi"
  title: string
  artist: string
  youtube_ids: string[]      // mirrors, tried in order. At least 1.
  duration_sec: number       // full length of the video
  entry_sec: number          // where the hook starts
  exit_sec: number           // where to leave the song
  play_full: boolean         // true = ignore exit_sec, play to end
  era: Era
  language: string           // 'hindi' | 'punjabi' | 'english' | 'garba' | 'tamil' | ...
  subtype: string            // 'dance' | 'party' | 'romantic' | 'sufi' | 'hiphop' | ...
  energy: number             // integer 1..10
  tags: string[]
  bpm?: number               // optional, filled by analysis
  camelot?: string           // optional key like "8A"
  gain_db?: number           // optional loudness offset, default 0
  heat?: number[]            // optional 100 numbers 0..1 for waveform shape
  unsure?: boolean           // true = cue not verified by a human
  verified?: boolean         // true = human confirmed
}

export interface Answers {
  languages: string[]        // at least 1
  subtypes: string[]         // may be empty = any
  time: Phase
  crowd: Crowd
}

export interface QueueItem {
  cue: Cue
  source: 'planner' | 'guest' | 'host'
  requestedBy?: string       // guest id
}

export type EngineEvent =
  | { type: 'live'; cue: Cue }
  | { type: 'seek'; cue: Cue; from: number; to: number }
  | { type: 'skip'; cue: Cue; at: number }
  | { type: 'cut'; cue: Cue }
  | { type: 'playfull'; cue: Cue; on: boolean }
  | { type: 'paused'; cue: Cue }
  | { type: 'resumed'; cue: Cue }
  | { type: 'holding'; cue: Cue }
  | { type: 'unavailable'; cue: Cue }
  | { type: 'finished'; cue: Cue }
```

## 2. Validation rules (`src/data/validate.ts`)
Write `validateCue(x: unknown): Cue | null` that returns `null` (and `console.warn`s the reason) if ANY is false:
- `song_id`, `title`, `artist` are non-empty strings
- `youtube_ids` is a non-empty array of strings, each 11 chars
- `duration_sec > 0`
- `0 <= entry_sec < exit_sec <= duration_sec`
- `exit_sec - entry_sec >= 20` (a hook shorter than 20s is almost certainly a typo)
- `energy` integer from 1 to 10
- `language` and `subtype` non-empty strings

`loadSongs()` fetches `/songs.json`, validates each item, drops invalid ones, warns how many were dropped, and returns `Cue[]`. Cache the result in a module variable.

## 3. songs.json format
A plain JSON **array** of Cue objects. See `songs.sample.json`.
Important: ONLY the human edits cue seconds and YouTube IDs (using the Tune tool). The agent never invents them.

## 4. Local storage keys (per device only)
| Key | Value |
|---|---|
| `pa.guestId` | random UUID string for this device |
| `pa.mySets` | JSON array of `{ id, name, answers, songIds, createdAt }` |
| `pa.tune.edits` | JSON map song_id -> edited cue fields (Tune tool progress) |
| `pa.lastAnswers` | last wizard answers |

Every read must be wrapped in try/catch and fall back to a default.

## 5. Supabase SQL (Phase 7 and 8). Run in the Supabase SQL editor.

```sql
-- Telemetry events. Anonymous clients may INSERT only.
create table if not exists public.events (
  id bigint generated always as identity primary key,
  type text not null,
  song_id text,
  from_sec real,
  to_sec real,
  session text,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "anon can insert events"
  on public.events for insert to anon
  with check (
    type in ('live','seek','skip','cut','playfull','paused','resumed','holding','unavailable','finished')
    and (from_sec is null or (from_sec >= 0 and from_sec < 20000))
    and (to_sec   is null or (to_sec   >= 0 and to_sec   < 20000))
  );

create index if not exists events_song_type_idx on public.events (song_id, type, created_at desc);
```

No SELECT policy for `anon`. Only the service-role key (used by GitHub Actions) can read.

Guest rooms (Phase 8) use Supabase **Realtime Broadcast** which needs no table. See 09.

## 6. Cue sanity helper (write it, use it everywhere)
```ts
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function cutPoint(cue: Cue, liveDuration: number, guard = 1.5): number {
  const fullEnd = liveDuration - guard
  if (cue.play_full) return fullEnd
  return Math.min(cue.exit_sec, fullEnd)
}
```
