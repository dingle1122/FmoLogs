<template>
  <span
    ref="container"
    class="marquee-container"
    :class="{
      'is-overflowing': isOverflowing,
      'is-scrolling': shouldScroll
    }"
    :title="text"
  >
    <span
      ref="track"
      class="marquee-track"
      :class="{ scrolling: shouldScroll }"
      :style="trackStyle"
    >
      <span ref="content" class="marquee-content">{{ text }}</span>
      <span v-if="shouldScroll" class="marquee-content marquee-content-copy" aria-hidden="true">
        {{ text }}
      </span>
    </span>
  </span>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  text: {
    type: String,
    required: true
  },
  // 滚动速度，单位：像素/秒
  speed: {
    type: Number,
    default: 40
  },
  // 两次文本之间的间距，避免循环边界贴得太近
  gap: {
    type: Number,
    default: 24
  }
})

const container = ref(null)
const content = ref(null)
const contentWidth = ref(0)
const isOverflowing = ref(false)
const shouldScroll = ref(false)
const scrollDuration = ref(0)

let resizeObserver = null
let resizeFallbackEnabled = false
let measureFrame = 0

const normalizedGap = computed(() => Math.max(0, Number(props.gap) || 0))
const travelDistance = computed(() => contentWidth.value + normalizedGap.value)

const trackStyle = computed(() => ({
  '--marquee-duration': `${scrollDuration.value}s`,
  '--marquee-distance': `${travelDistance.value}px`,
  '--marquee-gap': `${normalizedGap.value}px`
}))

function scheduleMeasure() {
  if (measureFrame) cancelAnimationFrame(measureFrame)

  measureFrame = requestAnimationFrame(() => {
    measureFrame = 0
    measure()
  })
}

async function measure() {
  await nextTick()

  const containerEl = container.value
  const contentEl = content.value
  if (!containerEl || !contentEl) return

  const containerWidth = containerEl.getBoundingClientRect().width
  const textWidth = contentEl.getBoundingClientRect().width
  const speed = Number(props.speed)
  const canAnimate = Number.isFinite(speed) && speed > 0
  const hasOverflow = containerWidth > 0 && textWidth - containerWidth > 1

  contentWidth.value = textWidth
  isOverflowing.value = hasOverflow
  shouldScroll.value = hasOverflow && canAnimate
  scrollDuration.value = shouldScroll.value ? travelDistance.value / speed : 0
}

onMounted(() => {
  scheduleMeasure()

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(scheduleMeasure)
    if (container.value) resizeObserver.observe(container.value)
    if (content.value) resizeObserver.observe(content.value)
  } else if (typeof window !== 'undefined') {
    window.addEventListener('resize', scheduleMeasure)
    resizeFallbackEnabled = true
  }

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    document.fonts.ready.then(scheduleMeasure).catch(() => {})
  }
})

onBeforeUnmount(() => {
  if (measureFrame) cancelAnimationFrame(measureFrame)
  resizeObserver?.disconnect()

  if (resizeFallbackEnabled) {
    window.removeEventListener('resize', scheduleMeasure)
  }
})

watch(() => [props.text, props.speed, props.gap], scheduleMeasure, { flush: 'post' })
</script>

<style scoped>
.marquee-container {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  vertical-align: top;
}

.marquee-container.is-overflowing {
  justify-content: flex-start;
}

.marquee-track {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  max-width: 100%;
  min-width: 0;
  white-space: nowrap;
}

.marquee-container.is-scrolling .marquee-track {
  max-width: none;
  will-change: transform;
}

.marquee-content {
  display: inline-block;
  flex: 0 0 auto;
  white-space: nowrap;
}

.marquee-content-copy {
  margin-left: var(--marquee-gap);
}

.marquee-track.scrolling {
  animation: marquee-scroll var(--marquee-duration) linear infinite;
}

@keyframes marquee-scroll {
  from {
    transform: translate3d(0, 0, 0);
  }

  to {
    transform: translate3d(calc(var(--marquee-distance) * -1), 0, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .marquee-track.scrolling {
    animation: none;
    transform: translate3d(0, 0, 0);
  }
}
</style>
