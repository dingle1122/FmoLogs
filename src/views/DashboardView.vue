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
          {{ error || '实时刷新中' }}
        </span>
      </div>

      <div v-if="records.length > 0" class="live-table-wrap">
        <table class="live-table">
          <thead>
            <tr>
              <th>呼号</th>
              <th>时间</th>
              <th>留言</th>
              <th>模式</th>
              <th>中继</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in records" :key="record.logId || record.timestamp + record.toCallsign">
              <td class="callsign-cell">
                <strong>{{ record.toCallsign || '-' }}</strong>
                <span v-if="record.toGrid">{{ record.toGrid }}</span>
              </td>
              <td class="time-cell">{{ formatTime(record.timestamp) }}</td>
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
                <span v-else>-</span>
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
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { FmoApiClient } from '../services/fmoApi'
import { formatTimestamp } from '../components/home/constants'
import { getControlTarget, switchStationByRelayName } from '../services/stationControl'
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
let timer = null

const controlTarget = computed(() => getControlTarget(props.fmoAddress, props.protocol))
const controlHost = computed(() => controlTarget.value.host)
const controlProtocol = computed(() => controlTarget.value.protocol)

const lastRefreshText = computed(() => {
  if (!lastRefreshAt.value) return '尚未刷新'
  return `上次刷新 ${formatClock(lastRefreshAt.value)}`
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
    const [station, qsoResponse] = await Promise.all([
      client.getCurrentStation(),
      client.getQsoList(0, 20, props.selectedFromCallsign || '')
    ])
    currentStation.value = station
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
  refreshDashboard()
  timer = setInterval(refreshDashboard, 5000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.dashboard-view {
  height: 100%;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
  padding: 1rem 1.25rem;
}

.eyebrow {
  color: var(--text-tertiary);
  font-size: 0.8rem;
}

.station-band h2 {
  margin: 0.2rem 0;
  color: var(--text-primary);
  font-size: 1.5rem;
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
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1.25rem;
  border-bottom: 1px solid var(--border-light);
}

.panel-header h3 {
  margin: 0;
  color: var(--text-primary);
}

.live-status.error {
  color: var(--color-danger);
}

.live-table-wrap {
  overflow-x: auto;
}

.live-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.live-table th,
.live-table td {
  padding: 0.75rem 0.9rem;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-primary);
  text-align: left;
  vertical-align: middle;
}

.live-table th {
  background: var(--bg-table-header);
  color: var(--text-secondary);
  font-weight: 600;
}

.callsign-cell {
  width: 180px;
}

.callsign-cell strong {
  display: block;
  font-size: 1.05rem;
}

.callsign-cell span,
.relay-admin {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.time-cell {
  width: 170px;
  white-space: nowrap;
}

.comment-cell {
  width: 40%;
  word-break: break-word;
}

.relay-cell {
  width: 220px;
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

.relay-link:hover:not(:disabled) {
  text-decoration: underline;
}

.relay-link:disabled {
  cursor: wait;
  opacity: 0.7;
}

.empty-state {
  padding: 3rem 1rem;
  color: var(--text-tertiary);
  text-align: center;
}

@media (max-width: 768px) {
  .dashboard-view {
    padding: 1rem;
  }

  .station-band,
  .panel-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .live-table {
    min-width: 760px;
  }
}
</style>
