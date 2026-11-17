import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MIN_VOTES = 15

const median = (arr) => {
  if (arr.length === 0) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const clamp = (val, min, max) => Math.min(max, Math.max(min, val))

async function run() {
  console.log('--- PartyAux Autonomous Cue Tuning from Crowd Telemetry ---')

  const songsPath = path.resolve('public/songs.json')
  const reportPath = path.resolve('tune-report.md')

  const songsRaw = await readFile(songsPath, 'utf8')
  const songs = JSON.parse(songsRaw)
  const songMap = new Map(songs.map((s) => [s.song_id, s]))

  if (!URL || !KEY) {
    console.log('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured. Running dry run.')
    await writeFile(
      reportPath,
      '# Nightly Cue Tuning Report\n\nNo Supabase credentials configured. Telemetry skipped.\n',
      'utf8',
    )
    return
  }

  const since = new Date(Date.now() - 30 * 864e5).toISOString()
  const fetchUrl = `${URL}/rest/v1/events?type=eq.seek&created_at=gte.${since}&select=song_id,from_sec,to_sec,session,created_at&limit=100000`

  const res = await fetch(fetchUrl, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
    },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch events from Supabase: ${res.status} ${res.statusText}`)
  }

  const events = await res.json()
  console.log(`Fetched ${events.length} seek events from the last 30 days.`)

  // Group events by song_id
  const eventsBySong = new Map()
  for (const e of events) {
    const list = eventsBySong.get(e.song_id) || []
    list.push(e)
    eventsBySong.set(e.song_id, list)
  }

  const tuningChanges = []

  for (const [songId, songEvents] of eventsBySong.entries()) {
    const cue = songMap.get(songId)
    if (!cue) continue

    // 1. Keep deliberate seeks: |to_sec - from_sec| >= 3, and to_sec between 5 and duration_sec - 15
    const deliberate = songEvents.filter((e) => {
      const delta = Math.abs((e.to_sec ?? 0) - (e.from_sec ?? 0))
      const to = e.to_sec ?? 0
      return delta >= 3 && to >= 5 && to <= cue.duration_sec - 15
    })

    // 2. Per session keep only the LAST seek (one vote per user)
    const sessionLastSeek = new Map()
    for (const e of deliberate) {
      sessionLastSeek.set(e.session, e)
    }

    const votes = Array.from(sessionLastSeek.values()).map((e) => e.to_sec)
    if (votes.length < MIN_VOTES) continue

    // 3. Compute median of to_sec
    let med = median(votes)

    // Remove outlier votes further than 20s from median, then recompute
    const filteredVotes = votes.filter((v) => Math.abs(v - med) <= 20)
    med = median(filteredVotes)

    // 4. If difference is at least 3 seconds and new point is valid
    if (Math.abs(med - cue.entry_sec) >= 3 && med < cue.exit_sec - 20) {
      const shift = clamp(med - cue.entry_sec, -10, 10)
      const newEntry = Math.round((cue.entry_sec + shift) * 2) / 2 // round to 0.5s

      tuningChanges.push({
        song_id: cue.song_id,
        title: cue.title,
        old_entry: cue.entry_sec,
        new_entry: newEntry,
        votes: votes.length,
      })

      cue.entry_sec = newEntry
      cue.crowd_tuned = true
    }
  }

  // Save changes if any
  if (tuningChanges.length > 0) {
    await writeFile(songsPath, JSON.stringify(songs, null, 2) + '\n', 'utf8')
    let report = '# Proposed Cue Tuning Report\n\n'
    report += `Generated at ${new Date().toISOString()}.\n\n`
    report += '| Song ID | Title | Old Entry | New Entry | Votes |\n'
    report += '|---|---|---|---|---|\n'
    for (const c of tuningChanges) {
      report += `| \`${c.song_id}\` | ${c.title} | ${c.old_entry}s | **${c.new_entry}s** | ${c.votes} |\n`
    }
    await writeFile(reportPath, report, 'utf8')
    console.log(`Successfully tuned ${tuningChanges.length} cues.`)
  } else {
    await writeFile(
      reportPath,
      `# Nightly Cue Tuning Report\n\nAnalyzed ${events.length} seek events. No cues reached the ${MIN_VOTES} vote threshold.\n`,
      'utf8',
    )
    console.log('No cues qualified for adjustment today.')
  }
}

run().catch((err) => {
  console.error('Tuning script error:', err)
  process.exit(1)
})
