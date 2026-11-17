# 00 — START HERE (Read this first, completely)

You are an AI coding agent. You will build a web app called **PartyAux** (name is changeable).
PartyAux is an "autonomous party DJ" website. It plays songs **starting at the best part (the hook)**,
**stops them when the energy fades**, and **blends one song into the next** with a smooth crossfade.
The host opens it on a phone/laptop connected to speakers. Nobody has to fight over the aux cord.

This documentation pack is written for you step by step, from EASY to HARD.
Follow it in order. Do not skip ahead. Do not "improve" the plan. Do not invent features.

## How to use these documents

| File | What it is | When to read |
|---|---|---|
| 00_START_HERE (this) | Rules + how to work | Now, and whenever you are confused |
| 01_PROJECT_OVERVIEW | What we are building and why | Now |
| 02_ARCHITECTURE | The whole system, boxes and arrows | Now (skim), re-read before each phase |
| 03_SETUP_AND_FOLDERS | Exact commands, folder layout | Before writing any code |
| 04_DATA_MODEL | Types, JSON format, SQL | Before Phase 1 |
| 05_PLAYER_ENGINE_SPEC | The most important file: the audio engine | Before Phase 2 and Phase 6 |
| 06_SET_GENERATOR_SPEC | How the playlist is chosen | Before Phase 4 |
| 07_UI_SPEC | Screens and components | Before Phase 5 |
| 08_TUNE_TOOL_SPEC | Admin tool to set hook times | Before Phase 3 |
| 09_TELEMETRY_ROOMS_BEATS | Events, guest rooms, BPM detection | Before Phases 7, 8, 9 |
| 10_BUILD_TASKS_EASY_TO_HARD | THE TASK LIST. Do tasks in order | Always open |
| 11_TESTING_AND_DEBUGGING | Checks and fixes | After each task |
| 12_DEPLOY_FREE | Free hosting steps | Phase 10 |
| 13_AGENT_PROMPTS | Copy-paste prompts per phase | Optional helper |
| PROGRESS_CHECKLIST.md | Tick boxes as you finish tasks | Update after each task |
| songs.sample.json | Example song data | Phase 1 |

## The 12 golden rules

1. **One task at a time.** Open `10_BUILD_TASKS_EASY_TO_HARD.md`, do the next unchecked task, stop, verify, tick it in `PROGRESS_CHECKLIST.md`.
2. **Every task has "Done when".** The task is NOT done until every "Done when" line is true. Run the app and check.
3. **Never skip a phase.** Later phases depend on earlier ones.
4. **TypeScript strict mode stays ON.** No `any` unless a comment explains why.
5. **No new libraries** beyond those listed in `03_SETUP_AND_FOLDERS.md`. If you think you need one, stop and ask the human.
6. **Do not use the YouTube Data API.** Only the IFrame Player API (`https://www.youtube.com/iframe_api`). No API keys for YouTube.
7. **Never use `localStorage` for anything that must be shared between people.** It is only for per-device things (saved sets, guest id, tune progress).
8. **All timings are in SECONDS (numbers, may have decimals).** Never milliseconds in data. Milliseconds only inside timer code and always named `...Ms`.
9. **Do not put secrets in code.** Supabase URL and anon key come from `import.meta.env.VITE_...`. The service-role key is only in GitHub Actions secrets.
10. **Keep files small.** One responsibility per file. If a file passes about 300 lines, split it.
11. **When something fails, read the error, then read `11_TESTING_AND_DEBUGGING.md`.** Do not guess-and-rewrite everything.
12. **If a document and your memory disagree, the document wins.** If two documents disagree, ask the human.

## Honest warnings (important)

- **YouTube terms.** YouTube's API policy does not allow hiding the player or playing it as audio-only. Our default is a **visible** small player tile (at least 200x200 px, not covered). The code must have a single constant `SHOW_PLAYERS = true`. A hobby/personal project is fine. Do not promise commercial use of YouTube mode.
- **iPhone Safari ignores `player.setVolume()`.** So crossfade does not work for YouTube on iPhone. The engine must detect this and do a quick hard cut with a short gap instead. The **Local Files mode** (Web Audio) works on iPhone and is the best mode.
- **Browsers block autoplay.** Playback must start from a real button tap ("Start the party").
- **Some songs cannot be embedded.** That is why every song has several YouTube IDs (mirrors). The engine must try the next ID on error.
- **Song cue data (entry/exit seconds) is human work.** You (the agent) cannot hear songs. Never invent cue numbers or YouTube IDs. Use only what the human gives you in `songs.json`. If data is missing, say so.

## Definition of "finished"

The project is finished when:
- Phases 0–5 work: a person can answer a wizard, press Start, and hear songs hook-to-hook with smooth crossfades, a glow, a waveform, a queue, hotkeys, saved sets.
- Phase 6 works: the same engine plays the host's own audio files with Web Audio (works on iPhone).
- Phase 7 works: telemetry is stored and a nightly script proposes cue fixes.
- Phase 8 works: guests scan a QR code and request/vote songs.
- Phase 9 works: BPM-aware transitions for local files.
- Phase 10: deployed on free hosting and passes the QA checklist.

## How to report to the human

After each task write 3 lines: what you did, how you checked it, what is next. If blocked, say exactly what you need (a YouTube ID, a decision, an API key).
