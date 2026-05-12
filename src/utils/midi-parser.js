import { Midi } from '@tonejs/midi'

export function parseMidiFile(buffer) {
  const midi = new Midi(buffer)
  const bpm = midi.header.tempos[0]?.bpm || 120
  const duration = midi.duration

  const allNotes = []
  let maxNoteDuration = 0
  midi.tracks.forEach((track, ti) => {
    track.notes.forEach((n) => {
      if (n.duration > maxNoteDuration) maxNoteDuration = n.duration
      allNotes.push({
        trackIndex: ti,
        name: n.name,
        time: n.time,
        duration: n.duration,
        velocity: n.velocity,
      })
    })
  })
  allNotes.sort((a, b) => a.time - b.time)

  const filteredTracks = []
  const trackMap = new Map()

  midi.tracks.forEach((track, i) => {
    if (track.notes.length > 0) {
      const programChanges = track.programChanges
      const program = programChanges?.[0]?.number ?? 0
      const trackInfo = {
        name: track.name || `Track ${filteredTracks.length + 1}`,
        channel: track.channel || 1,
        program,
        volume: 100,
        muted: false,
        solo: false,
      }
      filteredTracks.push(trackInfo)
      trackMap.set(i, filteredTracks.length - 1)
    }
  })

  const finalAllNotes = allNotes
    .map((n) => ({
      ...n,
      trackIndex: trackMap.get(n.trackIndex),
    }))
    .filter((n) => n.trackIndex !== undefined)

  const finalMidi = midi.clone()
  finalMidi.tracks = finalMidi.tracks.filter((t, i) => t.notes.length > 0)

  return {
    midi: finalMidi,
    tracks: filteredTracks,
    allNotes: finalAllNotes,
    bpm,
    duration,
    maxNoteDuration,
  }
}

export function generateVisualizerBlob(midi, tracks) {
  const clone = midi.clone()
  const anySolo = tracks.some((t) => t.solo)

  clone.tracks.forEach((_, i) => {
    const state = tracks[i]
    if (!state) return
    const shouldDim = anySolo ? !state.solo : state.muted
    try {
      clone.tracks[i].addProgramChange(0, i)
    } catch {}
    clone.tracks[i].notes.forEach((n) => {
      n.velocity = shouldDim ? 10 : Math.max(1, Math.round((n.velocity * state.volume) / 100))
    })
  })

  const uint8 = clone.toArray()
  return new Blob([uint8], { type: 'audio/midi' })
}
