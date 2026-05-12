import { fileURLToPath, URL } from 'node:url'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tonejsMidi from '@tonejs/midi'
const { Midi } = tonejsMidi

function midiFilePlugin() {
  const VIRTUAL_MODULE = 'virtual:midi-files'
  let fileList = []

  function walk(dir) {
    let results = []
    const list = readdirSync(dir, { withFileTypes: true })
    for (const dirent of list) {
      const res = resolve(dir, dirent.name)
      if (dirent.isDirectory()) {
        results = results.concat(walk(res))
      } else if (dirent.name.endsWith('.mid')) {
        results.push(res)
      }
    }
    return results
  }

  function computeList(midiDir) {
    if (!existsSync(midiDir)) return []

    const files = walk(midiDir)

    const fileData = files.map((fullPath) => {
      const buf = readFileSync(fullPath)
      const fileName = resolve(fullPath, '')
        .replace(midiDir + '/', '')
        .replace(/^\\/, '')
      let name = fileName.replace(/\.mid$/, '')
      let composer = ''
      let numTracks = 0
      let duration = 0

      try {
        const midi = new Midi(new Uint8Array(buf))
        numTracks = midi.tracks.filter((t) => t.notes.length > 0).length
        duration = midi.duration
        if (midi.header.name) name = midi.header.name
        if (midi.header.copyright) {
          const m = midi.header.copyright.match(/[©(c)]\s*\d{4}\s*(.+)/i)
          if (m) composer = m[1].trim()
        }
        if (!composer) {
          const dirName = fileName.split('/')[0]
          if (dirName) composer = dirName
        }
        const fnMatch = fileName.match(/^(.+?)\s*-\s*(.+?)\.mid$/)
        if (fnMatch) {
          if (!composer) composer = fnMatch[1].trim()
          if (name === fileName.replace(/\.mid$/, '')) name = fnMatch[2].trim()
        }
      } catch (e) {
        // fallback handled by initial name value
      }

      const naturalDisplay = name.replace(/_/g, ' ').replace(/-/g, ' ')
      return { fileName, name, composer, naturalDisplay, numTracks, duration }
    })

    const titleCounts = {}
    fileData.forEach((f) => {
      titleCounts[f.naturalDisplay] = (titleCounts[f.naturalDisplay] || 0) + 1
    })

    const composerMetaMap = {}
    const composerDirs = [...new Set(fileData.map((f) => f.fileName.split('/')[0]))]
    for (const dir of composerDirs) {
      const aboutPath = resolve(midiDir, dir, 'ABOUT.md')
      if (existsSync(aboutPath)) {
        const content = readFileSync(aboutPath, 'utf-8')
        const meta = {}
        for (const line of content.split('\n')) {
          const m = line.match(/^(\w+):\s*"(.+)"\s*$/)
          if (m) meta[m[1]] = m[2]
        }
        composerMetaMap[dir] = meta
      }
    }

    return fileData.map((f) => {
      let display = f.naturalDisplay
      if (titleCounts[display] > 1) {
        const baseName = f.fileName
          .split('/')
          .pop()
          .replace(/\.mid$/, '')
        display = `${display} (${baseName})`
      }
      return {
        fileName: f.fileName,
        name: f.name,
        composer: f.composer,
        composerMeta: composerMetaMap[f.fileName.split('/')[0]] || null,
        display,
        numTracks: f.numTracks,
        duration: f.duration,
      }
    })
  }

  return {
    name: 'midi-file-plugin',
    buildStart() {
      const PUBLIC_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), 'public')
      fileList = computeList(resolve(PUBLIC_DIR, 'midi'))
    },
    resolveId(id) {
      if (id === VIRTUAL_MODULE) return VIRTUAL_MODULE
    },
    load(id) {
      if (id !== VIRTUAL_MODULE) return
      return `
import { ref } from 'vue'
const data = ref([])
if (import.meta.env.DEV) {
  data.value = ${JSON.stringify(fileList)}
} else {
  const base = (import.meta.env.BASE_URL || '/') + 'midi/midi-files.json'
  fetch(base).then(r => r.json()).then(d => { data.value = d })
}
export const midiFileList = data
export default data
`
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'midi/midi-files.json',
        source: JSON.stringify(fileList),
      })
    },
  }
}

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  clearScreen: false,
  base: process.env.TAURI_ENV_PLATFORM ? './' : '/midivox/',
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.includes('-'),
        },
      },
    }),
    vueDevTools(),
    midiFilePlugin(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: host ? true : false,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM
      ? process.env.TAURI_ENV_PLATFORM === 'windows'
        ? 'chrome105'
        : 'safari14'
      : undefined,
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
})
