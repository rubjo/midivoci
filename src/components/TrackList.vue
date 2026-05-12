<template>
  <div class="overflow-hidden bg-surface-card border-1 surface-border border-round-lg">
    <div class="flex align-items-center justify-content-between p-3 border-bottom-1 surface-border">
      <h3 class="text-sm font-medium text-color-secondary text-uppercase m-0">
        {{ t('tracks') }}
      </h3>
      <div class="flex align-items-center gap-1">
        <Button
          :severity="showNoteIndicators ? 'success' : ''"
          size="small"
          :title="showNoteIndicators ? t('hide_note_indicators') : t('show_note_indicators')"
          :aria-label="showNoteIndicators ? t('hide_note_indicators') : t('show_note_indicators')"
          @click="$emit('toggleNoteIndicators')"
        >
          <IconHeartbeat :size="16" />
        </Button>
        <PrimeMenu ref="bulkMenuRef" :model="menuItems" popup />
        <Button
          size="small"
          @click="bulkMenuRef?.toggle($event)"
          :title="t('bulk_actions')"
          :aria-label="t('bulk_actions')"
        >
          <IconDotsVertical :size="16" />
        </Button>
        <Button
          size="small"
          variant="text"
          :title="expanded ? t('collapse') : t('expand')"
          @click="expanded = !expanded"
        >
          <IconChevronDown :size="16" class="chevron" :class="{ expanded: expanded }" />
        </Button>
      </div>
    </div>

    <div v-if="tracks.length === 0" class="p-5 text-center text-color-secondary text-sm">
      {{ t('tracks_empty') }}
    </div>

    <template v-if="expanded">
    <div
      v-for="(track, index) in tracks"
      :key="index"
      class="track-item flex flex-wrap p-3 border-bottom-1 surface-border hover-surface gap-1 md:flex-nowrap md:align-items-center"
      :class="{ 'track-active': showNoteIndicators && activeTracks?.has(index) }"
    >
      <div
        class="flex align-items-center justify-content-between md:justify-content-start w-full md:flex-1 gap-1"
      >
        <span class="font-medium text-sm text-color-primary">{{
          track.name || `Track ${index + 1}`
        }}</span>
        <span
          v-if="showNoteIndicators"
          class="flex align-items-center gap-1 text-xs font-mono text-color-secondary"
        >
          <template v-if="activeTracks?.has(index)">
            <span class="text-green-500" style="font-size: 1.25rem; line-height: 0">&#8226;</span>
            <span class="text-green-500 font-medium">{{ activeTracks.get(index) }}</span>
          </template>
        </span>
      </div>

      <template v-if="!compactMode">
        <div
          class="flex flex-column sm:flex-row align-items-stretch sm:align-items-center gap-1 flex-1 md:flex-none"
        >
          <div class="flex-1 flex align-items-center gap-1 py-2">
            <label
              class="text-sm font-medium text-color-secondary text-uppercase label hidden lg:inline"
              >{{ t('volume') }}</label
            >
            <PrimeSlider
              :min="0"
              :max="100"
              :model-value="track.volume"
              @update:model-value="$emit('setTrackVolume', index, $event)"
              class="flex-1 md:flex-none md:w-7rem mr-2"
              :disabled="track.muted"
            />
            <span
              class="text-xs font-medium text-color-secondary font-mono"
              style="min-width: 2rem"
              >{{ track.muted ? '—' : track.volume + '%' }}</span
            >
          </div>
          <div class="flex-1 flex align-items-center gap-1">
            <label
              class="text-sm font-medium text-color-secondary text-uppercase label hidden lg:inline"
              >{{ t('instrument') }}</label
            >
            <PrimeSelect
              :model-value="track.program"
              @update:model-value="$emit('setTrackInstrument', index, $event)"
              :options="instrumentList"
              option-label="name"
              option-value="program"
              size="small"
              class="w-full md:w-14rem"
              scroll-height="50vh"
            />
          </div>
        </div>
        <div class="flex gap-1 w-full md:w-auto md:ml-auto">
          <Button
            size="small"
            class="flex-1 md:flex-none text-xs text-uppercase"
            :variant="track.muted ? undefined : 'outlined'"
            :severity="track.muted ? 'danger' : 'secondary'"
            @click="$emit('setTrackMuted', index, !track.muted)"
          >
            {{ t('mute') }}
          </Button>
          <Button
            size="small"
            class="flex-1 md:flex-none text-xs text-uppercase"
            :variant="leadTrack.includes(index) ? undefined : 'outlined'"
            :severity="leadTrack.includes(index) ? 'info' : 'secondary'"
            @click="$emit('setTrackLead', index)"
          >
            {{ t('lead') }}
          </Button>
          <Button
            size="small"
            class="flex-1 md:flex-none text-xs text-uppercase"
            :variant="track.solo ? undefined : 'outlined'"
            :severity="track.solo ? 'success' : 'secondary'"
            @click="$emit('setTrackSolo', index, !track.solo)"
          >
            {{ t('solo') }}
          </Button>
        </div>
      </template>

      <template v-if="compactMode">
        <div class="flex align-items-center gap-1 flex-1 md:flex-none justify-content-between">
          <div
            class="flex-1 md:flex-none flex align-items-center gap-1 py-2"
            style="min-width: 8rem"
          >
            <PrimeSlider
              :min="0"
              :max="100"
              :model-value="track.volume"
              @update:model-value="$emit('setTrackVolume', index, $event)"
              class="flex-1 md:w-7rem mr-2"
              :disabled="track.muted"
            />
            <span
              class="text-xs font-medium text-color-secondary font-mono"
              style="min-width: 2rem"
              >{{ track.muted ? '—' : track.volume + '%' }}</span
            >
          </div>
          <div class="compact-actions flex align-items-center gap-1">
            <div class="flex-1 md:flex-none">
              <PrimeSelect
                :model-value="track.program"
                @update:model-value="$emit('setTrackInstrument', index, $event)"
                :options="instrumentList"
                option-label="name"
                option-value="program"
                size="small"
                scroll-height="50vh"
              >
                <template #value>
                  <InstrumentIcon
                    :program="track.program"
                    :size="16"
                    style="display: block; margin: 0 auto"
                  />
                </template>
              </PrimeSelect>
            </div>
            <Button
              size="small"
              class="text-xs"
              :variant="track.muted ? undefined : 'outlined'"
              :severity="track.muted ? 'danger' : 'secondary'"
              @click="$emit('setTrackMuted', index, !track.muted)"
            >
              <IconVolumeOff :size="16" class="-m-2" />
            </Button>
            <Button
              size="small"
              class="text-xs"
              :variant="leadTrack.includes(index) ? undefined : 'outlined'"
              :severity="leadTrack.includes(index) ? 'info' : 'secondary'"
              @click="$emit('setTrackLead', index)"
            >
              <IconMicrophone2 :size="16" class="-m-2" />
            </Button>
            <Button
              size="small"
              class="text-xs"
              :variant="track.solo ? undefined : 'outlined'"
              :severity="track.solo ? 'success' : 'secondary'"
              @click="$emit('setTrackSolo', index, !track.solo)"
            >
              <IconHeadphones :size="16" class="-m-2" />
            </Button>
          </div>
        </div>
      </template>
    </div>
    </template>
  </div>

  <PrimeDialog
    v-model:visible="showVolumeModal"
    :header="t('set_volume_all') + '&nbsp;&nbsp;&nbsp;'"
    :modal="true"
    :dismissable-mask="true"
    style="min-width: 320px"
  >
    <div class="flex align-items-center gap-3 p-2">
      <PrimeSlider v-model="bulkVolume" :min="0" :max="100" class="flex-1" />
      <span class="text-sm font-medium font-mono" style="min-width: 2rem; text-align: right">{{
        bulkVolume
      }}</span>
    </div>
    <template #footer>
      <Button severity="secondary" variant="outlined" @click="showVolumeModal = false">{{
        t('cancel')
      }}</Button>
      <Button severity="primary" @click="applyVolume">{{ t('apply') }}</Button>
    </template>
  </PrimeDialog>

  <PrimeDialog
    v-model:visible="showInstrumentModal"
    :header="t('set_instrument_all') + '&nbsp;&nbsp;&nbsp;'"
    :modal="true"
    :dismissable-mask="true"
    style="min-width: 320px"
  >
    <div class="flex flex-column gap-3 p-2">
      <PrimeSelect
        v-model="bulkInstrument"
        :options="instrumentList"
        option-label="name"
        option-value="program"
        class="w-full"
        scroll-height="400px"
      />
      <div class="flex align-items-center gap-2">
        <PrimeToggleSwitch v-model="saveAsPreferred" input-id="pref-instrument" />
        <label for="pref-instrument" class="text-sm text-color-secondary">{{
          t('preferred_instrument')
        }}</label>
      </div>
    </div>
    <template #footer>
      <Button severity="secondary" variant="outlined" @click="showInstrumentModal = false">{{
        t('cancel')
      }}</Button>
      <Button severity="primary" @click="applyInstrument">{{ t('apply') }}</Button>
    </template>
  </PrimeDialog>
</template>

<script setup>
import Button from 'primevue/button'
import PrimeDialog from 'primevue/dialog'
import PrimeSlider from 'primevue/slider'
import PrimeSelect from 'primevue/select'
import PrimeMenu from 'primevue/menu'
import PrimeToggleSwitch from 'primevue/toggleswitch'
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  IconHeartbeat,
  IconDotsVertical,
  IconVolumeOff,
  IconMicrophone2,
  IconHeadphones,
  IconChevronDown,
} from '@tabler/icons-vue'
import { instrumentList } from '../constants/instruments.js'
import InstrumentIcon from './icons/InstrumentIcon.vue'

const PREFERRED_INSTRUMENT_KEY = 'midivox:preferred-instrument'
const COMPACT_MODE_KEY = 'midivox:compact-mode'

const { t } = useI18n()

const expanded = ref(true)

defineProps({
  tracks: { type: Array, default: () => [] },
  activeTracks: { type: Map, default: () => new Map() },
  leadTrack: { type: Array, default: () => [] },
  showNoteIndicators: { type: Boolean, default: false },
})

const emit = defineEmits([
  'setTrackVolume',
  'setTrackInstrument',
  'setAllTrackVolumes',
  'setAllTrackInstruments',
  'setTrackMuted',
  'setTrackSolo',
  'setTrackLead',
  'toggleNoteIndicators',
])

const compactMode = ref(localStorage.getItem(COMPACT_MODE_KEY) !== 'false')
function toggleCompactMode() {
  compactMode.value = !compactMode.value
  localStorage.setItem(COMPACT_MODE_KEY, String(compactMode.value))
}

const bulkMenuRef = ref(null)
const showVolumeModal = ref(false)
const showInstrumentModal = ref(false)
const bulkVolume = ref(100)
const bulkInstrument = ref(0)
const saveAsPreferred = ref(false)

const menuItems = computed(() => [
  {
    label: compactMode.value ? t('compact_mode_off') : t('compact_mode_on'),
    command: toggleCompactMode,
  },
  {
    label: t('set_volume_all'),
    command: () => {
      bulkVolume.value = 100
      showVolumeModal.value = true
    },
  },
  {
    label: t('set_instrument_all'),
    command: () => {
      bulkInstrument.value = 0
      saveAsPreferred.value = false
      showInstrumentModal.value = true
    },
  },
])

function applyVolume() {
  emit('setAllTrackVolumes', bulkVolume.value)
  showVolumeModal.value = false
}

function applyInstrument() {
  emit('setAllTrackInstruments', bulkInstrument.value)
  if (saveAsPreferred.value) {
    localStorage.setItem(PREFERRED_INSTRUMENT_KEY, String(bulkInstrument.value))
  }
  showInstrumentModal.value = false
}
</script>

<style lang="scss" scoped>
.hover-surface {
  transition: background 0.15s;
  &:hover {
    background: var(--p-content-hover-background);
  }
}

.track-active {
  background: rgba(34, 197, 94, 0.07);
  &:hover {
    background: rgba(34, 197, 94, 0.1);
  }
}

@media (max-width: 769px) {
  .track-item {
    gap: 0.5rem;
  }
}

@media (max-width: 768px) {
  .p-select {
    min-width: 0;
  }
}

.chevron {
  transition: transform 0.2s;
}

.chevron.expanded {
  transform: rotate(180deg);
}

.compact-actions {
  .p-select {
    height: 1.75rem;
    width: 4.25rem;
  }
  .p-button {
    width: 1.75rem;
    height: 1.75rem;
  }
}
</style>
