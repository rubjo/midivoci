import { Midi } from '@tonejs/midi'
import { parseMidi as rawParseMidi } from 'midi-file'

export function parseMidiFile(buffer) {
  const midi = new Midi(buffer)
  const bpm = midi.header.tempos[0]?.bpm || 120
  const duration = midi.duration

  // @tonejs/midi's splitTracks can lose trackName events on multi-channel tracks.
  // Parse raw events to build a channel→name fallback map.
  const uint8 = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer
  const rawData = rawParseMidi(uint8)
  rawData.tracks.forEach((track) => {
    let ticks = 0
    track.forEach((e) => {
      ticks += e.deltaTime
      e.absoluteTime = ticks
    })
  })
  const channelNames = new Map()
  rawData.tracks.forEach((track, ti) => {
    const isConductor = rawData.header.format === 1 && ti === 0
    const nameEvent = track.find((e) => e.type === 'trackName')
    if (nameEvent?.text && !isConductor) {
      const channels = new Set()
      track.forEach((e) => {
        if (e.type === 'noteOn' && e.channel !== undefined) channels.add(e.channel)
      })
      channels.forEach((ch) => {
        if (!channelNames.has(ch)) channelNames.set(ch, nameEvent.text)
      })
    }
  })

  const allNotes = []
  let maxNoteDuration = 0
  midi.tracks.forEach((track, ti) => {
    track.notes.forEach((n) => {
      if (n.duration > maxNoteDuration) maxNoteDuration = n.duration
      allNotes.push({
        trackIndex: ti,
        name: n.name,
        midi: n.midi,
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
      const trackInfo = {
        name: track.name || channelNames.get(track.channel) || `Track ${filteredTracks.length + 1}`,
        channel: track.channel || 1,
        program: 0,
        volume: 100,
        pan: 50,
        muted: false,
        solo: false,
        noteCount: track.notes.length,
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

export function generateVisualizerBlob(midi, tracks, transposeOffset = 0) {
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
      if (transposeOffset) {
        n.midi = Math.max(0, Math.min(127, n.midi + transposeOffset))
      }
      n.velocity = shouldDim ? 10 : Math.max(1, Math.round((n.velocity * state.volume) / 100))
    })
  })

  const uint8 = clone.toArray()
  return new Blob([uint8], { type: 'audio/midi' })
}
