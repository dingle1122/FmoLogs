<template>
  <div class="location-view">
    <div class="location-content">

      <!-- FMO 当前坐标 -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">FMO 当前坐标</span>
          <button class="btn-refresh" @click="handleFetchFmo">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            刷新
          </button>
        </div>
        <div v-if="store.fmoCoordinate" class="coord-display">
          <div class="coord-row">
            <span class="coord-label">纬度</span>
            <span class="coord-value">{{ store.fmoCoordinate.lat.toFixed(6) }}</span>
          </div>
          <div class="coord-row">
            <span class="coord-label">经度</span>
            <span class="coord-value">{{ store.fmoCoordinate.lng.toFixed(6) }}</span>
          </div>
        </div>
        <div v-else class="card-empty">点击刷新获取 FMO 当前坐标</div>
      </div>

      <!-- 当前 GPS 定位 -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">当前 GPS 定位</span>
          <button class="btn-refresh" @click="handleRefreshGps">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
            </svg>
            获取定位
          </button>
        </div>
        <div v-if="store.currentGps" class="coord-display">
          <div class="coord-row">
            <span class="coord-label">纬度</span>
            <span class="coord-value">{{ store.currentGps.lat.toFixed(6) }}</span>
          </div>
          <div class="coord-row">
            <span class="coord-label">经度</span>
            <span class="coord-value">{{ store.currentGps.lng.toFixed(6) }}</span>
          </div>
        </div>
        <div v-else class="card-empty">点击获取当前 GPS 定位</div>
      </div>

      <!-- 自动上报控制 -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">自动上报</span>
        </div>

        <div class="setting-row">
          <span class="setting-label">开启自动上报</span>
          <label class="toggle-switch">
            <input
              type="checkbox"
              :checked="store.enabled"
              @change="store.toggleEnabled()"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="setting-row interval-row">
          <span class="setting-label">上报间隔</span>
          <input
            type="range"
            min="0"
            :max="SLIDER_MAX"
            v-model="sliderValue"
            class="interval-slider"
            :style="{
              background: `linear-gradient(to right, var(--color-primary, #409eff) 0%, var(--color-primary, #409eff) ${(sliderValue / SLIDER_MAX) * 100}%, var(--border-primary) ${(sliderValue / SLIDER_MAX) * 100}%, var(--border-primary) 100%)`
            }"
            @change="handleSliderChange"
          />
          <span class="interval-current">{{ displayLabel }}</span>
        </div>

        <div class="setting-row-actions">
          <button
            class="btn-primary"
            @click="handleManualReport"
          >
            立即上报
          </button>
        </div>
      </div>

      <!-- 状态 -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">上报状态</span>
        </div>
        <div v-if="store.lastReportTime" class="status-info">
          <div class="status-row">
            <span class="status-label">上次上报</span>
            <span class="status-value">{{ store.lastReportTime }}</span>
          </div>
          <div class="status-row">
            <span class="status-label">结果</span>
            <span
              class="status-value"
              :class="{ 'text-success': store.lastReportResult?.includes('成功'), 'text-danger': store.lastReportResult?.includes('失败') }"
            >{{ store.lastReportResult }}</span>
          </div>
        </div>
        <div v-else class="card-empty">尚未上报</div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useLocationStore } from '../stores/locationStore'
import { SLIDER_POSITIONS } from '../stores/locationStore'

const store = useLocationStore()
const SLIDER_MAX = 100

// 滑块当前值（v-model 双向绑定，拖拽时实时更新，松手时吸附）
const sliderValue = ref(SLIDER_POSITIONS[store.getIntervalIndex()])

// 监听 store 间隔变化（如外部修改），同步滑块位置
watch(() => store.intervalSeconds, () => {
  const idx = store.getIntervalIndex()
  sliderValue.value = SLIDER_POSITIONS[idx]
})

// 将滑块位置 (0-100) 映射到最近的有效选项索引
function sliderToIndex(pos) {
  let nearest = 0
  let minDist = Infinity
  for (let i = 0; i < SLIDER_POSITIONS.length; i++) {
    const dist = Math.abs(SLIDER_POSITIONS[i] - pos)
    if (dist < minDist) {
      minDist = dist
      nearest = i
    }
  }
  return nearest
}

// 松手时吸附到最近有效位置并应用
function handleSliderChange(e) {
  const pos = Number(e.target.value)
  const idx = sliderToIndex(pos)
  const snapped = SLIDER_POSITIONS[idx]
  sliderValue.value = snapped
  store.setIntervalByIndex(idx)
}

// 根据滑块位置实时显示对应的标签文字
const displayLabel = computed(() => {
  const idx = sliderToIndex(sliderValue.value)
  return store.INTERVAL_OPTIONS[idx].label
})

async function handleFetchFmo() {
  await store.fetchFmoCoordinate()
}

async function handleRefreshGps() {
  await store.refreshGps()
}

async function handleManualReport() {
  await store.reportLocation()
}

onMounted(() => {
  store.init()
})

onUnmounted(() => {
  store.teardown()
})
</script>

<style scoped>
.location-view {
  height: 100%;
  overflow-y: auto;
  padding: 1.5rem;
}

.location-content {
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 卡片 */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 1rem 1.25rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.card-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  font-size: 0.8rem;
  background: none;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-refresh:hover {
  background: var(--color-primary);
  color: var(--text-white);
}

.card-empty {
  color: var(--text-tertiary);
  font-size: 0.85rem;
  padding: 0.5rem 0;
}

/* 坐标显示 */
.coord-display {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.coord-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0;
}

.coord-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  min-width: 2.5em;
}

.coord-value {
  font-family: 'IntelOneMono', monospace;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-primary);
}

/* 设置行 */
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0;
}

.setting-row + .setting-row {
  /* interval-row 已同行，无需分隔线 */
}

.setting-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
}

.setting-row-actions {
  padding-top: 0.5rem;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  cursor: pointer;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--border-primary);
  border-radius: 24px;
  transition: all 0.3s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: all 0.3s;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: var(--color-success);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

/* 间隔滑块 - 同行布局 */
.setting-row.interval-row {
  flex-wrap: nowrap;
  padding: 0.6rem 0;
}

.interval-row .setting-label {
  flex-shrink: 0;
}

.interval-slider {
  flex: 1;
  margin: 0 0.75rem;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border-primary);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.interval-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-primary, #409eff);
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.interval-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-primary, #409eff);
  border: none;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.interval-current {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-primary);
}

/* 按钮 */
.btn-primary {
  width: 100%;
  padding: 0.6rem 1rem;
  font-size: 0.9rem;
  background: var(--color-primary);
  color: var(--text-white);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 状态 */
.status-info {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.3rem 0;
}

.status-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  min-width: 4.5em;
}

.status-value {
  font-size: 0.9rem;
  color: var(--text-primary);
}

.text-success {
  color: var(--color-success);
}

.text-danger {
  color: var(--color-danger);
}

/* 移动端 */
@media (max-width: 768px) {
  .location-view {
    padding: 1rem;
  }

  .card {
    padding: 0.875rem 1rem;
  }

  .card-title {
    font-size: 0.9rem;
  }
}
</style>
