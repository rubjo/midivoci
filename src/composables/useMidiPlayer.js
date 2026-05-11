import { ref, onUnmounted } from 'vue'
import { midiFileList } from 'virtual:midi-files'
import { parseMidiFile, generateVisualizerBlob } from '../utils/midi-parser.js'
import {
  createAudioContext,
  resumeAudioContext,
  createTrackGains,
  loadInstrument,
  stopAllInstruments,
  closeAudioContext,
} from '../utils/audio-engine.js'

export const midiFileMeta = midiFileList
const midiBaseUrl = '/midivox/midi/'

export function useMidiPlayer() {
  const midiUrl = ref('')
  const tracks = ref([])
  const isPlaying = ref(false)
  const isPaused = ref(false)
  const bpm = ref(120)
  const originalBpm = ref(120)
  const duration = ref(0)
  const currentTime = ref(0)
  const isLoaded = ref(false)
  const visualizerUrl = ref('')
  const activeTracks = ref(new Map())
  const leadTrack = ref(-1)

  let audioCtx = null
  let masterGain = null
  let trackGains = []
  let midi = null
  let instruments = []
  let prevMuted = []
  let allNotes = []
  let maxNoteDuration = 0
  let startTime = 0
  let pausedAt = 0
  let scheduleRatio = 1
  let playing = false
  let rafId = null
  let tempoTimeout = null
  let visTimeout = null
  let nextNoteIndex = 0
  let schedulerId = null
  let instrumentLoadId = 0
  const LOOKAHEAD = 0.1
  const SCHEDULE_INTERVAL = 25

  onUnmounted(() => disposeAll())

  function ensureAudio() {
    if (!audioCtx) {
      const ctx = createAudioContext()
      audioCtx = ctx.audioCtx
      masterGain = ctx.masterGain
    }
    resumeAudioContext(audioCtx)
  }

  function isTrackEffectivelyMuted(i) {
    const t = tracks.value[i]
    if (!t) return true
    const anySolo = tracks.value.some((s) => s.solo)
    if (anySolo) return !t.solo
    return t.muted
  }

  function shouldPlayTrack(i) {
    return !isTrackEffectivelyMuted(i)
  }

  function getEffectiveGain(i) {
    return isTrackEffectivelyMuted(i) ? 0 : tracks.value[i].volume / 100
  }

  function applyTrackGain(index) {
    if (trackGains[index]) {
      trackGains[index].gain.value = getEffectiveGain(index)
    }
  }

  function applyAllTrackGains() {
    trackGains.forEach((_, i) => applyTrackGain(i))
  }

  function binarySearchFirstGt(arr, time) {
    let lo = 0,
      hi = arr.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (arr[mid].time <= time) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  function binarySearchFirstGe(arr, time) {
    let lo = 0,
      hi = arr.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (arr[mid].time < time) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  function computeActiveTracks(time) {
    const active = new Map()
    const anySolo = tracks.value.some((t) => t.solo)
    const window = Math.max(maxNoteDuration, 10) + 1
    const searchTime = time - window

    const end = binarySearchFirstGt(allNotes, time)
    const start = end > 0 ? binarySearchFirstGe(allNotes, Math.max(0, searchTime)) : 0

    for (let i = start; i < end; i++) {
      const n = allNotes[i]
      if (n.time + n.duration <= time) continue
      if (anySolo && !tracks.value[n.trackIndex]?.solo) continue
      if (tracks.value[n.trackIndex]?.muted) continue
      if (!active.has(n.trackIndex)) {
        active.set(n.trackIndex, n.name)
      }
    }
    return active
  }

  function scheduler() {
    if (!midi || !playing) return
    const now = audioCtx.currentTime
    const ratio = scheduleRatio

    while (nextNoteIndex < allNotes.length) {
      const n = allNotes[nextNoteIndex]
      const absTime = startTime + n.time * ratio

      if (absTime > now + LOOKAHEAD) break

      if (shouldPlayTrack(n.trackIndex)) {
        const inst = instruments[n.trackIndex]
        if (inst) {
          try {
            // If the note was supposed to play in the past (e.g. start of song),
            // schedule it for 'now' to avoid skipping it, but keep the duration relative.
            const scheduledTime = Math.max(now, absTime)
            inst.play(n.name, scheduledTime, { duration: n.duration * ratio, gain: 1 })
          } catch {}
        }
      }
      nextNoteIndex++
    }
  }

  function scheduleAll() {
    // Legacy function kept for API compatibility but now just triggers initial sync
    if (!midi) return
    scheduleRatio = (midi.header.tempos[0]?.bpm || 120) / bpm.value
    startTime = audioCtx.currentTime - pausedAt
    nextNoteIndex = binarySearchFirstGe(allNotes, currentTime.value)
    scheduler()
  }

  function scheduleTrack(index) {
    if (!midi || !playing) return
    const now = audioCtx.currentTime
    const ratio = scheduleRatio
    const inst = instruments[index]
    if (!inst) return

    // Only schedule notes that are within the lookahead window from 'now'
    // to avoid double-scheduling notes already handled by the main scheduler.
    for (const n of allNotes) {
      if (n.trackIndex !== index) continue
      const absTime = startTime + n.time * ratio
      if (absTime < now) continue
      if (absTime > now + LOOKAHEAD) break
      if (!shouldPlayTrack(index)) continue
      try {
        inst.play(n.name, absTime, { duration: n.duration * ratio, gain: 1 })
      } catch {}
    }
  }

  function scheduleVisualizerBlob() {
    if (visTimeout) clearTimeout(visTimeout)
    visTimeout = setTimeout(() => {
      refreshVisualizerBlob()
      visTimeout = null
    }, 30)
  }

  function refreshVisualizerBlob() {
    if (!midi) return
    if (visualizerUrl.value) {
      URL.revokeObjectURL(visualizerUrl.value)
      visualizerUrl.value = ''
    }
    const blob = generateVisualizerBlob(midi, tracks.value)
    visualizerUrl.value = URL.createObjectURL(blob)
  }

  async function parseMidi(buffer) {
    disposeAll()
    ensureAudio()

    const parsed = parseMidiFile(buffer)
    midi = parsed.midi
    tracks.value = parsed.tracks
    const preferredProgram = localStorage.getItem('midivox:preferred-instrument')
    if (preferredProgram !== null) {
      tracks.value.forEach((t) => {
        t.program = Number(preferredProgram)
      })
    }
    allNotes = parsed.allNotes
    maxNoteDuration = parsed.maxNoteDuration
    bpm.value = parsed.bpm
    originalBpm.value = parsed.bpm
    duration.value = parsed.duration
    currentTime.value = 0
    pausedAt = 0
    prevMuted = tracks.value.map(() => false)

    trackGains = createTrackGains(audioCtx, masterGain, midi.tracks.length)

    instruments = []
    for (let i = 0; i < midi.tracks.length; i++) {
      if (midi.tracks[i].notes.length === 0) {
        instruments.push(null)
        continue
      }
      const prog = tracks.value[i]?.program ?? 0
      try {
        instruments.push(await loadInstrument(audioCtx, prog, trackGains[i]))
      } catch {
        try {
          instruments.push(await loadInstrument(audioCtx, 0, trackGains[i]))
        } catch {
          instruments.push(null)
        }
      }
    }

    isLoaded.value = true
    refreshVisualizerBlob()
  }

  async function play() {
    if (!midi || !isLoaded.value) return

    if (isPaused.value) {
      ensureAudio()
      playing = true
      isPlaying.value = true
      isPaused.value = false
      animate()
      startScheduler()
      return
    }

    ensureAudio()
    if (instruments.length === 0 && midi) {
      trackGains = createTrackGains(audioCtx, masterGain, midi.tracks.length)
      for (let i = 0; i < midi.tracks.length; i++) {
        if (midi.tracks[i].notes.length === 0) {
          instruments.push(null)
          continue
        }
        const prog = tracks.value[i]?.program ?? 0
        try {
          instruments.push(await loadInstrument(audioCtx, prog, trackGains[i]))
        } catch {
          try {
            instruments.push(await loadInstrument(audioCtx, 0, trackGains[i]))
          } catch {
            instruments.push(null)
          }
        }
      }
    }
    applyAllTrackGains()
    scheduleAll()
    playing = true
    isPlaying.value = true
    isPaused.value = false
    animate()
    startScheduler()
  }

  function startScheduler() {
    if (schedulerId) return
    schedulerId = setInterval(scheduler, SCHEDULE_INTERVAL)
  }

  function stopScheduler() {
    if (schedulerId) {
      clearInterval(schedulerId)
      schedulerId = null
    }
  }

  function pause() {
    playing = false
    isPlaying.value = false
    isPaused.value = true
    stopScheduler()
    if (rafId) cancelAnimationFrame(rafId)
    if (audioCtx) {
      pausedAt = audioCtx.currentTime - startTime
      audioCtx.suspend()
    }
  }

  function stop() {
    playing = false
    isPlaying.value = false
    isPaused.value = false
    stopScheduler()
    if (rafId) cancelAnimationFrame(rafId)
    closeAudioContext(audioCtx)
    audioCtx = null
    masterGain = null
    trackGains = []
    instruments = []
    pausedAt = 0
    currentTime.value = 0
  }

  function togglePlay() {
    playing ? pause() : play()
  }

  function seek(time) {
    if (!midi || !isLoaded.value) return
    const clamped = Math.max(0, Math.min(time, duration.value))
    currentTime.value = clamped
    if (playing) {
      stopAllInstruments(instruments)
      const ratio = (midi.header.tempos[0]?.bpm || 120) / bpm.value
      pausedAt = clamped * ratio
      const now = audioCtx.currentTime
      startTime = now - pausedAt
      nextNoteIndex = binarySearchFirstGe(allNotes, currentTime.value)
      scheduler()
    }
  }

  function animate() {
    if (!playing) return
    const elapsed = audioCtx.currentTime - startTime
    currentTime.value = elapsed / scheduleRatio
    activeTracks.value = computeActiveTracks(currentTime.value)
    if (elapsed >= duration.value * scheduleRatio) {
      playing = false
      isPlaying.value = false
      isPaused.value = false
      pausedAt = 0
      currentTime.value = 0
      activeTracks.value = new Map()
      return
    }
    rafId = requestAnimationFrame(animate)
  }

  function setTempo(val) {
    const t = parseFloat(val)
    if (isNaN(t)) return
    bpm.value = t
    if (playing) {
      if (tempoTimeout) clearTimeout(tempoTimeout)
      tempoTimeout = setTimeout(() => {
        stopAllInstruments(instruments)
        const ratio = (midi.header.tempos[0]?.bpm || 120) / bpm.value
        pausedAt = currentTime.value * ratio
        scheduleAll()
        tempoTimeout = null
      }, 80)
    }
  }

  function setTrackVolume(index, value) {
    const vol = parseInt(value, 10)
    if (tracks.value[index]) tracks.value[index].volume = vol
    applyTrackGain(index)
    if (isLoaded.value) scheduleVisualizerBlob()
  }

  function setTrackInstrument(index, value) {
    const program = parseInt(value, 10)
    if (tracks.value[index]) tracks.value[index].program = program
    if (!audioCtx) return

    const loadId = ++instrumentLoadId
    loadInstrument(audioCtx, program, trackGains[index])
      .then((inst) => {
        if (loadId !== instrumentLoadId) return
        const oldInst = instruments[index]
        if (oldInst && typeof oldInst.stop === 'function') oldInst.stop()
        instruments[index] = inst
        if (playing) scheduleTrack(index)
        applyTrackGain(index)
      })
      .catch(() => {})
  }

  function setAllTrackVolumes(volume) {
    tracks.value.forEach((track) => {
      track.volume = volume
    })
    tracks.value.forEach((_, i) => applyTrackGain(i))
    if (isLoaded.value) scheduleVisualizerBlob()
  }

  function setAllTrackInstruments(program) {
    tracks.value.forEach((track) => {
      track.program = program
    })
    if (!audioCtx) return
    const loadId = ++instrumentLoadId
    tracks.value.forEach((_, index) => {
      loadInstrument(audioCtx, program, trackGains[index])
        .then((inst) => {
          if (loadId !== instrumentLoadId) return
          const oldInst = instruments[index]
          if (oldInst && typeof oldInst.stop === 'function') oldInst.stop()
          instruments[index] = inst
          if (playing) scheduleTrack(index)
          applyTrackGain(index)
        })
        .catch(() => {})
    })
  }

  function setTrackMuted(index, value) {
    if (tracks.value[index]) tracks.value[index].muted = value
    if (value && tracks.value[index]?.solo) {
      tracks.value[index].solo = false
    }
    applyAllTrackGains()
    refreshVisualizerBlob()
  }

  function setTrackSolo(index, value) {
    if (value) {
      const wasAnySolo = tracks.value.some((t) => t.solo)
      if (!wasAnySolo) {
        prevMuted = tracks.value.map((t) => t.muted)
      }
      tracks.value[index].muted = false
      tracks.value[index].solo = true
      tracks.value.forEach((t, i) => {
        if (i !== index && !t.solo) t.muted = true
      })
    } else {
      tracks.value[index].solo = false
      const anySolo = tracks.value.some((t) => t.solo)
      if (!anySolo) {
        tracks.value.forEach((t, i) => {
          t.muted = prevMuted[i] ?? false
        })
      } else {
        tracks.value[index].muted = true
        tracks.value.forEach((t, i) => {
          if (i !== index && !t.solo) t.muted = true
        })
      }
    }
    leadTrack.value = -1
    applyAllTrackGains()
    refreshVisualizerBlob()
  }

  function setTrackLead(index) {
    if (leadTrack.value === index) {
      tracks.value.forEach((t) => {
        t.volume = 100
      })
      leadTrack.value = -1
    } else {
      const anySolo = tracks.value.some((t) => t.solo)
      if (anySolo) {
        tracks.value.forEach((t, i) => {
          t.solo = false
          t.muted = prevMuted[i] ?? false
        })
      }
      if (tracks.value[index]?.muted) {
        tracks.value[index].muted = false
      }
      tracks.value.forEach((t, i) => {
        t.volume = i === index ? 100 : 25
      })
      leadTrack.value = index
    }
    applyAllTrackGains()
    if (isLoaded.value) refreshVisualizerBlob()
  }

  function disposeAll() {
    if (tempoTimeout) clearTimeout(tempoTimeout)
    if (visTimeout) clearTimeout(visTimeout)
    stopScheduler()
    if (rafId) cancelAnimationFrame(rafId)
    closeAudioContext(audioCtx)
    audioCtx = null
    masterGain = null
    trackGains = []
    instruments = []
    allNotes = []
    maxNoteDuration = 0
    midi = null
    playing = false
    isPlaying.value = false
    isPaused.value = false
    pausedAt = 0
    currentTime.value = 0
    isLoaded.value = false
    tracks.value = []
    activeTracks.value = new Map()
    leadTrack.value = -1
    if (visualizerUrl.value) {
      URL.revokeObjectURL(visualizerUrl.value)
      visualizerUrl.value = ''
    }
  }

  async function loadMidiFromUrl(url) {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const buffer = await response.arrayBuffer()
    midiUrl.value = url
    await parseMidi(buffer)
  }

  async function loadMidiFromBuffer(buffer, blobUrl) {
    midiUrl.value = blobUrl
    await parseMidi(buffer)
  }

  async function handleFileSelect(e) {
    ensureAudio()

    // PrimeAutocomplete emits the value directly (as a string)
    // or as an object if option-value isn't used.
    const file = typeof e === 'string' ? e : (e?.value ?? e?.target?.value)

    if (!file || typeof file !== 'string') return

    // Only proceed if the value is exactly a known filename from our metadata.
    // This prevents search queries or group headers from triggering loads.
    const exists = midiFileMeta.some((m) => m.fileName === file)
    if (!exists) return

    try {
      await loadMidiFromUrl(midiBaseUrl + file)
    } catch (err) {
      console.error('Failed to load MIDI file:', file, err)
    }
  }

  async function handleUpload(e) {
    ensureAudio()
    const file = e.target.files[0]
    if (file) {
      const buffer = await file.arrayBuffer()
      const blobUrl = URL.createObjectURL(file)
      await loadMidiFromBuffer(buffer, blobUrl)
    }
  }

  return {
    midiUrl,
    tracks,
    isPlaying,
    isPaused,
    bpm,
    originalBpm,
    duration,
    currentTime,
    isLoaded,
    visualizerUrl,
    activeTracks,
    leadTrack,
    handleFileSelect,
    handleUpload,
    togglePlay,
    stop,
    setTempo,
    seek,
    setTrackVolume,
    setTrackInstrument,
    setAllTrackVolumes,
    setAllTrackInstruments,
    setTrackMuted,
    setTrackSolo,
    setTrackLead,
  }
}
