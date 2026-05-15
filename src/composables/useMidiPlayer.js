import { ref, onUnmounted } from 'vue'
import { midiFileList } from 'virtual:midi-files'
import { parseMidiFile, generateVisualizerBlob } from '../utils/midi-parser.js'
import {
  createAudioContext,
  resumeAudioContext,
  createTrackGains,
  createTrackPanners,
  loadInstrument,
  stopAllInstruments,
  closeAudioContext,
} from '../utils/audio-engine.js'

export const midiFileMeta = midiFileList
const isTauri = !!import.meta.env.TAURI_ENV_PLATFORM
const musicBaseUrl = isTauri ? '/music/' : '/midivox/music/'

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
  const leadTrack = ref([])
  const currentFileMeta = ref(null)
  const currentFileHasPdf = ref(false)
  const transpose = ref(0)
  const loop = ref(false)

  let audioCtx = null
  let masterGain = null
  let trackGains = []
  let trackPanners = []
  let midi = null
  let instruments = []
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

  async function ensureAudio() {
    if (!audioCtx) {
      const ctx = createAudioContext()
      audioCtx = ctx.audioCtx
      masterGain = ctx.masterGain
    }
    await resumeAudioContext(audioCtx)
  }

  function isTrackEffectivelyMuted(i) {
    const t = tracks.value[i]
    if (!t) return true
    const anySolo = tracks.value.some((s) => s.solo)
    if (anySolo) return !t.solo
    return t.muted
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

  function applyTrackPan(index) {
    if (trackPanners[index]) {
      trackPanners[index].pan.value = ((tracks.value[index]?.pan ?? 50) - 50) / 50
    }
  }

  function applyAllTrackPans() {
    trackPanners.forEach((_, i) => applyTrackPan(i))
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

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

  function noteNameFromMidi(midi) {
    const clamped = Math.max(0, Math.min(127, Math.round(midi)))
    const octave = Math.floor(clamped / 12) - 1
    return NOTE_NAMES[clamped % 12] + octave
  }

  function getTransposedName(n) {
    if (!transpose.value) return n.name
    return noteNameFromMidi(n.midi + transpose.value)
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
        active.set(n.trackIndex, getTransposedName(n))
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

      if (!isTrackEffectivelyMuted(n.trackIndex)) {
        const inst = instruments[n.trackIndex]
        if (inst) {
          try {
            // If the note was supposed to play in the past (e.g. start of song),
            // schedule it for 'now' to avoid skipping it, but keep the duration relative.
            const scheduledTime = Math.max(now, absTime)
            inst.play(getTransposedName(n), scheduledTime, { duration: n.duration * ratio, gain: 1 })
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
      if (!isTrackEffectivelyMuted(index)) continue
      try {
        inst.play(getTransposedName(n), absTime, { duration: n.duration * ratio, gain: 1 })
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
    const blob = generateVisualizerBlob(midi, tracks.value, transpose.value)
    visualizerUrl.value = URL.createObjectURL(blob)
  }

  async function loadAllInstruments() {
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
  }

  async function parseMidi(buffer) {
    try {
      resetTrackState()
      await ensureAudio()

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
      trackGains = createTrackGains(audioCtx, masterGain, midi.tracks.length)
      trackPanners = createTrackPanners(audioCtx, trackGains, masterGain, midi.tracks.length)
      await loadAllInstruments()

      isLoaded.value = true
      refreshVisualizerBlob()
    } catch (err) {
      console.error('parseMidi failed:', err)
    }
  }

  async function play() {
    if (!midi || !isLoaded.value) return

    if (isPaused.value) {
      await ensureAudio()
      playing = true
      isPlaying.value = true
      isPaused.value = false
      animate()
      startScheduler()
      return
    }

    await ensureAudio()
    if (instruments.length === 0 && midi) {
      trackGains = createTrackGains(audioCtx, masterGain, midi.tracks.length)
      trackPanners = createTrackPanners(audioCtx, trackGains, masterGain, midi.tracks.length)
      await loadAllInstruments()
    }
    applyAllTrackGains()
    applyAllTrackPans()
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

  async function seek(time) {
    if (!midi || !isLoaded.value) return
    await ensureAudio()
    const clamped = Math.max(0, Math.min(time, duration.value))
    currentTime.value = clamped
    const ratio = (midi.header.tempos[0]?.bpm || 120) / bpm.value
    pausedAt = clamped * ratio
    if (playing) {
      stopAllInstruments(instruments)
      const now = audioCtx.currentTime
      startTime = now - pausedAt
      nextNoteIndex = binarySearchFirstGe(allNotes, currentTime.value)
      scheduler()
    } else {
      startTime = audioCtx.currentTime - pausedAt
      nextNoteIndex = binarySearchFirstGe(allNotes, currentTime.value)
    }
  }

  function animate() {
    if (!playing) return
    const elapsed = audioCtx.currentTime - startTime
    currentTime.value = elapsed / scheduleRatio
    activeTracks.value = computeActiveTracks(currentTime.value)
    if (elapsed >= duration.value * scheduleRatio) {
      if (loop.value) {
        stopAllInstruments(instruments)
        pausedAt = 0
        currentTime.value = 0
        nextNoteIndex = 0
        const ratio = (midi.header.tempos[0]?.bpm || 120) / bpm.value
        scheduleRatio = ratio
        startTime = audioCtx.currentTime
        scheduler()
        activeTracks.value = new Map()
        rafId = requestAnimationFrame(animate)
      } else {
        playing = false
        isPlaying.value = false
        isPaused.value = false
        pausedAt = 0
        currentTime.value = 0
        activeTracks.value = new Map()
      }
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

  function setTranspose(val) {
    const clamped = Math.max(-12, Math.min(12, Math.round(val)))
    if (clamped === transpose.value) return
    transpose.value = clamped
    if (playing) stop()
    refreshVisualizerBlob()
  }

  function setTrackVolume(index, value) {
    const vol = parseInt(value, 10)
    if (tracks.value[index]) tracks.value[index].volume = vol
    applyTrackGain(index)
    if (isLoaded.value) scheduleVisualizerBlob()
  }

  function setTrackPan(index, value) {
    const pan = parseInt(value, 10)
    if (tracks.value[index]) tracks.value[index].pan = pan
    applyTrackPan(index)
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

  function setAllTrackPans(value) {
    tracks.value.forEach((track) => {
      track.pan = value
    })
    tracks.value.forEach((_, i) => applyTrackPan(i))
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
      tracks.value[index].muted = false
      tracks.value[index].solo = true
      tracks.value.forEach((t, i) => {
        if (i !== index && !t.solo) t.muted = true
      })
    } else {
      tracks.value[index].solo = false
      if (!tracks.value.some((t) => t.solo)) {
        tracks.value.forEach((t) => {
          t.muted = false
        })
      } else {
        tracks.value[index].muted = true
        tracks.value.forEach((t, i) => {
          if (i !== index && !t.solo) t.muted = true
        })
      }
    }
    leadTrack.value = []
    applyAllTrackGains()
    refreshVisualizerBlob()
  }

  function setTrackLead(index) {
    const leads = [...leadTrack.value]
    const pos = leads.indexOf(index)
    if (pos >= 0) {
      leads.splice(pos, 1)
    } else {
      leads.push(index)
      const track = tracks.value[index]
      if (track) {
        track.solo = false
        track.muted = false
        track.volume = 100
      }
      tracks.value.forEach((t, i) => {
        if (i !== index && t.solo) t.solo = false
      })
    }
    leadTrack.value = leads
    if (leads.length > 0) {
      tracks.value.forEach((t, i) => {
        if (!leads.includes(i)) t.volume = 25
      })
    } else {
      tracks.value.forEach((t) => {
        t.volume = 100
      })
    }
    applyAllTrackGains()
    if (isLoaded.value) refreshVisualizerBlob()
  }

  function resetTrackState() {
    if (tempoTimeout) clearTimeout(tempoTimeout)
    if (visTimeout) clearTimeout(visTimeout)
    stopScheduler()
    if (rafId) cancelAnimationFrame(rafId)
    stopAllInstruments(instruments)
    trackGains.forEach((g) => {
      try { g.disconnect() } catch {}
    })
    trackPanners.forEach((p) => {
      try { p.disconnect() } catch {}
    })
    trackGains = []
    trackPanners = []
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
    leadTrack.value = []
    currentFileMeta.value = null
    currentFileHasPdf.value = false
    transpose.value = 0
    if (visualizerUrl.value) {
      URL.revokeObjectURL(visualizerUrl.value)
      visualizerUrl.value = ''
    }
  }

  function disposeAll() {
    resetTrackState()
    closeAudioContext(audioCtx)
    audioCtx = null
    masterGain = null
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

  async function loadMidiFromBuffer(buffer, blobUrl, meta = null) {
    midiUrl.value = blobUrl
    await parseMidi(buffer)
    if (meta) {
      currentFileMeta.value = meta
    }
  }

  async function handleFileSelect(e) {
    await ensureAudio()

    // PrimeAutocomplete emits the value directly (as a string)
    // or as an object if option-value isn't used.
    const file = typeof e === 'string' ? e : (e?.value ?? e?.target?.value)

    if (!file || typeof file !== 'string') return

    // Only proceed if the value is exactly a known filename from our metadata.
    // This prevents search queries or group headers from triggering loads.
    const item = midiFileMeta.value.find((m) => m.fileName === file)
    if (!item) return

    try {
      await loadMidiFromUrl(musicBaseUrl + file)
      const meta = item.meta || {}
      currentFileMeta.value = { ...meta, composer: item.composer, title: item.display }
      currentFileHasPdf.value = !!item.hasPdf
    } catch (err) {
      console.error('Failed to load MIDI file:', file, err)
    }
  }

  async function handleUpload(e) {
    await ensureAudio()
    const file = e.target.files[0]
    if (file) {
      currentFileMeta.value = null
      currentFileHasPdf.value = false
      const buffer = await file.arrayBuffer()
      const blobUrl = URL.createObjectURL(file)
      const fileName = file.name.replace(/\.midi?$/i, '')
      await loadMidiFromBuffer(buffer, blobUrl, { title: fileName, composer: '' })
    }
  }

  function toggleLoop() {
    loop.value = !loop.value
  }

  return {
    midiUrl,
    tracks,
    isPlaying,
    bpm,
    originalBpm,
    duration,
    currentTime,
    isLoaded,
    visualizerUrl,
    activeTracks,
    leadTrack,
    currentFileMeta,
    currentFileHasPdf,
    transpose,
    loop,
    setTranspose,
    toggleLoop,
    handleFileSelect,
    handleUpload,
    loadMidiFromBuffer,
    togglePlay,
    stop,
    setTempo,
    seek,
    setTrackVolume,
    setTrackPan,
    setTrackInstrument,
    setAllTrackVolumes,
    setAllTrackPans,
    setAllTrackInstruments,
    setTrackMuted,
    setTrackSolo,
    setTrackLead,
  }
}
