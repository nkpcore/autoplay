# 06 — Set Generator Spec (Phase 4)

Pure functions in `src/planner`. No React, no network. Same inputs + same seed = same output.

## 1. Seeded random — `prng.ts`

```ts
/** mulberry32: small, fast, good enough. Returns function giving floats in [0,1). */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}
```
Never use `Math.random()` inside the planner except to create a new seed.

## 2. Filters — `filters.ts`

```ts
export function filterCandidates(all: Cue[], a: Answers, excludeIds: Set<string>): Cue[] {
  return all.filter((c) =>
    !excludeIds.has(c.song_id) &&
    a.languages.includes(c.language) &&
    (a.subtypes.length === 0 || a.subtypes.includes(c.subtype)) &&
    c.youtube_ids.length > 0
  )
}
```
If the result has fewer than 10 songs, relax in this order and note which were relaxed: (1) ignore subtypes, (2) ignore exclude list except the last 10 played. Return a `note` string for the UI ("Not many songs match, mixing in more.").

## 3. Energy arc — `arc.ts`

Target energy for slot `i` of `n` songs:

```ts
export function targetEnergy(phase: Phase, crowd: Crowd, i: number, n: number): number {
  const t = n <= 1 ? 0 : i / (n - 1)            // 0..1 through the batch
  let e: number
  switch (phase) {
    case 'warming':  e = 4 + 3 * t; break                          // 4 -> 7
    case 'peak':     e = 9 + Math.sin(i * 0.9);  break             // ~8..10 with small waves
    case 'winding':  e = 7 - 4 * t; break                          // 7 -> 3
    case 'bangers':  e = 10; break
  }
  const crowdBoost = crowd === 'large' ? 1 : crowd === 'small' ? -0.5 : 0
  return Math.min(10, Math.max(1, e + crowdBoost))
}
```

## 4. Scoring — `planSet.ts`

For slot `i`, given the previous chosen song `prev` (may be undefined) and the history of the last 5 chosen:

```
score = 0
score -= |cue.energy - target| * 2.0              // closeness to the energy curve
score -= (same artist as any of last 5) ? 6 : 0   // avoid artist repeats
score -= (same subtype as last 3 AND all 3 same)  ? 1.5 : 0   // some variety
score += eraBonus                                  // warming: pre2000/2000s +1.5; peak: 2020s/pre2020 +0.5; others 0
score += languageBalance                           // +1 if this language has been played least in the last 5 (only when 2+ languages chosen)
score -= prev && Math.abs(cue.energy - prev.energy) > 4 ? 3 : 0     // avoid sudden whiplash
score += prev && tempoCompatible(prev, cue) ? 1.5 : 0                // only if both have bpm
score += cue.verified ? 0.5 : cue.unsure ? -0.5 : 0                  // prefer verified cues
```
`tempoCompatible(a, b)`: both have `bpm` and `|a.bpm - b.bpm| / a.bpm <= 0.06`, or half/double tempo matches.

Selection per slot: sort candidates by score desc, take top 5, pick one using the seeded rng with weights `[5,4,3,2,1]`. Remove it from the pool.

```ts
export interface PlanResult {
  cues: Cue[]
  note: string
  seed: number
}

export function planSet(
  all: Cue[], answers: Answers, seed: number,
  opts?: { count?: number; exclude?: string[]; previous?: Cue[] }
): PlanResult
```
- `count` defaults to `CONFIG.SET_SIZE`.
- `previous` = recently played songs, used as `prev`/history so "load more" continues smoothly.
- `opening` rule: first song of a brand-new set must have `energy >= target - 1` and prefer `verified`.

## 5. Load more (infinite set)
The URL holds `?l=hindi,punjabi&s=dance,party&t=peak&c=medium&seed=123456&n=1`.
- `n` = batch number (starting 1).
- "Load more" calls `planSet(all, answers, seed + n * 7919, { exclude: allPlayedIds, previous: last5 })` and increments `n`.
- Anyone opening the same URL gets the same first batch. This replaces the server HMAC token from the original idea (no server, so no tampering concern).

## 6. Search — `searchSongs.ts`
Lowercase compare. Match query tokens against `title + artist + tags`. A song matches if every token appears. Rank: title starts-with first, then title contains, then artist contains. Return max 20.

## 7. Unit checks (write as simple assert functions in `src/planner/selfTest.ts`, run in the browser console)
1. Same seed twice returns identical `song_id` list.
2. No two adjacent songs by the same artist when 3+ artists exist.
3. `peak` batch average energy >= 8 when enough songs exist.
4. `winding` batch first energy > last energy.
5. Excluded ids never appear.
