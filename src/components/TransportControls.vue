<template>
  <div
    class="flex flex-wrap align-items-center gap-4 p-3 bg-surface-card border-1 surface-border border-round-lg"
  >
    <div class="flex gap-1 align-items-center w-full md:w-auto">
      <Button
        :disabled="!isLoaded"
        :title="t('skip_back')"
        class="flex-1 md:flex-none"
        @click="skipBack"
      >
        <IconRewindBackward10 :size="18" />
      </Button>
      <Button
        :disabled="!isLoaded"
        :title="isPlaying ? t('pause') : t('play')"
        class="flex-1 md:flex-none"
        @click="$emit('togglePlay')"
      >
        <IconPlayerPlayFilled v-if="!isPlaying" :size="18" />
        <IconPlayerPauseFilled v-else :size="18" />
      </Button>
      <Button
        :disabled="!isLoaded"
        :title="t('skip_forward')"
        class="flex-1 md:flex-none"
        @click="skipForward"
      >
        <IconRewindForward10 :size="18" />
      </Button>
      <Button
        :disabled="!isLoaded"
        :title="t('stop')"
        class="flex-1 md:flex-none"
        @click="$emit('stop')"
      >
        <IconPlayerStopFilled :size="18" />
      </Button>
      <span class="text-sm font-mono text-color-primary ml-2" style="white-space: nowrap">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </span>
    </div>

    <div class="flex align-items-center gap-2 w-full md:w-20rem md:ml-auto">
      <label
        class="text-sm font-medium text-color-secondary text-uppercase label flex-shrink-0"
        style="white-space: nowrap"
        >{{ t('tempo') }}</label
      >
      <Button size="small" class="flex-shrink-0" @click="changeTempoBy(-5)" :disabled="!isLoaded"
        >-5</Button
      >
      <PrimeSlider
        :min="25"
        :max="300"
        class="flex-1 md:max-w-10rem"
        :model-value="originalBpm ? Math.round((bpm / originalBpm) * 100) : 100"
        @update:model-value="
          originalBpm
            ? $emit('setTempo', (parseFloat($event) / 100) * originalBpm)
            : $emit('setTempo', $event)
        "
      />
      <Button size="small" class="flex-shrink-0" @click="changeTempoBy(5)" :disabled="!isLoaded"
        >+5</Button
      >
      <span
        class="text-sm font-medium text-color-primary font-mono flex-shrink-0"
        :class="{ 'cursor-pointer text-decoration-line underline hover:text-primary': canReset }"
        style="white-space: nowrap"
        @click="resetTempo"
      >
        {{ originalBpm ? Math.round((bpm / originalBpm) * 100) + '%' : Math.round(bpm) }}
      </span>
      <Button
        :disabled="!isLoaded"
        size="small"
        class="flex-shrink-0"
        :title="t('transpose')"
        :aria-label="t('transpose')"
        @click="transposeDialogVisible = true"
        :severity="transpose ? 'danger' : undefined"
      >
        <IconArrowsTransferUpDown :size="16" />
      </Button>
    </div>
  </div>

  <PrimeDialog
    v-model:visible="transposeDialogVisible"
    :header="t('transpose')"
    :modal="true"
    :draggable="false"
    :style="{ width: '300px' }"
    class="transpose-dialog"
  >
    <div class="flex flex-column gap-4 p-2">
      <PrimeSlider
        :min="-12"
        :max="12"
        :step="1"
        class="w-full"
        :model-value="transpose"
        @update:model-value="$emit('setTranspose', $event)"
      />
      <div class="text-center">
        {{ transposeLabel }}
      </div>
    </div>
    <template #footer>
      <div class="flex gap-2 justify-content-center">
        <Button
          severity="secondary"
          variant="outlined"
          @click="emit('setTranspose', 0)"
          :disabled="!transpose"
        >
          {{ t('reset') }}
        </Button>
        <Button severity="secondary" variant="outlined" @click="transposeDialogVisible = false">
          {{ t('close') }}
        </Button>
      </div>
    </template>
  </PrimeDialog>
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
  IconArrowsTransferUpDown,
} from '@tabler/icons-vue'

import Button from 'primevue/button'
import PrimeSlider from 'primevue/slider'
import PrimeDialog from 'primevue/dialog'

const { t } = useI18n()

const props = defineProps({
  isLoaded: Boolean,
  isPlaying: Boolean,
  bpm: Number,
  originalBpm: Number,
  currentTime: Number,
  duration: Number,
  transpose: { type: Number, default: 0 },
})

const emit = defineEmits(['togglePlay', 'stop', 'setTempo', 'seek', 'setTranspose'])

const transposeDialogVisible = ref(false)

const canReset = computed(
  () => props.originalBpm && Math.round(props.bpm) !== Math.round(props.originalBpm),
)

const transposeLabel = computed(() => {
  const v = props.transpose
  const prefix = v > 0 ? '+' : ''
  return `${prefix}${v} ${t('semitones')}`
})

function resetTempo() {
  if (canReset.value) emit('setTempo', props.originalBpm)
}

function changeTempoBy(delta) {
  if (!props.originalBpm) return
  const currentPct = Math.round((props.bpm / props.originalBpm) * 100)
  const newPct = Math.max(25, Math.min(300, currentPct + delta))
  emit('setTempo', (newPct / 100) * props.originalBpm)
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
