<template>
  <div
    v-if="pdfUrl"
    class="pdf-panel bg-surface-card border-1 surface-border border-round-lg overflow-hidden"
  >
    <div class="panel-header flex align-items-center justify-content-between p-3 border-bottom-1 surface-border">
      <h3 class="text-sm font-medium text-color-secondary text-uppercase m-0">
        {{ t('score') }}
      </h3>
      <div class="flex align-items-center gap-1">
        <Button
          v-if="expanded"
          size="small"
          variant="text"
          :title="t('fullscreen')"
          @click="toggleFullscreen"
        >
          <IconArrowsMaximize :size="16" />
        </Button>
        <Button
          size="small"
          variant="text"
          :title="expanded ? t('collapse') : t('expand')"
          @click="toggleExpanded"
        >
          <IconChevronDown :size="16" class="chevron" :class="{ expanded }" />
        </Button>
      </div>
    </div>
    <div v-if="expanded" ref="pdfContainerRef" class="pdf-wrapper">
      <iframe
        :src="pdfUrl"
        frameborder="0"
        class="pdf-iframe"
        :title="t('score')"
        allowfullscreen
      ></iframe>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { IconChevronDown, IconArrowsMaximize } from '@tabler/icons-vue'
import Button from 'primevue/button'

const { t } = useI18n()

const EXPANDED_KEY = 'midivox:pdf-panel-expanded'

defineProps({
  pdfUrl: { type: String, default: '' },
})

const expanded = ref(localStorage.getItem(EXPANDED_KEY) === 'true')

function toggleExpanded() {
  expanded.value = !expanded.value
  localStorage.setItem(EXPANDED_KEY, String(expanded.value))
}

const pdfContainerRef = ref(null)

function toggleFullscreen() {
  const el = pdfContainerRef.value
  if (!el) return
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    el.requestFullscreen()
  }
}
</script>

<style scoped>
.pdf-panel {
  padding: 0;
}

.pdf-wrapper {
  position: relative;
  width: 100%;
  height: 80vh;
  background: #f0f0f0;
}

.pdf-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.chevron {
  transition: transform 0.2s;
}

.chevron.expanded {
  transform: rotate(180deg);
}
</style>
