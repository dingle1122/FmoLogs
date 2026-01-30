<template>
  <div
    v-if="fmoAddress && (eventsConnected || speakingHistory.length > 0)"
    class="speaking-bar"
    @click="$emit('click')"
  >
    <div class="speaking-bar-content">
      <span v-if="currentSpeaker" class="speaking-indicator speaking"></span>
      <span v-else class="speaking-indicator idle"></span>
      <span class="speaking-text">
        <template v-if="currentSpeaker">
          正在发言: <strong>{{ currentSpeaker }}</strong>
        </template>
        <template v-else> 当前无人发言 </template>
      </span>
      <span class="speaking-expand">点击展开</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  currentSpeaker: {
    type: String,
    default: ''
  },
  speakingHistory: {
    type: Array,
    default: () => []
  },
  fmoAddress: {
    type: String,
    default: ''
  },
  eventsConnected: {
    type: Boolean,
    default: false
  }
})

defineEmits(['click'])
</script>

<style scoped>
.speaking-bar {
  flex-shrink: 0;
  background: var(--bg-speaking-bar);
  border-bottom: 2px solid var(--border-speaking-bar);
  padding: 1rem 1.5rem;
  cursor: pointer;
  transition: background 0.2s;
}

.speaking-bar:hover {
  background: var(--bg-today-card);
}

.speaking-bar-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 2rem;
}

.speaking-indicator {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
}

.speaking-indicator.speaking {
  background: var(--color-speaking);
  animation: pulse 1.5s infinite;
}

.speaking-indicator.idle {
  background: var(--text-disabled);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}

.speaking-text {
  flex: 1;
  font-size: 1.3rem;
  color: var(--text-primary);
  line-height: 1.5rem;
}

.speaking-text strong {
  color: var(--color-speaking);
  font-weight: 700;
  font-size: 1.3rem;
}

.speaking-expand {
  font-size: 1rem;
  color: var(--text-tertiary);
}

@media (max-width: 768px) {
  .speaking-bar {
    padding: 0.75rem 1rem;
  }

  .speaking-text {
    font-size: 1.1rem;
  }

  .speaking-text strong {
    font-size: 1.3rem;
  }

  .speaking-expand {
    font-size: 0.9rem;
  }
}

@media (max-width: 480px) {
  .speaking-bar-content {
    gap: 0.6rem;
  }

  .speaking-indicator {
    width: 14px;
    height: 14px;
  }

  .speaking-text {
    font-size: 1rem;
  }

  .speaking-text strong {
    font-size: 1.2rem;
  }

  .speaking-expand {
    font-size: 0.85rem;
  }
}
</style>
