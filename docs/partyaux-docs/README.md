# PartyAux — Build Docs Pack

An autonomous party DJ for the browser: hook-first playback, dual-deck equal-power crossfades, energy-arc set planning, guest QR rooms, beat-aware mixing. Built free (Cloudflare Pages + Supabase free tier + GitHub Actions).

## For the human
1. Create a new project folder and unzip this pack into it as `docs/`.
2. Open your coding agent (Antigravity / Gemini) with that folder.
3. Send the MASTER PROMPT from `13_AGENT_PROMPTS.md`, then phase prompts one by one.
4. You supply: song data (YouTube IDs + cue seconds, using the Tune tool), a Supabase project (Phase 7+), and testing on a real phone.

## Reading order
00 -> 01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 07 -> 08 -> 09 -> 10 (task list) -> 11 -> 12 -> 13

## Estimated effort
Phases 0–5 (a working party DJ): about 4–6 weekends with an AI agent plus 1–2 weeks of evenings to tune ~150 songs.
Phases 6–9 (local mode, telemetry, rooms, beats): another 6–8 weekends.

## Honest limits
- YouTube mode: terms-of-service risk if the player is hidden, no volume control on iPhone, some songs not embeddable.
- Cue times are human work; the agent cannot hear music.
- Beat analysis works only for local files.
- Tip for weaker agents: give one task at a time and always ask for evidence (what they ran, what they saw).
