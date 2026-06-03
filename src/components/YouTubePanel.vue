<template>
  <div
    v-if="embedUrl"
    class="youtube-panel bg-surface-card border-1 surface-border border-round-lg overflow-hidden"
  >
    <div
      class="panel-header flex align-items-center justify-content-between p-3 surface-border"
      @click="toggleExpanded"
    >
      <h3
        class="text-sm font-medium text-color-secondary text-uppercase m-0 flex align-items-center gap-1"
      >
        <IconDeviceTv :size="16" />
        {{ t('live_performance_video') }}
      </h3>
      <div class="flex align-items-center gap-1" @click.stop>
        <Button
          size="small"
          variant="text"
          :title="expanded ? t('collapse') : t('expand')"
          @click="toggleExpanded"
        >
          <IconChevronDown :size="16" class="chevron" :class="{ expanded: expanded }" />
        </Button>
      </div>
    </div>
    <div v-if="expanded" class="youtube-aspect-ratio-wrapper">
      <div class="youtube-aspect-ratio">
        <iframe
          :src="embedUrl"
          frameborder="0"
          allowfullscreen
          allow="autoplay; encrypted-media; picture-in-picture"
          class="youtube-iframe"
          :title="t('live_performance_video')"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { IconChevronDown, IconDeviceTv } from '@tabler/icons-vue'
import Button from 'primevue/button'

const { t } = useI18n()

const EXPANDED_KEY = 'midivoci:youtube-panel-expanded'

const props = defineProps({
  youtubeUrl: { type: String, default: '' },
})

const expanded = ref(localStorage.getItem(EXPANDED_KEY) !== 'false')

function toggleExpanded() {
  expanded.value = !expanded.value
  localStorage.setItem(EXPANDED_KEY, String(expanded.value))
}

const embedUrl = computed(() => {
  if (!props.youtubeUrl) return ''
  const match = props.youtubeUrl.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/,
  )
  return match ? `https://www.youtube.com/embed/${match[1]}` : ''
})
</script>

<style scoped>
.youtube-panel {
  padding: 0;
}

.youtube-aspect-ratio-wrapper {
  padding: 0;
}

.youtube-aspect-ratio {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
}

.youtube-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
}

.chevron {
  transition: transform 0.2s;
}

.chevron.expanded {
  transform: scaleY(-1);
}
</style>
