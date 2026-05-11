<template>
  <div
    class="flex flex-wrap align-items-center gap-4 p-3 bg-surface-card border-1 surface-border border-round-lg"
  >
    <div class="flex gap-1 w-full md:w-auto">
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
    </div>

    <div class="flex align-items-center gap-2 min-w-0 flex-1 md:flex-none">
      <label
        class="text-sm font-medium text-color-secondary text-uppercase"
        style="white-space: nowrap"
        >{{ t('tempo') }}</label
      >
      <PrimeSlider
        :min="25"
        :max="300"
        class="flex-1 md:w-7rem"
        :model-value="originalBpm ? Math.round((bpm / originalBpm) * 100) : 100"
        @update:model-value="
          originalBpm
            ? $emit('setTempo', (parseFloat($event) / 100) * originalBpm)
            : $emit('setTempo', $event)
        "
      />
      <span
        class="text-sm font-semibold text-color-primary font-mono"
        style="min-width: 3rem; white-space: nowrap"
      >
        {{ originalBpm ? Math.round((bpm / originalBpm) * 100) + '%' : Math.round(bpm) }}
      </span>
      <Button
        v-if="originalBpm && Math.round(bpm) !== Math.round(originalBpm)"
        :title="t('reset_tempo')"
        @click="$emit('setTempo', originalBpm)"
      >
        <IconRefresh :size="18" stroke-width="2.5" />
      </Button>
    </div>

    <span class="text-sm font-mono text-color-secondary md:ml-auto" style="white-space: nowrap">
      {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
    </span>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import {
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconPlayerStopFilled,
  IconRefresh,
} from '@tabler/icons-vue'

import Button from 'primevue/button'
import PrimeSlider from 'primevue/slider'

const { t } = useI18n()

defineProps({
  isLoaded: Boolean,
  isPlaying: Boolean,
  bpm: Number,
  originalBpm: Number,
  currentTime: Number,
  duration: Number,
})

defineEmits(['togglePlay', 'stop', 'setTempo'])

function formatTime(seconds) {
  if (!seconds || !isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>
