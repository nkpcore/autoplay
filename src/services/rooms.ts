import { supabase } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface RoomRules {
  maxRequestsPerGuest: number // default 3
  approveAll: boolean // default false
  blockedSubtypes: string[]
  vetoThreshold: number // default 3 distinct guests
  cooldownSec: number // default 20s
}

export interface QueuedGuestSong {
  songId: string
  title: string
  artist: string
  votes: number
  byGuestId: string
  requestedAt: number
}

export interface RoomState {
  roomId: string
  nowPlayingId: string | null
  nowPlayingTitle: string | null
  nowPlayingArtist: string | null
  queue: QueuedGuestSong[]
  rules: RoomRules
}

export type RoomMsg =
  | { kind: 'hello'; guestId: string }
  | { kind: 'request'; guestId: string; songId: string }
  | { kind: 'vote'; guestId: string; songId: string; dir: 1 | -1 }
  | { kind: 'veto'; guestId: string; songId: string }

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function makeRoomId(): string {
  let id = ''
  for (let i = 0; i < 6; i++) {
    id += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return id
}

export interface HostRoom {
  id: string
  sendState: (s: RoomState) => void
  close: () => void
}

export function createHostRoom(
  roomId: string,
  onMessage: (msg: RoomMsg) => void,
): HostRoom | null {
  if (!supabase) {
    console.warn('[PartyAux Rooms] Supabase not configured; running room in local offline mode.')
    return {
      id: roomId,
      sendState: () => {},
      close: () => {},
    }
  }

  const channel: RealtimeChannel = supabase.channel(`room:${roomId}`, {
    config: { broadcast: { self: false } },
  })

  channel
    .on('broadcast', { event: 'request' }, ({ payload }) => {
      onMessage({ kind: 'request', ...(payload as { guestId: string; songId: string }) })
    })
    .on('broadcast', { event: 'vote' }, ({ payload }) => {
      onMessage({ kind: 'vote', ...(payload as { guestId: string; songId: string; dir: 1 | -1 }) })
    })
    .on('broadcast', { event: 'veto' }, ({ payload }) => {
      onMessage({ kind: 'veto', ...(payload as { guestId: string; songId: string }) })
    })
    .on('broadcast', { event: 'hello' }, ({ payload }) => {
      onMessage({ kind: 'hello', ...(payload as { guestId: string }) })
    })
    .subscribe((status) => {
      console.log(`[Host Room ${roomId}] status:`, status)
    })

  return {
    id: roomId,
    sendState: (s: RoomState) => {
      void channel.send({ type: 'broadcast', event: 'state', payload: s })
    },
    close: () => {
      void supabase?.removeChannel(channel)
    },
  }
}

export interface GuestRoomConnection {
  sendHello: (guestId: string) => void
  sendRequest: (guestId: string, songId: string) => void
  sendVote: (guestId: string, songId: string, dir: 1 | -1) => void
  sendVeto: (guestId: string, songId: string) => void
  close: () => void
}

export function connectGuestRoom(
  roomId: string,
  onState: (state: RoomState) => void,
): GuestRoomConnection | null {
  if (!supabase) return null

  const channel: RealtimeChannel = supabase.channel(`room:${roomId}`, {
    config: { broadcast: { self: false } },
  })

  channel
    .on('broadcast', { event: 'state' }, ({ payload }) => {
      onState(payload as RoomState)
    })
    .subscribe((status) => {
      console.log(`[Guest Room ${roomId}] status:`, status)
    })

  return {
    sendHello: (guestId) => {
      void channel.send({ type: 'broadcast', event: 'hello', payload: { guestId } })
    },
    sendRequest: (guestId, songId) => {
      void channel.send({ type: 'broadcast', event: 'request', payload: { guestId, songId } })
    },
    sendVote: (guestId, songId, dir) => {
      void channel.send({ type: 'broadcast', event: 'vote', payload: { guestId, songId, dir } })
    },
    sendVeto: (guestId, songId) => {
      void channel.send({ type: 'broadcast', event: 'veto', payload: { guestId, songId } })
    },
    close: () => {
      void supabase?.removeChannel(channel)
    },
  }
}
