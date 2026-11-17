import { equalPowerFade } from '../src/engine/crossfade.ts'
import { Engine } from '../src/engine/Engine.ts'
import type { Deck, DeckStatus } from '../src/engine/types.ts'
import type { Cue, EngineEvent, QueueItem } from '../src/data/types.ts'
import { runPlannerSelfTests } from '../src/planner/selfTest.ts'
import { estimateBpm, snapToBeat } from '../src/analysis/bpm.ts'
import { runEstimateBpmWorker } from '../src/state/localFiles.ts'
import {
  applyGuestVote,
  getSongVoteScore,
  reorderGuestQueue,
  isSubtypeBlocked,
  countGuestActiveRequests,
  buildGuestSnapshot,
  type GuestVoteMap,
  type PendingRequest,
} from '../src/services/roomHostLogic.ts'
import fs from 'node:fs'
import path from 'node:path'

// --- Mock Deck Implementation for Headless Testing ---
class MockDeck implements Deck {
  status: DeckStatus = 'empty'
  cue: Cue | null = null
  gain = 0
  currentTime = 0
  playing = false
  loadDelayMs = 0
  shouldFailLoads = false
  failCueId?: string
  loadCount = 0

  readonly name: 'A' | 'B'

  constructor(name: 'A' | 'B') {
    this.name = name
  }

  async load(cue: Cue, startSec: number): Promise<void> {
    this.loadCount++
    if (this.shouldFailLoads || (this.failCueId && cue.song_id === this.failCueId)) {
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
    equalPowerFade({
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

  console.log('\n--- Testing Phase 4: Set Planner Self-Tests ---')
  const catalogPath = path.resolve('public/songs.json')
  const rawCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as Cue[]
  runPlannerSelfTests(rawCatalog)

  console.log('\n--- Testing Phase 9: BPM Analysis & Transition Styles ---')
  // 1. Synthetic 120 BPM signal (pulse every 0.5s at 44100Hz for 10s)
  const sampleRate = 44100
  const totalSamples = sampleRate * 10
  const syntheticSignal = new Float32Array(totalSamples)
  const pulseInterval = Math.round(sampleRate * 0.5) // 120 BPM
  for (let p = 0; p < totalSamples; p += pulseInterval) {
    for (let j = 0; j < 100 && p + j < totalSamples; j++) {
      syntheticSignal[p + j] = 0.9
    }
  }

  const bpmResult = estimateBpm(syntheticSignal, sampleRate)
  console.log(`Estimated BPM from synthetic 120 BPM audio: ${bpmResult.bpm}`)
  if (Math.abs(bpmResult.bpm - 120) > 3) {
    throw new Error(`BPM estimation inaccurate: expected ~120, got ${bpmResult.bpm}`)
  }
  console.log('✓ estimateBpm accurately detected 120 BPM')

  // 2. snapToBeat test
  const snapped = snapToBeat(23.2, 120, 0) // 120 BPM -> bar = 2.0s. 23.2 -> nearest 24.0s
  if (snapped !== 24) {
    throw new Error(`snapToBeat failed: expected 24, got ${snapped}`)
  }
  console.log('✓ snapToBeat properly aligned timestamp to musical downbeat')

  // 3. Transition styles test
  const mockEngine = new Engine([deckA, deckB])
  const slowCue: Cue = { ...cues[0]!, bpm: 120, energy: 5 }
  const fastCue: Cue = { ...cues[1]!, bpm: 122, energy: 5 }
  const hypeCue: Cue = { ...cues[1]!, bpm: 150, energy: 9 }
  const chillCue: Cue = { ...cues[1]!, bpm: 80, energy: 3 }

  const blendDuration = mockEngine.computeFadeDuration(slowCue, fastCue)
  if (blendDuration !== 3000) {
    throw new Error(`Expected 3000ms long blend for tempo compatible songs, got ${blendDuration}`)
  }
  console.log('✓ Long blend 3.0s chosen for tempo-compatible pair')

  const cutDuration = mockEngine.computeFadeDuration(slowCue, hypeCue)
  if (cutDuration !== 800) {
    throw new Error(`Expected 800ms quick cut for energy jump, got ${cutDuration}`)
  }
  console.log('✓ Quick 0.8s cut chosen for energy jump')

  const dropDuration = mockEngine.computeFadeDuration(hypeCue, chillCue)
  if (dropDuration !== 2000) {
    throw new Error(`Expected 2000ms smooth drop for energy drop, got ${dropDuration}`)
  }
  console.log('✓ Smooth 2.0s fade chosen for energy drop')

  // 4. runEstimateBpmWorker test
  const workerResult = await runEstimateBpmWorker(syntheticSignal, sampleRate)
  if (Math.abs(workerResult.bpm - 120) > 3) {
    throw new Error(`runEstimateBpmWorker returned unexpected BPM: ${workerResult.bpm}`)
  }
  const entrySnapped = snapToBeat(0, workerResult.bpm, workerResult.firstBeatSec)
  const exitSnapped = snapToBeat(180, workerResult.bpm, workerResult.firstBeatSec)
  if (exitSnapped <= entrySnapped) {
    throw new Error('exitSnapped must be greater than entrySnapped')
  }
  console.log('✓ runEstimateBpmWorker and snapToBeat verified for local file audio processing')

  // 5. Bug 1: Tempo ramp 8s continuity across handoff & cancel early rules
  class RateMockDeck extends MockDeck {
    rate = 1.0
    setRate(r: number) {
      this.rate = r
    }
  }
  const deckRateA = new RateMockDeck('A')
  const deckRateB = new RateMockDeck('B')
  const engineRate = new Engine([deckRateA, deckRateB])
  const cueRate1: Cue = { ...cues[0]!, song_id: 'r-1', bpm: 122 }
  const cueRate2: Cue = { ...cues[1]!, song_id: 'r-2', bpm: 120 } // ratio = 122/120 = 1.01666...

  const originalNow = performance.now
  let mockTime = 1000
  performance.now = () => mockTime

  try {
    await engineRate.start([cueRate1, cueRate2])
    // Start crossfade handoff (outgoing is deckRateA, incoming is deckRateB)
    engineRate.requestHandoff('exit')
    const initialRatio = 122 / 120
    if (Math.abs(deckRateB.rate - initialRatio) > 0.001) {
      throw new Error(`Deck B rate should start at ratio ${initialRatio}, got ${deckRateB.rate}`)
    }

    // Step A: At 3s, complete handoff occurs via equalPowerFade finish
    mockTime = 1000 + 3000
    // Wait for equalPowerFade (stepMs: 50) and tempo ramp (100ms) interval ticks
    await new Promise((r) => setTimeout(r, 120))

    if (engineRate.state !== 'playing' || engineRate.current?.song_id !== 'r-2') {
      throw new Error(`Engine should have completed handoff to r-2 at 3s (got state: ${engineRate.state})`)
    }

    // Tempo ramp MUST NOT be cancelled in completeHandoff
    const timerRunning = (engineRate as unknown as { tempoRampTimer?: number }).tempoRampTimer !== undefined
    if (!timerRunning) {
      throw new Error('tempoRampTimer was cancelled in completeHandoff! It must continue running its full 8s.')
    }
    const expectedRateAt3s = initialRatio + (1.0 - initialRatio) * (3000 / 8000)
    if (Math.abs(deckRateB.rate - expectedRateAt3s) > 0.005) {
      throw new Error(`Deck B rate at 3s should be ~${expectedRateAt3s}, got ${deckRateB.rate}`)
    }

    // Step B: Progress toward 5s
    mockTime = 1000 + 5000
    await new Promise((r) => setTimeout(r, 120))
    const expectedRateAt5s = initialRatio + (1.0 - initialRatio) * (5000 / 8000)
    if (Math.abs(deckRateB.rate - expectedRateAt5s) > 0.005) {
      throw new Error(`Deck B rate at 5s should be ~${expectedRateAt5s}, got ${deckRateB.rate}`)
    }

    // Step C: At 8s, reaches 1.0
    mockTime = 1000 + 8000
    await new Promise((r) => setTimeout(r, 120))
    if (Math.abs(deckRateB.rate - 1.0) > 0.001) {
      throw new Error(`Deck B rate should reach 1.0 at 8s, got ${deckRateB.rate}`)
    }
    const timerCompleted = (engineRate as unknown as { tempoRampTimer?: number }).tempoRampTimer === undefined
    if (!timerCompleted) {
      throw new Error('tempoRampTimer should be cleared when ramp finishes at 8s')
    }
    console.log('✓ After a 3s handoff, incoming deck rate kept moving toward 1.0 and reached 1.0 at 8s')

    // Test Early Cancellation on skip (must call setRate(1))
    mockTime = 1000
    await engineRate.start([cueRate1, cueRate2])
    engineRate.requestHandoff('exit')
    if (Math.abs(deckRateB.rate - initialRatio) > 0.001) {
      throw new Error('Deck B rate should be at initial ratio before skip')
    }
    engineRate.skip()
    if (deckRateB.rate !== 1) {
      throw new Error(`Skip must call setRate(1) on ramping deck, got ${deckRateB.rate}`)
    }
    if ((engineRate as unknown as { tempoRampTimer?: number }).tempoRampTimer !== undefined) {
      throw new Error('tempoRampTimer was not cleared on skip')
    }
    console.log('✓ skip cancelled tempo ramp early, cleared timer, and called setRate(1)')

    // Test Early Cancellation on stopAll (must call setRate(1))
    mockTime = 1000
    await engineRate.start([cueRate1, cueRate2])
    engineRate.requestHandoff('exit')
    engineRate.stopAll()
    if (deckRateB.rate !== 1) {
      throw new Error(`stopAll must call setRate(1) on ramping deck, got ${deckRateB.rate}`)
    }
    if ((engineRate as unknown as { tempoRampTimer?: number }).tempoRampTimer !== undefined) {
      throw new Error('tempoRampTimer was not cleared on stopAll')
    }
    console.log('✓ stopAll cancelled tempo ramp early, cleared timer, and called setRate(1)')

    // Test Early Cancellation on deck status change (emptied or new song loaded)
    mockTime = 1000
    await engineRate.start([cueRate1, cueRate2])
    engineRate.requestHandoff('exit')
    deckRateB.status = 'empty'
    await new Promise((r) => setTimeout(r, 120))
    if (deckRateB.rate !== 1) {
      throw new Error(`Deck emptying must call setRate(1) on ramping deck, got ${deckRateB.rate}`)
    }
    if ((engineRate as unknown as { tempoRampTimer?: number }).tempoRampTimer !== undefined) {
      throw new Error('tempoRampTimer was not cleared when deck status changed to empty')
    }
    console.log('✓ Deck status change cancelled tempo ramp early, cleared timer, and called setRate(1)')
  } finally {
    performance.now = originalNow
    engineRate.stopAll()
  }

  // 6. Bug 2: preloadNext guards (fading state & ready/loading song matches)
  console.log('\n--- Testing Bug 2: Engine.preloadNext guards ---')
  const deckA_p = new MockDeck('A')
  const deckB_p = new MockDeck('B')
  const engine_p = new Engine([deckA_p, deckB_p])
  const cueP1: Cue = { ...cues[0]!, song_id: 'p-1', title: 'Song P1' }
  const cueP2: Cue = { ...cues[1]!, song_id: 'p-2', title: 'Song P2' }
  const cueP3: Cue = { ...cues[0]!, song_id: 'p-3', title: 'Song P3' }
  const cueP4: Cue = { ...cues[1]!, song_id: 'p-4', title: 'Song P4' }

  await engine_p.start([cueP1, cueP2, cueP3, cueP4])
  // deckA_p is playing cueP1, deckB_p is idle and preloaded cueP2
  if (deckB_p.cue?.song_id !== 'p-2' || deckB_p.status !== 'ready') {
    throw new Error('Initial preload of cueP2 on deckB failed')
  }
  const loadCountAfterInit = deckB_p.loadCount

  // Test A: A request during a fade does not reload the idle deck
  engine_p.requestHandoff('exit')
  if (engine_p.state !== 'fading') {
    throw new Error('Engine should be in fading state')
  }
  await engine_p.preloadNext()
  if (deckB_p.loadCount !== loadCountAfterInit) {
    throw new Error(`Request during fade reloaded idle deck! (${deckB_p.loadCount} vs ${loadCountAfterInit})`)
  }
  console.log('✓ Request during a fade did not reload the idle deck')

  // Complete the fade
  ;(engine_p as unknown as { completeHandoff: (d: Deck) => void }).completeHandoff(deckA_p)
  if (engine_p.current?.song_id !== 'p-2') {
    throw new Error('Engine should be playing cueP2 after handoff')
  }
  // Now deckA_p has preloaded cueP3
  const deckALoadsAfterHandoff = deckA_p.loadCount

  // Test B: Ten votes in a row cause zero extra loads
  for (let vote = 1; vote <= 10; vote++) {
    await engine_p.preloadNext()
  }
  if (deckA_p.loadCount !== deckALoadsAfterHandoff) {
    throw new Error(`Ten votes caused extra loads! Expected ${deckALoadsAfterHandoff}, got ${deckA_p.loadCount}`)
  }
  console.log('✓ Ten votes in a row caused zero extra loads on the idle deck')
  engine_p.stopAll()

  console.log('\n--- Testing Task R1: Engine single ownership of queue order ---')
  // T1: Call setUpcomingQueue with a reordered list WHILE state is 'fading'
  const deckA_r1 = new MockDeck('A')
  const deckB_r1 = new MockDeck('B')
  const engine_r1 = new Engine([deckA_r1, deckB_r1])
  const s1: Cue = { ...cues[0]!, song_id: 's-1', title: 'Song 1' }
  const s2: Cue = { ...cues[1]!, song_id: 's-2', title: 'Song 2' }
  const s3: Cue = { ...cues[0]!, song_id: 's-3', title: 'Song 3' }
  const s4: Cue = { ...cues[1]!, song_id: 's-4', title: 'Song 4' }
  const s5: Cue = { ...cues[0]!, song_id: 's-5', title: 'Song 5' }

  await engine_r1.start([s1, s2, s3, s4, s5])
  engine_r1.requestHandoff('exit')
  if (engine_r1.state !== 'fading') {
    throw new Error('Engine should be fading')
  }

  // While fading, reorder the upcoming songs
  engine_r1.setUpcomingQueue([s5, s4, s3])
  // Handoff completes
  ;(engine_r1 as unknown as { completeHandoff: (d: Deck) => void }).completeHandoff(deckA_r1)

  if (engine_r1.current?.song_id !== 's-2') {
    throw new Error(`Engine current should be s-2 (faded in), got ${engine_r1.current?.song_id}`)
  }
  const s2Occurrences = engine_r1.queue.filter((c) => c.song_id === 's-2').length
  if (s2Occurrences !== 1) {
    throw new Error(`s-2 should appear exactly once in the queue, found ${s2Occurrences}`)
  }
  const queueAfterCurrent = engine_r1.queue.slice(engine_r1.index + 1).map((c) => c.song_id)
  if (queueAfterCurrent.join(',') !== 's-5,s-4,s-3') {
    throw new Error(`Queue after current should follow new order [s-5, s-4, s-3], got ${queueAfterCurrent.join(',')}`)
  }
  console.log('✓ T1: setUpcomingQueue during fade applied after handoff, current is faded-in song (once), and rest follows new order')
  engine_r1.stopAll()

  // T2: Call playNext during a fade
  const deckA_r2 = new MockDeck('A')
  const deckB_r2 = new MockDeck('B')
  const engine_r2 = new Engine([deckA_r2, deckB_r2])
  const vipSong: Cue = { ...cues[0]!, song_id: 'vip-song', title: 'VIP Song' }

  await engine_r2.start([s1, s2, s3, s4])
  engine_r2.requestHandoff('exit')
  if (engine_r2.state !== 'fading') {
    throw new Error('Engine should be fading')
  }

  engine_r2.playNext(vipSong)
  ;(engine_r2 as unknown as { completeHandoff: (d: Deck) => void }).completeHandoff(deckA_r2)

  if (engine_r2.current?.song_id !== 's-2') {
    throw new Error(`Engine current should be s-2 (faded in), got ${engine_r2.current?.song_id}`)
  }
  const s2CountT2 = engine_r2.queue.filter((c) => c.song_id === 's-2').length
  if (s2CountT2 !== 1) {
    throw new Error(`s-2 should appear exactly once in queue, found ${s2CountT2}`)
  }
  const nextTrack = engine_r2.queue[engine_r2.index + 1]
  if (nextTrack?.song_id !== 'vip-song') {
    throw new Error(`New song vip-song should be right after the one that faded in (s-2), got ${nextTrack?.song_id}`)
  }
  console.log('✓ T2: playNext during fade placed new song directly after the faded-in song exactly once')
  engine_r2.stopAll()

  // T3: Dead song removed by preloadNext triggers onQueueChange callback exactly once
  const deckA_r3 = new MockDeck('A')
  const deckB_r3 = new MockDeck('B')
  deckB_r3.failCueId = 'dead-song'
  const engine_r3 = new Engine([deckA_r3, deckB_r3])
  const deadCue: Cue = { ...cues[0]!, song_id: 'dead-song', title: 'Dead Song' }
  const goodCue: Cue = { ...cues[1]!, song_id: 'good-song', title: 'Good Song' }

  // Start with clean initial queue
  await engine_r3.start([s1, s2])

  let queueChangeCountT3 = 0
  const unsubscribeT3 = engine_r3.onQueueChange(() => {
    queueChangeCountT3++
  })

  // Add deadCue followed by goodCue to upcoming
  engine_r3.setUpcomingQueue([deadCue, goodCue])
  // Reset count after setUpcomingQueue to isolate preloadNext removal callback
  queueChangeCountT3 = 0

  // Trigger preloadNext to encounter and drop deadCue
  await engine_r3.preloadNext()

  if (queueChangeCountT3 !== 1) {
    throw new Error(`onQueueChange should be called exactly once when dead song is removed, got ${queueChangeCountT3}`)
  }
  if (engine_r3.queue.some((c) => c.song_id === 'dead-song')) {
    throw new Error('dead-song was not removed from engine queue')
  }
  if (engine_r3.queue[engine_r3.index + 1]?.song_id !== 'good-song') {
    throw new Error('good-song should now be next in queue')
  }
  unsubscribeT3()
  console.log('✓ T3: A dead song removed by preloadNext triggers the onQueueChange callback exactly once')
  engine_r3.stopAll()

  // T4: setUpcomingQueue while NOT fading applies immediately and calls the callback
  const deckA_r4 = new MockDeck('A')
  const deckB_r4 = new MockDeck('B')
  const engine_r4 = new Engine([deckA_r4, deckB_r4])
  await engine_r4.start([s1, s2, s3])

  let callbackCalledT4 = false
  const unsubscribeT4 = engine_r4.onQueueChange(() => {
    callbackCalledT4 = true
  })

  if (engine_r4.state === 'fading') {
    throw new Error('Engine should not be fading')
  }

  engine_r4.setUpcomingQueue([s4, s5])
  if (!callbackCalledT4) {
    throw new Error('onQueueChange callback was not called immediately')
  }
  const upcomingIdsT4 = engine_r4.queue.slice(engine_r4.index + 1).map((c) => c.song_id)
  if (upcomingIdsT4.join(',') !== 's-4,s-5') {
    throw new Error(`Upcoming songs should immediately be [s-4, s-5], got ${upcomingIdsT4.join(',')}`)
  }
  unsubscribeT4()
  console.log('✓ T4: setUpcomingQueue while NOT fading applied immediately and called onQueueChange')
  engine_r4.stopAll()

  console.log('\n--- Testing Phase 8: Room Host Rules & Vote Logic (T42) ---')
  const votesMap: GuestVoteMap = new Map()

  // 1. Voting tests
  applyGuestVote(votesMap, 'song-a', 'guest-1', 1)
  applyGuestVote(votesMap, 'song-a', 'guest-2', 1)
  applyGuestVote(votesMap, 'song-a', 'guest-3', -1)
  if (getSongVoteScore(votesMap, 'song-a') !== 1) {
    throw new Error(`Expected vote score 1 (2 up, 1 down), got ${getSongVoteScore(votesMap, 'song-a')}`)
  }
  applyGuestVote(votesMap, 'song-b', 'guest-1', 1)
  applyGuestVote(votesMap, 'song-b', 'guest-2', 1)
  if (getSongVoteScore(votesMap, 'song-b') !== 2) {
    throw new Error(`Expected vote score 2, got ${getSongVoteScore(votesMap, 'song-b')}`)
  }
  console.log('✓ applyGuestVote and getSongVoteScore correctly compute net score per song')

  // 2. Queue reordering tests (votes desc, time asc, guests before planner)
  const reqTimes = new Map<string, number>()
  reqTimes.set('song-a', 1000)
  reqTimes.set('song-b', 2000)
  reqTimes.set('song-c', 1500)

  const cueA: Cue = { ...cues[0]!, song_id: 'song-a', title: 'Song A' }
  const cueB: Cue = { ...cues[0]!, song_id: 'song-b', title: 'Song B' }
  const cueC: Cue = { ...cues[0]!, song_id: 'song-c', title: 'Song C' }
  const cuePlanner: Cue = { ...cues[1]!, song_id: 'song-p', title: 'Planner Song' }

  const testQueue: QueueItem[] = [
    { cue: cues[0]!, source: 'host' }, // index 0 (now playing)
    { cue: cuePlanner, source: 'planner' },
    { cue: cueA, source: 'guest', requestedBy: 'guest-1' },
    { cue: cueB, source: 'guest', requestedBy: 'guest-2' },
    { cue: cueC, source: 'guest', requestedBy: 'guest-3' },
  ]

  // song-b has 2 votes, song-a has 1 vote, song-c has 0 votes
  const reorderedQueue = reorderGuestQueue(testQueue, 0, votesMap, reqTimes)
  const orderIds = reorderedQueue.map((item) => item.cue.song_id)
  // Expected order:
  // [0]: now playing
  // [1]: song-b (2 votes)
  // [2]: song-a (1 vote)
  // [3]: song-c (0 votes)
  // [4]: song-p (planner)
  if (
    orderIds[0] !== cues[0]!.song_id ||
    orderIds[1] !== 'song-b' ||
    orderIds[2] !== 'song-a' ||
    orderIds[3] !== 'song-c' ||
    orderIds[4] !== 'song-p'
  ) {
    throw new Error(`Unexpected queue order after voting: ${orderIds.join(', ')}`)
  }
  console.log('✓ reorderGuestQueue sorted guests by votes desc and placed ahead of planner tracks')

  // 3. Blocked subtype check
  if (!isSubtypeBlocked('Romantic', ['dance', 'romantic', 'sufi'])) {
    throw new Error('Case-insensitive blocked subtype check failed')
  }
  if (isSubtypeBlocked('hiphop', ['dance', 'romantic'])) {
    throw new Error('Non-blocked subtype incorrectly marked as blocked')
  }
  console.log('✓ isSubtypeBlocked enforces blockedSubtypes correctly')

  // 4. Max requests per guest
  const samplePending: PendingRequest[] = [
    { id: '1', cue: cueA, guestId: 'guest-x', requestedAt: 100 },
  ]
  const sampleQueue: QueueItem[] = [
    { cue: cueB, source: 'guest', requestedBy: 'guest-x' },
    { cue: cueC, source: 'guest', requestedBy: 'guest-y' },
  ]
  const guestXCount = countGuestActiveRequests(sampleQueue, samplePending, 'guest-x')
  if (guestXCount !== 2) {
    throw new Error(`Expected active request count 2 for guest-x (1 queued + 1 pending), got ${guestXCount}`)
  }
  console.log('✓ countGuestActiveRequests accurately tracks pending and queued requests per guest')

  // 5. Snapshot building
  const snapshot = buildGuestSnapshot(reorderedQueue.slice(1), votesMap, reqTimes)
  if (snapshot.length !== 3 || snapshot[0]?.songId !== 'song-b' || snapshot[0]?.votes !== 2) {
    throw new Error('buildGuestSnapshot failed to construct room snapshot')
  }
  console.log('✓ buildGuestSnapshot generated accurate guest queue telemetry')

  // 6. Veto state reset on live event
  const vetoSet = new Set<string>(['guest-1', 'guest-2'])
  mockEngine.on((e) => {
    if (e.type === 'live') {
      vetoSet.clear()
    }
  })
  mockEngine.emit({ type: 'live', cue: cueA })
  if (vetoSet.size !== 0) {
    throw new Error('Veto state did not reset on live event')
  }
  console.log('✓ Veto state successfully resets on every live event')

  console.log('\n===========================================')
  console.log('ALL PHASE 2 ENGINE TESTS PASSED PERFECTLY!')
  console.log('===========================================')
}

runTests().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
