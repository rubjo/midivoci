<template>
  <div class="app" :data-theme="theme">
    <header class="app-header">
      <h1>{{ t('app.title') }}</h1>
      <div class="header-actions">
        <div @click.stop>
          <PrimeSelect
            :options="langOptions"
            option-label="label"
            option-value="code"
            :model-value="locale"
            @change="setLocale"
            class="lang-select"
            label-class="pr-0 py-2"
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
        <Button ref="infoBtnRef" @click="toggleInfo">
          <IconInfoCircle :size="16" />
        </Button>
        <PrimePopover ref="infoPopoverRef">
          <div class="info-popover">
            <h3>{{ t('app.title') }}</h3>
            <p>{{ t('app.description') }}</p>
            <p>
              {{ t('app.created_by') }}
              <a href="https://github.com/rubjo" target="_blank" rel="noopener noreferrer"
                >@rubjo</a
              >
              <template v-if="!isTauri">
                – {{ t('app.donations_welcome') }}
                <a
                  href="https://www.paypal.com/donate/?hosted_button_id=QT5CW924DJN3Q"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src="https://www.paypalobjects.com/en_US/i/btn/btn_donate_SM.gif"
                    alt="Donate with PayPal button"
                    style="vertical-align: middle"
                  />
                </a>
              </template>
            </p>
            <h4>{{ t('app.midi_files') }}</h4>
            <p>
              {{ t('app.midi_credit') }}
              <a
                href="https://www.learnchoralmusic.co.uk/"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:text-primary"
                >learnchoralmusic.co.uk</a
              >
            </p>
            <h4>{{ t('app.libraries') }}</h4>
            <ul>
              <li>@tonejs/midi</li>
              <li>html-midi-player</li>
              <li>soundfont-player</li>
              <li>Tone.js</li>
              <li>PrimeVue</li>
              <li>Vue 3</li>
              <li>vue-i18n</li>
              <li>@tabler/icons-vue</li>
              <li>Vite</li>
            </ul>
            <h4>{{ t('app.other_projects') }}</h4>
            <ul>
              <li>
                <a
                  href="https://rubjo.github.io/victor-mono/"
                  target="_blank"
                  rel="noopener noreferrer"
                  >Victor Mono</a
                >
              </li>
              <li>
                <a href="https://rubjo.github.io/dani/" target="_blank" rel="noopener noreferrer"
                  >Dani</a
                >
              </li>
              <li>
                <a href="https://rubjo.github.io/m-bench/" target="_blank" rel="noopener noreferrer"
                  >MBench</a
                >
              </li>
            </ul>
          </div>
        </PrimePopover>
      </div>
    </header>

    <main>
      <section>
        <PrimeInputGroup>
          <PrimeAutocomplete
            ref="autocomplete"
            :suggestions="suggestions"
            @complete="searchFiles"
            @focus="onAutocompleteFocus"
            @option-select="onOptionSelect"
            showClear
            @clear="suggestions = fileGroups"
            option-label="label"
            option-group-label="label"
            option-group-children="items"
            option-value="value"
            :placeholder="t('searchForAndSelectMidiFile')"
            class="w-full"
            scroll-height="70vh"
            :delay="300"
            fluid
            @update:model-value="handleFileSelect"
          >
            <template #item="slotProps">
              {{ slotProps.value ? metaLabel(slotProps.value) : t('searchForAndSelectMidiFile') }}
            </template>
            <template #optiongroup="slotProps">
              <div class="midi-group-header flex align-items-center gap-2">
                <span class="font-medium">{{
                  slotProps.option.composerMeta?.name || slotProps.option.label
                }}</span>
                <span
                  v-if="slotProps.option.composerMeta?.born || slotProps.option.composerMeta?.died"
                  class="text-sm text-500"
                >
                  ({{ slotProps.option.composerMeta?.born || '?' }}–{{
                    slotProps.option.composerMeta?.died || '?'
                  }})
                </span>
                <a
                  v-if="slotProps.option.composerMeta?.wikipedia"
                  :href="slotProps.option.composerMeta.wikipedia"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-400 hover:text-primary no-underline p-button p-1"
                  @click.stop
                >
                  <IconInfoCircle :size="14" style="vertical-align: middle" />
                </a>
              </div>
            </template>
            <template #option="slotProps">
              <div class="midi-option">
                <div class="midi-option-main flex flex-column gap-2">
                  <strong class="midi-option-name">{{ slotProps.option.label }}</strong>
                  <div class="flex gap-2">
                    <Tag class="text-xs font-mono">
                      {{ formatDuration(slotProps.option.duration) }}
                    </Tag>
                    <Tag class="text-xs font-mono">
                      {{ slotProps.option.numTracks }} {{ t('parts').toLowerCase() }}
                    </Tag>
                  </div>
                </div>
              </div>
            </template>
          </PrimeAutocomplete>
          <PrimeFileUpload
            mode="basic"
            accept=".mid,.midi"
            :auto="true"
            :choose-label="t('orUpload')"
            @select="handleFileUpload"
            class="upload-inputgroup-btn"
          >
            <template #chooseicon>
              <IconUpload :size="16" />
              <span class="md:hidden">{{ t('upload') }}</span>
            </template>
          </PrimeFileUpload>
        </PrimeInputGroup>
      </section>

      <TransportControls
        v-if="isLoaded"
        :is-loaded="isLoaded"
        :is-playing="isPlaying"
        :bpm="bpm"
        :original-bpm="originalBpm"
        :current-time="currentTime"
        :duration="duration"
        @toggle-play="togglePlay"
        @stop="stop"
        @set-tempo="setTempo"
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
        @set-track-instrument="setTrackInstrument"
        @set-all-track-volumes="setAllTrackVolumes"
        @set-all-track-instruments="setAllTrackInstruments"
        @set-track-muted="setTrackMuted"
        @set-track-solo="setTrackSolo"
        @set-track-lead="setTrackLead"
        @toggle-note-indicators="showNoteIndicators = !showNoteIndicators"
      />
    </main>
  </div>
</template>

<script setup>
import { ref, getCurrentInstance, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { IconSun, IconMoon, IconLanguage, IconInfoCircle, IconUpload } from '@tabler/icons-vue'
import { nb_NO } from 'primelocale/js/nb_NO.js'
import { en } from 'primelocale/js/en.js'

import Button from 'primevue/button'
import PrimeSelect from 'primevue/select'
import PrimePopover from 'primevue/popover'
import PrimeFileUpload from 'primevue/fileupload'
import PrimeAutocomplete from 'primevue/autocomplete'
import Tag from 'primevue/tag'
import PrimeInputGroup from 'primevue/inputgroup'

import { useMidiPlayer, midiFileMeta } from './composables/useMidiPlayer.js'
import TransportControls from './components/TransportControls.vue'
import TrackList from './components/TrackList.vue'
import ScoreView from './components/ScoreView.vue'

const isTauri = !!window.__TAURI__

const { t, locale } = useI18n()

const $primevue = getCurrentInstance().appContext.config.globalProperties.$primevue

const langOptions = [
  { code: 'en', label: 'English' },
  { code: 'no', label: 'Norsk' },
]

const autocomplete = ref(null)

function onAutocompleteFocus() {
  const input = autocomplete.value?.$el?.querySelector('input')
  const query = input?.value?.trim() || ''
  if (!query) {
    suggestions.value = fileGroups.value
    nextTick(() => autocomplete.value?.show())
  }
}

function onOptionSelect() {
  suggestions.value = []
  autocomplete.value?.hide()
}

function setPrimeLocale(localeCode) {
  $primevue.config.locale = localeCode === 'no' ? nb_NO : en
}

function setLocale(e) {
  const val = typeof e === 'string' ? e : e.value
  locale.value = val
  localStorage.setItem('locale', val)
  setPrimeLocale(val)
}

// init PrimeVue locale
setPrimeLocale(locale.value)

const theme = ref(localStorage.getItem('theme') || 'light')
const isDark = ref(theme.value === 'dark')
document.documentElement.setAttribute('data-theme', theme.value)

function toggleTheme() {
  isDark.value = !isDark.value
  theme.value = isDark.value ? 'dark' : 'light'
  localStorage.setItem('theme', theme.value)
  document.documentElement.setAttribute('data-theme', theme.value)
}

const showNoteIndicators = ref(false)
const infoBtnRef = ref(null)
const infoPopoverRef = ref(null)

function toggleInfo(event) {
  infoPopoverRef.value.toggle(event)
}

function handleFileUpload(e) {
  const file = e.files?.[0]
  if (file) handleUpload({ target: { files: [file] } })
}

function formatDuration(seconds) {
  if (!seconds || typeof seconds !== 'number') return '?'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')} mins`
}

function metaLabel(fileName) {
  const m = midiFileMeta.find((e) => e.fileName === fileName)
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
} = useMidiPlayer()

const fileGroups = computed(() => {
  const groupsMap = {}
  midiFileMeta.forEach((file) => {
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

const suggestions = ref([])

function searchFiles(event) {
  const query = event.query.toLowerCase().trim()
  if (!query) {
    suggestions.value = fileGroups.value
    return
  }
  suggestions.value = fileGroups.value
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item._display.includes(query) || item._composer.includes(query),
      ),
    }))
    .filter((group) => group.items.length > 0)
}
</script>

<style scoped>
.info-popover {
  line-height: 1.2;
}
</style>
