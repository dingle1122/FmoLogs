<template>
  <div ref="resultSectionRef" class="result-section">
    <table class="data-table">
      <thead>
        <tr>
          <th v-for="col in displayColumns" :key="col" :class="'col-' + col">
            {{ ColumnNames[col] || col }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!dbLoaded" class="empty-row">
          <td :colspan="displayColumns.length" class="empty-cell">
            请点击右上角设置图标选择日志目录
          </td>
        </tr>
        <tr v-else-if="queryResult && queryResult.data.length === 0" class="empty-row">
          <td :colspan="displayColumns.length" class="empty-cell">暂无数据</td>
        </tr>
        <template v-else-if="queryResult">
          <tr
            v-for="(row, index) in queryResult.data"
            :key="index"
            :class="{ 'row-today': isTodayContact(row.timestamp) }"
            @click="$emit('show-detail', row)"
          >
            <td
              v-for="col in queryResult.columns"
              :key="col"
              :class="[
                'col-' + col,
                col === 'dailyIndex' && row.dailyIndex === 1 ? 'rank-bg-1' : '',
                col === 'dailyIndex' && row.dailyIndex === 2 ? 'rank-bg-2' : '',
                col === 'dailyIndex' && row.dailyIndex === 3 ? 'rank-bg-3' : '',
                col === 'dailyIndex' && isTodayContact(row.timestamp) && row.dailyIndex > 3 ? 'today-index' : ''
              ]"
            >
              <template v-if="col === 'timestamp'">
                <div class="timestamp-div">
                  <div>{{ formatDatePart(formatTimestamp(row[col])) }}</div>
                  <div>{{ formatTimePart(formatTimestamp(row[col])) }}</div>
                </div>
              </template>
              <template v-else-if="col === 'dailyIndex'">
                <div class="daily-index-cell">
                  <span
                    class="daily-index"
                    :class="{
                      'rank-1': row.dailyIndex === 1,
                      'rank-2': row.dailyIndex === 2,
                      'rank-3': row.dailyIndex === 3
                    }"
                    >#{{ row.dailyIndex }}</span
                  >
                </div>
              </template>
              <template v-else-if="col === 'freqHz'">
                {{ formatFreqHz(row[col]) }}
              </template>
              <template v-else-if="col === 'relayName'">
                <div class="relay-cell">
                  <div>{{ row.relayName }}</div>
                  <div class="relay-admin">（{{ row.relayAdmin }}）</div>
                </div>
              </template>
              <template v-else-if="col === 'toCallsign'">
                <div class="callsign-with-grid">
                  <div class="callsign-main">
                    {{ row.toCallsign }}
                    <span v-if="contactCounts.get(row.toCallsign)" class="contact-count">
                      x{{ contactCounts.get(row.toCallsign) }}
                    </span>
                  </div>
                  <div v-if="row.toGrid || gridAddressMap[row.toGrid]" class="callsign-grid">
                    <span v-if="row.toGrid">{{ row.toGrid }}</span>
                    <span v-if="row.toGrid && gridAddressMap[row.toGrid]">&nbsp;</span>
                    <span v-if="gridAddressMap[row.toGrid]" class="callsign-address">{{ gridAddressMap[row.toGrid] }}</span>
                  </div>
                </div>
              </template>
              <template v-else-if="col === 'fromCallsign'">
                <div class="callsign-with-grid">
                  <div>{{ row.fromCallsign }}</div>
                  <div v-if="row.fromGrid" class="callsign-grid">{{ row.fromGrid }}</div>
                </div>
              </template>
              <template v-else>
                {{ row[col] }}
              </template>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <!-- 滚动加载观察器（仅移动端显示） -->
    <div
      v-if="dbLoaded && queryResult && queryResult.data.length > 0"
      ref="loadMoreRef"
      class="load-more-trigger"
    >
      <template v-if="loadingMore">
        <span class="loading-spinner"></span>
        加载中...
      </template>
      <template v-else-if="!hasMore"> 没有更多数据 </template>
    </div>
  </div>
</template>

<script setup>
/* global IntersectionObserver */
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue'
import { ColumnNames, formatTimestamp, formatFreqHz, isTodayContact } from './constants'
import { gridToAddress } from '../../services/gridService.js'

const props = defineProps({
  queryResult: {
    type: Object,
    default: null
  },
  displayColumns: {
    type: Array,
    required: true
  },
  dbLoaded: {
    type: Boolean,
    default: false
  },
  loadingMore: {
    type: Boolean,
    default: false
  },
  hasMore: {
    type: Boolean,
    default: true
  },
  contactCounts: {
    type: Map,
    default: () => new Map()
  }
})

const emit = defineEmits(['show-detail', 'load-more'])

const gridAddressMap = reactive({})

function formatGridAddress(data) {
  if (!data) return ''
  return data.city || data.province || ''
}

async function loadGridAddresses() {
  if (!props.queryResult?.data) return
  const grids = new Set()
  for (const row of props.queryResult.data) {
    if (row.toGrid) grids.add(row.toGrid)
  }
  for (const grid of grids) {
    if (gridAddressMap[grid]) continue
    try {
      const result = await gridToAddress(grid)
      gridAddressMap[grid] = formatGridAddress(result)
    } catch {
      gridAddressMap[grid] = ''
    }
  }
}

watch(() => props.queryResult, loadGridAddresses, { immediate: true, deep: true })

const resultSectionRef = ref(null)
const loadMoreRef = ref(null)
let observer = null

function isMobile() {
  return window.innerWidth <= 768
}

function setupObserver() {
  if (!isMobile() || !loadMoreRef.value) return

  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]
      if (entry.isIntersecting && !props.loadingMore && props.hasMore) {
        emit('load-more')
      }
    },
    {
      root: isMobile() ? null : resultSectionRef.value,
      rootMargin: '100px',
      threshold: 0
    }
  )
  observer.observe(loadMoreRef.value)
}

function cleanupObserver() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
}

onMounted(() => {
  setupObserver()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  cleanupObserver()
  window.removeEventListener('resize', handleResize)
})

function handleResize() {
  cleanupObserver()
  if (isMobile() && loadMoreRef.value) {
    setupObserver()
  }
}

watch(
  () => props.queryResult,
  () => {
    // 数据变化后重新设置观察器
    cleanupObserver()
    setTimeout(() => {
      if (isMobile() && loadMoreRef.value) {
        setupObserver()
      }
    }, 100)
  }
)

function formatDatePart(dateTimeStr) {
  if (!dateTimeStr) return ''
  return dateTimeStr.split(' ')[0]
}

function formatTimePart(dateTimeStr) {
  if (!dateTimeStr) return ''
  return dateTimeStr.split(' ')[1]
}
</script>

<style scoped>
.result-section {
  margin-top: 1rem;
  flex: 1;
  overflow: auto;
}

.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.9rem;
  table-layout: fixed;
}

.data-table th,
.data-table td {
  border-bottom: 1px solid #b0b0b0;
  border-right: 1px solid #b0b0b0;
  padding: 0.5rem;
  text-align: left;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.data-table th:first-child,
.data-table td:first-child {
  border-left: 1px solid #b0b0b0;
}

.data-table th {
  background: var(--bg-table-header);
  font-weight: bold;
  position: sticky;
  top: 0;
  z-index: 1;
  text-align: center;
  border-top: 1px solid #b0b0b0;
}

/* 列宽设置 */
.col-timestamp {
  width: 120px;
  text-align: center;
  vertical-align: middle;
  line-height: 1.2;
}
.col-dailyIndex {
  width: 60px;
  text-align: center;
  vertical-align: middle;
}
.col-freqHz {
  width: 95px;
}
.col-fromCallsign {
  width: 100px;
}
.col-fromGrid {
  width: 100px;
}
.col-toCallsign {
  width: 210px;
}
.col-toGrid {
  width: 100px;
}
.col-toComment {
  width: auto;
}
.col-mode {
  width: 80px;
}
.col-relayName {
  width: 130px;
  text-align: center;
  vertical-align: middle;
}
.col-count {
  width: 60px;
}

.timestamp-div {
  display: block;
  white-space: nowrap;
  text-align: center;
}

.relay-cell {
  text-align: center;
}

.relay-admin {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.callsign-with-grid {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.callsign-main {
  font-weight: bold;
  font-size: 1.1rem;
}

.callsign-grid {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.callsign-address {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 400;
}

.contact-count {
  font-size: 1rem;
  font-weight: 400;
  color: var(--text-tertiary);
  margin-left: 0.3rem;
}

.daily-index {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-primary);
}

.daily-index.rank-1 {
  color: #c69500;
  font-weight: 700;
}

.daily-index.rank-2 {
  color: #5c6b7f;
  font-weight: 700;
}

.daily-index.rank-3 {
  color: #a0522d;
  font-weight: 700;
}

/* ========== 序号列背景色（按优先级分层） ========== */

/* 基础层：默认序号列 */
.data-table tbody td.col-dailyIndex {
  background-color: #e8eaf0;
}

/* 状态层：今日通联行 */
.data-table tbody tr.row-today td {
  background-color: #d9f2c8;
  border-color: #6aaa50;
}

.data-table tbody tr.row-today td.col-dailyIndex,
.data-table tbody tr.row-today td.col-dailyIndex.today-index {
  background-color: #a3d184;
}

/* 特殊层：排名 & today-index（覆盖所有状态） */
.data-table tbody tr td.col-dailyIndex.rank-bg-1 {
  background-color: #f5e6a3;
}
.data-table tbody tr td.col-dailyIndex.rank-bg-2 {
  background-color: #d0d4db;
}
.data-table tbody tr td.col-dailyIndex.rank-bg-3 {
  background-color: #f0c898;
}
.data-table tbody tr td.col-dailyIndex.today-index {
  background-color: #f0fdf4;
}

/* 交互层：hover */
.data-table tbody tr:hover:not(.empty-row) td {
  background-color: var(--bg-table-hover);
  cursor: pointer;
}

.data-table tbody tr:hover:not(.empty-row) td.col-dailyIndex[class*='rank-bg'],
.data-table tbody tr:hover:not(.empty-row) td.col-dailyIndex.today-index {
  background-color: var(--bg-table-hover);
}

.daily-index-cell {
  display: flex;
  justify-content: center;
  align-items: center;
}

.data-table tbody tr {
  line-height: 1.6;
}

.empty-row .empty-cell {
  text-align: center;
  color: var(--text-tertiary);
  padding: 3rem;
}

/* 滚动加载提示 */
.load-more-trigger {
  display: none;
  text-align: center;
  padding: 1rem;
  color: var(--text-tertiary);
  font-size: 0.9rem;
}

.loading-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-primary);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 0.5rem;
  vertical-align: middle;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-color-scheme: dark) {
  /* 恢复深色模式边框 */
  .data-table th,
  .data-table td,
  .data-table th:first-child,
  .data-table td:first-child {
    border-color: #404040;
  }

  /* 基础层：默认序号列 */
  .data-table tbody td.col-dailyIndex {
    background-color: #363636;
  }

  /* 状态层：今日通联行 */
  .data-table tbody tr.row-today td {
    background-color: #2d5a2d;
    border-color: #1a3a1a;
  }

  .data-table tbody tr.row-today td.col-dailyIndex,
  .data-table tbody tr.row-today td.col-dailyIndex.today-index {
    background-color: #254a25;
  }

  /* 特殊层：排名 & today-index */
  .data-table tbody tr td.col-dailyIndex.rank-bg-1 {
    background-color: #5c4a1a;
  }
  .data-table tbody tr td.col-dailyIndex.rank-bg-2 {
    background-color: #4a4a4a;
  }
  .data-table tbody tr td.col-dailyIndex.rank-bg-3 {
    background-color: #5c3a1a;
  }
  .data-table tbody tr td.col-dailyIndex.today-index {
    background-color: #1a3a1a;
  }
}

@media (max-width: 1024px) {
  .col-freqHz,
  .col-fromCallsign,
  .col-mode,
  .col-relayName {
    display: none;
  }
}

@media (max-width: 768px) {
  .result-section {
    margin-top: 0.5rem;
    overflow: visible;
  }

  .data-table {
    font-size: 0.8rem;
  }

  .data-table th,
  .data-table td {
    padding: 0.4rem;
  }

  .col-toComment {
    display: none;
  }

  .load-more-trigger {
    display: block;
  }
}

@media (max-width: 480px) {
  .col-freqHz,
  .col-fromCallsign,
  .col-toComment,
  .col-mode,
  .col-relayName {
    display: none;
  }

  .col-timestamp,
  .col-toCallsign {
    display: table-cell;
  }

  .col-timestamp {
    width: 90px;
  }
}
</style>
