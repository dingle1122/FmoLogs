<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal modal-speaking-history">
      <div class="modal-header">
        <h3>30分钟内发言记录</h3>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>
      <div class="modal-body">
        <div v-if="history.length > 0" class="speaking-history-list">
          <div
            v-for="(record, index) in history"
            :key="index"
            class="speaking-history-item"
            :class="{ 'is-speaking': !record.endTime }"
            @click="$emit('show-callsign-records', record.callsign)"
          >
            <span class="history-indicator" :class="{ speaking: !record.endTime }"></span>
            <span class="history-callsign">
              {{ record.callsign }}
              <span v-if="todayContactedCallsigns.has(record.callsign)" class="today-star"
                >&#11088;</span
              >
            </span>
            <span class="history-time">
              <template v-if="!record.endTime">正在发言</template>
              <template v-else>{{ formatTimeAgo(record.endTime) }}</template>
            </span>
          </div>
        </div>
        <div v-else class="speaking-history-empty">
          <div class="empty-divider"></div>
          <div class="empty-text">暂无30分钟内的发言记录</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatTimeAgo } from '../constants'

defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  history: {
    type: Array,
    default: () => []
  },
  todayContactedCallsigns: {
    type: Set,
    default: () => new Set()
  }
})

defineEmits(['close', 'show-callsign-records'])
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-card);
  border-radius: 8px;
  box-shadow: 0 4px 20px var(--shadow-modal);
}

.modal-speaking-history {
  width: 400px;
  max-width: 90%;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
}

.modal-header h3 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-tertiary);
  line-height: 1;
}

.close-btn:hover {
  color: var(--text-secondary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  height: auto;
}

.speaking-history-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.speaking-history-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  background: var(--bg-card);
  border: 1px solid var(--border-secondary);
  border-radius: 6px;
  transition: background 0.2s;
  cursor: pointer;
}

.speaking-history-item:hover {
  background: var(--bg-table-hover);
}

.speaking-history-item.is-speaking {
  background: var(--bg-speaking-bar);
  border-color: var(--border-speaking-bar);
}

.history-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-disabled);
  flex-shrink: 0;
}

.history-indicator.speaking {
  background: var(--color-speaking);
  animation: pulse 1.5s infinite;
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

.history-callsign {
  flex: 1;
  font-weight: 700;
  font-size: 1.3rem;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.today-star {
  font-size: 1rem;
  line-height: 1.3rem;
  display: inline-flex;
  align-items: center;
}

.speaking-history-item.is-speaking .history-callsign {
  font-weight: 700;
  color: var(--color-speaking);
}

.history-time {
  font-size: 0.9rem;
  color: var(--text-tertiary);
}

.speaking-history-item.is-speaking .history-time {
  color: var(--color-speaking);
}

.speaking-history-empty {
  text-align: center;
  padding: 2rem 1rem;
}

.empty-divider {
  border-top: 1px dashed var(--border-secondary);
  margin-bottom: 1rem;
}

.empty-text {
  color: var(--text-tertiary);
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .modal-speaking-history {
    width: 95%;
  }
}

@media (max-width: 480px) {
  .speaking-history-item {
    padding: 0.5rem;
    gap: 0.5rem;
  }

  .history-callsign {
    font-size: 0.9rem;
  }

  .history-time {
    font-size: 0.8rem;
  }
}
</style>
