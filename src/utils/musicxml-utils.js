import { unzipSync, strFromU8 } from 'fflate'
import tonejsMidi from '@tonejs/midi'

const { Midi } = tonejsMidi

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function midiNumber(step, octave, alter) {
  return (octave + 1) * 12 + (NOTE_INDEX[step] || 0) + (alter || 0)
}

export function musicXmlToMidiBuffer(xmlContent) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlContent, 'text/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error('Invalid XML: ' + parseError.textContent)

  const parts = doc.querySelectorAll('score-partwise > part-list > score-part')
  const partElements = doc.querySelectorAll('score-partwise > part')
  const midi = new Midi()

  const firstMeasure = doc.querySelector('measure')
  const divisionsEl = firstMeasure?.querySelector('attributes > divisions')
  const divisions = divisionsEl ? parseInt(divisionsEl.textContent) || 1 : 1

  const firstTempoSound = doc.querySelector('sound[tempo]')
  const initialBpm = firstTempoSound ? parseFloat(firstTempoSound.getAttribute('tempo')) || 120 : 120
  const PPQ = midi.header.ppq

  const tempoChanges = [{ ticks: 0, bpm: initialBpm }]
  midi.header.tempos = tempoChanges
  midi.header.timeSignatures = [{ ticks: 0, timeSignature: [4, 4] }]
  midi.header.update()

  for (let pi = 0; pi < partElements.length; pi++) {
    const partEl = partElements[pi]
    const partId = partEl.getAttribute('id') || ''
    const scorePart = Array.from(parts).find((p) => p.getAttribute('id') === partId)
    const instrumentName = scorePart
      ? scorePart.querySelector('part-name')?.textContent || scorePart.querySelector('track-name')?.textContent || `Part ${pi + 1}`
      : `Part ${pi + 1}`
    const midiProgram = scorePart
      ? parseInt(scorePart.querySelector('midi-program')?.textContent) || 0
      : 0

    const track = midi.addTrack()
    track.instrument.name = instrumentName
    track.instrument.number = midiProgram

    let absTime = 0
    const measures = partEl.querySelectorAll('measure')

    for (const measure of measures) {
      if (pi === 0) {
        const tempoSound = measure.querySelector('direction > sound[tempo], sound[tempo]')
        if (tempoSound) {
          const newBpm = parseFloat(tempoSound.getAttribute('tempo')) || initialBpm
          if (Math.abs(newBpm - tempoChanges[tempoChanges.length - 1].bpm) > 0.1) {
            tempoChanges.push({ ticks: Math.round(absTime * PPQ), bpm: newBpm })
          }
        }
      }

      const mDivisions = measure.querySelector('attributes > divisions')
      const mDiv = mDivisions ? parseInt(mDivisions.textContent) || divisions : divisions

      const notes = measure.querySelectorAll('note:not([print-object=no])')
      let measureDur = 0

      for (const note of notes) {
        if (note.querySelector('grace')) continue
        if (note.querySelector('rest')) {
          const dur = parseInt(note.querySelector('duration')?.textContent) || 0
          measureDur += dur
          continue
        }

        const pitch = note.querySelector('pitch')
        if (!pitch) {
          const dur = parseInt(note.querySelector('duration')?.textContent) || 0
          measureDur += dur
          continue
        }

        const step = pitch.querySelector('step')?.textContent || 'C'
        const octave = parseInt(pitch.querySelector('octave')?.textContent) || 4
        const alterEl = pitch.querySelector('alter')
        const alter = alterEl ? parseInt(alterEl.textContent) || 0 : 0
        const dur = parseInt(note.querySelector('duration')?.textContent) || 0
        const type = note.querySelector('type')?.textContent || ''

        measureDur += dur

        let noteDur = dur / mDiv
        if (type === 'whole') noteDur = dur / mDiv
        else if (type === 'half') noteDur = 2
        else if (type === 'quarter') noteDur = 1
        else if (type === 'eighth') noteDur = 0.5
        else if (type === '16th') noteDur = 0.25
        else if (type === '32nd') noteDur = 0.125

        const dots = note.querySelectorAll('dot').length
        const finalDur = noteDur + (dots > 0 ? noteDur * (1 - Math.pow(0.5, dots)) : 0)

        const chord = note.querySelector('chord')
        const time = chord ? absTime : absTime

        track.addNote({
          midi: midiNumber(step, octave, alter),
          ticks: Math.round(time * PPQ),
          durationTicks: Math.round(Math.max(finalDur, 0.0625) * PPQ),
        })

        if (!chord) absTime += dur / mDiv
      }

      if (measureDur === 0) absTime += 4
    }
  }

  midi.header.tempos = tempoChanges
  midi.header.update()

  const encoded = midi.toArray()
  if (!encoded || !encoded.length) throw new Error('Generated empty MIDI')
  return encoded.buffer
}

export function decompressMxl(buffer) {
  const zip = unzipSync(new Uint8Array(buffer))
  const containerXml = zip['META-INF/container.xml']
  if (containerXml) {
    const doc = new DOMParser().parseFromString(strFromU8(containerXml), 'text/xml')
    const rootPath = doc.querySelector('rootfile')?.getAttribute('full-path')
    if (rootPath && zip[rootPath]) {
      return strFromU8(zip[rootPath])
    }
  }
  for (const name of Object.keys(zip)) {
    if (/\.musicxml$/i.test(name) || (/\.xml$/i.test(name) && name !== 'META-INF/container.xml')) {
      return strFromU8(zip[name])
    }
  }
  throw new Error('No MusicXML file found in .mxl archive')
}
