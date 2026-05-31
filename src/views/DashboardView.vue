<template>
  <div class="dashboard-view">
    <section
      class="dashboard-hero"
      :class="{ active: isDisplaySpeakerActive, 'self-speaking': isOwnSpeaking }"
    >
      <span v-if="displaySpeaker" class="hero-watermark" aria-hidden="true">
        {{ displaySpeaker.callsign }}
        <span class="hero-watermark-count"
          >x{{ contactCounts.get(displaySpeaker.callsign) || 0 }}</span
        >
      </span>
      <div v-if="displaySpeaker" class="hero-content">
        <div class="hero-station">
          <div class="speaker-title">
            <div class="speaker-identity">
              <span class="speaker-callsign" :class="{ idle: !isDisplaySpeakerActive }">
                {{ displaySpeaker.callsign }}
              </span>
              <span class="speaker-contact-count"
                >x{{ contactCounts.get(displaySpeaker.callsign) || 0 }}</span
              >
              <span
                v-if="
                  displaySpeaker.callsign !== selectedFromCallsign &&
                  todayContactedCallsigns.has(displaySpeaker.callsign)
                "
                class="speaker-contact-star"
              >
                <img src="/img/star_2b50.png" alt="" />
              </span>
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
            <span>{{
              isOwnSpeaking && !isDisplaySpeakerActive
                ? '您正在发言'
                : isDisplaySpeakerActive
                  ? '持续时间'
                  : '发言时长'
            }}</span>
            <strong v-if="isDisplaySpeakerActive">
              {{ speakingDuration }}
            </strong>
            <strong v-else-if="isOwnSpeaking" class="self-speaking-duration">
              {{ ownSpeakingDuration }}
            </strong>
            <strong v-else-if="displaySpeaker.endTime" class="idle-duration">
              {{ formatDurationMmSs(displaySpeaker.endTime - displaySpeaker.startTime) }}
            </strong>
          </div>
        </div>
      </div>

      <div v-else class="hero-empty">
        <div>
          <strong>{{
            isOwnSpeaking
              ? '您正在发言'
              : hasAnySpeakingHistory
                ? '暂时没有对方发言'
                : '暂时没人发言'
          }}</strong>
          <span>{{ heroEmptyText }}</span>
        </div>
      </div>
    </section>

    <section class="event-strip-wrap">
      <h3>最近发言</h3>

      <div v-if="displayHistoryEvents.length === 0" class="empty-state">
        <div class="empty-state-copy">
          <strong>暂无最近发言</strong>
          <span>有新发言时会显示在这里</span>
        </div>
      </div>
      <div v-else class="event-strip">
        <div
          v-for="(event, index) in displayHistoryEvents"
          :key="index"
          class="event-chip"
          :class="{ self: event.callsign === selectedFromCallsign }"
          @click="
            event.callsign !== selectedFromCallsign &&
            $emit('show-callsign-records', event.callsign)
          "
        >
          <span class="event-index-bg" aria-hidden="true">{{ index + 1 }}</span>
          <div class="event-main">
            <div class="event-callsign-line">
              <strong>{{ event.callsign }}</strong>
              <span
                v-if="
                  event.callsign !== selectedFromCallsign &&
                  todayContactedCallsigns.has(event.callsign)
                "
                class="event-contact-star"
              >
                <img src="/img/star_2b50.png" alt="" />
              </span>
            </div>
            <span>{{ formatEventTime(event.utcTime) }}</span>
          </div>
          <span class="event-count">x{{ contactCounts.get(event.callsign) || 0 }}</span>
        </div>
      </div>
    </section>

    <section class="history-panel">
      <h3>历史发言记录</h3>

      <div class="history-list">
        <div v-if="displayHistory.length === 0" class="empty-state">
          <div class="empty-state-copy">
            <strong>暂无历史发言记录</strong>
            <span>有发言记录时会显示在这里</span>
          </div>
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
          <span class="history-index-bg" aria-hidden="true">{{ index + 1 }}</span>
          <div class="history-name">
            <div class="history-topline">
              <strong :class="{ on: !record.endTime }">
                {{ record.callsign }}
              </strong>
              <span class="contact-count">
                <span v-if="record.callsign === selectedFromCallsign" class="self-label">您</span>
                <template v-else>x{{ contactCounts.get(record.callsign) || 0 }}</template>
              </span>
              <span
                v-if="
                  record.callsign !== selectedFromCallsign &&
                  todayContactedCallsigns.has(record.callsign)
                "
                class="history-contact-star"
              >
                <img class="star-img" src="/img/star_2b50.png" alt="" />
              </span>
            </div>

            <div class="history-meta">
              <span v-if="record.serverName" class="detail-tag">{{ record.serverName }}</span>
              <span v-if="historyAddressMap[record.callsign]" class="history-address">{{
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

// ========== 计算属性 ==========

const currentSpeakerRecord = computed(() => {
  return speakingStore.speakingHistory.find((h) => !h.endTime) || null
})

const currentOwnSpeakerRecord = computed(() => {
  const ownCallsign = selectedFromCallsign.value
  if (!ownCallsign) return null
  return currentSpeakerRecord.value?.callsign === ownCallsign ? currentSpeakerRecord.value : null
})

const isAnyoneSpeaking = computed(() => !!currentSpeakerRecord.value)
const isOwnSpeaking = computed(() => !!currentOwnSpeakerRecord.value)

const displaySpeaker = computed(() => {
  const history = speakingStore.speakingHistory
  const ownCallsign = selectedFromCallsign.value
  const isOwnRecord = (record) => ownCallsign && record?.callsign === ownCallsign

  if (currentSpeakerRecord.value && !isOwnRecord(currentSpeakerRecord.value)) {
    return currentSpeakerRecord.value
  }

  return history.find((h) => !isOwnRecord(h)) || null
})

// 展示的发言者是否正在发言（只有当 displaySpeaker 就是当前发言者时才算）
const isDisplaySpeakerActive = computed(() => {
  return (
    isAnyoneSpeaking.value &&
    currentSpeakerRecord.value?.callsign === displaySpeaker.value?.callsign
  )
})

const hasAnySpeakingHistory = computed(() => speakingStore.speakingHistory.length > 0)

const heroEmptyText = computed(() =>
  isOwnSpeaking.value ? '等待对方回应时会保留在这里' : '有新发言时会显示在这里'
)

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
const ownSpeakingDuration = ref('00:00')
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
const displayHistoryEvents = computed(() => allHistoryEvents.value)

// ========== 方法 ==========

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
  if (currentOwnSpeakerRecord.value && !currentOwnSpeakerRecord.value.endTime) {
    ownSpeakingDuration.value = formatDurationMmSs(
      Date.now() - currentOwnSpeakerRecord.value.startTime
    )
  } else {
    ownSpeakingDuration.value = '00:00'
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
  updateSpeakingDuration()
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
  border-radius: 10px;
}

.event-strip-wrap,
.history-panel {
  background: transparent;
}

.dashboard-hero {
  position: relative;
  overflow: hidden;
  padding: 0.9rem 1.1rem;
  border: 1px solid var(--border-secondary);
  background:
    linear-gradient(135deg, var(--bg-card), var(--bg-table-stripe));
}

.dashboard-hero.active {
  background:
    linear-gradient(135deg, var(--bg-speaking-bar), var(--bg-card));
}

.dashboard-hero.self-speaking:not(.active) {
  border-color: var(--color-speaking);
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--color-speaking) 10%, transparent),
      var(--bg-card)
    );
}

.dashboard-hero::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--text-disabled);
  content: '';
  z-index: 2;
}

.dashboard-hero.active::before {
  background: var(--color-speaking);
}

.dashboard-hero.self-speaking:not(.active)::before {
  background: var(--color-speaking);
  opacity: 0.65;
}

.history-marker span {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--text-disabled);
  flex-shrink: 0;
}

.history-marker span.on {
  background: var(--color-speaking);
  animation: pulse 1.5s ease-in-out infinite;
}

.hero-watermark {
  position: absolute;
  inset: 0 0.45rem 0 0.85rem;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  color: var(--text-primary);
  font-size: clamp(3.8rem, 15vw, 8.8rem);
  font-weight: 800;
  line-height: 0.9;
  opacity: 0.045;
  overflow: hidden;
  pointer-events: none;
  text-transform: uppercase;
  white-space: nowrap;
  z-index: 0;
}

.hero-watermark-count {
  margin-left: 0.28em;
  text-transform: none;
}

.dashboard-hero.active .hero-watermark {
  color: var(--color-speaking);
  opacity: 0.075;
}

.hero-content {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  gap: 1rem;
  z-index: 1;
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
  font-size: clamp(2.1rem, 5.4vw, 3.8rem);
  font-weight: 800;
  letter-spacing: 0;
  line-height: 0.95;
  overflow-wrap: anywhere;
}

.speaker-callsign.idle {
  color: var(--text-secondary);
}

.speaker-contact-count {
  color: var(--text-tertiary);
  font-size: clamp(2.1rem, 5.4vw, 3.8rem);
  font-weight: 800;
  line-height: 0.95;
  white-space: nowrap;
}

.speaker-contact-star {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(1.65rem, 4.1vw, 2.7rem);
  height: clamp(1.65rem, 4.1vw, 2.7rem);
  line-height: 1;
}

.speaker-contact-star img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
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
  border: 2px solid var(--text-disabled);
  border-radius: 50%;
  background: var(--alpha-neutral-12);
  color: var(--text-tertiary);
  transform-origin: center;
}

.geo-icon svg {
  display: block;
  width: 1.12rem;
  height: 1.12rem;
  fill: currentColor;
  transform: translateY(-0.08rem);
}

.dashboard-hero.active .geo-icon {
  border-color: var(--color-speaking);
  background: var(--alpha-success-12);
  color: var(--color-speaking);
}

.geo-item strong {
  color: var(--text-primary);
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
  color: var(--text-tertiary);
  font-size: 1.02rem;
  font-weight: 700;
}

.dashboard-hero.active .geo-block strong {
  color: var(--color-speaking);
}

.duration-block .idle-duration {
  color: var(--text-secondary);
}

.duration-block .self-speaking-duration {
  color: var(--color-speaking);
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
  position: relative;
  display: grid;
  place-items: center;
  min-height: 6.7rem;
  color: var(--text-secondary);
  text-align: center;
  z-index: 1;
}

.hero-empty strong,
.hero-empty span {
  display: block;
}

.hero-empty span {
  margin-top: 0.24rem;
  color: var(--text-tertiary);
  font-size: 0.92rem;
}

.hero-empty strong {
  color: var(--text-primary);
  font-size: 1.12rem;
  font-weight: 500;
}

.history-panel {
  overflow: visible;
}

.event-strip-wrap h3,
.history-panel h3 {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
  margin: 0;
  padding: 0.8rem 1rem;
  color: var(--text-primary);
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0;
}

.event-strip-wrap {
  min-width: 0;
  overflow: visible;
}

.event-strip-wrap > .empty-state {
  margin: 0.55rem 0.65rem;
}

.empty-state {
  display: grid;
  grid-column: 1 / -1;
  place-items: center;
  min-height: 6.8rem;
  padding: 1.1rem;
  border: 1px dashed var(--border-light);
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-primary) 3%, transparent);
  color: var(--text-tertiary);
  text-align: center;
}

.empty-state-copy {
  min-width: 0;
}

.empty-state-copy strong,
.empty-state-copy span {
  display: block;
}

.empty-state-copy strong {
  color: var(--text-secondary);
  font-size: 0.96rem;
  font-weight: 500;
}

.empty-state-copy span {
  margin-top: 0.16rem;
  color: var(--text-tertiary);
  font-size: 0.86rem;
}

.event-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr));
  gap: 0.45rem;
  padding: 0.55rem 0.65rem;
  overflow: visible;
}

.event-chip {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 0.45rem;
  min-width: 11.5rem;
  height: 4.5rem;
  padding: 0.7rem 0.6rem;
  padding-right: 2.65rem;
  border-radius: 6px;
  background: color-mix(in srgb, var(--text-primary) 5%, transparent);
  cursor: pointer;
  overflow: hidden;
  transition: background 0.15s;
}

.event-chip.self {
  cursor: default;
}

.event-index-bg {
  position: absolute;
  right: -0.14rem;
  bottom: -0.3rem;
  color: var(--text-primary);
  font-size: 2.6rem;
  font-weight: 800;
  line-height: 1;
  opacity: 0.065;
  pointer-events: none;
  z-index: 0;
}

.event-callsign-line {
  display: flex;
  align-items: center;
  gap: 0.22rem;
  min-width: 0;
}

.event-callsign-line strong {
  min-width: 0;
}

.event-contact-star {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 1.08rem;
  height: 1.08rem;
  pointer-events: none;
}

.event-contact-star img {
  display: block;
  width: 1.08rem;
  height: 1.08rem;
  object-fit: contain;
}

.event-main {
  position: relative;
  align-self: center;
  min-width: 0;
  z-index: 1;
}

.event-main strong,
.history-topline strong {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-weight: 800;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-main strong {
  flex: 0 1 auto;
  font-size: 1.15rem;
}

.event-main > span {
  display: block;
  margin-top: 0.12rem;
  color: var(--text-tertiary);
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
  position: absolute;
  top: 0.48rem;
  right: 0.55rem;
  font-weight: 700;
  z-index: 1;
}

.history-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr));
  gap: 0.65rem;
  padding: 0.65rem;
  overflow: visible;
}

.history-row {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 6.1rem;
  padding: 0.72rem 0.8rem 0.78rem;
  border-left: 3px solid transparent;
  border-radius: 6px;
  background: color-mix(in srgb, var(--text-primary) 5%, transparent);
  cursor: pointer;
  line-height: 1.35;
  overflow: hidden;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.history-index-bg {
  position: absolute;
  top: -0.3rem;
  right: -0.2rem;
  color: var(--text-primary);
  font-size: 4.45rem;
  font-weight: 800;
  line-height: 1;
  opacity: 0.065;
  pointer-events: none;
  z-index: 0;
}

.history-row.active .history-index-bg {
  color: var(--color-speaking);
  opacity: 0.095;
}

.history-row.active {
  border-left-color: var(--color-speaking);
  background: var(--alpha-success-08);
}

.history-row.self {
  cursor: default;
}

@media (hover: hover) {
  .event-chip:hover,
  .history-row:hover {
    background: color-mix(in srgb, var(--text-primary) 7%, transparent);
  }

  .history-row.active:hover {
    background: var(--alpha-success-08);
  }
}

.history-name {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.38rem;
  min-width: 0;
  z-index: 1;
}

.history-topline {
  display: flex;
  align-items: center;
  gap: 0.36rem;
  min-width: 0;
}

.history-topline strong {
  flex: 0 1 auto;
  font-size: 1.36rem;
  font-weight: 800;
  line-height: 1.05;
}

.history-topline strong.on,
.history-state.on,
.history-row.active .contact-count,
.history-row.active .history-duration {
  color: var(--color-speaking);
}

.history-topline .contact-count {
  flex-shrink: 0;
  margin-top: 0;
}

.history-topline .contact-count {
  color: var(--text-tertiary);
  font-size: 1.36rem;
  font-weight: 800;
  line-height: 1.05;
}

.history-topline .self-label {
  display: inline-block;
  font-size: 1.1rem;
  font-weight: 500;
  line-height: 1;
}

.history-contact-star {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 1.18rem;
  height: 1.18rem;
  line-height: 1;
}

.star-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.history-times {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.38rem;
  min-width: 0;
  margin-top: auto;
  white-space: nowrap;
  z-index: 1;
}

.history-state {
  color: var(--text-tertiary);
  font-size: 0.78rem;
  font-weight: 500;
  flex-shrink: 0;
  line-height: 1.2;
}

.history-state.on {
  background: transparent;
}

.history-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.08rem;
  min-height: 1.28rem;
  margin-top: 0;
  font-size: 0.8rem;
  line-height: 1.28;
  overflow: hidden;
}

.history-meta .detail-tag {
  max-width: 100%;
  padding: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
}

.history-address {
  display: block;
  max-width: 100%;
  color: var(--text-tertiary);
  font-size: 0.78rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-duration {
  font-size: 0.9rem;
  font-weight: 600;
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

@media (max-width: 760px) {
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
    min-height: 6rem;
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
    gap: 0.5rem;
    min-height: 5.9rem;
    padding: 0.72rem 0.75rem 0.65rem;
  }

  .history-topline {
    flex-wrap: wrap;
  }

  .empty-state {
    min-height: 6.6rem;
  }
}
</style>
