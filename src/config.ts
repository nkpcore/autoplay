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
