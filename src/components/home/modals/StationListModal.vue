<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal modal-station-list">
      <div class="modal-header">
        <h3>选择信道 <span v-if="showPrimaryBadge" class="title-primary-badge">主</span></h3>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>
      <div ref="modalBodyRef" class="modal-body" @scroll="handleScroll">
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
            <span v-if="showPrimaryBadge && currentStation?.uid === station.uid" class="primary-badge">主</span>
          </button>
        </div>
        <div v-else-if="loading" class="station-loading">加载中...</div>
        <div v-else class="station-empty">暂无服务器</div>

        <!-- 加载状态提示 -->
        <div v-if="stationList.length > 0" class="load-status">
          <template v-if="loading">
            <span class="loading-text">加载中...</span>
          </template>
          <template v-else-if="noMore">
            <span class="no-more-text">没有更多了</span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

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
  noMore: {
    type: Boolean,
    default: false
  },
  showPrimaryBadge: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'select', 'load-more'])

const modalBodyRef = ref(null)

// 弹框显示时自动加载服务器列表
watch(
  () => props.visible,
  (newVisible) => {
    if (newVisible && props.stationList.length === 0 && !props.loading) {
      emit('load-more')
    }
  }
)

// 监听加载状态，加载完成后检查是否需要继续加载
watch(
  () => props.loading,
  (newLoading) => {
    if (!newLoading && props.visible && !props.noMore) {
      // 使用 nextTick 确保 DOM 已更新
      setTimeout(() => {
        checkAndLoadMore()
      }, 0)
    }
  }
)

function handleSelect(uid) {
  emit('select', uid)
  emit('close')
}

function handleScroll() {
  if (!modalBodyRef.value || props.loading || props.noMore) return

  const { scrollTop, scrollHeight, clientHeight } = modalBodyRef.value
  // 距离底部 50px 时触发加载
  if (scrollHeight - scrollTop - clientHeight < 50) {
    emit('load-more')
  }
}

// 检查内容是否填满容器，如未填满则继续加载
function checkAndLoadMore() {
  if (!modalBodyRef.value || props.noMore || props.loading) return

  const { scrollHeight, clientHeight } = modalBodyRef.value
  // 如果内容高度小于等于容器高度，说明没有滚动条，继续加载
  if (scrollHeight <= clientHeight) {
    emit('load-more')
  }
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
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.title-primary-badge {
  background: #4a9eff;
  color: #fff;
  font-size: 0.7rem;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  font-weight: 600;
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
  border-color: var(--color-primary);
}

.station-item.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.primary-badge {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
  font-size: 0.7rem;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  font-weight: 600;
  margin-left: 0.25rem;
  vertical-align: middle;
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

.load-status {
  margin-top: 1rem;
  text-align: center;
  padding: 0.5rem;
}

.loading-text,
.no-more-text {
  font-size: 0.9rem;
  color: var(--text-tertiary);
}

.loading-text::after {
  content: '';
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-left: 8px;
  border: 2px solid var(--border-secondary);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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
