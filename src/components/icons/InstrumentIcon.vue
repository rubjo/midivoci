<template>
  <span
    class="instrument-icon"
    :style="{ width: size + 'px', height: size + 'px', display: 'inline-block', lineHeight: 0 }"
    v-html="svgContent"
  />
</template>

<script setup>
import { computed } from 'vue'
import pianoSvg from '../../assets/instrument-icons/piano.svg?raw'
import churchSvg from '../../assets/instrument-icons/church.svg?raw'
import reedSvg from '../../assets/instrument-icons/reed.svg?raw'
import harmonicaSvg from '../../assets/instrument-icons/harmonica.svg?raw'
import guitarSvg from '../../assets/instrument-icons/guitar.svg?raw'
import bassSvg from '../../assets/instrument-icons/bass.svg?raw'
import violinSvg from '../../assets/instrument-icons/violin.svg?raw'
import celloSvg from '../../assets/instrument-icons/cello.svg?raw'
import stringsSvg from '../../assets/instrument-icons/strings.svg?raw'
import choirSvg from '../../assets/instrument-icons/choir.svg?raw'
import fluteSvg from '../../assets/instrument-icons/flute.svg?raw'
import ocarinaSvg from '../../assets/instrument-icons/ocarina.svg?raw'

const props = defineProps({
  size: { type: Number, default: 24 },
  program: { type: Number, required: true },
})

function normalize(raw) {
  return raw
    .replace(/\s+style="[^"]*"/g, '')
    .replace(/\s+fill="#[^"]*"/g, '')
    .replace(/<svg/, `<svg fill="var(--text-primary)" width="${props.size}" height="${props.size}"`)
}

const svgMap = {
  0: pianoSvg,
  19: churchSvg,
  20: reedSvg,
  22: harmonicaSvg,
  24: guitarSvg,
  32: bassSvg,
  40: violinSvg,
  41: violinSvg,
  42: celloSvg,
  43: celloSvg,
  48: stringsSvg,
  49: stringsSvg,
  52: choirSvg,
  53: choirSvg,
  68: fluteSvg,
  73: fluteSvg,
  77: fluteSvg,
  78: fluteSvg,
  79: ocarinaSvg,
}

const svgContent = computed(() => {
  const raw = svgMap[props.program]
  if (!raw) {
    return `<svg width="${props.size}" height="${props.size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="9" cy="16" r="3.5" fill="currentColor"/>
      <rect x="11.5" y="5" width="2.5" height="12" rx="1" fill="currentColor"/>
      <rect x="11.5" y="4" width="9" height="2.5" rx="1" fill="currentColor"/>
    </svg>`
  }
  return normalize(raw)
})
</script>
