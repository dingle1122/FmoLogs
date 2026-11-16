<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal modal-speaking-history">
      <div class="modal-header">
        <StationControl
          :connected="stationConnected"
          :current-station="currentStation"
          :is-busy="stationBusy"
          :show-primary-badge="multiSelectMode"
          @prev="$emit('station-prev')"
          @next="$emit('station-next')"
          @refresh="$emit('station-refresh')"
          @open-list="$emit('station-open-list')"
        />
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>
      <div class="modal-body">
        <!-- 发言历史列表 -->
        <div v-if="displayHistory.length > 0" class="speaking-history-list">
          <div
            v-for="(record, index) in displayHistory"
            :key="index"
            class="speaking-history-item"
            :class="{
              'is-speaking': !record.endTime,
              'is-self': record.callsign === selectedFromCallsign
            }"
            @click="
              record.callsign !== selectedFromCallsign &&
              $emit('show-callsign-records', record.callsign)
            "
          >
            <div class="history-main">
              <div class="history-callsign-area">
                <span class="history-indicator" :class="{ speaking: !record.endTime }"></span>
                <span class="history-callsign" :title="record.callsign">{{ record.callsign }}</span>
              </div>
              <div class="history-time">
                <div class="speaking-time">
                  <template v-if="!record.endTime">正在发言</template>
                  <template v-else>{{ formatTimeAgo(record.endTime) }}</template>
                </div>
                <div class="duration-time">
                  {{ formatDurationMmSs((record.endTime || now) - record.startTime) }}
                </div>
                <div class="callsign-badge">
                  <span v-if="record.callsign === selectedFromCallsign" class="self-tag">您</span>
                  <template v-else>
                    <img
                      class="today-star-icon"
                      :src="
                        todayContactedCallsigns.has(record.callsign)
                          ? '/img/star_2b50.webp'
                          : '/img/star_2b50_unactivated.webp'
                      "
                      :alt="
                        todayContactedCallsigns.has(record.callsign) ? '今日已通联' : '今日未通联'
                      "
                    />
                    <span class="contact-count"
                      >x{{ contactCounts.get(record.callsign) || 0 }}</span
                    >
                  </template>
                </div>
              </div>
              <div class="history-address-row">
                <span v-if="multiSelectMode && record.addressId" class="server-tag">{{
                  getServerName(record.addressId)
                }}</span>
                <span v-if="record.serverUid" class="history-server-tag">{{
                  formatServerInfo(record.serverUid, record.serverName)
                }}</span>
                <span v-if="record.grid" class="history-grid-tag">{{ record.grid }}</span>
                <span v-if="gridAddressMap[record.grid]" class="history-address-text">{{
                  gridAddressMap[record.grid]
                }}</span>
              </div>
            </div>
          </div>
          <div class="speaking-history-end">没有更多了</div>
        </div>
        <div v-else class="speaking-history-empty">暂无1小时内的发言记录</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch, reactive } from 'vue'
import { formatTimeAgo, formatDurationMmSs } from '../constants'
import { gridToAddress } from '../../../services/gridService'
import StationControl from '../StationControl.vue'

const now = ref(Date.now())
let nowTimer = null

// grid -> 格式化地址的缓存映射
const gridAddressMap = reactive({})

// 格式化地址数据（精确到区，使用 - 分隔）
function formatAddress(data) {
  if (!data) return ''
  const province = data.province || ''
  const city = data.city || ''
  const district = data.district || ''

  const parts = []
  if (province) parts.push(province)
  if (city && city !== province) parts.push(city)
  if (district) parts.push(district)

  const full = parts.join('-')
  return full
}

// 异步加载历史记录中 grid 对应的地址（实时请求，不走缓存）
async function loadGridAddresses(records) {
  const grids = new Set()
  for (const record of records) {
    if (record.grid) {
      grids.add(record.grid)
    }
  }
  for (const grid of grids) {
    try {
      const result = await gridToAddress(grid)
      const formatted = formatAddress(result)
      gridAddressMap[grid] = formatted
    } catch (err) {
      console.warn(`[SpeakingHistoryModal] grid 转地址失败: ${grid}`, err.message)
      gridAddressMap[grid] = ''
    }
  }
}

onMounted(() => {
  nowTimer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (nowTimer) {
    clearInterval(nowTimer)
    nowTimer = null
  }
})

const props = defineProps({
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
  },
  stationConnected: {
    type: Boolean,
    default: false
  },
  currentStation: {
    type: Object,
    default: null
  },
  stationBusy: {
    type: Boolean,
    default: false
  },
  selectedFromCallsign: {
    type: String,
    default: ''
  },
  allSpeakingHistories: {
    type: Array,
    default: () => []
  },
  allCurrentSpeakers: {
    type: Array,
    default: () => []
  },
  addressList: {
    type: Array,
    default: () => []
  },
  multiSelectMode: {
    type: Boolean,
    default: false
  },
  activeAddressId: {
    type: String,
    default: ''
  },
  contactCounts: {
    type: Map,
    default: () => new Map()
  }
})

// 计算要显示的历史记录（多选模式使用 allSpeakingHistories，单选模式使用 history）
const displayHistory = computed(() => {
  if (props.multiSelectMode && props.allSpeakingHistories?.length > 0) {
    return props.allSpeakingHistories
  }
  return props.history
})

// 监听历史记录变化，自动加载 grid 地址
watch(
  () => displayHistory.value,
  (records) => {
    if (records?.length > 0) {
      loadGridAddresses(records)
    }
  },
  { immediate: true, deep: true }
)

// 根据 addressId 获取服务器显示名称
function getServerName(addressId) {
  // 主服务器显示"主"
  if (addressId === props.activeAddressId) return '主'
  const address = props.addressList.find((a) => a.id === addressId)
  if (!address) return '?'
  // 显示 numId，如果没有则降级显示在列表中的 index+1
  if (address.numId) return address.numId.toString()
  const index = props.addressList.findIndex((a) => a.id === addressId)
  return index !== -1 ? (index + 1).toString() : '?'
}

// 格式化服务器信息：仅显示服务器名称（最多10个字符）
function formatServerInfo(uid, name) {
  const serverName = name || ''
  return serverName.length > 10 ? serverName.slice(0, 10) + '...' : serverName
}

defineEmits([
  'close',
  'show-callsign-records',
  'station-prev',
  'station-next',
  'station-refresh',
  'station-open-list'
])
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
  width: 500px;
  max-width: 90%;
  height: min(600px, calc(var(--vh, 1vh) * 80));
  max-height: calc(var(--vh, 1vh) * 80);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1rem;
  border-bottom: 1px solid var(--border-light);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.2rem;
}

.modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0;
  height: auto;
  border-radius: 0 0 8px 8px;
}

.speaking-history-list {
  display: flex;
  flex-direction: column;
}

.speaking-history-end,
.speaking-history-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 0.8rem 1rem;
  color: var(--text-disabled);
  font-size: 0.7rem;
}

.speaking-history-end::before,
.speaking-history-end::after,
.speaking-history-empty::before,
.speaking-history-empty::after {
  content: '';
  width: 1.5rem;
  height: 1px;
  background: var(--border-secondary);
}

.speaking-history-empty {
  padding-top: 2rem;
}

.speaking-history-item {
  display: flex;
  padding: 0.45rem 1rem 0.25rem;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-secondary);
  transition: background 0.2s;
  cursor: pointer;
}

.speaking-history-item:last-child {
  padding-bottom: 0.6rem;
}

@media (hover: hover) {
  .speaking-history-item:hover {
    background: var(--bg-table-hover);
  }

  .speaking-history-item.is-self:hover {
    background: var(--bg-card);
  }

  .speaking-history-item.is-self.is-speaking:hover {
    background: var(--bg-speaking-bar);
  }
}

.speaking-history-item.is-speaking {
  background: var(--bg-speaking-bar);
  border-color: var(--border-speaking-bar);
}

.history-indicator {
  width: 12px;
  height: 12px;
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

.history-main {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 0.5rem;
  row-gap: 0.1rem;
  min-width: 0;
}

.history-callsign-area {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.history-callsign {
  font-weight: 700;
  font-size: 1.6rem;
  line-height: 1.15;
  color: var(--text-primary);
  min-width: 0;
  overflow: hidden;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.callsign-badge {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 1.1rem;
  gap: 0.2rem;
}

.history-address-row .server-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.2rem;
  border-radius: 2px;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--alpha-neutral-12);
  color: var(--text-primary);
  line-height: 1;
  flex-shrink: 0;
  min-width: 1.2rem;
  min-height: 1.2rem;
}

.today-star-icon {
  display: block;
  width: 1rem;
  height: 1rem;
  object-fit: contain;
}

.contact-count {
  font-size: 0.95rem;
  font-weight: 400;
  color: var(--text-tertiary);
  line-height: 1;
  display: inline-flex;
  align-items: center;
}

.history-server-tag {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--text-primary);
  line-height: 1;
  flex-shrink: 0;
}

.history-grid-tag {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--text-tertiary);
  line-height: 1;
  flex-shrink: 0;
}

.history-address-row {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;
  min-height: 1.2rem;
  padding-left: 1.15rem;
}

.history-address-text {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.self-tag {
  font-size: 0.7em;
  font-weight: 500;
  color: var(--text-tertiary);
  line-height: 1;
}

.speaking-history-item.is-speaking .history-callsign {
  font-weight: 700;
  color: var(--color-speaking);
}

.speaking-history-item.is-speaking .history-address-row .server-tag {
  color: var(--color-speaking);
  background: var(--status-success-bg-soft);
}

.history-time {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 0.2rem;
  line-height: 1.1;
}

.speaking-time {
  font-size: 0.95rem;
  color: var(--text-tertiary);
  font-weight: 400;
  line-height: 1.1;
}

.duration-time {
  font-size: 0.95rem;
  color: var(--text-tertiary);
  font-weight: 400;
  line-height: 1.1;
}

.speaking-history-item.is-speaking .speaking-time,
.speaking-history-item.is-speaking .duration-time {
  color: var(--color-speaking);
}

@media (max-width: 760px) {
  .modal-speaking-history {
    width: 95%;
    height: min(600px, calc(var(--vh, 1vh) * 85));
    max-height: calc(var(--vh, 1vh) * 85);
  }
}

@media (min-width: 481px) and (max-width: 760px) {
  .modal-speaking-history {
    width: min(92vw, 560px);
    max-width: 92vw;
  }

  .modal-header {
    padding: 0.85rem 0.9rem;
  }

  .history-callsign {
    font-size: 1.4rem;
  }

  .history-address-row .server-tag {
    font-size: 0.7rem;
  }

  .contact-count {
    font-size: 0.85rem;
  }

  .speaking-time {
    font-size: 0.85rem;
  }

  .duration-time {
    font-size: 0.85rem;
  }
}

@media (max-width: 480px) {
  .history-indicator {
    width: 10px;
    height: 10px;
  }

  .history-callsign {
    font-size: 1.3rem;
  }

  .history-address-row .server-tag {
    padding: 0.15rem 0.35rem;
    font-size: 0.65rem;
  }

  .contact-count {
    font-size: 0.85rem;
  }

  .speaking-time {
    font-size: 0.85rem;
  }

  .duration-time {
    font-size: 0.85rem;
  }
}
</style>
