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
