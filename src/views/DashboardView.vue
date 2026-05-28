<template>
  <div class="dashboard-view">
    <section class="dashboard-hero" :class="{ active: isDisplaySpeakerActive }">
      <div v-if="displaySpeaker" class="hero-content">
        <div class="hero-station">
          <div class="speaker-title">
            <div class="speaker-identity">
              <span class="speaker-callsign" :class="{ idle: !isDisplaySpeakerActive }">
                {{ displaySpeaker.callsign }}
              </span>
              <span v-if="displaySpeaker.callsign === selectedFromCallsign" class="pill muted"
                >您</span
              >
            </div>
          </div>

          <div class="speaker-details">
            <span v-if="displaySpeaker.serverName" class="detail-tag">{{
              displaySpeaker.serverName
            }}</span>
            <span v-if="displaySpeakerAddress">{{ displaySpeakerAddress }}</span>
          </div>

          <div class="metric-block geo-block">
            <span
              v-if="displaySpeakerGeoText"
              class="geo-icon"
              :style="{ transform: `rotate(${displaySpeakerBearing || 0}deg)` }"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4 19 20 12 16 5 20 12 4Z" />
              </svg>
            </span>
            <strong>{{ displaySpeakerGeoText || '位置计算中' }}</strong>
          </div>
        </div>

        <div class="hero-metrics">
          <div class="metric-block duration-block">
            <span>{{ isDisplaySpeakerActive ? '持续时间' : '发言时长' }}</span>
            <strong v-if="isDisplaySpeakerActive">
              {{ speakingDuration }}
            </strong>
            <strong v-else-if="displaySpeaker.endTime" class="idle-duration">
              {{ formatDurationMmSs(displaySpeaker.endTime - displaySpeaker.startTime) }}
            </strong>
          </div>
        </div>
      </div>

      <div v-else class="hero-empty">
        <div class="empty-radar"></div>
        <div>
          <strong>暂无发言事件</strong>
          <span>连接到 FMO 后，这里会显示当前频道的实时状态。</span>
        </div>
      </div>

      <div v-if="isSelfSpeaking" class="self-bar">
        <span class="self-dot"></span>
        <span>{{ selectedFromCallsign }} 正在发言，主视图显示上一位对方台站。</span>
      </div>
    </section>

    <section class="event-strip-wrap">
      <div v-if="displayHistoryEvents.length === 0" class="event-empty">暂无历史发言事件</div>
      <div v-else class="event-strip">
        <div v-for="(event, index) in displayHistoryEvents" :key="index" class="event-chip">
          <div class="event-main">
            <strong>{{ event.callsign }}</strong>
            <span>{{ formatEventTime(event.utcTime) }}</span>
          </div>
          <span class="event-count">x{{ getEventCount(event.callsign) }}</span>
        </div>
      </div>
    </section>

    <section class="history-panel">
      <h3>历史发言记录</h3>

      <div class="history-list">
        <div v-if="displayHistory.length === 0" class="panel-empty">
          <span>暂无发言记录</span>
        </div>

        <div
          v-for="(record, index) in displayHistory"
          :key="index"
          class="history-row"
          :class="{
            active: !record.endTime,
            self: record.callsign === selectedFromCallsign
          }"
          @click="
            record.callsign !== selectedFromCallsign &&
            $emit('show-callsign-records', record.callsign)
          "
        >
          <div class="history-name">
            <div class="history-topline">
              <strong :class="{ on: !record.endTime }">
                {{ record.callsign }}
              </strong>
              <span v-if="record.callsign === selectedFromCallsign" class="pill muted tiny"
                >您</span
              >
              <span
                v-else
                class="contact-star"
                :class="todayContactedCallsigns.has(record.callsign) ? 'star-on' : 'star-off'"
              >
                <img
                  v-if="todayContactedCallsigns.has(record.callsign)"
                  class="star-img"
                  src="/img/star_2b50.png"
                  alt=""
                />
                <template v-else>&#9733;</template>
              </span>
              <span v-if="record.callsign !== selectedFromCallsign" class="contact-count"
                >x{{ contactCounts.get(record.callsign) || 0 }}</span
              >
            </div>

            <div class="history-meta">
              <span v-if="record.serverName" class="detail-tag">{{ record.serverName }}</span>
              <span v-if="historyAddressMap[record.callsign]">{{
                historyAddressMap[record.callsign]
              }}</span>
            </div>
          </div>

          <div class="history-times">
            <span class="history-state" :class="{ on: !record.endTime }">
              <template v-if="!record.endTime">发言中</template>
              <template v-else>{{ formatTimeAgo(record.endTime) }}</template>
            </span>

            <span class="history-duration">{{
              formatDurationMmSs((record.endTime || now) - record.startTime)
            }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, inject, reactive } from 'vue'
import { useSpeakingStatusStore } from '../stores/speakingStore'
import { useSettingsStore } from '../stores/settingsStore'
import { formatTimeAgo, formatDurationMmSs } from '../components/home/constants'
import { gridToAddress } from '../services/gridService'
import { normalizeHost } from '../utils/urlUtils'
import { FmoApiClient } from '../services/fmoApi'

defineEmits(['show-callsign-records'])

const speakingStore = useSpeakingStatusStore()
const settingsStore = useSettingsStore()

const selectedFromCallsign = inject('selectedFromCallsign', ref(''))
const fmoAddress = inject('fmoAddress', ref(''))
const protocol = inject('protocol', ref('ws'))

const now = ref(Date.now())
let nowTimer = null

const myLat = ref(null)
const myLng = ref(null)

const historyAddressMap = reactive({})
const gridAddressCache = reactive({})
const EVENT_STORAGE_KEY = 'dashboard_history_events'
const cachedHistoryEvents = ref(loadCachedHistoryEvents())

// ========== 计算属性 ==========

const currentSpeakerRecord = computed(() => {
  return speakingStore.speakingHistory.find((h) => !h.endTime) || null
})

const isAnyoneSpeaking = computed(() => !!currentSpeakerRecord.value)

const isSelfSpeaking = computed(() => {
  return currentSpeakerRecord.value?.callsign === selectedFromCallsign.value
})

const displaySpeaker = computed(() => {
  const history = speakingStore.speakingHistory
  if (isSelfSpeaking.value) {
    const prev = history.find((h) => h.endTime && h.callsign !== selectedFromCallsign.value)
    if (prev) return prev
    const anyPrev = history.find((h) => h.endTime)
    return anyPrev || currentSpeakerRecord.value || null
  }
  if (currentSpeakerRecord.value) return currentSpeakerRecord.value
  return history[0] || null
})

// 展示的发言者是否正在发言（只有当 displaySpeaker 就是当前发言者时才算）
const isDisplaySpeakerActive = computed(() => {
  return (
    isAnyoneSpeaking.value &&
    currentSpeakerRecord.value?.callsign === displaySpeaker.value?.callsign
  )
})

const displaySpeakerAddress = ref('')

const displaySpeakerDistance = computed(() => {
  if (!displaySpeaker.value?.grid || myLat.value === null) return ''
  const coords = gridToLatLng(displaySpeaker.value.grid)
  if (!coords) return ''
  const dist = haversineDistance(myLat.value, myLng.value, coords.lat, coords.lng)
  if (dist < 1) return `${Math.round(dist * 1000)}m`
  return `${dist.toFixed(1)}km`
})

const displaySpeakerBearing = computed(() => {
  if (!displaySpeaker.value?.grid || myLat.value === null) return ''
  const coords = gridToLatLng(displaySpeaker.value.grid)
  if (!coords) return ''
  return calcBearing(myLat.value, myLng.value, coords.lat, coords.lng)
})

const displaySpeakerDirection = computed(() => {
  if (displaySpeakerBearing.value === '') return ''
  const deg = displaySpeakerBearing.value
  return `${bearingToDirection(deg)} ${Math.round(deg)}°`
})

const displaySpeakerGeoText = computed(() => {
  if (!displaySpeakerDirection.value || !displaySpeakerDistance.value) return ''
  return `${displaySpeakerDirection.value} ${displaySpeakerDistance.value}`
})

const speakingDuration = ref('00:00')
let durationTimer = null

const displayHistory = computed(() => {
  if (speakingStore.allSpeakingHistories?.length > 0) {
    return speakingStore.allSpeakingHistories
  }
  return speakingStore.speakingHistory
})

const todayContactedCallsigns = computed(() => settingsStore.todayContactedCallsigns)
const contactCounts = computed(() => settingsStore.contactCounts)
const allHistoryEvents = computed(() => speakingStore.allHistoryEvents)
const displayHistoryEvents = computed(() => {
  return allHistoryEvents.value.length > 0 ? allHistoryEvents.value : cachedHistoryEvents.value
})

// ========== 方法 ==========

function getEventCount(callsign) {
  let count = 0
  for (const event of displayHistoryEvents.value) {
    if (event.callsign === callsign) count++
  }
  return count
}

function loadCachedHistoryEvents() {
  try {
    const raw = localStorage.getItem(EVENT_STORAGE_KEY)
    if (!raw) return []
    const oneHourAgo = Math.floor(Date.now() / 1000) - 60 * 60
    return JSON.parse(raw).filter((event) => event?.callsign && event?.utcTime > oneHourAgo)
  } catch {
    return []
  }
}

function saveCachedHistoryEvents(events) {
  try {
    localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(events))
  } catch {
    // ignore storage errors
  }
}

function formatEventTime(utcTime) {
  if (!utcTime) return ''
  const date = new Date(utcTime * 1000)
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function gridToLatLng(grid) {
  if (!grid || grid.length < 4) return null
  grid = grid.toUpperCase()
  let lng = (grid.charCodeAt(0) - 65) * 20 - 180
  let lat = (grid.charCodeAt(1) - 65) * 10 - 90
  lng += parseInt(grid[2]) * 2
  lat += parseInt(grid[3]) * 1
  if (grid.length >= 6) {
    lng += ((grid.charCodeAt(4) - 65) * 5) / 60
    lat += ((grid.charCodeAt(5) - 65) * 2.5) / 60
    lng += 2.5 / 60
    lat += 1.25 / 60
  } else {
    lng += 1
    lat += 0.5
  }
  return { lat, lng }
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function calcBearing(lat1, lon1, lat2, lon2) {
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180)
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function bearingToDirection(bearing) {
  const dirs = [
    [22.5, '北'],
    [67.5, '东北'],
    [112.5, '东'],
    [157.5, '东南'],
    [202.5, '南'],
    [247.5, '西南'],
    [292.5, '西'],
    [337.5, '西北'],
    [360, '北']
  ]
  for (const [limit, cn] of dirs) {
    if (bearing < limit) return cn
  }
  return '北'
}

function formatAddress(data) {
  if (!data) return ''
  const parts = []
  if (data.province) parts.push(data.province)
  if (data.city && data.city !== data.province) parts.push(data.city)
  if (data.district) parts.push(data.district)
  return parts.join('-')
}

async function loadGridAddress(grid) {
  if (!grid || gridAddressCache[grid] !== undefined) return gridAddressCache[grid] || ''
  try {
    const result = await gridToAddress(grid)
    const formatted = formatAddress(result)
    gridAddressCache[grid] = formatted
    return formatted
  } catch {
    gridAddressCache[grid] = ''
    return ''
  }
}

async function loadHistoryAddresses(records) {
  for (const record of records) {
    if (record.grid && !historyAddressMap[record.callsign]) {
      historyAddressMap[record.callsign] = await loadGridAddress(record.grid)
    }
  }
}

async function fetchMyCoordinate() {
  if (!fmoAddress.value) return
  try {
    const host = normalizeHost(fmoAddress.value)
    const fullAddress = `${protocol.value}://${host}`
    const client = new FmoApiClient(fullAddress)
    await client.connect()
    const coord = await client.getCoordinate()
    const latitude = Number(coord?.latitude ?? coord?.lat)
    const longitude = Number(coord?.longitude ?? coord?.lng ?? coord?.lon)
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      myLat.value = latitude
      myLng.value = longitude
    }
    client.close()
  } catch {
    // 无法获取坐标
  }
}

function updateSpeakingDuration() {
  if (currentSpeakerRecord.value && !currentSpeakerRecord.value.endTime) {
    speakingDuration.value = formatDurationMmSs(Date.now() - currentSpeakerRecord.value.startTime)
  }
}

async function updateDisplaySpeakerAddress() {
  if (displaySpeaker.value?.grid) {
    displaySpeakerAddress.value = await loadGridAddress(displaySpeaker.value.grid)
  } else {
    displaySpeakerAddress.value = ''
  }
}

// ========== 生命周期 ==========

onMounted(() => {
  nowTimer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
  durationTimer = setInterval(updateSpeakingDuration, 1000)
})

onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer)
  if (durationTimer) clearInterval(durationTimer)
})

watch(
  () => displayHistory.value,
  (records) => {
    if (records?.length > 0) loadHistoryAddresses(records)
  },
  { immediate: true, deep: true }
)

watch(displaySpeaker, () => updateDisplaySpeakerAddress(), { immediate: true })

watch([fmoAddress, protocol], () => fetchMyCoordinate(), { immediate: true })

watch(
  allHistoryEvents,
  (events) => {
    if (events.length === 0) return
    cachedHistoryEvents.value = events
    saveCachedHistoryEvents(events)
  },
  { immediate: true }
)
</script>

<style scoped>
.dashboard-view {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  width: 100%;
}

.dashboard-hero,
.event-strip-wrap,
.history-panel {
  flex-shrink: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-secondary);
  border-radius: 10px;
}

.dashboard-hero {
  position: relative;
  overflow: hidden;
  padding: 0.9rem 1.1rem;
}

.dashboard-hero::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--text-disabled);
  content: '';
}

.dashboard-hero.active::before {
  background: var(--color-speaking);
}

.self-dot,
.history-marker span {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--text-disabled);
  flex-shrink: 0;
}

.self-dot,
.history-marker span.on {
  background: var(--color-speaking);
  animation: pulse 1.5s ease-in-out infinite;
}

.hero-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  gap: 1rem;
}

.hero-station {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.speaker-title {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.speaker-identity {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-width: 0;
}

.speaker-callsign {
  color: var(--color-speaking);
  font-family: 'IntelOneMono', monospace;
  font-size: clamp(2.1rem, 5.4vw, 3.8rem);
  font-weight: 800;
  letter-spacing: 0;
  line-height: 0.95;
  overflow-wrap: anywhere;
}

.speaker-callsign.idle {
  color: var(--text-secondary);
}

.pill {
  display: inline-flex;
  align-items: center;
  min-height: 1.35rem;
  padding: 0.12rem 0.48rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1;
}

.pill.live {
  color: var(--text-primary);
  background: var(--status-success-bg-soft);
}

.pill.muted {
  color: var(--text-tertiary);
  background: var(--alpha-neutral-12);
}

.pill.tiny {
  min-height: 1.12rem;
  padding: 0.08rem 0.32rem;
  font-size: 0.7rem;
}

.speaker-details,
.history-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem 0.55rem;
  min-width: 0;
  color: var(--text-tertiary);
  font-size: 0.88rem;
}

.speaker-details {
  margin-top: 0.45rem;
}

.hero-station .geo-block {
  margin-top: 0.55rem;
}

.geo-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.45rem;
  height: 1.45rem;
  border: 2px solid var(--text-primary);
  border-radius: 50%;
  color: var(--text-primary);
  transform-origin: center;
}

.geo-icon svg {
  display: block;
  width: 1.12rem;
  height: 1.12rem;
  fill: var(--text-primary);
  transform: translateY(-0.08rem);
}

.geo-item strong {
  color: var(--text-primary);
  font-family: 'IntelOneMono', monospace;
  font-size: 1.02rem;
  font-weight: 800;
}

.detail-tag {
  max-width: 100%;
  padding: 0.08rem 0.42rem;
  border-radius: 4px;
  background: var(--alpha-neutral-12);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-metrics {
  display: grid;
  grid-template-columns: auto;
  gap: 0.5rem;
  align-items: stretch;
}

.metric-block {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 7.2rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-table-stripe);
}

.metric-block span {
  color: var(--text-tertiary);
  font-size: 0.9rem;
  font-weight: 500;
  line-height: 1.2;
}

.metric-block strong {
  color: var(--color-speaking);
  font-family: 'IntelOneMono', monospace;
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1.1;
  margin-top: 0.22rem;
  white-space: nowrap;
}

.geo-block {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  column-gap: 0.45rem;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
}

.geo-block strong {
  margin-top: 0;
  color: var(--text-primary);
  font-size: 1.02rem;
}

.duration-block .idle-duration {
  color: var(--text-secondary);
}

.duration-block {
  min-width: 6.5rem;
  align-items: flex-end;
  padding-right: 0;
  padding-left: 0.6rem;
  border-color: transparent;
  background: transparent;
  text-align: right;
}

.duration-block strong {
  font-size: 1.65rem;
}

.hero-empty {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-height: 5rem;
  color: var(--text-secondary);
}

.hero-empty strong,
.hero-empty span {
  display: block;
}

.hero-empty span {
  margin-top: 0.2rem;
  color: var(--text-tertiary);
  font-size: 0.9rem;
}

.empty-radar {
  width: 2.4rem;
  height: 2.4rem;
  border: 2px solid var(--border-secondary);
  border-radius: 50%;
  box-shadow: inset 0 0 0 8px var(--bg-table-stripe);
  flex-shrink: 0;
}

.self-bar {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.8rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--border-light);
  color: var(--text-tertiary);
  font-size: 0.88rem;
}

.history-panel {
  overflow: visible;
}

.history-panel {
  box-shadow: 0 1px 3px var(--shadow-card);
}

.history-panel h3 {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
  margin: 0;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-primary);
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0;
}

.history-panel h3::before {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--brand-indigo);
  content: '';
  flex-shrink: 0;
}

.panel-empty {
  display: grid;
  place-items: center;
  flex: 1;
  min-height: 8rem;
  padding: 1rem;
  color: var(--text-tertiary);
  font-size: 0.95rem;
  text-align: center;
}

.event-strip-wrap {
  min-width: 0;
  overflow: hidden;
}

.event-empty {
  padding: 0.7rem 1rem;
  color: var(--text-tertiary);
  font-size: 0.92rem;
  text-align: center;
}

.history-list {
  overflow: visible;
}

.event-strip {
  display: flex;
  gap: 0.45rem;
  padding: 0.55rem 0.65rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.event-strip::-webkit-scrollbar {
  display: none;
}

.event-chip {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.45rem;
  flex: 0 0 auto;
  width: 9rem;
  min-height: 2.85rem;
  padding: 0.45rem 0.6rem;
  border-radius: 6px;
  background: var(--bg-table-stripe);
  transition: background 0.15s;
}

.event-main {
  min-width: 0;
}

.event-main strong,
.history-topline strong {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-family: 'IntelOneMono', monospace;
  font-weight: 800;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-main strong {
  font-size: 0.98rem;
}

.event-main span {
  display: block;
  margin-top: 0.12rem;
  color: var(--text-tertiary);
  font-family: 'IntelOneMono', monospace;
  font-size: 0.82rem;
}

.event-count,
.contact-count,
.history-state,
.history-duration {
  color: var(--text-tertiary);
  white-space: nowrap;
}

.event-count {
  padding: 0.08rem 0.35rem;
  border-radius: 999px;
  background: var(--bg-table-stripe);
  font-weight: 700;
}

.history-list {
  padding: 0.35rem 0;
}

.history-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.85rem;
  padding: 0.68rem 1rem;
  border-left: 3px solid var(--color-transparent);
  cursor: pointer;
  line-height: 1.45;
  transition: background 0.15s;
}

.history-row.active {
  border-left-color: var(--color-speaking);
  background: var(--bg-speaking-bar);
}

.history-row:nth-child(even) {
  background: var(--bg-table-stripe);
}

.history-row.active {
  background: var(--bg-speaking-bar);
}

.history-row.self {
  cursor: default;
}

@media (hover: hover) {
  .event-chip:hover,
  .history-row:hover {
    background: var(--bg-table-hover);
  }

  .history-row.active:hover {
    background: var(--bg-speaking-bar);
  }

  .history-row:nth-child(even):hover {
    background: var(--bg-table-hover);
  }
}

.history-name {
  min-width: 0;
}

.history-topline {
  display: flex;
  align-items: center;
  gap: 0.42rem;
  min-width: 0;
}

.history-topline strong {
  flex: 0 1 auto;
  font-size: 1.08rem;
}

.history-topline strong.on,
.history-state.on {
  color: var(--color-speaking);
}

.contact-star {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--color-today-uncontacted);
  font-size: 0.9rem;
  line-height: 1;
}

.contact-star.star-on {
  width: 1rem;
  height: 1rem;
}

.star-img {
  display: block;
  width: 1rem;
  height: 1rem;
  object-fit: contain;
}

.history-times {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.12rem;
  min-width: max-content;
  white-space: nowrap;
}

.history-state {
  color: var(--text-tertiary);
  font-size: 0.92rem;
  font-weight: 500;
  flex-shrink: 0;
}

.history-meta {
  margin-top: 0.22rem;
}

.history-duration {
  font-family: 'IntelOneMono', monospace;
  font-size: 0.92rem;
  font-weight: 500;
  text-align: right;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.45;
    transform: scale(1.2);
  }
}

@media (max-width: 768px) {
  .dashboard-view {
    height: auto;
    margin-top: 0.5rem;
  }

  .hero-content {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .hero-metrics {
    grid-template-columns: auto;
    justify-content: end;
    justify-self: stretch;
  }

  .metric-block,
  .geo-block {
    min-width: 0;
  }

  .metric-block strong {
    font-size: 1.25rem;
  }

  .history-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
}

@media (max-width: 520px) {
  .dashboard-hero {
    padding: 0.8rem 0.9rem;
  }

  .speaker-details {
    padding-left: 0;
  }

  .hero-metrics {
    grid-template-columns: 1fr;
    justify-self: end;
  }

  .history-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.5rem;
    padding: 0.62rem 0.8rem;
  }

  .history-topline {
    flex-wrap: wrap;
  }
}
</style>
