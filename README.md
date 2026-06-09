# MidiVoci — rehearsal player for choirs

A browser-based rehearsal player with piano roll visualization, multi-track controls, tempo adjustment and transposition, with sheet music and video display.

Comes with a selection of works from [John's Midi File Choral Music](https://www.learnchoralmusic.co.uk/).

Supports upload of either MIDI or MusicXML files. For the latter, an interactive score can be shown, allowing the user to skip to any point in the score.

**→ https://rubjo.github.io/midivoci/**

## Features

- **MIDI playback** with SoundFont instruments
- **Piano roll** visualization synced to playback
- **Multi-track controls** — volume, mute, solo, lead, instrument selection
- **Tempo & transpose** — adjust speed (25%–300%) and key (±12 semitones)
- **Sheet music** — MusicXML score rendering (Verovio)
- **Interactive score** — (MusicXML only) click anywhere on a system to seek
- **File upload** — load your own MIDI or MusicXML files
- **Floating controls** — detachable transport bar
- **Language support** — 9 languages (EN, NO, DE, FR, IT, ES, SV, DA, FI)
- **Dark/light theme** — system-aware toggle

## Credits

- MIDI files adapted from [John's Midi File Choral Music](https://www.learnchoralmusic.co.uk/)
- Sheet music from [IMSLP](https://imslp.org/) and other sources
- Built with Vue 3, PrimeVue, Verovio, Tone.js, html-midi-player, soundfont-player
