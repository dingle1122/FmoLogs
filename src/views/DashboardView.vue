<template>
  <div class="dashboard-view">
    <section class="station-band">
      <div>
        <span class="eyebrow">当前中继</span>
        <h2>{{ currentStation?.name || (loadingStation ? '读取中...' : '未知') }}</h2>
        <p>
          {{ controlProtocol }}://{{ controlHost }}
          <template v-if="currentStation?.uid"> · #{{ currentStation.uid }}</template>
        </p>
      </div>
      <div class="station-actions">
        <button class="refresh-btn" :disabled="refreshing" @click="refreshNow">
          {{ refreshing ? '刷新中...' : '刷新' }}
        </button>
        <span class="refresh-time">{{ lastRefreshText }}</span>
      </div>
    </section>

    <section class="live-panel">
      <div class="panel-header">
        <h3>最近通联</h3>
        <span :class="['live-status', error ? 'error' : '']">
          {{ liveStatusText }}
        </span>
      </div>

      <div v-if="displayRecords.length > 0" class="live-table-wrap">
        <table class="live-table">
          <thead>
            <tr>
              <th>呼号</th>
              <th>时间</th>
              <th>QTH</th>
              <th>留言</th>
              <th>模式</th>
              <th>中继</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="record in displayRecords"
              :key="record.rowId"
              :class="{ 'is-speaking': record.isSpeaking }"
            >
              <td class="callsign-cell">
                <strong>
                  {{ record.toCallsign || '-' }}
                  <span v-if="record.isSpeaking" class="speaking-badge">正在发言</span>
                </strong>
                <span v-if="record.toGrid">{{ record.toGrid }}</span>
              </td>
              <td class="time-cell">{{ formatTime(record.timestamp) }}</td>
              <td class="qth-cell">{{ record.qth || '-' }}</td>
              <td class="comment-cell">{{ record.toComment || '-' }}</td>
              <td>{{ record.mode || '-' }}</td>
              <td class="relay-cell">
                <button
                  v-if="record.relayName"
                  class="relay-link"
                  :disabled="switchingRelay === record.relayName"
                  :title="`切换到 ${record.relayName}`"
                  @click="switchRelay(record.relayName)"
                >
                  {{ record.relayName }}
                </button>
                <span
                  v-if="record.isRelayPinned"
                  class="favorite-indicator"
                  title="已在 FMO 收藏中"
                >★</span>
                <span v-if="!record.relayName">-</span>
                <span v-if="record.relayAdmin" class="relay-admin">（{{ record.relayAdmin }}）</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="empty-state">
        {{ refreshing ? '正在读取最近通联...' : '暂无通联数据' }}
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { FmoApiClient } from '../services/fmoApi'
import { formatTimestamp } from '../components/home/constants'
import { getControlTarget, switchStationByRelayName } from '../services/stationControl'
import { useSpeakingStatusStore } from '../stores/speakingStore'
import { gridToAddress } from '../services/gridService'
import toast from '../composables/useToast'

const props = defineProps({
  fmoAddress: {
    type: String,
    default: ''
  },
  protocol: {
    type: String,
    default: 'ws'
  },
  selectedFromCallsign: {
    type: String,
    default: ''
  }
})

const records = ref([])
const currentStation = ref(null)
const refreshing = ref(false)
const loadingStation = ref(false)
const error = ref('')
const lastRefreshAt = ref(null)
const switchingRelay = ref('')
const pinnedRelayNames = ref([])
const qthCache = ref({})
let timer = null
const REFRESH_INTERVAL_MS = 5000

const controlTarget = computed(() => getControlTarget(props.fmoAddress, props.protocol))
const controlHost = computed(() => controlTarget.value.host)
const controlProtocol = computed(() => controlTarget.value.protocol)
const speakingStatus = useSpeakingStatusStore()
const { speakingHistory, primaryConnected } = storeToRefs(speakingStatus)

const lastRefreshText = computed(() => {
  if (!lastRefreshAt.value) return '尚未刷新'
  return `上次刷新 ${formatClock(lastRefreshAt.value)}`
})

const liveStatusText = computed(() => {
  if (error.value) return error.value
  if (primaryConnected.value) return '实时监听中'
  return '正在连接实时事件'
})

const displayRecords = computed(() => {
  const liveRows = speakingHistory.value.map((item) => {
    const matchedLog = findMatchingLog(item)
    const timestamp = Math.floor(item.startTime / 1000)
    const grid = item.grid || matchedLog?.toGrid || ''
    return {
      ...matchedLog,
      rowId: `live-${item.callsign}-${item.startTime}`,
      toCallsign: item.callsign,
      toGrid: grid,
      qth: getRecordQth({ ...matchedLog, toGrid: grid }),
      timestamp,
      toComment: item.endTime ? matchedLog?.toComment || '最近发言' : '正在发言',
      mode: matchedLog?.mode || 'FMO',
      relayName: item.serverName || matchedLog?.relayName || currentStation.value?.name || '',
      relayAdmin: matchedLog?.relayAdmin || '',
      isRelayPinned: isRelayPinned(item.serverName || matchedLog?.relayName || currentStation.value?.name),
      isSpeaking: !item.endTime
    }
  })

  const qsoRows = records.value
    .filter((record) => !liveRows.some((row) => isSameContact(row, record)))
    .map((record) => ({
      ...record,
      qth: getRecordQth(record),
      rowId: `log-${record.logId || record.timestamp || ''}-${record.toCallsign || ''}`,
      isRelayPinned: isRelayPinned(record.relayName),
      isSpeaking: false
    }))

  const sortedRows = [...liveRows, ...qsoRows].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  return dedupeLatestByCallsign(sortedRows).slice(0, 20)
})

function createClient() {
  if (!controlHost.value) return null
  return new FmoApiClient(`${controlProtocol.value}://${controlHost.value}`)
}

function formatClock(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatTime(timestamp) {
  if (!timestamp) return '-'
  return formatTimestamp(timestamp)
}

function normalizeRecord(item, detail) {
  const log = detail?.log || detail || item
  return {
    ...item,
    ...log,
    logId: log.logId || item.logId
  }
}

function formatAddress(address) {
  if (!address) return ''
  return [
    address.province,
    address.city,
    address.district
  ]
    .filter(Boolean)
    .filter((part, index, arr) => arr.indexOf(part) === index)
    .join('')
}

function getRecordQth(record) {
  const direct =
    record?.qth ||
    record?.address ||
    record?.location ||
    record?.toAddress ||
    record?.city ||
    record?.province
  if (direct) return direct

  const grid = normalizeGrid(record?.toGrid || record?.grid)
  if (!grid) return ''
  return qthCache.value[grid] || grid
}

function normalizeGrid(grid) {
  return String(grid || '').trim().toUpperCase()
}

function normalizeRelayName(name) {
  return String(name || '').trim().toLowerCase()
}

function isRelayPinned(relayName) {
  const name = normalizeRelayName(relayName)
  return Boolean(name && pinnedRelayNames.value.includes(name))
}

function collectVisibleGrids() {
  const grids = new Set()
  for (const record of records.value) {
    const grid = normalizeGrid(record.toGrid)
    if (grid) grids.add(grid)
  }
  for (const item of speakingHistory.value) {
    const grid = normalizeGrid(item.grid)
    if (grid) grids.add(grid)
  }
  return Array.from(grids)
}

async function loadQthForGrid(grid) {
  if (!grid || qthCache.value[grid]) return
  try {
    const address = await gridToAddress(grid)
    const qth = formatAddress(address) || grid
    qthCache.value = { ...qthCache.value, [grid]: qth }
  } catch {
    qthCache.value = { ...qthCache.value, [grid]: grid }
  }
}

function getCallsign(record) {
  return (record?.toCallsign || record?.callsign || '').toUpperCase()
}

function dedupeLatestByCallsign(rows) {
  const seen = new Set()
  return rows.filter((row) => {
    const callsign = getCallsign(row)
    if (!callsign) return true
    if (seen.has(callsign)) return false
    seen.add(callsign)
    return true
  })
}

function isSameContact(a, b) {
  const callsignA = getCallsign(a)
  const callsignB = getCallsign(b)
  if (!callsignA || callsignA !== callsignB) return false
  const timestampA = a?.timestamp || Math.floor((a?.startTime || 0) / 1000)
  const timestampB = b?.timestamp || Math.floor((b?.startTime || 0) / 1000)
  if (!timestampA || !timestampB) return false
  return Math.abs(timestampA - timestampB) < 90
}

function findMatchingLog(speakingRecord) {
  const speakingTimestamp = Math.floor(speakingRecord.startTime / 1000)
  return records.value.find((record) => {
    if (getCallsign(record) !== speakingRecord.callsign.toUpperCase()) return false
    return Math.abs((record.timestamp || 0) - speakingTimestamp) < 90
  })
}

async function refreshDashboard() {
  if (refreshing.value) return

  const client = createClient()
  if (!client) {
    error.value = '请先设置 FMO 地址'
    return
  }

  refreshing.value = true
  loadingStation.value = true
  error.value = ''

  try {
    const [station, qsoResponse, pinnedList] = await Promise.all([
      client.getCurrentStation(),
      client.getQsoList(0, 20, props.selectedFromCallsign || ''),
      client.getAllPinnedStations()
    ])
    currentStation.value = station
    pinnedRelayNames.value = (pinnedList || []).map((item) => normalizeRelayName(item.name))
    loadingStation.value = false

    const list = qsoResponse?.list || []
    const detailed = []

    for (const item of list) {
      try {
        const detail = item.logId ? await client.getQsoDetail(item.logId) : null
        detailed.push(normalizeRecord(item, detail))
      } catch {
        detailed.push(normalizeRecord(item, null))
      }
    }

    records.value = detailed
    lastRefreshAt.value = new Date()
  } catch (err) {
    error.value = `刷新失败：${err.message || err}`
  } finally {
    loadingStation.value = false
    refreshing.value = false
    client.close()
  }
}

function refreshNow() {
  refreshDashboard()
}

watch(
  () => collectVisibleGrids().join('|'),
  (gridKey) => {
    if (!gridKey) return
    for (const grid of gridKey.split('|')) {
      loadQthForGrid(grid)
    }
  },
  { immediate: true }
)

async function switchRelay(relayName) {
  if (!relayName || switchingRelay.value) return
  switchingRelay.value = relayName

  try {
    const { current, station } = await switchStationByRelayName(
      relayName,
      props.fmoAddress,
      props.protocol
    )
    currentStation.value = current || station
    toast.success(`已切换到：${current?.name || station.name}`)
  } catch (err) {
    toast.error(err.message || '切换中继失败')
  } finally {
    switchingRelay.value = ''
  }
}

onMounted(() => {
  if (controlHost.value && !primaryConnected.value) {
    speakingStatus.connectEventWs(controlHost.value, controlProtocol.value)
  }
  refreshDashboard()
  timer = setInterval(refreshDashboard, REFRESH_INTERVAL_MS)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.dashboard-view {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.station-band,
.live-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 8px;
}

.station-band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  flex-shrink: 0;
}

.eyebrow {
  color: var(--text-tertiary);
  font-size: 0.8rem;
}

.station-band h2 {
  margin: 0.2rem 0;
  color: var(--text-primary);
  font-size: 1.3rem;
}

.station-band p {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.station-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.refresh-btn {
  border: 1px solid var(--color-success);
  background: var(--color-success);
  color: #fff;
  border-radius: 4px;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
}

.refresh-btn:disabled {
  cursor: wait;
  opacity: 0.7;
}

.refresh-time,
.live-status {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.live-panel {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.panel-header h3 {
  margin: 0;
  color: var(--text-primary);
}

.live-status.error {
  color: var(--color-danger);
}

.live-table-wrap {
  min-height: 0;
  flex: 1;
  overflow: auto;
}

.live-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.live-table th,
.live-table td {
  padding: 0.45rem 0.65rem;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-primary);
  font-size: 0.9rem;
  line-height: 1.25;
  text-align: left;
  vertical-align: middle;
}

.live-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg-table-header);
  color: var(--text-secondary);
  font-weight: 600;
}

.live-table tr.is-speaking td {
  background: rgba(76, 175, 80, 0.1);
}

.callsign-cell {
  width: clamp(135px, 14vw, 165px);
}

.callsign-cell strong {
  display: block;
  font-size: 0.98rem;
}

.callsign-cell span,
.relay-admin {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.callsign-cell .speaking-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 0.35rem;
  border: 1px solid rgba(76, 175, 80, 0.45);
  border-radius: 4px;
  padding: 0.05rem 0.3rem;
  color: var(--color-success);
  font-size: 0.7rem;
  font-weight: 600;
  vertical-align: middle;
}

.time-cell {
  width: 158px;
  white-space: nowrap;
}

.qth-cell {
  width: clamp(170px, 18vw, 230px);
  color: var(--text-secondary);
  display: -webkit-box;
  overflow: hidden;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.comment-cell {
  width: auto;
  word-break: break-word;
}

.relay-cell {
  width: clamp(130px, 15vw, 185px);
}

.live-table th:nth-child(5),
.live-table td:nth-child(5) {
  width: 58px;
  text-align: center;
}

.relay-link {
  border: 0;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  padding: 0;
  text-align: left;
}

.favorite-indicator {
  margin-left: 0.35rem;
  color: var(--color-warning, #e6a23c);
  font-size: 0.9rem;
}

.relay-link:hover:not(:disabled) {
  text-decoration: underline;
}

.relay-link:disabled {
  cursor: wait;
  opacity: 0.7;
}

.empty-state {
  flex: 1;
  padding: 3rem 1rem;
  color: var(--text-tertiary);
  text-align: center;
}

@media (max-width: 768px) {
  .dashboard-view {
    padding: 1rem;
    overflow-y: auto;
  }

  .station-band,
  .panel-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .live-table {
    min-width: 880px;
  }

  .live-table-wrap {
    max-height: 70vh;
  }
}

@media (max-width: 520px) {
  .dashboard-view {
    padding: 0.75rem;
  }

  .live-table {
    min-width: 820px;
  }

  .live-table th,
  .live-table td {
    padding: 0.42rem 0.5rem;
    font-size: 0.86rem;
  }

  .callsign-cell {
    width: 132px;
  }

  .time-cell {
    width: 152px;
  }

  .qth-cell {
    width: 210px;
    -webkit-line-clamp: 2;
  }

  .relay-cell {
    width: 145px;
  }
}
</style>
