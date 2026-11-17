# 08 — Tune Tool Spec (Phase 3)

Purpose: let the human (curator) set `entry_sec` and `exit_sec` for each song quickly by listening. The quality of the product depends on this tool. Route: `/tune`. Local-only workflow; the result is exported as JSON and pasted into `public/songs.json`.

## 1. Workflow for the human
1. Open `/tune`.
2. Add a song: paste a YouTube URL or ID -> tool extracts the 11-char ID, loads it, reads `getDuration()`.
3. Fill title, artist, language, subtype, energy, era (form fields).
4. Press play. Listen. At the moment the hook starts press `i` (sets entry). At the moment to leave press `o` (sets exit).
5. Press `p` to **preview the transition**: plays from `entry_sec - 0` for 5 s, then from `exit_sec - 5` for 5 s, so the human hears both ends.
6. Press `Enter` to save the song to the working list (localStorage `pa.tune.edits`), mark `verified: true`, `unsure: false`.
7. Press `e` (or button "Export") to download `songs.json`.

## 2. Page layout
```
[ YouTube ID/URL input ] [Load]
[ big visible player 16:9 ]
[ time 1:05.2 / 3:12 ]  [ progress bar clickable ]
entry: 22.0  [Set (i)] [-1s] [+1s]     exit: 129.0  [Set (o)] [-1s] [+1s]
form: title, artist, language, subtype, energy(1-10), era, mirrors (extra IDs, one per line)
[Preview (p)] [Save (Enter)] [Next unsure song (n)] [Export JSON (e)]
list of all songs: filter by "unsure only"
```

## 3. Hotkeys (ignore when typing in an input)
| Key | Action |
|---|---|
| Space | play/pause |
| `i` | entry = current time (rounded to 0.1 s) |
| `o` | exit = current time |
| Left / Right | seek -1 s / +1 s |
| Shift+Left/Right | seek -5 s / +5 s |
| `p` | preview both ends |
| Enter | save song |
| `n` | load next song with `unsure: true` |
| `e` | export |

## 4. Rules
- Validate with `validateCue` before saving. Show errors in red.
- Duration must come from the player (`getDuration()`), not typed manually.
- Merge on export: take the songs from `public/songs.json` (fetched), override with edits from localStorage by `song_id`, add new songs, sort by `song_id`, pretty-print with 2 spaces.
- Never auto-save to disk. Only the Export button writes a file (via `Blob` + `<a download>`).
- Also provide "Import JSON" (file input) to load an existing `songs.json` into the tool.

## 5. Quick tuning tips for the human (put in the page as a collapsible help)
- Hook = where a crowd would start dancing: the first chorus/drop, not the intro.
- Exit = right after the chorus ends or before energy drops. 90–150 s of music per song keeps a party moving.
- Mirrors: add 2 extra IDs (official video, lyric video, audio upload). If one is blocked, the next one plays.
- Mark energy honestly: 10 = everyone screams, 5 = background, 2 = slow ballad.
- Aim for 150 verified songs before inviting people.
