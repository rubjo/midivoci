<template>
  <div ref="containerRef" class="track-meta">
    <div ref="contentRef" class="track-meta-content">
      <span class="track-meta-composer">{{ composer }}</span><span v-if="composer && title">: </span><span class="track-meta-title">{{ title }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  composer: { type: String, default: '' },
})

const containerRef = ref(null)
const contentRef = ref(null)
let animation = null
let observer = null

function updateScroll() {
  const container = containerRef.value
  const content = contentRef.value
  if (!container || !content) return

  if (animation) {
    animation.cancel()
    animation = null
  }

  if (content.scrollWidth <= container.clientWidth) return

  const scrollDist = container.clientWidth - content.scrollWidth

  animation = content.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(0)', offset: 0.15 },
      { transform: `translateX(${scrollDist}px)`, offset: 0.65 },
      { transform: `translateX(${scrollDist}px)`, offset: 0.78 },
      { transform: 'translateX(0)', offset: 0.95 },
      { transform: 'translateX(0)' },
    ],
    {
      duration: 14000,
      iterations: Infinity,
      easing: 'ease-in-out',
    },
  )
}

onMounted(() => {
  nextTick(updateScroll)
  observer = new ResizeObserver(updateScroll)
  if (containerRef.value) observer.observe(containerRef.value)
  if (contentRef.value) observer.observe(contentRef.value)
})

onUnmounted(() => {
  if (animation) animation.cancel()
  if (observer) observer.disconnect()
})

watch(
  () => [props.title, props.composer],
  () => nextTick(updateScroll),
)
</script>

<style scoped>
.track-meta {
  overflow: hidden;
  flex: 1;
  min-width: 0;
}

.track-meta-content {
  display: inline-block;
  white-space: nowrap;
  min-width: 0;
}

.track-meta-composer {
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1.4;
  color: var(--text-secondary);
}

.track-meta-title {
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1.4;
  color: var(--text-primary);
}
</style>
