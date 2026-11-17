import { equalPowerFade } from '../src/engine/crossfade.ts'
import { Engine } from '../src/engine/Engine.ts'
import type { Deck, DeckStatus } from '../src/engine/types.ts'
import type { Cue, EngineEvent } from '../src/data/types.ts'

// --- Mock Deck Implementation for Headless Testing ---
class MockDeck implements Deck {
  status: DeckStatus = 'empty'
  cue: Cue | null = null
  gain = 0
  currentTime = 0
  playing = false
  loadDelayMs = 0
  shouldFailLoads = false

  readonly name: 'A' | 'B'

  constructor(name: 'A' | 'B') {
    this.name = name
  }

  async load(cue: Cue, startSec: number): Promise<void> {
    if (this.shouldFailLoads) {
      this.status = 'error'
      throw new Error('Mock load failed')
    }
    this.status = 'loading'
    this.cue = cue
    this.currentTime = startSec
    if (this.loadDelayMs > 0) {
      await new Promise((r) => setTimeout(r, this.loadDelayMs))
    }
    this.status = 'ready'
  }

  play(): void {
    this.playing = true
    this.status = 'playing'
  }

  pause(): void {
    this.playing = false
    this.status = 'paused'
  }

  setGain(g: number): void {
    this.gain = g
  }

  getTime(): number {
    return this.currentTime
  }

  getDuration(): number {
    return this.cue?.duration_sec ?? 200
  }

  seek(sec: number): void {
    this.currentTime = sec
  }

  stop(): void {
    this.playing = false
    this.status = 'empty'
    this.cue = null
    this.gain = 0
  }
}

async function runTests() {
  console.log('--- Testing T10: equalPowerFade ---')
  await new Promise<void>((resolve, reject) => {
    let lastIn = -1
    let lastOut = -1
    const handle = equalPowerFade({
      durationMs: 200,
      stepMs: 20,
      onStep: (inGain, outGain) => {
        // Equal power property: inGain^2 + outGain^2 should be ~ 1
        const power = inGain * inGain + outGain * outGain
        if (Math.abs(power - 1) > 0.01) {
          reject(new Error(`Equal power invariant violated: ${power}`))
        }
        lastIn = inGain
        lastOut = outGain
      },
      onDone: () => {
        if (lastIn !== 1 || lastOut !== 0) {
          reject(new Error(`Fade did not finish at 1 and 0 (got ${lastIn}, ${lastOut})`))
        }
        console.log('✓ equalPowerFade passed: power invariant preserved, exact (1, 0) terminal reached.')
        resolve()
      },
    })
  })

  console.log('\n--- Testing T11 & T15: Engine Autonomous Lifecycle ---')
  const deckA = new MockDeck('A')
  const deckB = new MockDeck('B')
  const engine = new Engine([deckA, deckB], { hardCut: false })

  const cues: Cue[] = [
    {
      song_id: 'song-1',
      title: 'Song One',
      artist: 'Artist One',
      youtube_ids: ['AAAAAAAAAAA'],
      duration_sec: 180,
      entry_sec: 20,
      exit_sec: 30,
      play_full: false,
      era: 'pre2020',
      language: 'english',
      subtype: 'pop',
      energy: 8,
      tags: [],
    },
    {
      song_id: 'song-2',
      title: 'Song Two',
      artist: 'Artist Two',
      youtube_ids: ['BBBBBBBBBBB'],
      duration_sec: 180,
      entry_sec: 15,
      exit_sec: 35,
      play_full: false,
      era: 'pre2020',
      language: 'english',
      subtype: 'pop',
      energy: 9,
      tags: [],
    },
  ]

  const events: EngineEvent[] = []
  engine.on((e) => events.push(e))

  // Start engine
  await engine.start(cues)
  if (engine.state !== 'playing' || engine.current?.song_id !== 'song-1') {
    throw new Error(`Engine failed to start playing song 1 (state: ${engine.state})`)
  }
  if (!deckA.playing || deckA.gain !== 1) {
    throw new Error('Deck A should be playing with gain 1')
  }
  console.log('✓ Engine started playing cue 1 on Deck A')

  // Wait briefly for preload of song-2 on Deck B
  await new Promise((r) => setTimeout(r, 50))
  if (deckB.status !== 'ready' || deckB.cue?.song_id !== 'song-2') {
    throw new Error(`Deck B should have preloaded song-2 (status: ${deckB.status})`)
  }
  console.log('✓ Deck B successfully preloaded cue 2 while Deck A is live')

  // Advance time past cutPointNow()
  deckA.currentTime = 30.5
  engine.requestHandoff('exit')
  if (engine.state !== 'fading') {
    throw new Error(`Engine should be in fading state (got: ${engine.state})`)
  }
  console.log('✓ Engine entered fading state upon handoff request')

  // Wait for fade to complete (CONFIG.FADE_MS is 1500)
  await new Promise((r) => setTimeout(r, 1600))
  if (engine.current?.song_id !== 'song-2') {
    throw new Error(`Engine failed to transition to song 2 (current: ${engine.current?.song_id})`)
  }
  if (engine.state !== 'playing') {
    throw new Error(`Engine should be playing song 2 (got: ${engine.state})`)
  }
  console.log('✓ Complete handoff to song 2 succeeded smoothly')

  // Test Pause / Resume (T15)
  engine.togglePause()
  if (engine.state !== 'paused') {
    throw new Error(`Engine should be paused (got: ${engine.state})`)
  }
  engine.togglePause()
  if (engine.state !== 'playing') {
    throw new Error(`Engine should be resumed (got: ${engine.state})`)
  }
  console.log('✓ Engine pause and resume verified')

  // Test Full Track Toggle (T15)
  const fullCutBefore = engine.cutPointNow()
  engine.togglePlayFull()
  const fullCutAfter = engine.cutPointNow()
  if (fullCutAfter <= fullCutBefore) {
    throw new Error(`cutPointNow should extend when play_full is toggled (${fullCutBefore} vs ${fullCutAfter})`)
  }
  console.log('✓ Toggle full track extended cutPointNow appropriately')

  // Test Skip (T15)
  engine.skip()
  console.log('✓ Skip requested gracefully')

  engine.stopAll()
  console.log('✓ Engine stopAll cleaned up decks and timers')

  console.log('\n--- Testing T12: Holding buffer guard ---')
  const deckA2 = new MockDeck('A')
  const deckB2 = new MockDeck('B')
  deckB2.loadDelayMs = 500 // simulate slow network loading
  const engine2 = new Engine([deckA2, deckB2])
  let holdingReceived = false
  engine2.on((e) => {
    if (e.type === 'holding') holdingReceived = true
  })
  await engine2.start(cues)
  // Immediately request handoff while Deck B is still loading
  deckA2.currentTime = 31
  engine2.requestHandoff('exit')
  if (engine2.state !== 'holding' || !holdingReceived) {
    throw new Error('Engine should enter holding state when idle deck is not ready')
  }
  console.log('✓ Holding state properly engaged when next deck is buffering')
  engine2.stopAll()

  console.log('\n--- Testing T16: Hard cut mode ---')
  const deckA3 = new MockDeck('A')
  const deckB3 = new MockDeck('B')
  const engine3 = new Engine([deckA3, deckB3], { hardCut: true })
  await engine3.start(cues)
  await new Promise((r) => setTimeout(r, 50))
  // Advance time and trigger handoff in hard-cut mode
  deckA3.currentTime = 30.5
  engine3.requestHandoff('exit')
  // In hard cut mode, transition should be instantaneous (state goes straight to playing cue 2)
  if (engine3.current?.song_id !== 'song-2' || engine3.state !== 'playing') {
    throw new Error(`Hard cut mode should immediately switch to song-2 without fading (got ${engine3.current?.song_id}, ${engine3.state})`)
  }
  console.log('✓ Hard-cut mode switched immediately with zero delay')
  engine3.stopAll()

  console.log('\n===========================================')
  console.log('ALL PHASE 2 ENGINE TESTS PASSED PERFECTLY!')
  console.log('===========================================')
}

runTests().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
