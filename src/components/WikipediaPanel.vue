<template>
  <div
    v-if="summary"
    class="wikipedia-panel bg-surface-card border-1 surface-border border-round-lg overflow-hidden"
  >
    <div
      class="panel-header flex align-items-center justify-content-between p-3 surface-border cursor-pointer"
      @click="toggleExpanded"
    >
      <h3
        class="text-sm font-medium text-color-secondary text-uppercase m-0 flex align-items-center gap-1"
      >
        <IconInfoCircle :size="16" />
        Wikipedia
      </h3>
      <div class="flex align-items-center gap-1" @click.stop>
        <a
          v-if="pageUrl"
          :href="pageUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="p-button p-button-sm"
          :title="t('openInNewTab')"
          @click.stop
        >
          <IconExternalLink :size="16" />
        </a>
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
    <div v-if="expanded" class="px-3 pb-3 leading-normal">
      <h3 class="mb-2 mt-0">{{ pageTitle }}</h3>
      <p class="m-0 wikipedia-summary">{{ summary }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { IconChevronDown, IconInfoCircle, IconExternalLink } from '@tabler/icons-vue'
import Button from 'primevue/button'

const { t, locale } = useI18n()

const EXPANDED_KEY = 'midivox:wikipedia-panel-expanded'

const props = defineProps({
  composer: { type: String, default: '' },
  title: { type: String, default: '' },
  wikipediaUrl: { type: String, default: '' },
})

const expanded = ref(localStorage.getItem(EXPANDED_KEY) !== 'false')
const summary = ref('')
const pageTitle = ref('')
const foundLang = ref('en')
const loading = ref(false)

function toggleExpanded() {
  expanded.value = !expanded.value
  localStorage.setItem(EXPANDED_KEY, String(expanded.value))
}

const pageUrl = computed(() => {
  if (props.wikipediaUrl) return props.wikipediaUrl
  if (pageTitle.value) {
    const lang = foundLang.value === 'en' ? 'en' : foundLang.value
    return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pageTitle.value.replace(/ /g, '_'))}`
  }
  return ''
})

async function searchWikipedia(lang, term) {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?` +
    `action=query&` +
    `generator=search&` +
    `gsrsearch=${encodeURIComponent(term)}&` +
    `gsrlimit=1&` +
    `prop=extracts&` +
    `exintro&` +
    `explaintext&` +
    `format=json&` +
    `origin=*`

  const res = await fetch(url)
  const data = await res.json()
  const pages = data?.query?.pages
  if (pages) {
    const id = Object.keys(pages)[0]
    if (id && pages[id].extract) {
      return { summary: pages[id].extract, title: pages[id].title || '' }
    }
  }
  return null
}

function isExactMatch(searchTerm, title) {
  const words = searchTerm.split(' ').filter((w) => w.length > 2)
  if (!words.length) return false
  const t = title.toLowerCase()
  return words.every((w) => t.includes(w.toLowerCase()))
}

async function fetchSummary() {
  const searchTerm = [props.composer, props.title].filter(Boolean).join(' ')
  if (!searchTerm) {
    summary.value = ''
    pageTitle.value = ''
    return
  }

  loading.value = true
  const langs = locale.value === 'en' ? ['en'] : [locale.value, 'en']

  try {
    for (const lang of langs) {
      let result = await searchWikipedia(lang, searchTerm)
      if (!result && props.composer) {
        result = await searchWikipedia(lang, `${props.composer} composer`)
      }
      if (result && (lang === 'en' || isExactMatch(searchTerm, result.title))) {
        summary.value = result.summary
        pageTitle.value = result.title
        foundLang.value = lang
        return
      }
    }
    summary.value = ''
    pageTitle.value = ''
  } catch {
    summary.value = ''
    pageTitle.value = ''
  } finally {
    loading.value = false
  }
}

watch(() => [props.composer, props.title, locale.value], fetchSummary, { immediate: true })
</script>

<style scoped>
.wikipedia-panel {
  padding: 0;
}

.cursor-pointer {
  cursor: pointer;
}

.chevron {
  transition: transform 0.2s;
}

.chevron.expanded {
  transform: scaleY(-1);
}

.leading-normal {
  line-height: 1.75;
}

@media (min-width: 992px) {
  .wikipedia-summary {
    column-count: 2;
    column-gap: 3rem;
  }
}
</style>
