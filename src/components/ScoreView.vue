<template>
  <div class="bg-surface-card border-1 surface-border border-round-lg overflow-hidden">
    <div class="flex align-items-center justify-content-between p-3 border-bottom-1 surface-border">
      <h3 class="text-sm font-semibold text-color-secondary text-uppercase m-0">
        {{ t('piano_roll') }}
      </h3>
      <div class="flex align-items-center gap-1">
        <Button
          v-if="midiUrl"
          size="small"
          :title="visible ? 'Hide' : 'Show'"
          @click="visible = !visible"
        >
          <IconChevronUp v-if="visible" :size="16" />
          <IconChevronDown v-else :size="16" />
        </Button>
      </div>
    </div>
    <div
      v-if="midiUrl && visible"
      ref="containerRef"
      class="overflow-auto"
      style="max-height: 600px"
      @mousemove="handleRollHover"
      @mouseleave="hoverX = -1"
    >
      <div class="roll-content" ref="rollContentRef" @click="handleRollClick">
        <midi-visualizer
          ref="visualizerRef"
          :src="visualizerUrl || midiUrl"
          type="piano-roll"
        ></midi-visualizer>
        <div ref="cursorRef" class="playback-cursor"></div>
        <div v-if="hoverX >= 0" class="hover-cursor" :style="{ left: hoverX + 'px' }"></div>
      </div>
    </div>
    <div v-else-if="!midiUrl" class="p-5 text-center text-color-secondary text-sm">
      {{ t('piano_roll_empty') }}
    </div>
  </div>
</template>

<script setup>
import 'html-midi-player'
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { IconChevronUp, IconChevronDown } from '@tabler/icons-vue'

import Button from 'primevue/button'

const { t } = useI18n()

const props = defineProps({
  midiUrl: String,
  visualizerUrl: String,
  currentTime: Number,
  duration: Number,
  tracks: { type: Array, default: () => [] },
})

const emit = defineEmits(['seek'])

const visible = ref(true)
const visualizerRef = ref(null)
const containerRef = ref(null)
const cursorRef = ref(null)
const rollContentRef = ref(null)
const hoverX = ref(-1)

function handleRollClick(e) {
  const container = containerRef.value
  const roll = rollContentRef.value
  if (!container || !roll || !props.duration) return
  const rect = roll.getBoundingClientRect()
  const x = e.clientX - rect.left
  const progress = x / rect.width
  emit('seek', progress * props.duration)
}

function handleRollHover(e) {
  const roll = rollContentRef.value
  if (!roll) return
  const rect = roll.getBoundingClientRect()
  hoverX.value = e.clientX - rect.left
}

function updatePlaybackCursor(time) {
  const container = containerRef.value
  const cursor = cursorRef.value
  if (!container || !cursor || !props.duration || time < 0) {
    if (cursor) cursor.style.display = 'none'
    return
  }
  const progress = time / props.duration
  const totalWidth = container.scrollWidth
  if (!totalWidth) return
  cursor.style.display = 'block'
  cursor.style.left = progress * totalWidth + 'px'
}

function applyVolumeToRects() {
  const container = rollContentRef.value
  if (!container) return

  let styleEl = container.querySelector('#track-opacity-style')
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'track-opacity-style'
    container.prepend(styleEl)
  }

  let css = ''
  for (let i = 0; i < props.tracks.length; i++) {
    const track = props.tracks[i]
    if (!track) continue
    const opacity = track.muted ? 0.1 : Math.max(0.1, track.volume / 100)
    css += `midi-visualizer svg rect.note[data-instrument="${i}"] { opacity: ${opacity} !important; }\n`
  }
  styleEl.textContent = css
}

watch(
  () => props.currentTime,
  (t) => {
    if (t < 0) return
    setTimeout(() => {
      updatePlaybackCursor(t)
      const container = containerRef.value
      if (!container || !props.duration) return
      const progress = t / props.duration
      const maxScroll = container.scrollWidth - container.clientWidth
      if (maxScroll <= 0) return
      const wantCenter = progress * container.scrollWidth - container.clientWidth / 2
      container.scrollLeft = Math.max(0, Math.min(wantCenter, maxScroll))
    }, 0)
  },
)

watch(
  () => props.visualizerUrl,
  () => {
    setTimeout(() => {
      updatePlaybackCursor(props.currentTime)
      applyVolumeToRects()
    }, 0)
  },
)

watch(
  () => props.tracks.map((t) => `${t.volume}:${t.muted}`),
  async () => {
    await nextTick()
    applyVolumeToRects()
  },
)
</script>

<style lang="scss" scoped>
.roll-content {
  position: relative;
  display: inline-block;
  min-width: 100%;
}

.playback-cursor {
  position: absolute;
  top: 0;
  height: 100%;
  width: 2px;
  background: #ef4444;
  pointer-events: none;
  z-index: 10;
  display: none;
}

.hover-cursor {
  position: absolute;
  top: 0;
  height: 100%;
  width: 1px;
  background: rgba(100, 116, 139, 0.5);
  pointer-events: none;
  z-index: 9;
}
</style>
