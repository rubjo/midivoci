<template>
  <div
    class="flex flex-wrap align-items-center gap-4 p-3 bg-surface-card border-1 surface-border border-round-lg"
  >
    <div class="flex gap-1 align-items-center w-full md:w-auto">
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
        :title="t('stop')"
        class="flex-1 md:flex-none"
        @click="$emit('stop')"
      >
        <IconPlayerStopFilled :size="18" />
      </Button>
      <span class="text-sm font-mono text-color-secondary ml-2" style="white-space: nowrap">
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
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import {
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconPlayerStopFilled,
} from '@tabler/icons-vue'

import Button from 'primevue/button'
import PrimeSlider from 'primevue/slider'

const { t } = useI18n()

const props = defineProps({
  isLoaded: Boolean,
  isPlaying: Boolean,
  bpm: Number,
  originalBpm: Number,
  currentTime: Number,
  duration: Number,
})

const emit = defineEmits(['togglePlay', 'stop', 'setTempo'])

const canReset = computed(
  () => props.originalBpm && Math.round(props.bpm) !== Math.round(props.originalBpm),
)

function resetTempo() {
  if (canReset.value) emit('setTempo', props.originalBpm)
}

function changeTempoBy(delta) {
  if (!props.originalBpm) return
  const currentPct = Math.round((props.bpm / props.originalBpm) * 100)
  const newPct = Math.max(25, Math.min(300, currentPct + delta))
  emit('setTempo', (newPct / 100) * props.originalBpm)
}

function formatTime(seconds) {
  if (!seconds || !isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>
