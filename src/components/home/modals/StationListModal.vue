<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal modal-station-list">
      <div class="modal-header">
        <div class="search-area">
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="查询信道"
            @keydown.enter.prevent
          />
          <label class="pin-filter" @click.prevent="showPinnedOnly = !showPinnedOnly">
            <span>仅收藏</span>
            <span class="toggle-switch" :class="{ active: showPinnedOnly }">
              <span class="toggle-slider"></span>
            </span>
          </label>
        </div>
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
      <div ref="modalBodyRef" class="modal-body">
        <div v-if="filteredStationList.length > 0" class="station-grid">
          <button
            v-for="station in filteredStationList"
            :key="station.uid"
            class="station-item"
            :class="{ active: currentStation?.uid === station.uid }"
            :disabled="loading"
            :title="station.name"
            @click="handleSelect(station.uid)"
          >
            <span v-if="station.isPinned" class="pin-badge">收藏</span>
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
import { ref, computed, watch, nextTick } from 'vue'

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

const searchQuery = ref('')
const showPinnedOnly = ref(false)
const modalBodyRef = ref(null)

// 弹框关闭后重置开关状态，打开时滚动到当前选中项
watch(
  () => props.visible,
  async (val) => {
    if (!val) {
      showPinnedOnly.value = false
      searchQuery.value = ''
      return
    }
    await nextTick()
    scrollToActiveStation()
  }
)

function scrollToActiveStation() {
  const container = modalBodyRef.value
  if (!container) return
  const activeItem = container.querySelector('.station-item.active')
  if (activeItem) {
    const containerRect = container.getBoundingClientRect()
    const itemRect = activeItem.getBoundingClientRect()
    container.scrollTop =
      container.scrollTop +
      itemRect.top -
      containerRect.top -
      containerRect.height / 2 +
      itemRect.height / 2
  } else {
    container.scrollTop = 0
  }
}

const filteredStationList = computed(() => {
  let list = props.stationList

  // 仅显示收藏
  if (showPinnedOnly.value) {
    list = list.filter((station) => station.isPinned)
  }

  const query = searchQuery.value.trim()
  if (!query) {
    return list
  }

  // #开头的按uid精确查询
  if (query.startsWith('#')) {
    const uid = query.slice(1).trim()
    if (!uid) {
      return list
    }
    return list.filter((station) => String(station.uid) === uid)
  }

  // 按名称模糊查询
  return list.filter((station) => station.name?.toLowerCase().includes(query.toLowerCase()))
})

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
  height: 70vh;
  min-height: 320px;
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

.search-input {
  width: 180px;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--border-secondary);
  border-radius: 4px;
  background: var(--bg-input, var(--bg-page));
  color: var(--text-primary);
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.search-input:focus {
  border-color: var(--color-success);
}

.search-area {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.pin-filter {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}

.toggle-switch {
  position: relative;
  width: 32px;
  height: 18px;
  background: var(--border-secondary, #ccc);
  border-radius: 9px;
  transition: background 0.2s;
  flex-shrink: 0;
}

.toggle-switch.active {
  background: var(--color-success, #67c23a);
}

.toggle-slider {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

.toggle-switch.active .toggle-slider {
  transform: translateX(14px);
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
  position: relative;
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

.pin-badge {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--color-warning, #e6a23c);
  line-height: 1;
  pointer-events: none;
  background: rgba(230, 162, 60, 0.22);
  border-radius: 3px;
  padding: 3px;
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

.station-item.active .pin-badge {
  color: white;
  background: rgba(255, 255, 255, 0.35);
  font-weight: 300;
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
