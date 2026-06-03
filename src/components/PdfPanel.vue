<template>
  <div
    v-if="pdfUrl"
    class="pdf-panel bg-surface-card border-1 surface-border border-round-lg overflow-hidden"
  >
    <div
      class="panel-header flex align-items-center justify-content-between p-3 surface-border"
      @click="toggleExpanded"
    >
      <div class="flex flex-column gap-1">
        <h3
          class="text-sm font-medium text-color-secondary text-uppercase m-0 flex align-items-center gap-1"
        >
          <IconMusic :size="16" />
          {{ t('score_pdf') }}
        </h3>
        <div v-if="pdfMeta" class="flex gap-2 text-xs text-color-secondary">
          <span v-if="pdfMeta.author">{{ pdfMeta.author }}</span>
          <span v-if="pdfMeta.author && pdfMeta.creator" class="text-color-muted">|</span>
          <span v-if="pdfMeta.creator">{{ pdfMeta.creator }}</span>
        </div>
      </div>
      <div class="flex align-items-center gap-1" @click.stop>
        <template v-if="expanded && numPages > 0">
          <Button
            size="small"
            variant="text"
            :disabled="pageNum <= 1"
            title="Previous page"
            @click="prevPage"
          >
            <IconChevronLeft :size="16" />
          </Button>
          <span class="text-xs text-color-secondary font-mono">{{ pageNum }}/{{ numPages }}</span>
          <Button
            size="small"
            variant="text"
            :disabled="pageNum >= numPages"
            title="Next page"
            @click="nextPage"
          >
            <IconChevronRight :size="16" />
          </Button>
        </template>
        <Button
          v-if="expanded"
          size="small"
          variant="text"
          :title="fullscreenSupported ? t('fullscreen') : t('openInNewTab')"
          @click="toggleFullscreen"
        >
          <IconExternalLink v-if="!fullscreenSupported" :size="16" />
          <IconArrowsMaximize v-else :size="16" />
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
      <canvas ref="canvasRef" class="pdf-canvas"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  IconChevronDown,
  IconArrowsMaximize,
  IconExternalLink,
  IconChevronLeft,
  IconChevronRight,
  IconMusic,
} from '@tabler/icons-vue'
import Button from 'primevue/button'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const { t } = useI18n()

const EXPANDED_KEY = 'midivoci:pdf-panel-expanded'

const props = defineProps({
  pdfUrl: { type: String, default: '' },
})

const expanded = ref(localStorage.getItem(EXPANDED_KEY) === 'true')
const fullscreenSupported = document.fullscreenEnabled
const pdfContainerRef = ref(null)
const canvasRef = ref(null)

const pageNum = ref(1)
const numPages = ref(0)
const pdfMeta = ref(null)

let pdfDoc = null
let renderTask = null
let resizeObserver = null
let onWindowResize = null

function toggleExpanded() {
  expanded.value = !expanded.value
  localStorage.setItem(EXPANDED_KEY, String(expanded.value))
}

function toggleFullscreen() {
  if (!fullscreenSupported) {
    window.open(props.pdfUrl, '_blank')
    return
  }
  const el = pdfContainerRef.value
  if (!el) return
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    el.requestFullscreen()
  }
}

async function loadPdf(url) {
  if (pdfDoc) {
    try {
      await pdfDoc.destroy()
    } catch {
      /* ignore */
    }
    pdfDoc = null
  }
  numPages.value = 0
  pageNum.value = 1
  pdfMeta.value = null
  try {
    pdfDoc = await pdfjsLib.getDocument(url).promise
    numPages.value = pdfDoc.numPages
    const meta = await pdfDoc.getMetadata()
    const info = meta.info || {}
    pdfMeta.value = {
      author: info.Author || null,
      creator: info.Creator || null,
    }
    await renderPage()
  } catch (err) {
    console.error('Failed to load PDF:', err)
  }
}

async function renderPage() {
  if (!pdfDoc || !canvasRef.value) return
  if (renderTask) {
    try {
      renderTask.cancel()
    } catch {
      /* ignore */
    }
    renderTask = null
  }
  const page = await pdfDoc.getPage(pageNum.value)
  const container = pdfContainerRef.value
  if (!container) return
  const unscaled = page.getViewport({ scale: 1 })
  const fitScale = container.clientWidth / unscaled.width
  const dpr = window.devicePixelRatio || 1
  const viewport = page.getViewport({ scale: fitScale * dpr })
  const canvas = canvasRef.value
  canvas.width = viewport.width
  canvas.height = viewport.height
  canvas.style.width = `${container.clientWidth}px`
  canvas.style.height = `${unscaled.height * fitScale}px`
  renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport })
  await renderTask.promise
}

function prevPage() {
  if (pageNum.value > 1) {
    pageNum.value--
    renderPage()
  }
}

function nextPage() {
  if (pageNum.value < numPages.value) {
    pageNum.value++
    renderPage()
  }
}

watch(expanded, (val) => {
  if (val && props.pdfUrl) {
    nextTick(() => {
      loadPdf(props.pdfUrl)
      observeContainer()
    })
  }
})

watch(
  () => props.pdfUrl,
  (url) => {
    if (url && expanded.value) {
      nextTick(() => loadPdf(url))
    }
  },
)

function observeContainer() {
  if (resizeObserver || !pdfContainerRef.value) return
  resizeObserver = new ResizeObserver(() => {
    if (expanded.value && numPages.value > 0) {
      renderPage()
    }
  })
  resizeObserver.observe(pdfContainerRef.value)
}

onMounted(() => {
  if (props.pdfUrl && expanded.value) {
    nextTick(() => {
      loadPdf(props.pdfUrl)
      observeContainer()
    })
  }
  onWindowResize = () => {
    if (expanded.value && numPages.value > 0) {
      renderPage()
    }
  }
  window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
  if (onWindowResize) window.removeEventListener('resize', onWindowResize)
  if (pdfDoc) {
    pdfDoc.destroy().catch(() => {})
  }
})
</script>

<style scoped>
.pdf-panel {
  padding: 0;
}

.pdf-wrapper {
  position: relative;
  width: 100%;
  min-height: 40vh;
  background: #f0f0f0;
  display: flex;
  justify-content: center;
}

.pdf-canvas {
  display: block;
}

.chevron {
  transition: transform 0.2s;
}

.chevron.expanded {
  transform: scaleY(-1);
}
</style>
