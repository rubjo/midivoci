<template>
  <div :class="['transport-wrapper', { 'transport-floating': isFloating }]">
    <div class="transport-bar">
      <div class="transport-header">
        <TrackMeta :title="title" :composer="composer" />
      </div>

      <div class="transport-progress">
        <div class="flex align-items-center gap-2">
          <PrimeSlider
            :min="0"
            :max="duration || 1"
            :step="0.1"
            :model-value="currentTime"
            @update:model-value="$emit('seek', $event)"
            class="flex-1"
          />
          <span class="transport-time"
            >{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span
          >
        </div>
      </div>

      <div class="transport-buttons">
        <div class="transport-buttons-inner">
          <Button
            :disabled="!isLoaded"
            :title="t('skip_back')"
            :severity="isFloating ? 'contrast' : ''"
            :variant="isFloating ? 'text' : 'filled'"
            :size="isFloating ? 'small' : 'normal'"
            @click="skipBack"
          >
            <IconRewindBackward10 :size="18" />
          </Button>
          <Button
            :disabled="!isLoaded"
            :title="isPlaying ? t('pause') : t('play')"
            :severity="isFloating ? 'contrast' : ''"
            :variant="isFloating ? 'text' : 'filled'"
            :size="isFloating ? 'small' : 'normal'"
            @click="$emit('togglePlay')"
          >
            <IconPlayerPlayFilled v-if="!isPlaying" :size="18" />
            <IconPlayerPauseFilled v-else :size="18" />
          </Button>
          <Button
            :disabled="!isLoaded"
            :title="t('stop')"
            :severity="isFloating ? 'contrast' : ''"
            :variant="isFloating ? 'text' : 'filled'"
            :size="isFloating ? 'small' : 'normal'"
            @click="$emit('stop')"
          >
            <IconPlayerStopFilled :size="18" />
          </Button>
          <Button
            :disabled="!isLoaded"
            :title="t('skip_forward')"
            :severity="isFloating ? 'contrast' : ''"
            :variant="isFloating ? 'text' : 'filled'"
            :size="isFloating ? 'small' : 'normal'"
            @click="skipForward"
          >
            <IconRewindForward10 :size="18" />
          </Button>
          <Button
            :disabled="!isLoaded"
            :title="loop ? t('loop_on') : t('loop_off')"
            :severity="loop ? 'success' : isFloating ? 'contrast' : undefined"
            :variant="isFloating ? 'text' : 'filled'"
            :size="isFloating ? 'small' : 'normal'"
            @click="$emit('toggleLoop')"
          >
            <IconRepeat :size="18" />
          </Button>
          <Button
            :title="t('close_track')"
            :severity="isFloating ? 'contrast' : ''"
            :variant="isFloating ? 'text' : 'filled'"
            :size="isFloating ? 'small' : 'normal'"
            @click="$emit('close')"
          >
            <IconPlayerEjectFilled :size="18" />
          </Button>
          <Button
            :title="t('settings')"
            :severity="isFloating ? 'contrast' : ''"
            :variant="isFloating ? 'text' : 'filled'"
            :size="isFloating ? 'small' : 'normal'"
            @click="settingsPopover.toggle($event)"
          >
            <IconSettings :size="18" />
          </Button>
        </div>
      </div>
    </div>

    <Popover ref="settingsPopover" class="transport-settings">
      <div class="settings-content">
        <div class="settings-section">
          <Button
            severity="secondary"
            class="w-full"
            @click="($emit('close'), settingsPopover.hide())"
          >
            <IconPlayerEjectFilled :size="16" />
            <span>{{ t('close_track') }}</span>
          </Button>
        </div>

        <hr class="settings-divider" />

        <div class="settings-section">
          <span class="settings-label">{{ t('tempo') }}</span>
          <div class="settings-slider-row p-2">
            <Button size="small" @click="changeTempoBy(-5)" :disabled="!isLoaded">−5</Button>
            <PrimeSlider
              :min="25"
              :max="300"
              :model-value="tempoPercent"
              @update:model-value="handleTempoSlider"
              class="flex-1"
            />
            <Button size="small" @click="changeTempoBy(5)" :disabled="!isLoaded">+5</Button>
          </div>
          <div class="settings-sub-row">
            <span>{{ tempoPercent }}%</span>
            <Button v-if="canReset" severity="secondary" size="small" @click="resetTempo">
              {{ t('reset') }}
            </Button>
          </div>
        </div>

        <hr class="settings-divider" />

        <div class="settings-section">
          <span class="settings-label">{{ t('transpose') }}</span>
          <div class="settings-slider-row p-2">
            <Button size="small" :disabled="!isLoaded" @click="$emit('setTranspose', transpose - 1)">−1</Button>
            <PrimeSlider
              :min="-12"
              :max="12"
              :step="1"
              :model-value="transpose"
              @update:model-value="$emit('setTranspose', $event)"
              class="flex-1"
            />
            <Button size="small" :disabled="!isLoaded" @click="$emit('setTranspose', transpose + 1)">+1</Button>
          </div>
          <div class="settings-sub-row">
            <span>{{ transposeLabel }}</span>
            <Button
              v-if="transpose"
              severity="secondary"
              size="small"
              @click="$emit('setTranspose', 0)"
            >
              {{ t('reset') }}
            </Button>
          </div>
        </div>

        <hr class="settings-divider" />

        <div class="settings-section">
          <div class="settings-row">
            <span>{{ t('float_controls') }}</span>
            <PrimeToggleSwitch
              :model-value="isFloating"
              @update:model-value="($emit('toggleFloat'), settingsPopover.hide())"
            />
          </div>
        </div>
      </div>
    </Popover>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { ref, computed } from 'vue'
import {
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconPlayerStopFilled,
  IconRewindBackward10,
  IconRewindForward10,
  IconRepeat,
  IconSettings,
  IconPlayerEjectFilled,
} from '@tabler/icons-vue'

import TrackMeta from './TrackMeta.vue'
import Button from 'primevue/button'
import PrimeSlider from 'primevue/slider'
import Popover from 'primevue/popover'
import PrimeToggleSwitch from 'primevue/toggleswitch'

const { t } = useI18n()

const props = defineProps({
  isLoaded: Boolean,
  isPlaying: Boolean,
  bpm: Number,
  originalBpm: Number,
  currentTime: Number,
  duration: Number,
  transpose: { type: Number, default: 0 },
  title: { type: String, default: '' },
  composer: { type: String, default: '' },
  isFloating: Boolean,
  loop: Boolean,
})

const emit = defineEmits([
  'togglePlay',
  'stop',
  'setTempo',
  'seek',
  'setTranspose',
  'close',
  'toggleFloat',
  'toggleLoop',
])

const settingsPopover = ref()

const canReset = computed(
  () => props.originalBpm && Math.round(props.bpm) !== Math.round(props.originalBpm),
)

const tempoPercent = computed(() => {
  if (!props.originalBpm) return 100
  return Math.round((props.bpm / props.originalBpm) * 100)
})

const transposeLabel = computed(() => {
  const v = props.transpose
  if (v === 0) return '0'
  const prefix = v > 0 ? '+' : ''
  return `${prefix}${v} ${t('semitones')}`
})

function resetTempo() {
  if (canReset.value) emit('setTempo', props.originalBpm)
}

function changeTempoBy(delta) {
  if (!props.originalBpm) return
  const newPct = Math.max(25, Math.min(300, tempoPercent.value + delta))
  emit('setTempo', (newPct / 100) * props.originalBpm)
}

function handleTempoSlider(val) {
  if (!props.originalBpm) return
  emit('setTempo', (val / 100) * props.originalBpm)
}

function skipBack() {
  emit('seek', Math.max(0, (props.currentTime || 0) - 10))
}

function skipForward() {
  emit('seek', Math.min(props.duration || 0, (props.currentTime || 0) + 10))
}

function formatTime(seconds) {
  if (!seconds || !isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.transport-wrapper {
  transition: all 0.3s ease;
  &.transport-floating {
    margin: 0 1rem;
  }
}

.transport-bar {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition:
    background 0.3s,
    border-radius 0.3s,
    box-shadow 0.3s;
}

.transport-floating {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  padding: 0.75rem 0;
  display: flex;
  justify-content: center;
}

.transport-floating .transport-bar {
  border-radius: 100px;
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.25);
  border: none;
  gap: 0;
  background: color-mix(in srgb, var(--extreme) 50%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  max-width: 500px;
  width: 100%;
  padding: 0.25rem 1.5rem;
}

.transport-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0.3rem 0;
}

.transport-progress {
  padding: 0.1rem 0 0.25rem 0;
}

.transport-progress :deep(.p-slider .p-slider-handle) {
  display: none;
}

.transport-buttons {
  display: flex;
  justify-content: center;
}

.transport-buttons-inner {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.transport-time {
  font-size: 0.75rem;
  font-family: 'Victor Mono', monospace;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

/* Settings Popover */
.settings-content {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 240px;
}

.settings-section {
  padding: 0.5rem 0.25rem;
}

.settings-label {
  display: block;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.settings-slider-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.settings-sub-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.35rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.settings-divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 0;
  opacity: 0.5;
}
</style>
