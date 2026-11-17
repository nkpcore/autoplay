# 11 — Testing and Debugging

## 1. Always-on debug panel
In development show a small collapsible panel (bottom of Player page when `import.meta.env.DEV`) with: engine state, live deck name, live time / cut point, idle deck status, queue length, last 10 events. Most bugs are visible here immediately.

## 2. Common problems and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| No sound after Start | Audio started outside the click handler | Create decks and call `engine.start` directly inside the click handler (before any other long `await`) |
| Next deck never `ready` | Player stuck loading; state PLAYING never fired | Check watchdog; check embeds; open the video URL in another tab to see if it is blocked; try mirror IDs |
| Song starts at 0:00, not at hook | `startSeconds` ignored or preload logic skipped | Make sure `seekTo(startSec, true)` runs after PLAYING while paused |
| Tiny silence between songs | Incoming deck started late | Preload earlier; start `incoming.play()` BEFORE the fade; verify status was `ready` |
| Loudness dips mid-fade | Linear fade used | Use sin/cos (equal power) |
| Fade jumps | Timers throttled in a background tab | Keep the tab visible; use wake lock; document limitation |
| iPhone: both songs audible at once | `setVolume` ignored on iOS | Hard-cut mode (T16) or local mode |
| `YT is not defined` | API not loaded yet | Always `await loadYouTubeApi()` |
| Error 101/150 | Label disabled embedding | Add mirror IDs; engine already falls through |
| Error 2 | Invalid ID | Check 11 chars; remove query params |
| Waveform flickers | React re-render per frame | Draw on canvas with a ref, not React state |
| Local file: "Unable to decode audio data" | Unsupported codec (some .m4a/.wma) | Tell the user to use MP3/AAC/WAV/FLAC; show a friendly error |
| Local file: clicks at start/end | Hard gain steps | Always change gain via the fade, never jump from 0 to 1 except at the end of a fade |
| Rooms: no messages | Wrong channel name, or env vars missing | Log channel status `SUBSCRIBED`; ensure both sides use `room:<ID>` with same case |
| Build error `possibly undefined` | `noUncheckedIndexedAccess` is on | Use `arr[i]!` only when safe, otherwise handle `undefined` |
| Refresh on `/play` gives 404 in prod | No SPA fallback | `public/_redirects` with `/*  /index.html  200` |

## 3. Final QA checklist (T48)
Desktop Chrome:
- [ ] Wizard builds a set for each of the 4 phases
- [ ] 30-minute soak test: no dead air longer than 1 s, no stuck state
- [ ] Skip 10 times quickly: no crash, no double audio
- [ ] Pause/resume during a crossfade
- [ ] Play-full toggle works and resets for the next song
- [ ] Seek by waveform works and logs one event
- [ ] A song with a bad first ID falls back to the second
- [ ] A song with all bad IDs is skipped with a toast
- [ ] Refresh `/play?...` rebuilds the same set
- [ ] Offline: app shell loads (PWA), friendly message for songs
Android Chrome:
- [ ] Wake lock keeps screen on, lock-screen controls work
- [ ] QR join works end to end
iPhone Safari:
- [ ] YouTube mode shows the cut banner, still plays song to song
- [ ] Local mode crossfades smoothly
- [ ] Add to Home Screen works
Rooms:
- [ ] Two guests request; order is correct; vetoes skip at the threshold
- [ ] Host closing the tab shows "host offline" on guests
Security/privacy:
- [ ] No secrets in the repo (`git grep -i service_role` returns nothing)
- [ ] Anonymous cannot SELECT from `events`
- [ ] `localStorage` holds no personal data besides a random guest id

## 4. Writing KNOWN_ISSUES.md
List anything unfinished with: what, where, how to reproduce, suggested fix. Honest is better than perfect.
