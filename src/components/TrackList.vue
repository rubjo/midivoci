<template>
  <div class="overflow-hidden bg-surface-card border-1 surface-border border-round-lg">
    <div
      class="panel-header flex align-items-center justify-content-between p-3 surface-border"
      @click="expanded = !expanded"
    >
      <h3
        class="text-sm font-medium text-color-secondary text-uppercase m-0 flex align-items-center gap-1"
      >
        <IconPlaylist :size="16" />
        {{ tracks.length }} {{ t('parts') }}
      </h3>
      <div class="flex align-items-center gap-1" @click.stop>
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
          <span class="font-medium text-sm text-color-primary max-w-10rem md:max-w-full truncate">{{
            track.name || `Track ${index + 1}`
          }}</span>
          <span
            v-if="track.avgVelocity !== undefined"
            v-tooltip="t('avg_velocity') + ': ' + track.avgVelocity + '%'"
            class="inline-flex align-items-center hidden sm:inline ml-1"
            :style="{ opacity: 0.1 + (track.avgVelocity / 100) * 1 }"
          >
            <component :is="velocityIcon(track.avgVelocity)" :size="16" />
          </span>
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
            class="flex flex-column sm:flex-row align-items-stretch sm:align-items-end gap-1 flex-1 md:flex-none"
          >
            <div
              class="flex-1 flex lg:flex-column align-items-center lg:align-items-start gap-2 py-2"
            >
              <label
                class="text-sm font-medium text-color-secondary text-uppercase label hidden lg:block lg:mb-1"
                >{{ t('volume') }}</label
              >
              <div class="flex align-items-center gap-1 flex-1 lg:w-full">
                <PrimeSlider
                  :min="0"
                  :max="100"
                  :model-value="track.volume"
                  @update:model-value="$emit('setTrackVolume', index, $event)"
                  class="flex-1 md:flex-none md:w-5rem lg:w-7rem mr-2"
                  :disabled="track.muted"
                />
                <span
                  class="text-xs font-medium text-color-secondary font-mono"
                  style="min-width: 2rem"
                  >{{ track.muted ? '—' : track.volume + '%' }}</span
                >
              </div>
            </div>
            <div
              class="flex-1 flex lg:flex-column align-items-center lg:align-items-start gap-2 py-2"
            >
              <label
                class="text-sm font-medium text-color-secondary text-uppercase label hidden lg:block lg:mb-1"
                >{{ t('balance') }}</label
              >
              <div
                class="flex align-items-center gap-1 flex-1 lg:w-full balance-slider-wrapper"
                :style="{ '--balance-color': panColor(track.pan ?? 50) }"
              >
                <PrimeSlider
                  :min="0"
                  :max="100"
                  :step="10"
                  :model-value="track.pan ?? 50"
                  @update:model-value="$emit('setTrackPan', index, $event)"
                  class="flex-1 md:flex-none md:w-5rem lg:w-7rem mr-2"
                />
                <span
                  class="text-xs font-medium text-color-secondary font-mono"
                  style="min-width: 2rem; text-align: center"
                  >{{
                    track.pan < 50
                      ? t('pan_left') + (50 - track.pan)
                      : track.pan > 50
                        ? t('pan_right') + (track.pan - 50)
                        : t('pan_center')
                  }}</span
                >
              </div>
            </div>
            <div class="flex-1 flex lg:flex-column lg:justify-items-end gap-1">
              <label
                class="text-sm font-medium text-color-secondary text-uppercase label hidden lg:block"
                >{{ t('instrument') }}</label
              >
              <PrimeSelect
                :model-value="track.program"
                @update:model-value="$emit('setTrackInstrument', index, $event)"
                :options="instrumentList"
                :option-label="(opt) => t(`instrument_${opt.program}`)"
                option-value="program"
                size="small"
                class="w-full md:w-5rem lg:w-14rem"
                scroll-height="50vh"
              >
                <template #value="slotProps">
                  <div class="flex align-items-center gap-2">
                    <InstrumentIcon :program="track.program" :size="16" class="-my-1" />
                    <span class="md:hidden lg:inline">{{ t(`instrument_${track.program}`) }}</span>
                  </div>
                </template>
                <template #option="slotProps">
                  <div class="flex align-items-center gap-2">
                    <InstrumentIcon :program="slotProps.option.program" :size="16" />
                    <span>{{ t(`instrument_${slotProps.option.program}`) }}</span>
                  </div>
                </template>
              </PrimeSelect>
            </div>
          </div>
          <div class="flex gap-1 w-full md:w-auto md:ml-auto align-self-end">
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
            <div
              class="flex-1 md:flex-none hidden md:flex align-items-center gap-1 py-2 balance-slider-wrapper"
              :style="[{ minWidth: '8rem' }, { '--balance-color': panColor(track.pan ?? 50) }]"
            >
              <PrimeSlider
                :min="0"
                :max="100"
                :step="10"
                :model-value="track.pan ?? 50"
                @update:model-value="$emit('setTrackPan', index, $event)"
                class="flex-1 md:w-7rem mr-2"
              />
              <span
                class="text-xs font-medium text-color-secondary font-mono"
                style="min-width: 2rem; text-align: center"
                >{{
                  track.pan < 50
                    ? t('pan_left') + (50 - track.pan)
                    : track.pan > 50
                      ? t('pan_right') + (track.pan - 50)
                      : t('pan_center')
                }}</span
              >
            </div>
            <div class="compact-actions flex align-items-center gap-1">
              <div class="flex-1 md:flex-none">
                <PrimeSelect
                  :model-value="track.program"
                  @update:model-value="$emit('setTrackInstrument', index, $event)"
                  :options="instrumentList"
                  :option-label="(opt) => t(`instrument_${opt.program}`)"
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
                  <template #option="slotProps">
                    <div class="flex align-items-center gap-2">
                      <InstrumentIcon :program="slotProps.option.program" :size="16" />
                      <span>{{ t(`instrument_${slotProps.option.program}`) }}</span>
                    </div>
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
        :option-label="(opt) => t(`instrument_${opt.program}`)"
        option-value="program"
        class="w-full"
        scroll-height="400px"
      >
        <template #value="slotProps">
          <div class="flex align-items-center gap-2">
            <InstrumentIcon :program="slotProps.value" :size="16" />
            <span>{{ t(`instrument_${slotProps.value}`) }}</span>
          </div>
        </template>
        <template #option="slotProps">
          <div class="flex align-items-center gap-2">
            <InstrumentIcon :program="slotProps.option.program" :size="16" />
            <span>{{ t(`instrument_${slotProps.option.program}`) }}</span>
          </div>
        </template>
      </PrimeSelect>
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
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  IconHeartbeat,
  IconDotsVertical,
  IconVolumeOff,
  IconMicrophone2,
  IconHeadphones,
  IconChevronDown,
  IconPlaylist,
  IconPercentage0,
  IconPercentage10,
  IconPercentage20,
  IconPercentage30,
  IconPercentage40,
  IconPercentage50,
  IconPercentage60,
  IconPercentage70,
  IconPercentage80,
  IconPercentage90,
  IconPercentage100,
} from '@tabler/icons-vue'
import { instrumentList } from '../constants/instruments.js'
import InstrumentIcon from './icons/InstrumentIcon.vue'

const PREFERRED_INSTRUMENT_KEY = 'midivoci:preferred-instrument'
const COMPACT_MODE_KEY = 'midivoci:compact-mode'

const TRACKS_EXPANDED_KEY = 'midivoci:tracks-panel-expanded'

const { t } = useI18n()

const expanded = ref(localStorage.getItem(TRACKS_EXPANDED_KEY) !== 'false')
watch(expanded, (val) => localStorage.setItem(TRACKS_EXPANDED_KEY, String(val)))

const props = defineProps({
  tracks: { type: Array, default: () => [] },
  activeTracks: { type: Map, default: () => new Map() },
  leadTrack: { type: Array, default: () => [] },
  showNoteIndicators: { type: Boolean, default: false },
})

const emit = defineEmits([
  'setTrackVolume',
  'setTrackPan',
  'setTrackInstrument',
  'setAllTrackVolumes',
  'setAllTrackPans',
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
  { separator: true },
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
  { separator: true },
  {
    label: t('reset_balance_all'),
    visible: props.tracks.some((t) => t.pan !== 50),
    command: () => emit('setAllTrackPans', 50),
  },
  {
    label: t('set_balance_double_ensemble'),
    visible:
      props.tracks.some((t) => t.name?.includes('1')) &&
      props.tracks.some((t) => t.name?.includes('2')),
    command: () => {
      props.tracks.forEach((track, i) => {
        const first = track.name?.match(/[12]/)?.[0]
        if (first === '1') emit('setTrackPan', i, 10)
        else if (first === '2') emit('setTrackPan', i, 90)
      })
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

function lerpColor(c1, c2, t) {
  const a = [
    parseInt(c1.slice(1, 3), 16),
    parseInt(c1.slice(3, 5), 16),
    parseInt(c1.slice(5, 7), 16),
  ]
  const b = [
    parseInt(c2.slice(1, 3), 16),
    parseInt(c2.slice(3, 5), 16),
    parseInt(c2.slice(5, 7), 16),
  ]
  const r = Math.round(a[0] + (b[0] - a[0]) * t)
  const g = Math.round(a[1] + (b[1] - a[1]) * t)
  const b_ = Math.round(a[2] + (b[2] - a[2]) * t)
  return `rgb(${r},${g},${b_})`
}

function panColor(pan) {
  if (pan <= 50) return lerpColor('#22c55e', '#0ea5e9', pan / 50)
  return lerpColor('#0ea5e9', '#ef4444', (pan - 50) / 50)
}

const velocityIcons = {
  0: IconPercentage0,
  10: IconPercentage10,
  20: IconPercentage20,
  30: IconPercentage30,
  40: IconPercentage40,
  50: IconPercentage50,
  60: IconPercentage60,
  70: IconPercentage70,
  80: IconPercentage80,
  90: IconPercentage90,
  100: IconPercentage100,
}

function velocityIcon(avg) {
  const rounded = Math.round(avg / 10) * 10
  const clamped = Math.max(0, Math.min(100, rounded))
  return velocityIcons[clamped]
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
  transform: scaleY(-1);
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

.balance-slider-wrapper {
  :deep(.p-slider) {
    background: var(--balance-color, var(--p-slider-range-background));
  }
  :deep(.p-slider-range) {
    display: none;
  }
}
</style>
