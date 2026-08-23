<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal modal-station-list">
      <div class="modal-header">
        <div class="search-area">
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="查询/导入信道"
            @keydown.enter.prevent
          />
          <div class="station-summary" aria-live="polite">
            <div class="summary-main">
              <div class="summary-item">
                <span class="summary-value">{{ stationCount }}</span>
                <span>个信道</span>
              </div>
              <span class="summary-separator" aria-hidden="true">·</span>
              <div class="summary-item summary-item-pinned">
                <span class="summary-value">{{ pinnedCount }}</span>
                <span>个收藏</span>
              </div>
            </div>
            <div v-if="hasSearchQuery" class="summary-item summary-item-match">
              <span>匹配</span>
              <span class="summary-value">{{ displayStationList.length }}</span>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <button
            class="refresh-btn"
            :disabled="loading || importing"
            title="刷新列表"
            @click="$emit('refresh')"
          >
            {{ loading ? '刷新中...' : '刷新' }}
          </button>
          <button class="close-btn" @click="$emit('close')">&times;</button>
        </div>
      </div>
      <div ref="modalBodyRef" class="modal-body">
        <div v-if="displayStationList.length > 0" class="station-grid">
          <button
            v-for="station in displayStationList"
            :key="station.parsedPacket ? `packet-${station.uid}` : station.uid"
            class="station-item"
            :class="{
              active: currentStation && String(currentStation.uid) === String(station.uid)
            }"
            :disabled="loading || importing"
            :title="station.name"
            @click="handleStationClick(station)"
          >
            <span v-if="station.isPinned" class="pin-badge">收藏</span>
            <span
              v-if="station.parsedPacket"
              class="import-badge"
              :class="{ imported: station.imported }"
            >
              {{ station.imported ? '已导入' : '未导入' }}
            </span>
            {{ station.name }}
            <span
              v-if="
                showPrimaryBadge &&
                currentStation &&
                String(currentStation.uid) === String(station.uid)
              "
              class="primary-badge"
              >主</span
            >
          </button>
        </div>
        <div v-else-if="loading" class="station-loading">加载中...</div>
        <div v-else-if="remoteQueryLoading" class="station-loading">正在查询...</div>
        <div v-else class="station-empty">暂无服务器</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { parseFmoStationPacket } from '../../../utils/fmoStationPacket'
import {
  getFmoMapDeviceQueryPath,
  isFmoMapQueryAbort,
  queryFmoMapStationPackets
} from '../../../services/fmoMapApi'

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
  },
  importing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'select', 'refresh', 'import-station'])

const searchQuery = ref('')
const modalBodyRef = ref(null)
const remotePackets = ref([])
const remoteQueryLoading = ref(false)
let remoteQueryTimer = null
let remoteQueryController = null

const stationCount = computed(() => props.stationList.length)
const pinnedCount = computed(() => props.stationList.filter((station) => station.isPinned).length)
const hasSearchQuery = computed(() => searchQuery.value.trim().length > 0)
const parsedStation = computed(() => parseFmoStationPacket(searchQuery.value))
const parsedStationImported = computed(
  () =>
    parsedStation.value &&
    props.stationList.some((station) => String(station.uid) === String(parsedStation.value.uid))
)
const remoteStations = computed(() => {
  const stationsByUid = new Map()
  for (const rawPacket of remotePackets.value) {
    const station = parseFmoStationPacket(rawPacket)
    if (station) stationsByUid.set(String(station.uid), station)
  }
  return [...stationsByUid.values()]
})
const displayStationList = computed(() => {
  const list = [...filteredStationList.value]
  const localByUid = new Map(props.stationList.map((station) => [String(station.uid), station]))
  const displayedUids = new Set(list.map((station) => String(station.uid)))

  if (parsedStation.value) {
    const station = localByUid.get(String(parsedStation.value.uid)) || {
      ...parsedStation.value,
      parsedPacket: true,
      imported: parsedStationImported.value
    }
    if (!displayedUids.has(String(station.uid))) list.push(station)
    displayedUids.add(String(station.uid))
  }

  for (const remoteStation of remoteStations.value) {
    const station = localByUid.get(String(remoteStation.uid)) || {
      ...remoteStation,
      parsedPacket: true,
      imported: false
    }
    if (!displayedUids.has(String(station.uid))) list.push(station)
    displayedUids.add(String(station.uid))
  }
  return list
})

// 弹框关闭后重置开关状态，打开时滚动到当前选中项
watch(
  () => props.visible,
  async (val) => {
    if (!val) {
      searchQuery.value = ''
      clearRemoteQuery()
      return
    }
    await nextTick()
    scrollToActiveStation()
  }
)

watch(searchQuery, () => scheduleRemoteQuery())

function clearRemoteQuery() {
  clearTimeout(remoteQueryTimer)
  remoteQueryTimer = null
  remoteQueryController?.abort()
  remoteQueryController = null
  remotePackets.value = []
  remoteQueryLoading.value = false
}

function scheduleRemoteQuery() {
  clearRemoteQuery()
  const query = searchQuery.value.trim()
  // 粘贴的 APRS 报文完全由本地解析，不再重复请求在线接口。
  if (parseFmoStationPacket(query) || !getFmoMapDeviceQueryPath(query)) return

  remoteQueryLoading.value = true
  remoteQueryTimer = setTimeout(async () => {
    const controller = new AbortController()
    remoteQueryController = controller
    try {
      const packets = await queryFmoMapStationPackets(query, { signal: controller.signal })
      if (searchQuery.value.trim() !== query || controller.signal.aborted) return
      remotePackets.value = packets.filter((packet) => parseFmoStationPacket(packet))
    } catch (error) {
      if (searchQuery.value.trim() !== query || controller.signal.aborted) return
      if (!isFmoMapQueryAbort(error)) console.warn('在线信道查询失败:', error)
    } finally {
      if (remoteQueryController === controller) {
        remoteQueryController = null
        remoteQueryLoading.value = false
      }
    }
  }, 400)
}

onUnmounted(clearRemoteQuery)

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

  // 收藏的服务器前置，其他保持原有顺序
  list = [...list].sort((a, b) => {
    if (a.isPinned === b.isPinned) return 0
    return a.isPinned ? -1 : 1
  })

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

function handleStationClick(station) {
  if (!station.parsedPacket || station.imported) {
    handleSelect(station.uid)
    return
  }
  emit('import-station', station)
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
  height: calc(var(--vh, 1vh) * 70);
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

.station-summary {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--text-tertiary);
  font-size: 0.78rem;
  white-space: nowrap;
}

.summary-main {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.summary-item {
  display: inline-flex;
  align-items: baseline;
  gap: 0.2rem;
  white-space: nowrap;
}

.summary-value {
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.summary-separator {
  color: var(--text-disabled);
}

.summary-item-pinned .summary-value {
  color: var(--color-warning);
}

.summary-item-match {
  padding-left: 0.65rem;
  border-left: 1px solid var(--border-light);
  line-height: 1;
}

.summary-item-match .summary-value {
  font-size: inherit;
  color: var(--text-secondary);
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
  border-color: var(--component-station-search-focus-border);
}

.search-area {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* 主服务器标签样式 - 与 user-uid 同款绿色 */
.title-primary-badge {
  background: var(--component-station-primary-badge-bg);
  color: var(--component-station-primary-badge-text);
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

@media (hover: hover) {
  .refresh-btn:hover:not(:disabled) {
    color: var(--component-station-refresh-hover-text);
  }
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
  border: 2px solid var(--alpha-neutral-30);
  background: var(--bg-card);
  border-radius: 6px;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 400;
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
  color: var(--color-warning);
  line-height: 1;
  pointer-events: none;
  background: var(--alpha-warning-22);
  border-radius: 3px;
  padding: 3px;
}

@media (hover: hover) {
  .station-item:hover:not(:disabled) {
    background: var(--bg-table-hover);
    border-color: var(--component-station-item-hover-border);
  }
}

.station-item.active {
  background: var(--component-station-item-active-bg);
  border-color: var(--component-station-item-active-border);
  color: var(--component-station-item-active-text);
}

.station-item.active .pin-badge {
  color: var(--component-station-item-active-pin-text);
  background: var(--component-station-item-active-pin-bg);
}

/* 信道按钮内的主标签样式 - 与 user-uid 同款绿色 */
.primary-badge {
  background: var(--component-station-primary-badge-bg);
  color: var(--component-station-primary-badge-text);
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

.import-badge {
  position: absolute;
  top: 3px;
  right: 4px;
  padding: 3px;
  border-radius: 3px;
  background: var(--alpha-warning-22);
  color: var(--color-warning);
  font-size: 0.75rem;
  line-height: 1;
}
.import-badge.imported {
  background: var(--component-station-primary-badge-bg);
  color: var(--component-station-primary-badge-text);
}

@media (max-width: 600px) {
  .modal-station-list {
    width: 95%;
  }

  .modal-header {
    position: relative;
    padding-bottom: 2.1rem;
  }

  .station-summary {
    position: absolute;
    left: 1rem;
    bottom: 0.55rem;
    right: 1rem;
  }

  .summary-item-match {
    margin-left: auto;
  }

  .station-item {
    padding: 0.7rem 0.5rem;
    font-size: 0.95rem;
  }
}
</style>
