<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal modal-station-list">
      <div class="modal-header">
        <h3>选择服务器</h3>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>
      <div class="modal-body">
        <div v-if="stationList.length > 0" class="station-grid">
          <button
            v-for="station in stationList"
            :key="station.uid"
            class="station-item"
            :class="{ active: currentStation?.uid === station.uid }"
            :disabled="loading"
            @click="handleSelect(station.uid)"
          >
            {{ station.name }}
          </button>
        </div>
        <div v-else-if="loading" class="station-loading">加载中...</div>
        <div v-else class="station-empty">暂无服务器</div>

        <!-- 加载更多 -->
        <div v-if="stationList.length > 0" class="load-more-section">
          <button class="load-more-btn" :disabled="loading || noMore" @click="$emit('load-more')">
            <template v-if="loading">加载中...</template>
            <template v-else-if="noMore">没有更多了</template>
            <template v-else>加载更多</template>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  stationList: {
    type: Array,
    default: () => []
  },
  currentStation: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  noMore: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'select', 'load-more'])

function handleSelect(uid) {
  emit('select', uid)
  emit('close')
}
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
  z-index: 1100;
}

.modal {
  background: var(--bg-card);
  border-radius: 8px;
  box-shadow: 0 4px 20px var(--shadow-modal);
}

.modal-station-list {
  width: 450px;
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
  font-size: 1.1rem;
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
}

.station-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.station-item {
  padding: 0.7rem 1.2rem;
  border: 1px solid var(--border-secondary);
  background: var(--bg-card);
  border-radius: 6px;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.station-item:hover:not(:disabled) {
  background: var(--bg-table-hover);
  color: var(--text-primary);
}

.station-item.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.station-item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.station-loading,
.station-empty {
  text-align: center;
  padding: 2rem;
  color: var(--text-tertiary);
}

.load-more-section {
  margin-top: 1rem;
  text-align: center;
}

.load-more-btn {
  padding: 0.6rem 2rem;
  border: 1px solid var(--border-secondary);
  background: var(--bg-card);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.load-more-btn:hover:not(:disabled) {
  background: var(--bg-table-hover);
  color: var(--text-primary);
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .modal-station-list {
    width: 95%;
  }

  .station-item {
    padding: 0.6rem 1rem;
    font-size: 1rem;
  }
}
</style>
