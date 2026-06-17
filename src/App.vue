<template>
  <div :class="['app', { 'has-floating': isFloating }]" :data-theme="theme">
    <header class="app-header">
      <div class="flex align-items-center gap-2 cursor-pointer" @click="infoDialogVisible = true">
        <img src="./assets/logo.png" alt="MidiVoci" class="header-logo" />
        <div class="app-title-wrapper">
          <h1>
            {{ t('app.title') }}<span class="subtitle-desktop">&nbsp;{{ t('app.subtitle') }}</span>
          </h1>
          <span class="subtitle-mobile">{{ t('app.subtitle') }}</span>
        </div>
      </div>
      <div class="header-actions">
        <div @click.stop>
          <PrimeSelect
            :options="langOptions"
            option-label="label"
            option-value="code"
            :model-value="locale"
            @change="setLocale"
            @show="langDropdownOpen = true"
            @hide="onLangDropdownHide"
            class="lang-select"
            scroll-height="400px"
            label-class="pr-0 py-2"
            append-to="body"
          >
            <template #value="slotProps">
              <div class="flex align-items-center gap-1" v-if="slotProps.value">
                <IconLanguage :size="16" />
                <span>{{ slotProps.value.toUpperCase() }}</span>
              </div>
            </template>
          </PrimeSelect>
        </div>
        <Button @click="toggleTheme" :title="isDark ? t('light_mode') : t('dark_mode')">
          <IconSun v-if="isDark" :size="16" />
          <IconMoon v-else :size="16" />
        </Button>
        <PrimeDialog
          v-model:visible="infoDialogVisible"
          modal
          :draggable="false"
          :style="{ maxWidth: '420px' }"
          class="info-dialog"
          header="MidiVoci"
        >
          <img src="./assets/logo.png" alt="MidiVoci" class="info-dialog-banner" />
          <div class="info-dialog-body">
            <div class="text-center -mt-5 mb-4">
              <em style="font-size: 1.5rem">{{ t('app.tagline') }}</em>
            </div>
            {{ t('app.description') }}
            {{ t('app.created_by') }}
            <a href="https://github.com/rubjo/midivoci" target="_blank" rel="noopener noreferrer"
              >@rubjo</a
            >
            <span v-if="!isTauri" class="info-dialog-donate">
              – {{ t('app.donations_welcome') }}
              <div class="mt-3">
                <a
                  href="https://www.paypal.com/donate/?hosted_button_id=QT5CW924DJN3Q"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    width="175"
                    src="https://raw.githubusercontent.com/andreostrovsky/donate-with-paypal/refs/heads/master/blue.svg"
                    alt="PayPal donate"
                  />
                </a>
              </div>
              <div class="mt-4 flex flex-column align-items-center gap-2">
                <span class="text-sm font-semibold">{{ t('app.install_from_app_store') }}</span>
                <div class="flex gap-2 flex-wrap justify-content-center">
                  <a
                    href="https://apps.apple.com/us/app/midivoci/id6777052916?platform=mac"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      height="35"
                      src="https://tools.applemediaservices.com/api/badges/download-on-the-mac-app-store/black/en-us?size=250x83"
                      alt="Download on the Mac App Store"
                    />
                  </a>
                  <a
                    href="https://apps.apple.com/us/app/midivoci/id6777052916?platform=ios"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      height="35"
                      src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83"
                      alt="Download on the App Store"
                    />
                  </a>
                </div>
              </div>
            </span>

            <PrimeDivider />

            <h4 class="text-sm font-semibold text-color-secondary text-uppercase mb-2">
              {{ t('app.midi_files') }}
            </h4>
            <p class="text-sm">
              {{ t('app.midi_credit') }}
              <a
                href="https://www.learnchoralmusic.co.uk/"
                target="_blank"
                rel="noopener noreferrer"
                >learnchoralmusic.co.uk</a
              >
            </p>

            <PrimeDivider />

            <h4 class="text-sm font-semibold text-color-secondary text-uppercase mb-2">
              {{ t('app.libraries') }}
            </h4>
            <div class="text-sm info-dialog-tags flex flex-wrap gap-2">
              <a
                v-for="lib in libraries"
                :key="lib.name"
                :href="lib.url"
                target="_blank"
                rel="noopener noreferrer"
                class="info-dialog-tag"
              >
                {{ lib.name }}
              </a>
            </div>

            <PrimeDivider />

            <h4 class="text-sm font-semibold text-color-secondary text-uppercase mb-2">
              {{ t('app.other_projects') }}
            </h4>
            <div class="text-sm flex flex-column gap-1">
              <a
                v-for="p in projects"
                :key="p.name"
                :href="p.url"
                target="_blank"
                rel="noopener noreferrer"
                class="info-dialog-link"
              >
                {{ p.name }}
              </a>
            </div>
          </div>
        </PrimeDialog>
      </div>
    </header>

    <main>
      <section v-if="!midiUrl && !musicXmlContent">
        <PrimeInputGroup>
          <PrimeAutocomplete
            ref="autocomplete"
            v-model="autocompleteValue"
            :suggestions="suggestions"
            @complete="searchFiles"
            @focus="onAutocompleteFocus"
            @option-select="onOptionSelect"
            option-label="label"
            option-group-label="label"
            option-group-children="items"
            option-value="value"
            :placeholder="t('searchForComposerOrWork')"
            class="w-full"
            scroll-height="70vh"
            :delay="300"
            :loading="!dataLoaded"
            fluid
          >
            <template #header>
              <div class="flex gap-3 p-2 border-bottom-1 surface-border">
                <div class="flex align-items-center gap-2">
                  <PrimeToggleSwitch v-model="filterScore" />
                  <IconMusic :size="14" class="text-color-secondary" />
                  <span class="text-xs text-color-secondary">{{ t('score') }}</span>
                </div>
                <div class="flex-1"></div>
                <a
                  :href="suggestMissingUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="p-button p-button-text p-1 flex-shrink-0 no-underline"
                  style="font-size: 0.75rem"
                  @click.stop
                >
                  <IconExternalLink :size="14" />
                  <span class="hidden lg:inline">{{ t('suggest_missing_work') }}</span>
                  <span class="lg:hidden">{{ t('suggest') }}</span>
                </a>
              </div>
            </template>
            <template #item="slotProps">
              {{ slotProps.value ? metaLabel(slotProps.value) : t('searchForComposerOrWork') }}
            </template>
            <template #optiongroup="slotProps">
              <div class="midi-group-header flex align-items-center w-full">
                <div class="flex align-items-center gap-2 flex-wrap flex-1 min-w-0 text-sm">
                  <span>{{ slotProps.option.composerMeta?.name || slotProps.option.label }}</span>
                  <span
                    v-if="
                      slotProps.option.composerMeta?.born || slotProps.option.composerMeta?.died
                    "
                  >
                    ({{ slotProps.option.composerMeta?.born || '?' }}–{{
                      slotProps.option.composerMeta?.died || '?'
                    }})
                  </span>
                </div>
              </div>
            </template>
            <template #option="slotProps">
              <div class="midi-option pl-3">
                <div class="midi-option-main flex flex-column gap-1">
                  <span class="midi-option-name font-semibold">{{ slotProps.option.label }}</span>
                  <div class="flex gap-2 flex-wrap">
                    <Tag
                      v-if="slotProps.option.duration > 0"
                      severity="secondary"
                      class="font-mono track-info"
                    >
                      <IconClock :size="12" />
                      {{ formatDuration(slotProps.option.duration) }}
                    </Tag>
                    <Tag
                      v-if="slotProps.option.numTracks > 0"
                      severity="secondary"
                      class="font-mono track-info"
                    >
                      <IconUsers :size="12" />
                      {{ slotProps.option.numTracks }} {{ t('parts').toLowerCase() }}
                    </Tag>
                    <Tag severity="secondary" class="font-mono track-info">
                      {{ slotProps.option.format === 'musicxml' ? 'MusicXML' : 'MIDI' }}
                    </Tag>
                    <Tag
                      v-if="slotProps.option.hasPdf"
                      severity="success"
                      class="font-mono track-info"
                    >
                      <IconMusic :size="12" />
                      {{ t('score_interactive') }}
                    </Tag>
                  </div>
                </div>
              </div>
            </template>
          </PrimeAutocomplete>
          <PrimeFileUpload
            mode="basic"
            accept=".mid,.midi,.musicxml,.xml,.mxl"
            :choose-label="t('orUpload')"
            @select="handleFileUpload"
            class="upload-inputgroup-btn"
            :disabled="langDropdownOpen"
            :pt="{ root: { class: 'flex-shrink-0' } }"
          >
            <template #chooseicon>
              <IconUpload :size="16" />
              <span class="md:hidden upload-mobile-label">{{ t('upload_mobile') }}</span>
            </template>
          </PrimeFileUpload>
        </PrimeInputGroup>
      </section>

      <div
        v-if="!isLoaded && !musicXmlContent"
        class="empty-state flex flex-column align-items-center justify-content-center"
      >
        <div class="empty-state-inner">
          <div class="empty-state-step">1. {{ t('empty_state_pick_or_upload') }}</div>
          <div class="empty-state-step">2. {{ t('empty_state_volume') }}</div>
          <div class="empty-state-step">3. {{ t('empty_state_press_play') }}</div>
        </div>

        <div
          v-if="!isTauri && !isLoaded && !musicXmlContent"
          class="store-banner flex flex-wrap align-items-center justify-content-center gap-2 p-2"
        >
          <a
            href="https://apps.apple.com/us/app/midivoci/id6777052916?platform=mac"
            target="_blank"
            rel="noopener noreferrer"
            class="store-badge-link"
          >
            <img
              height="35"
              src="https://tools.applemediaservices.com/api/badges/download-on-the-mac-app-store/black/en-us?size=250x83"
              alt="Download on the Mac App Store"
            />
          </a>
          <a
            href="https://apps.apple.com/us/app/midivoci/id6777052916?platform=ios"
            target="_blank"
            rel="noopener noreferrer"
            class="store-badge-link"
          >
            <img
              height="35"
              src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83"
              alt="Download on the App Store"
            />
          </a>
        </div>
      </div>

      <TransportControls
        v-if="isLoaded"
        :is-loaded="isLoaded"
        :is-playing="isPlaying"
        :bpm="bpm"
        :original-bpm="originalBpm"
        :current-time="currentTime"
        :duration="duration"
        :transpose="transpose"
        :title="currentFileMeta?.title"
        :composer="currentFileMeta?.composer"
        :is-floating="isFloating"
        :loop="loop"
        @toggle-play="togglePlay"
        @stop="stop"
        @set-tempo="setTempo"
        @seek="seek"
        @set-transpose="setTranspose"
        @close="clearCurrentTrack"
        @toggle-float="toggleFloat"
        @toggle-loop="toggleLoop"
      />

      <ScoreView
        v-if="midiUrl"
        :midi-url="midiUrl"
        :visualizer-url="visualizerUrl"
        :current-time="currentTime"
        :duration="duration"
        :tracks="tracks"
        @seek="seek"
      />

      <TrackList
        v-if="tracks.length > 0"
        :tracks="tracks"
        :active-tracks="activeTracks"
        :lead-track="leadTrack"
        :show-note-indicators="showNoteIndicators"
        @set-track-volume="setTrackVolume"
        @set-track-pan="setTrackPan"
        @set-track-instrument="setTrackInstrument"
        @set-all-track-volumes="setAllTrackVolumes"
        @set-all-track-pans="setAllTrackPans"
        @set-all-track-instruments="setAllTrackInstruments"
        @set-track-muted="setTrackMuted"
        @set-track-solo="setTrackSolo"
        @set-track-lead="setTrackLead"
        @toggle-note-indicators="showNoteIndicators = !showNoteIndicators"
      />

      <MusicXmlPanel
        v-if="musicXmlContent"
        :xml-content="musicXmlContent"
        :current-time="currentTime"
        :duration="duration"
        :file-meta="currentFileMeta"
        @seek="seek"
        @midi-ready="handleMidiReady"
      />
    </main>
  </div>
</template>

<script setup>
import { ref, getCurrentInstance, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  IconSun,
  IconMoon,
  IconLanguage,
  IconUpload,
  IconClock,
  IconUsers,
  IconMusic,
  IconExternalLink,
} from '@tabler/icons-vue'
import { nb_NO } from 'primelocale/js/nb_NO.js'
import { en } from 'primelocale/js/en.js'
import { de } from 'primelocale/js/de.js'
import { fr } from 'primelocale/js/fr.js'
import { it } from 'primelocale/js/it.js'
import { es } from 'primelocale/js/es.js'
import { da } from 'primelocale/js/da.js'
import { sv } from 'primelocale/js/sv.js'
import { fi } from 'primelocale/js/fi.js'

import Button from 'primevue/button'
import PrimeSelect from 'primevue/select'
import PrimeDialog from 'primevue/dialog'
import PrimeDivider from 'primevue/divider'
import PrimeFileUpload from 'primevue/fileupload'
import PrimeAutocomplete from 'primevue/autocomplete'
import PrimeToggleSwitch from 'primevue/toggleswitch'
import Tag from 'primevue/tag'
import PrimeInputGroup from 'primevue/inputgroup'

import { useMidiPlayer, midiFileMeta } from './composables/useMidiPlayer.js'
import TransportControls from './components/TransportControls.vue'
import TrackList from './components/TrackList.vue'
import ScoreView from './components/ScoreView.vue'
import MusicXmlPanel from './components/MusicXmlPanel.vue'
import { decompressMxl } from './utils/musicxml-utils.js'

const isTauri = !!window.__TAURI_INTERNALS__

const { t, locale } = useI18n()

const $primevue = getCurrentInstance().appContext.config.globalProperties.$primevue

const langOptions = [
  { code: 'en', label: 'English' },
  { code: 'no', label: 'Norsk' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
  { code: 'da', label: 'Dansk' },
  { code: 'sv', label: 'Svenska' },
  { code: 'fi', label: 'Suomi' },
]

const langDropdownOpen = ref(false)
let langHideTimer

function onLangDropdownHide() {
  langHideTimer = setTimeout(() => {
    langDropdownOpen.value = false
  }, 150)
}

onUnmounted(() => clearTimeout(langHideTimer))

const primeLocales = { no: nb_NO, de, fr, it, es, da, sv, fi }

function setPrimeLocale(localeCode) {
  $primevue.config.locale = primeLocales[localeCode] || en
}

function setLocale(e) {
  const val = typeof e === 'string' ? e : e.value
  locale.value = val
  localStorage.setItem('midivoci:locale', val)
  setPrimeLocale(val)
}

setPrimeLocale(locale.value)

const autocomplete = ref(null)
const autocompleteValue = ref('')
let autocompleteGuard = false

const suggestMissingUrl = computed(() => {
  const q = autocompleteValue.value || ''
  const title = encodeURIComponent('Request for missing work')
  const body = encodeURIComponent(q ? `Suggested work: ${q}` : '')
  return `https://github.com/rubjo/midivoci/issues/new?title=${title}&body=${body}`
})

const filterScore = ref(false)

const filteredGroups = computed(() => {
  return fileGroups.value
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (filterScore.value && !item.hasPdf) return false
        return true
      }),
    }))
    .filter((group) => group.items.length > 0)
})

function getFilteredSuggestions(query) {
  const q = query?.toLowerCase().trim()
  const groups = filteredGroups.value
  if (!q) return groups
  const words = q.split(/\s+/).filter(Boolean)
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) =>
        words.every((w) => it._display.includes(w) || it._composer.includes(w)),
      ),
    }))
    .filter((g) => g.items.length > 0)
}

function clearCurrentTrack() {
  stop()
  autocompleteValue.value = ''
  isLoaded.value = false
  midiUrl.value = ''
  currentFileMeta.value = null
  tracks.value = []
  musicXmlContent.value = ''
  suggestions.value = filteredGroups.value
  nextTick(() => autocomplete.value?.show())
}

function onAutocompleteFocus() {
  if (autocompleteGuard) return
  const input = autocomplete.value?.$el?.querySelector('input')
  suggestions.value = getFilteredSuggestions(input?.value)
  nextTick(() => autocomplete.value?.show())
}

watch(filterScore, () => {
  const input = autocomplete.value?.$el?.querySelector('input')
  suggestions.value = getFilteredSuggestions(input?.value)
})

function onOptionSelect(event) {
  if (event?.value?.value) {
    autocompleteValue.value = event.value.value
    onFileSelected(event.value.value)
  }
  suggestions.value = []
  autocomplete.value?.hide()
  autocompleteGuard = true
  setTimeout(() => {
    autocompleteGuard = false
  }, 300)
  setTimeout(() => document.activeElement?.blur(), 50)
}

const isFloating = ref(localStorage.getItem('midivoci:float-controls') !== 'false')

function toggleFloat() {
  isFloating.value = !isFloating.value
  localStorage.setItem('midivoci:float-controls', String(isFloating.value))
}

const theme = ref(localStorage.getItem('midivoci:theme') || 'light')
const isDark = ref(theme.value === 'dark')
document.documentElement.setAttribute('data-theme', theme.value)

function toggleTheme() {
  isDark.value = !isDark.value
  theme.value = isDark.value ? 'dark' : 'light'
  localStorage.setItem('midivoci:theme', theme.value)
  document.documentElement.setAttribute('data-theme', theme.value)
}

const showNoteIndicators = ref(false)
const infoDialogVisible = ref(false)

const libraries = [
  { name: '@tonejs/midi', url: 'https://github.com/Tonejs/Midi' },
  { name: 'html-midi-player', url: 'https://github.com/cifkao/html-midi-player' },
  { name: 'verovio', url: 'https://www.verovio.org/' },
  { name: 'fflate', url: 'https://github.com/101arrowz/fflate' },
  { name: 'soundfont-player', url: 'https://github.com/danigb/soundfont-player' },
  { name: 'Tone.js', url: 'https://tonejs.github.io/' },
  { name: 'infojunkie/musicxml-player', url: 'https://github.com/infojunkie/musicxml-player' },
  { name: 'PrimeVue', url: 'https://primevue.org/' },
  { name: 'Vue 3', url: 'https://vuejs.org/' },
  { name: 'vue-i18n', url: 'https://vue-i18n.intlify.dev/' },
  { name: '@tabler/icons-vue', url: 'https://tabler.io/icons' },
  { name: 'Vite', url: 'https://vite.dev/' },
  { name: 'Tauri', url: 'https://tauri.app/' },
]

const projects = [
  { name: 'Victor Mono', url: 'https://rubjo.github.io/victor-mono/' },
  { name: 'Dani', url: 'https://rubjo.github.io/dani/' },
  { name: 'MBench', url: 'https://rubjo.github.io/m-bench/' },
]

const musicXmlContent = ref('')
let pendingMidiFileName = ''

async function handleFileUpload(e) {
  const file = e.files?.[0]
  if (!file) return
  const isMusicXml = /\.(musicxml|xml|mxl)$/i.test(file.name)
  if (isMusicXml) {
    try {
      let text
      if (/\.mxl$/i.test(file.name)) {
        const buf = await file.arrayBuffer()
        text = decompressMxl(buf)
      } else {
        text = await file.text()
      }
      const fileName = file.name.replace(/\.(musicxml|xml|mxl)$/i, '')
      pendingMidiFileName = fileName
      localStorage.setItem('midivoci:musicxml-panel-expanded', 'true')
      musicXmlContent.value = text
    } catch (err) {
      console.error('MusicXML upload failed:', err)
    }
    return
  }
  try {
    await handleUpload({ target: { files: [file] } })
  } catch (err) {
    console.error('File upload failed:', err)
  }
}

function onFileSelected(val) {
  const item = midiFileMeta.value.find((m) => m.fileName === val)
  if (!item) return
  if (item.format === 'musicxml') {
    loadMusicXmlFile(val, item)
  } else {
    handleFileSelect(val)
  }
}

async function loadMusicXmlFile(fileName, item) {
  const isTauri = !!window.__TAURI_INTERNALS__
  const baseUrl = isTauri ? '/music/' : '/midivoci/music/'
  try {
    const res = await fetch(baseUrl + fileName)
    const buf = await res.arrayBuffer()
    const text = decompressMxl(buf)
    localStorage.setItem('midivoci:musicxml-panel-expanded', 'true')
    musicXmlContent.value = text
    midiUrl.value = baseUrl + fileName
    const meta = item.meta || {}
    currentFileMeta.value = { ...meta, composer: item.composer, title: item.display }
  } catch (err) {
    console.error('Failed to load MusicXML file:', fileName, err)
  }
}

function handleMidiReady(buffer) {
  const fileName = pendingMidiFileName
  pendingMidiFileName = ''
  const blobUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/midi' }))
  if (!currentFileMeta.value) {
    currentFileMeta.value = { title: fileName, composer: '' }
  }
  loadMidiFromBuffer(buffer, blobUrl, currentFileMeta.value)
}

function formatDuration(seconds) {
  if (!seconds || typeof seconds !== 'number') return '?'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')} min`
}

function metaLabel(fileName) {
  const m = midiFileMeta.value.find((e) => e.fileName === fileName)
  if (!m) return fileName
  const composer = m.composer || 'Unknown Composer'
  const workName = m.display.split('/').pop() || m.display
  return `${composer}: ${workName}`
}

const {
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
} = useMidiPlayer()

function isTyping(el) {
  const tag = el?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable
}

function handleKeydown(e) {
  if (!isLoaded.value) return
  if (isTyping(document.activeElement)) return
  if (e.key === ' ') {
    e.preventDefault()
    togglePlay()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    seek(Math.max(0, (currentTime.value || 0) - 10))
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    seek(Math.min(duration.value || 0, (currentTime.value || 0) + 10))
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

const fileGroups = computed(() => {
  const groupsMap = {}
  midiFileMeta.value.forEach((file) => {
    const composer = file.fileName.split('/')[0] || file.composer || 'Unknown Composer'
    if (!groupsMap[composer]) {
      groupsMap[composer] = {
        label: composer,
        composerMeta: file.composerMeta,
        items: [],
      }
    }
    const parts = file.display.split('/')
    const cleanLabel = parts[parts.length - 1]
    groupsMap[composer].items.push({
      label: cleanLabel,
      value: file.fileName,
      numTracks: file.numTracks,
      duration: file.duration,
      format: file.format,
      hasPdf: file.format === 'musicxml',
      _display: file.display.toLowerCase(),
      _composer: (file.composer || '').toLowerCase(),
    })
  })
  const result = Object.values(groupsMap)
  result.sort((a, b) => a.label.localeCompare(b.label))
  result.forEach((group) => {
    group.items.sort((a, b) => a.label.localeCompare(b.label))
  })
  return result
})

const dataLoaded = computed(() => midiFileMeta.value.length > 0)
const suggestions = ref([])

function searchFiles(event) {
  suggestions.value = getFilteredSuggestions(event.query)
}
</script>

<style scoped>
.header-logo {
  width: 42px;
  height: 42px;
  margin: -4px 0;
}

.app-title-wrapper {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  line-height: 1rem;
}

.subtitle-desktop {
  display: inline;
  font-weight: 400;
  color: var(--text-secondary);
}

.subtitle-mobile {
  display: none;
}

@media (max-width: 768px) {
  .app-title-wrapper {
    flex-direction: column;
    gap: 0;
  }
  .subtitle-desktop {
    display: none;
  }
  .subtitle-mobile {
    display: block;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
}

.info-dialog-banner {
  display: block;
  width: 100%;
  margin: -2rem 0 -1rem 0;
}

.info-dialog-body {
  line-height: 1.5;
}

.info-dialog-donate {
  text-align: center;
}

.empty-state {
  min-height: 30vh;
  padding: 2rem;
}

.empty-state-inner {
  width: min(80vw, 480px);
}

.empty-state-step {
  font-size: 1.5rem;
  line-height: 1.5;
  margin: 1rem 0;
}

:deep(.p-fileupload-basic-content > span:first-of-type) {
  display: none;
}

.track-info {
  padding: 0.25rem 0.4rem;
  border: 1px solid color-mix(in srgb, var(--text-muted) 15%, transparent);
  font-size: 0.7rem;
  white-space: nowrap;
}

.has-floating {
  padding-bottom: 200px;
}

.store-banner {
  border-bottom: 1px solid var(--p-surface-border);
  background: var(--p-surface-ground);
}

.store-badge-link {
  line-height: 0;
}
</style>
