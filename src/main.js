import { createApp } from 'vue'
import App from './App.vue'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'
import { createI18n } from 'vue-i18n'
import 'victormono'
import './styles/main.scss'
import en from './locales/en.json'
import no from './locales/no.json'
import de from './locales/de.json'
import fr from './locales/fr.json'
import it from './locales/it.json'
import es from './locales/es.json'
import da from './locales/da.json'
import sv from './locales/sv.json'
import fi from './locales/fi.json'

const urlParams = new URLSearchParams(window.location.search)
const langParam = urlParams.get('lang')
const savedLocale = langParam || localStorage.getItem('midivoci:locale') || 'en'

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: { en, no, de, fr, it, es, da, sv, fi },
})

const app = createApp(App)

const MyPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{sky.50}',
      100: '{sky.100}',
      200: '{sky.200}',
      300: '{sky.300}',
      400: '{sky.400}',
      500: '{sky.500}',
      600: '{sky.600}',
      700: '{sky.700}',
      800: '{sky.800}',
      900: '{sky.900}',
      950: '{sky.950}',
    },
  },
})

app.use(PrimeVue, {
  theme: {
    preset: MyPreset,
    options: {
      darkModeSelector: '[data-theme="dark"]',
    },
  },
})

app.use(i18n)
app.directive('tooltip', Tooltip)
app.mount('#app')

if (window.__TAURI__) {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]')
    if (!link || !link.href) return
    if (link.href.startsWith('file://') || link.href.startsWith('blob:')) return
    e.preventDefault()
    window.__TAURI__.opener.openUrl(link.href)
  })
}
