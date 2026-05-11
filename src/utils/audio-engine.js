import Soundfont from 'soundfont-player'
import SamplePlayer from 'sample-player'
import { getSfName } from '../constants/instruments.js'

const bufferCache = new WeakMap()

export function createAudioContext() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const masterGain = audioCtx.createGain()
  masterGain.gain.value = 1
  masterGain.connect(audioCtx.destination)
  return { audioCtx, masterGain }
}

export function resumeAudioContext(audioCtx) {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
}

export function createTrackGains(audioCtx, masterGain, count) {
  return Array.from({ length: count }, () => {
    const g = audioCtx.createGain()
    g.gain.value = 1
    g.connect(masterGain)
    return g
  })
}

export async function loadInstrument(audioCtx, program, destination) {
  const sfName = getSfName(program)

  if (!bufferCache.has(audioCtx)) {
    bufferCache.set(audioCtx, new Map())
  }
  const ctxCache = bufferCache.get(audioCtx)

  if (!ctxCache.has(sfName)) {
    ctxCache.set(sfName, loadBuffer(audioCtx, sfName))
  }

  const buffers = await ctxCache.get(sfName)
  const inst = SamplePlayer(audioCtx, buffers, { gain: 0.5 })
  inst.connect(destination)
  return inst
}

async function loadBuffer(audioCtx, sfName) {
  const inst = await Soundfont.instrument(audioCtx, sfName, { gain: 0.5 })
  return inst.buffers
}

export function stopAllInstruments(instruments) {
  for (const inst of instruments) {
    if (inst && typeof inst.stop === 'function') {
      inst.stop()
    }
  }
}

export function closeAudioContext(ctx) {
  if (ctx) ctx.close()
}
