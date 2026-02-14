<template>
  <div class="top20-container">
    <div v-if="!dbLoaded" class="empty-hint">请点击右上角设置图标选择日志目录</div>
    <template v-else-if="top20Result">
      <!-- 接收方呼号 TOP20 -->
      <div class="top20-card">
        <h3>接收方呼号 TOP20</h3>
        <div class="top20-list">
          <div
            v-for="(item, index) in top20Result.toCallsign"
            :key="'callsign-' + index"
            class="top20-item"
          >
            <span class="rank">{{ index + 1 }}</span>
            <span class="name">{{ item.toCallsign || '-' }}</span>
            <span class="count"
              ><strong>{{ item.count }}</strong></span
            >
          </div>
          <div v-if="top20Result.toCallsign.length === 0" class="empty-item">暂无数据</div>
        </div>
      </div>

      <!-- 接收网格 TOP20 -->
      <div class="top20-card">
        <h3>接收网格 TOP20</h3>
        <div class="top20-list">
          <div
            v-for="(item, index) in top20Result.toGrid"
            :key="'grid-' + index"
            class="top20-item"
          >
            <span class="rank">{{ index + 1 }}</span>
            <span class="name">{{ item.toGrid || '-' }}</span>
            <span class="count"
              ><strong>{{ item.count }}</strong></span
            >
          </div>
          <div v-if="top20Result.toGrid.length === 0" class="empty-item">暂无数据</div>
        </div>
      </div>

      <!-- 中继名称 TOP20 -->
      <div class="top20-card">
        <h3>
          中继名称 TOP20
          <span
            class="info-icon"
            @mouseenter="handleMouseEnter"
            @mouseleave="handleMouseLeave"
            @click="toggleTooltip"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <div
              v-if="showTooltip"
              :class="tooltipClass"
              :style="tooltipStyle"
              @mouseenter="handleTooltipMouseEnter"
              @mouseleave="handleTooltipMouseLeave"
            >
              中继排名是根据导出的数据库信息进行排序的，存在被后续通联覆盖的情况。仅作娱乐性排名展示使用。
            </div>
          </span>
        </h3>
        <div class="top20-list">
          <div
            v-for="(item, index) in top20Result.relayName"
            :key="'relay-' + index"
            class="top20-item"
          >
            <span class="rank">{{ index + 1 }}</span>
            <span class="name"
              >{{ item.relayName || '-'
              }}<span class="relay-admin">（{{ item.relayAdmin }}）</span></span
            >
            <span class="count"
              ><strong>{{ item.count }}</strong></span
            >
          </div>
          <div v-if="top20Result.relayName.length === 0" class="empty-item">暂无数据</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

defineProps({
  top20Result: {
    type: Object,
    default: null
  },
  dbLoaded: {
    type: Boolean,
    default: false
  }
})

const showTooltip = ref(false)
const tooltipStyle = ref({})
let isMouseOverTooltip = false

const tooltipClass = computed(() => {
  if (tooltipStyle.value.top && tooltipStyle.value.top !== 'auto') {
    return 'tooltip tooltip-bottom'
  } else {
    return 'tooltip'
  }
})

function toggleTooltip(event) {
  showTooltip.value = !showTooltip.value
  if (showTooltip.value) {
    setTimeout(() => {
      adjustTooltipPosition(event)
    }, 0)
  }
}

function adjustTooltipPosition(event) {
  if (!showTooltip.value) return

  setTimeout(() => {
    const iconEl = event?.target?.closest('.info-icon') || event?.target

    if (iconEl) {
      const iconRect = iconEl.getBoundingClientRect()
      const iconCenterX = iconRect.left + iconRect.width / 2

      if (iconRect.top < 40) {
        tooltipStyle.value = {
          left: `${iconCenterX}px`,
          top: `${iconRect.bottom + 8}px`,
          bottom: 'auto'
        }
      } else {
        tooltipStyle.value = {
          left: `${iconCenterX}px`,
          bottom: `${window.innerHeight - iconRect.top + 8}px`,
          top: 'auto'
        }
      }
    }
  }, 10)
}

function handleMouseEnter(event) {
  showTooltip.value = true
  adjustTooltipPosition(event)
}

function handleMouseLeave() {
  setTimeout(() => {
    if (!isMouseOverTooltip) {
      showTooltip.value = false
    }
  }, 300)
}

function handleTooltipMouseEnter() {
  isMouseOverTooltip = true
}

function handleTooltipMouseLeave() {
  isMouseOverTooltip = false
  showTooltip.value = false
}
</script>

<style scoped>
.top20-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  flex: 1;
  overflow: auto;
  margin-top: 1rem;
}

.empty-hint {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text-tertiary);
  padding: 3rem;
}

.top20-card {
  background: var(--bg-card);
  border: 1px solid var(--border-secondary);
  border-radius: 8px;
  overflow: visible;
  display: flex;
  flex-direction: column;
  max-height: 100%;
}

.top20-card h3 {
  margin: 0;
  padding: 0.75rem 1rem;
  background: var(--bg-table-header);
  font-size: 0.95rem;
  border-bottom: 1px solid var(--border-secondary);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  overflow: visible;
}

.info-icon {
  position: relative;
  display: inline-block;
  cursor: pointer;
  margin-left: 0.5rem;
}

.info-icon svg {
  color: var(--text-tertiary);
  transition: color 0.2s ease;
}

.info-icon:hover svg {
  color: var(--color-primary);
}

.tooltip {
  position: fixed;
  top: auto;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--tooltip-bg);
  color: var(--text-white);
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.8rem;
  white-space: normal;
  z-index: 9999;
  width: max-content;
  max-width: 350px;
  min-width: 200px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  word-wrap: break-word;
  word-break: break-word;
}

.tooltip-bottom {
  top: calc(100% + 8px);
  bottom: auto;
  white-space: normal;
  word-wrap: break-word;
  word-break: break-word;
}

.tooltip-bottom::before {
  top: -12px;
  border-color: transparent transparent var(--tooltip-bg) transparent;
}

.tooltip::before {
  content: '';
  position: fixed;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 6px;
  border-style: solid;
  border-color: var(--tooltip-bg) transparent transparent transparent;
}

.top20-list {
  padding: 0.5rem 0;
  overflow-y: auto;
  flex: 1;
}

.top20-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  line-height: 1.6;
}

.top20-item:hover {
  background: var(--bg-table-hover);
}

.top20-item .rank {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-disabled);
  border-radius: 50%;
  font-size: 0.85rem;
  color: var(--text-secondary);
  flex-shrink: 0;
  margin-right: 0.75rem;
}

.top20-item:nth-child(1) .rank {
  background: #ffd700;
  color: var(--text-white);
}

.top20-item:nth-child(2) .rank {
  background: #c0c0c0;
  color: var(--text-white);
}

.top20-item:nth-child(3) .rank {
  background: #cd7f32;
  color: var(--text-white);
}

.top20-item .name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top20-item .relay-admin {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.top20-item .count {
  flex-shrink: 0;
  margin-left: 0.5rem;
  color: var(--color-primary);
}

.empty-item {
  text-align: center;
  color: var(--text-tertiary);
  padding: 2rem;
}

@media (max-width: 1024px) {
  .top20-container {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .top20-container {
    grid-template-columns: 1fr;
    margin-top: 0.5rem;
  }

  .top20-card {
    max-height: 50vh;
  }
}
</style>
