<template>
  <div
    v-if="xmlContent"
    class="musicxml-panel bg-surface-card border-1 surface-border border-round-lg overflow-hidden"
  >
      <div class="panel-header flex align-items-center justify-content-between p-3 surface-border"
      @click="toggleExpanded"
    >
      <div class="flex flex-column gap-1 min-w-0">
        <h3
          class="text-sm font-medium text-color-secondary text-uppercase m-0 flex align-items-center gap-1"
        >
          <IconMusic :size="16" />
          {{ t('score_interactive') }}
        </h3>
        <div v-if="xmlMeta.creators.length || xmlMeta.rights" class="flex gap-2 text-xs text-color-secondary flex-wrap">
          <template v-for="(c, i) in xmlMeta.creators" :key="c.type">
            <span>{{ c.value }}</span>
            <span v-if="i < xmlMeta.creators.length - 1 || xmlMeta.rights" class="text-color-muted">|</span>
          </template>
          <span v-if="xmlMeta.rights" class="truncate" style="max-width: 200px">{{ xmlMeta.rights }}</span>
        </div>
      </div>
      <div class="flex align-items-center gap-1" @click.stop>
        <template v-if="expanded">
          <Button size="small" variant="text" :disabled="zoomPercent <= 50" @click="zoomOut">
            <IconMinus :size="14" />
          </Button>
          <span class="text-xs text-color-secondary zoom-label">{{ zoomPercent }}%</span>
          <Button size="small" variant="text" :disabled="zoomPercent >= 150" @click="zoomIn">
            <IconPlus :size="14" />
          </Button>
        </template>
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
    <div v-if="expanded" class="musicxml-body" ref="bodyRef">
      <div v-if="error" class="musicxml-error p-4 text-center text-sm text-color-secondary">
        {{ t('musicxml_load_error') }}
      </div>
      <div
        v-else
        ref="containerRef"
        class="musicxml-container"
        @click="handleContainerClick"
        @mousemove="handleHover"
        @mouseleave="hoverX = -1"
      >
        <div ref="cursorRef" class="playback-cursor"></div>
        <div
          v-show="hoverX >= 0"
          class="hover-cursor"
          :style="{ left: hoverX + 'px', top: hoverY + 'px', height: hoverHeight + 'px' }"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { IconChevronDown, IconMusic, IconMinus, IconPlus } from '@tabler/icons-vue'
import Button from 'primevue/button'

const { t } = useI18n()

const EXPANDED_KEY = 'midivox:musicxml-panel-expanded'
const ZOOM_KEY = 'midivox:musicxml-zoom'
const SAVED_ZOOM = parseInt(localStorage.getItem(ZOOM_KEY), 10)

const props = defineProps({
  xmlContent: { type: String, default: '' },
  currentTime: { type: Number, default: -1 },
  duration: { type: Number, default: 0 },
  fileMeta: { type: Object, default: null },
})

const emit = defineEmits(['seek', 'midiReady'])

const expanded = ref(localStorage.getItem(EXPANDED_KEY) === 'true')
const containerRef = ref(null)
const bodyRef = ref(null)
const cursorRef = ref(null)
const error = ref(false)
const hoverX = ref(-1)
const hoverY = ref(0)
const hoverHeight = ref(0)
const zoomPercent = ref(SAVED_ZOOM >= 50 && SAVED_ZOOM <= 150 ? SAVED_ZOOM : 100)

const xmlMeta = computed(() => {
  const xml = props.xmlContent
  const meta = { creators: [], rights: null }
  if (xml) {
    const iterator = xml.matchAll(/<creator\s+type="([^"]+)">([^<]+)<\/creator>/gi)
    for (const m of iterator) {
      meta.creators.push({ type: m[1], value: m[2] })
    }
    const rightsMatch = xml.match(/<rights>([^<]+)<\/rights>/i)
    if (rightsMatch) meta.rights = rightsMatch[1]
  }
  if (!meta.creators.some((c) => c.type === 'composer') && props.fileMeta?.composer) {
    meta.creators.unshift({ type: 'composer', value: props.fileMeta.composer })
  }
  return meta
})

let vrv = null
let verovioModulePromise = null
let timemapEntries = []
let measures = []
let timepoints = []

async function getVerovio() {
  if (vrv) return vrv
  if (!verovioModulePromise) {
    verovioModulePromise = (async () => {
      const { VerovioToolkit } = await import('verovio/esm')
      const createModule = (await import('verovio/wasm')).default
      const module = await createModule()
      vrv = new VerovioToolkit(module)
      return vrv
    })()
  }
  return vrv || (await verovioModulePromise)
}

function destroyVrv() {
  if (vrv) {
    try {
      vrv.destroy()
    } catch {}
    vrv = null
  }
  verovioModulePromise = null
}

function zoomIn() {
  if (zoomPercent.value < 150) {
    zoomPercent.value += 10
    applyZoom()
  }
}

function zoomOut() {
  if (zoomPercent.value > 50) {
    zoomPercent.value -= 10
    applyZoom()
  }
}

function applyZoom() {
  if (!vrv) return
  vrv.setOptions({ scale: Math.round(zoomPercent.value / 2) })
  renderScore()
  updateCursor(props.currentTime)
}

async function initVerovio() {
  if (!containerRef.value || !props.xmlContent) return
  error.value = false
  destroyVrv()
  try {
    const tk = await getVerovio()
    tk.setOptions({
      adjustPageHeight: true,
      scale: Math.round(zoomPercent.value / 2),
      footer: 'none',
      font: 'Bravura',
      breaks: 'none',
      spacingNonLinear: 1.0,
      spacingLinear: 0.04,
    })
    if (!tk.loadData(props.xmlContent)) {
      throw new Error('Failed to load MusicXML')
    }
    renderScore()
    updateCursor(props.currentTime)
    const b64 = tk.renderToMIDI()
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    emit('midiReady', bytes.buffer)
  } catch (err) {
    console.error('Verovio render failed:', err)
    error.value = true
  }
}

function renderScore() {
  const container = containerRef.value
  if (!container || !vrv) return
  vrv.redoLayout({ resetCache: false })
  const pageCount = vrv.getPageCount()
  container.querySelectorAll('.sheet-page').forEach((el) => el.remove())

  for (let i = 0; i < pageCount; i++) {
    const svgHtml = vrv.renderToSVG(i + 1)
    const page = document.createElement('div')
    page.className = 'sheet-page'
    page.innerHTML = svgHtml
    container.appendChild(page)
  }

  const rawTimemap = vrv.renderToTimemap({ includeMeasures: true, includeRests: true })
  buildData(rawTimemap)
}

function buildData(rawTimemap) {
  timemapEntries = rawTimemap.map((e) => ({ ...e, rectNotes: [], notesOn: [] }))
  measures = []
  const container = containerRef.value
  const containerRect = container.getBoundingClientRect()

  timemapEntries.forEach((entry, entryIdx) => {
    if (entry.measureOn) {
      const el = container.querySelector('#' + CSS.escape(entry.measureOn))
      if (el) {
        const system = el.closest('g.system') || el
        const elRect = el.getBoundingClientRect()
        const sysRect = system.getBoundingClientRect()
        measures.push({
          idx: measures.length,
          timestamp: entry.tstamp,
          duration: 0,
          eventEntry: entryIdx,
          measureId: entry.measureOn,
          systemId: system.getAttribute('id') || '',
          rectMeasure: { left: elRect.left - containerRect.left, width: elRect.width },
          rectSystem: { top: sysRect.top - containerRect.top, height: sysRect.height },
        })
      }
    }
  })

  for (let i = 0; i < measures.length; i++) {
    if (i < measures.length - 1) {
      measures[i].duration = measures[i + 1].timestamp - measures[i].timestamp
    } else {
      measures[i].duration =
        Math.max(...timemapEntries.filter((e) => e.tstamp != null).map((e) => e.tstamp)) -
        measures[i].timestamp
    }
  }

  let lastIdx = 0
  timemapEntries.forEach((entry, entryIdx) => {
    entry.measureEntry = lastIdx
    entry.notesOn = entryIdx > 0 ? [...timemapEntries[entryIdx - 1].notesOn] : []
    const notesOff = [...(entry.off || []), ...(entry.restsOff || [])]
    entry.notesOn = entry.notesOn.filter((n) => !notesOff.includes(n))
    const measure = measures[lastIdx]
    if (measure) {
      ;[...(entry.on || []), ...(entry.restsOn || [])].forEach((domid) => {
        const note = container.querySelector('#' + CSS.escape(domid))
        if (note) entry.notesOn.push(domid)
      })
    }
    if (entry.measureOn) lastIdx++
  })

  refreshRects()
  buildTimepoints()
}

function buildTimepoints() {
  timepoints = []
  timemapEntries.forEach((entry) => {
    if (entry.tstamp == null) return
    const measure = measures[entry.measureEntry]
    if (!measure) return
    let x = null
    if (entry.rectNotes.length) {
      x = entry.rectNotes[0].left
    } else if (measure.rectMeasure) {
      x = measure.rectMeasure.left
    }
    if (x != null) {
      timepoints.push({
        timestamp: entry.tstamp,
        x,
        systemTop: measure.rectSystem.top,
        systemHeight: measure.rectSystem.height,
      })
    }
  })
}

function refreshRects() {
  const container = containerRef.value
  if (!container) return
  const containerRect = container.getBoundingClientRect()
  timemapEntries.forEach((entry, entryIdx) => {
    entry.rectNotes = []
    const measure = measures[entry.measureEntry]
    if (!measure) return
    if (entry.measureOn) {
      const el = container.querySelector('#' + CSS.escape(entry.measureOn))
      if (el) {
        const system = el.closest('g.system') || el
        const elRect = el.getBoundingClientRect()
        const sysRect = system.getBoundingClientRect()
        measure.rectMeasure = { left: elRect.left - containerRect.left, width: elRect.width }
        measure.rectSystem = { top: sysRect.top - containerRect.top, height: sysRect.height }
      }
    }
    ;[...(entry.on || []), ...(entry.restsOn || [])].forEach((domid) => {
      const note = container.querySelector('#' + CSS.escape(domid))
      if (note) {
        const nr = note.getBoundingClientRect()
        entry.rectNotes.push({
          left: nr.left - containerRect.left,
          top: nr.top - containerRect.top,
          width: nr.width,
          height: nr.height,
        })
      }
    })
    if (!entry.rectNotes.length) {
      entry.rectNotes.push({ ...measure.rectMeasure })
    }
    if (entryIdx === 0 && entry.rectNotes[0]) {
      measure.rectMeasure = {
        left: entry.rectNotes[0].left,
        width: measure.rectMeasure.width - (entry.rectNotes[0].left - measure.rectMeasure.left),
      }
    }
  })
}

function updateCursor(time) {
  const cursor = cursorRef.value
  if (!cursor || !vrv || !props.duration || time < 0 || !timepoints.length) {
    if (cursor) cursor.style.display = 'none'
    return
  }
  cursor.style.display = 'block'

  const ms = time * 1000
  let before = timepoints[0]
  let after = timepoints[timepoints.length - 1]
  for (let i = 0; i < timepoints.length - 1; i++) {
    if (ms >= timepoints[i].timestamp && ms < timepoints[i + 1].timestamp) {
      before = timepoints[i]
      after = timepoints[i + 1]
      break
    }
  }

  const range = after.timestamp - before.timestamp
  const ratio = range > 0 ? Math.min(1, Math.max(0, (ms - before.timestamp) / range)) : 0
  const cx = Math.round(before.x + ratio * (after.x - before.x))

  cursor.style.transform = `translate(${cx}px, ${before.systemTop}px)`
  cursor.style.height = `${before.systemHeight}px`
  cursor.style.width = '2px'
}

function handleContainerClick(e) {
  const container = containerRef.value
  if (!container || !timepoints.length) return
  const containerRect = container.getBoundingClientRect()
  const clickX = e.clientX - containerRect.left
  const clickY = e.clientY - containerRect.top

  let systemTop = 0
  let systemHeight = 0
  for (const m of measures) {
    const sysTop = m.rectSystem.top
    const sysBottom = sysTop + m.rectSystem.height
    if (clickY >= sysTop && clickY <= sysBottom) {
      systemTop = sysTop
      systemHeight = m.rectSystem.height
      break
    }
  }
  if (!systemHeight) return

  const inSystem = timepoints.filter((tp) => tp.systemTop === systemTop)
  if (inSystem.length < 2) return

  for (let i = 0; i < inSystem.length - 1; i++) {
    const a = inSystem[i]
    const b = inSystem[i + 1]
    if (clickX >= a.x && clickX <= b.x) {
      const range = b.x - a.x
      const ratio = range > 0 ? Math.min(1, Math.max(0, (clickX - a.x) / range)) : 0
      const ms = a.timestamp + ratio * (b.timestamp - a.timestamp)
      emit('seek', ms / 1000)
      return
    }
  }

  if (clickX < inSystem[0].x) {
    emit('seek', inSystem[0].timestamp / 1000)
  } else {
    emit('seek', inSystem[inSystem.length - 1].timestamp / 1000)
  }
}

function handleHover(e) {
  const containerRect = containerRef.value.getBoundingClientRect()
  hoverX.value = e.clientX - containerRect.left
  let found = false
  for (const measure of measures) {
    const sysTop = containerRect.top + measure.rectSystem.top
    const sysBottom = sysTop + measure.rectSystem.height
    if (e.clientY >= sysTop && e.clientY <= sysBottom) {
      hoverY.value = measure.rectSystem.top
      hoverHeight.value = measure.rectSystem.height
      found = true
      break
    }
  }
  if (!found) {
    hoverY.value = 0
    hoverHeight.value = 0
  }
}

function autoScroll(time) {
  const container = bodyRef.value
  if (!container || !props.duration || !timepoints.length) return
  const ms = time * 1000
  let before = timepoints[0]
  let after = timepoints[timepoints.length - 1]
  for (let i = 0; i < timepoints.length - 1; i++) {
    if (ms >= timepoints[i].timestamp && ms < timepoints[i + 1].timestamp) {
      before = timepoints[i]
      after = timepoints[i + 1]
      break
    }
  }
  const range = after.timestamp - before.timestamp
  const ratio = range > 0 ? Math.min(1, Math.max(0, (ms - before.timestamp) / range)) : 0
  const cx = before.x + ratio * (after.x - before.x)
  container.scrollLeft = cx - container.clientWidth / 2
}

function toggleExpanded() {
  expanded.value = !expanded.value
  localStorage.setItem(EXPANDED_KEY, String(expanded.value))
}

watch(expanded, (val) => {
  if (val && props.xmlContent) {
    nextTick(() => {
      if (!vrv) {
        initVerovio()
      } else {
        renderScore()
        updateCursor(props.currentTime)
      }
    })
  }
})

watch(zoomPercent, (val) => {
  localStorage.setItem(ZOOM_KEY, String(val))
})

watch(
  () => props.xmlContent,
  (xml) => {
    if (xml) {
      nextTick(() => initVerovio())
    }
  },
)

watch(
  () => props.currentTime,
  (t) => {
    if (t < 0 || !expanded.value) return
    nextTick(() => {
      updateCursor(t)
      autoScroll(t)
    })
  },
)

watch(
  () => props.duration,
  (dur) => {
    if (dur > 0 && expanded.value) {
      nextTick(() => updateCursor(props.currentTime))
    }
  },
)

onMounted(() => {
  if (props.xmlContent && expanded.value) {
    nextTick(() => initVerovio())
  }
})

onUnmounted(() => {
  destroyVrv()
})
</script>

<style scoped>
.musicxml-panel {
  padding: 0;
}

.musicxml-body {
  position: relative;
  width: 100%;
  overflow-x: auto;
}

.musicxml-container {
  position: relative;
  min-height: 200px;
  padding: 0;
  display: inline-block;
  min-width: 100%;
  line-height: 0;
  background: #fff;
}

.musicxml-container :deep(.sheet-page svg) {
  display: block;
  background: #fff;
}

.musicxml-container :deep(.sheet-page) {
  display: inline-block;
}

.musicxml-error {
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.playback-cursor {
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  background: #ef4444;
  pointer-events: none;
  z-index: 10;
  display: none;
  will-change: transform;
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

.zoom-label {
  min-width: 2.5em;
  text-align: center;
}

.chevron {
  transition: transform 0.2s;
}

.chevron.expanded {
  transform: scaleY(-1);
}
</style>
