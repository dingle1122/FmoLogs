<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal modal-station-list">
      <div class="modal-header">
        <h3>选择信道 <span v-if="showPrimaryBadge" class="title-primary-badge">主</span></h3>
        <div class="header-actions">
          <button
            class="refresh-btn"
            :disabled="loading"
            title="刷新列表"
            @click="$emit('refresh')"
          >
            {{ loading ? '刷新中...' : '刷新' }}
          </button>
          <button class="close-btn" @click="$emit('close')">&times;</button>
        </div>
      </div>
      <div class="modal-body">
        <div v-if="stationList.length > 0" class="station-grid">
          <button
            v-for="station in stationList"
            :key="station.uid"
            class="station-item"
            :class="{ active: currentStation?.uid === station.uid }"
            :disabled="loading"
            :title="station.name"
            @click="handleSelect(station.uid)"
          >
            {{ station.name }}
            <span
              v-if="showPrimaryBadge && currentStation?.uid === station.uid"
              class="primary-badge"
              >主</span
            >
          </button>
        </div>
        <div v-else-if="loading" class="station-loading">加载中...</div>
        <div v-else class="station-empty">暂无服务器</div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
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
  showPrimaryBadge: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'select', 'refresh'])

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
  width: 550px;
  max-width: 90%;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1rem;
  border-bottom: 1px solid var(--border-light);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

/* 主服务器标签样式 - 与 user-uid 同款绿色 */
.title-primary-badge {
  background: rgba(103, 194, 58, 0.15);
  color: var(--color-success);
  font-size: 0.7rem;
  padding: 0.1rem 0.1rem;
  border-radius: 2px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1rem;
  min-height: 1rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.refresh-btn {
  background: none;
  border: none;
  font-size: 0.9rem;
  cursor: pointer;
  color: var(--text-primary);
  line-height: 1;
  padding: 0.25rem 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  color: var(--color-success);
}

.refresh-btn:disabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.station-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.station-item {
  padding: 0.8rem 1.2rem;
  border: 2px solid rgba(150, 150, 150, 0.3);
  background: var(--bg-card);
  border-radius: 6px;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.2s;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.station-item:hover:not(:disabled) {
  background: var(--bg-table-hover);
  color: var(--text-primary);
  border-color: var(--color-success);
}

.station-item.active {
  background: var(--color-success);
  border-color: var(--color-success);
  color: white;
}

/* 信道按钮内的主标签样式 - 与 user-uid 同款绿色 */
.primary-badge {
  background: rgba(103, 194, 58, 0.25);
  color: #67c23a;
  font-size: 0.7rem;
  padding: 0.1rem 0.1rem;
  border-radius: 2px;
  font-weight: 700;
  margin-left: 0.25rem;
  vertical-align: middle;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1rem;
  min-height: 1rem;
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

@media (max-width: 600px) {
  .modal-station-list {
    width: 95%;
  }

  .station-item {
    padding: 0.7rem 0.5rem;
    font-size: 0.95rem;
  }
}
</style>
