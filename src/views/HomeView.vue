<template>
  <div class="container">
    <header class="header">
      <div class="header-left">
        <h1>FMO 日志查看器</h1>
        <span class="total-logs"
          ><span class="star">&#11088;</span> <strong>{{ totalLogs }}</strong></span
        >
      </div>
      <div class="header-actions">
        <a
          href="https://github.com/dingle1122/FmoLogs"
          target="_blank"
          rel="noopener noreferrer"
          class="icon-btn"
          title="GitHub"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path
              d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
            />
          </svg>
        </a>
        <button class="icon-btn" title="设置" @click="showSettings = true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path
              d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
            />
          </svg>
        </button>
      </div>
    </header>

    <div class="content-area">
      <div v-if="loading" class="loading">加载中...</div>

      <div v-if="error" class="error">{{ error }}</div>

      <div class="query-section">
        <div class="query-row">
          <div class="query-types">
            <label v-for="(name, type) in QueryTypeNames" :key="type">
              <input
                v-model="currentQueryType"
                type="radio"
                :value="type"
                :disabled="!dbLoaded"
                @change="handleQueryTypeChange"
              />
              {{ name }}
            </label>
          </div>
          <div v-if="currentQueryType === 'all'" class="search-box">
            <input
              v-model="searchKeyword"
              type="text"
              placeholder="接收方呼号"
              :disabled="!dbLoaded"
              @input="onSearchInput"
            />
          </div>
        </div>
      </div>

      <!-- TOP20汇总视图 -->
      <div v-if="currentQueryType === 'top20Summary'" class="top20-container">
        <div v-if="!dbLoaded" class="empty-hint">请点击右上角设置图标选择日志目录</div>
        <template v-else-if="top20Result">
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
          <div class="top20-card">
            <h3>
              中继名称 TOP20
              <span class="info-icon" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave" @click="toggleTooltip">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <div v-if="showTooltip" :class="tooltipClass" :style="tooltipStyle" @mouseenter="handleTooltipMouseEnter" @mouseleave="handleTooltipMouseLeave">
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

      <!-- 原有表格视图 -->
      <div v-else class="result-section">
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
              <tr v-for="(row, index) in queryResult.data" :key="index" @click="showDetailModal(row)">
                <td v-for="col in queryResult.columns" :key="col" :class="'col-' + col">
                  <template v-if="col === 'timestamp'">
                    <div class="timestamp-div">
                      <div>{{ formatDatePart(formatTimestamp(row[col])) }}</div>
                      <div>{{ formatTimePart(formatTimestamp(row[col])) }}</div>
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
                  <template v-else>
                    {{ row[col] }}
                  </template>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="currentQueryType === 'all'" class="pagination">
        <button :disabled="!dbLoaded || currentPage === 1" @click="goToPage(1)" class="hidden-on-small">首页</button>
        <button :disabled="!dbLoaded || currentPage === 1" @click="goToPage(currentPage - 1)">
          上一页
        </button>
        <span class="page-info">
          第 {{ currentPage }} / {{ totalPages }} 页 (共 {{ totalRecords }} 条)
        </span>
        <button
          :disabled="!dbLoaded || currentPage === totalPages || totalPages === 0"
          @click="goToPage(currentPage + 1)"
        >
          下一页
        </button>
        <button
          :disabled="!dbLoaded || currentPage === totalPages || totalPages === 0"
          @click="goToPage(totalPages)"
          class="hidden-on-small"
        >
          末页
        </button>
      </div>
    </div>

    <!-- 详情弹框 -->
    <div v-if="showDetailModalFlag" class="modal-overlay" @click.self="showDetailModalFlag = false">
      <div class="modal modal-detail">
        <div class="modal-header">
          <h3>详细信息</h3>
          <button class="close-btn" @click="showDetailModalFlag = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="detail-item" v-for="(value, key) in filteredSelectedRowData" :key="key">
            <span class="detail-label">{{ ColumnNames[key] || key }}：</span>
            <span class="detail-value">
              <template v-if="key === 'timestamp'">
                {{ formatTimestamp(value) }}
              </template>
              <template v-else-if="key === 'freqHz'">
                {{ formatFreqHz(value) }}
              </template>
              <template v-else-if="key === 'relayName'">
                <div class="relay-cell">
                  <div>{{ value }}</div>
                  <div class="relay-admin" v-if="selectedRowData['relayAdmin']">（{{ selectedRowData['relayAdmin'] }}）</div>
                </div>
              </template>
              <template v-else>
                {{ value }}
              </template>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 设置弹框 -->
    <div v-if="showSettings" class="modal-overlay" @click.self="showSettings = false">
      <div class="modal">
        <div class="modal-header">
          <h3>设置</h3>
          <button class="close-btn" @click="showSettings = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="setting-item">
            <span class="setting-label">日志文件</span>
            <div class="setting-actions">
              <button v-if="canSelectDirectory" class="btn-primary" @click="selectDirectory">
                {{ dbLoaded ? '重新选择目录' : '选择目录' }}
              </button>
              <button class="btn-primary" @click="triggerFileInput">
                {{ dbLoaded && !canSelectDirectory ? '重新选择文件' : '选择文件' }}
              </button>
              <button v-if="dbLoaded" class="btn-secondary" @click="clearDirectory">清除</button>
            </div>
          </div>
          <div v-if="dbLoaded" class="setting-info">已加载 {{ dbCount }} 个数据库文件</div>
        </div>
      </div>
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".db"
      multiple
      style="display: none"
      @change="handleFileSelect"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  scanDirectory,
  DatabaseManager,
  QueryTypes,
  QueryTypeNames,
  ColumnNames,
  formatTimestamp,
  formatFreqHz,
  getSavedDirHandle,
  loadDbFilesFromHandle,
  clearDirHandle,
  supportsDirectoryPicker,
  loadDbFilesFromFileList
} from '../services/db'

const PAGE_SIZE = 10

/* 默认列（查看所有模式） */
const DEFAULT_COLUMNS = [
  'timestamp',
  'toCallsign',
  'toGrid',
  'freqHz',
  'fromCallsign',
  'fromGrid',
  'toComment',
  'mode',
  'relayName'
]

const dbManager = new DatabaseManager()

const dbLoaded = ref(false)
const dbCount = ref(0)
const totalLogs = ref(0)
const loading = ref(false)
const error = ref(null)
const currentQueryType = ref(QueryTypes.ALL)
const currentPage = ref(1)
const queryResult = ref(null)
const top20Result = ref(null)
const showSettings = ref(false)
const searchKeyword = ref('')
const fileInputRef = ref(null)
const showDetailModalFlag = ref(false)
const selectedRowData = ref(null)
const showTooltip = ref(false)
const tooltipStyle = ref({})
const tooltipClass = computed(() => {
  // 根据样式中的top/bottom值判断位置
  if (tooltipStyle.value.top && tooltipStyle.value.top !== 'auto') {
    return 'tooltip tooltip-bottom'
  } else {
    return 'tooltip'
  }
})

// 过滤掉不显示在详情中的字段
const filteredSelectedRowData = computed(() => {
  if (!selectedRowData.value) return {}
  
  const filtered = {}
  Object.keys(selectedRowData.value).forEach(key => {
    if (key !== 'logId' && key !== 'relayAdmin') {
      filtered[key] = selectedRowData.value[key]
    }
  })
  
  return filtered
})

// 检测是否支持目录选择
const canSelectDirectory = supportsDirectoryPicker()

// 计算当前显示的列
const displayColumns = computed(() => {
  if (queryResult.value) {
    return queryResult.value.columns
  }
  return DEFAULT_COLUMNS
})

// 计算总页数
const totalPages = computed(() => {
  if (queryResult.value && queryResult.value.totalPages) {
    return queryResult.value.totalPages
  }
  return 0
})

// 计算总记录数
const totalRecords = computed(() => {
  if (queryResult.value) {
    return queryResult.value.total
  }
  return 0
})

// 页面加载时尝试恢复已保存的目录
onMounted(async () => {
  await tryRestoreDirectory()
})

async function tryRestoreDirectory() {
  try {
    const savedHandle = await getSavedDirHandle()
    if (savedHandle) {
      loading.value = true
      const dbFiles = await loadDbFilesFromHandle(savedHandle)
      if (dbFiles.length > 0) {
        await loadDatabases(dbFiles)
      }
      loading.value = false
    }
  } catch {
    // 权限可能已失效，忽略错误
    loading.value = false
  }
}

async function loadDatabases(dbFiles) {
  dbManager.close()
  const count = await dbManager.loadDatabases(dbFiles)

  if (count === 0) {
    error.value = '没有成功加载任何数据库文件'
    return
  }

  dbCount.value = count
  totalLogs.value = dbManager.totalLogs
  dbLoaded.value = true
  currentQueryType.value = QueryTypes.ALL
  currentPage.value = 1

  executeQuery()
}

async function selectDirectory() {
  loading.value = true
  error.value = null
  queryResult.value = null
  showSettings.value = false

  try {
    const dbFiles = await scanDirectory()
    if (dbFiles === null) {
      loading.value = false
      return
    }

    if (dbFiles.length === 0) {
      error.value = '所选目录中没有找到 .db 文件'
      loading.value = false
      return
    }

    await loadDatabases(dbFiles)
  } catch (err) {
    error.value = `加载失败: ${err.message}`
  }

  loading.value = false
}

async function clearDirectory() {
  await clearDirHandle()
  dbManager.close()
  dbLoaded.value = false
  dbCount.value = 0
  totalLogs.value = 0
  queryResult.value = null
  showSettings.value = false
  searchKeyword.value = ''
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

async function handleFileSelect(event) {
  const files = event.target.files
  if (!files || files.length === 0) return

  loading.value = true
  error.value = null
  queryResult.value = null
  showSettings.value = false

  try {
    const dbFiles = await loadDbFilesFromFileList(files)
    if (dbFiles.length === 0) {
      error.value = '所选文件中没有有效的 .db 文件'
      loading.value = false
      return
    }

    await loadDatabases(dbFiles)
  } catch (err) {
    error.value = `加载失败: ${err.message}`
  }

  loading.value = false
  event.target.value = ''
}

function handleQueryTypeChange() {
  searchKeyword.value = ''
  currentPage.value = 1
  executeQuery()
}

// 防抖定时器
let searchTimer = null

function onSearchInput() {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    executeQuery()
  }, 300)
}

function executeQuery() {
  if (!dbLoaded.value) return

  loading.value = true
  error.value = null

  try {
    if (currentQueryType.value === QueryTypes.TOP20_SUMMARY) {
      top20Result.value = dbManager.query(currentQueryType.value)
      queryResult.value = null
    } else if (currentQueryType.value === QueryTypes.ALL) {
      queryResult.value = dbManager.query(
        currentQueryType.value,
        currentPage.value,
        PAGE_SIZE,
        searchKeyword.value.trim()
      )
      top20Result.value = null
    } else {
      currentPage.value = 1
      queryResult.value = dbManager.query(currentQueryType.value)
      top20Result.value = null
    }
  } catch (err) {
    error.value = `查询失败: ${err.message}`
    queryResult.value = null
    top20Result.value = null
  }

  loading.value = false
}

function goToPage(page) {
  if (!queryResult.value || page < 1 || page > queryResult.value.totalPages) return
  currentPage.value = page
  executeQuery()
}

function formatDatePart(dateTimeStr) {
  if (!dateTimeStr) return ''
  return dateTimeStr.split(' ')[0]  // 只返回日期部分 (YYYY-MM-DD)
}

function formatTimePart(dateTimeStr) {
  if (!dateTimeStr) return ''
  return dateTimeStr.split(' ')[1]  // 只返回时间部分 (HH:MM:SS)
}

function showDetailModal(row) {
  selectedRowData.value = row
  showDetailModalFlag.value = true
}

function toggleTooltip(event) {
  showTooltip.value = !showTooltip.value
  // 如果显示提示框，则检测位置
  if (showTooltip.value) {
    setTimeout(() => {
      adjustTooltipPosition(event)
    }, 0)
  }
}

function adjustTooltipPosition(event) {
  if (!showTooltip.value) return
  
  // 这里我们使用setTimeout确保DOM已经更新
  setTimeout(() => {
    const iconEl = event?.target?.closest('.info-icon') || event?.target
    
    if (iconEl) {
      const iconRect = iconEl.getBoundingClientRect()
      
      // 由于使用fixed定位，直接设置相对于视口的位置
      const iconCenterX = iconRect.left + iconRect.width / 2
      
      // 检查上方是否有足够空间显示提示框
      if (iconRect.top < 40) { // 预留一定空间
        // 如果上方空间不足，添加data-position属性让提示框显示在下方
        // 设置位置在图标下方
        tooltipStyle.value = {
          left: `${iconCenterX}px`,
          top: `${iconRect.bottom + 8}px`,
          bottom: 'auto',
        }
      } else {
        // 设置位置在图标上方
        tooltipStyle.value = {
          left: `${iconCenterX}px`,
          bottom: `${window.innerHeight - iconRect.top + 8}px`,
          top: 'auto',
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
  // 延迟隐藏，让用户有机会将鼠标移到提示框上
  setTimeout(() => {
    if (!isMouseOverTooltip) {
      showTooltip.value = false
    }
  }, 300)
}

// 跟踪鼠标是否在提示框上
let isMouseOverTooltip = false

function handleTooltipMouseEnter() {
  isMouseOverTooltip = true
}

function handleTooltipMouseLeave() {
  isMouseOverTooltip = false
  showTooltip.value = false
}

onUnmounted(() => {
  dbManager.close()
})
</script>

<style scoped>
.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.header {
  flex-shrink: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: white;
  border-bottom: 1px solid #eee;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header h1 {
  margin: 0;
}

.total-logs {
  font-size: 1.1rem;
  color: #606266;
}

.star {
  font-size: 1.5rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  color: #606266;
  border-radius: 4px;
  text-decoration: none;
}

.icon-btn:hover {
  background: #f5f7fa;
  color: #409eff;
}

.content-area {
  flex: 1;
  overflow: hidden;
  padding: 1rem;
  display: flex;
  flex-direction: column;
}

.query-section {
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.query-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.query-types {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.query-types label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
}

.query-types input:disabled + span {
  color: #c0c4cc;
}

.search-box {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.search-box input {
  padding: 0.4rem 0.8rem;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 0.9rem;
  width: 150px;
}

.search-box input:focus {
  outline: none;
  border-color: #409eff;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.error {
  padding: 1rem;
  background: #fef0f0;
  color: #f56c6c;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.result-section {
  margin-top: 1rem;
  flex: 1;
  overflow: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  table-layout: fixed;
}

.data-table th,
.data-table td {
  border: 1px solid #ddd;
  padding: 0.5rem;
  text-align: left;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.data-table th {
  background: #f5f7fa;
  font-weight: bold;
  position: sticky;
  top: 0;
  z-index: 1;
}

/* 列宽设置 */
.col-timestamp {
  width: 120px;
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
  width: 100px;
}
.col-toGrid {
  width: 100px;
}
.col-toComment {
  width: auto;
}
.col-mode {
  width: 50px;
}
.col-relayName {
  width: 130px;
  text-align: center;
  vertical-align: middle;
}
.col-count {
  width: 60px;
}

/* 日期单元格样式 */
.col-timestamp {
  text-align: center;
  vertical-align: middle;
  line-height: 1.2;
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
  color: #909399;
  font-size: 0.85rem;
}

.modal-detail .relay-cell {
  text-align: left;
}

.data-table tbody tr:hover:not(.empty-row) {
  background: #f5f7fa;
}

.data-table tbody tr {
  line-height: 1.6;
}

.empty-row .empty-cell {
  text-align: center;
  color: #909399;
  padding: 3rem;
}

.pagination {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 0;
  background: white;
  border-top: 1px solid #eee;
  flex-wrap: nowrap;
  min-height: 50px;
}

.pagination button {
  padding: 0.4rem 0.8rem;
  border: 1px solid #dcdfe6;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.pagination button:hover:not(:disabled) {
  background: #f5f7fa;
}

.pagination button:disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}

.page-info {
  margin: 0 1rem;
  color: #606266;
  white-space: nowrap;
  flex-shrink: 0;
}

/* 弹框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  min-width: 320px;
  max-width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-detail {
  max-width: 600px;
  max-height: 80vh;
  overflow: auto;
}

.detail-item {
  display: flex;
  margin-bottom: 0.8rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid #eee;
}

.detail-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.detail-label {
  flex: 0 0 120px;
  font-weight: 500;
  color: #606266;
}

.detail-value {
  flex: 1;
  color: #333;
  word-break: break-all;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #909399;
  line-height: 1;
}

.close-btn:hover {
  color: #606266;
}

.modal-body {
  padding: 1.5rem;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.setting-label {
  font-weight: 500;
}

.setting-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-primary {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  background: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-primary:hover {
  background: #337ecc;
}

.btn-secondary {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  background: white;
  color: #606266;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
}

.btn-secondary:hover {
  background: #f5f7fa;
}

.setting-info {
  margin-top: 1rem;
  color: #67c23a;
  font-size: 0.9rem;
}

/* TOP20汇总样式 */
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
  color: #909399;
  padding: 3rem;
}

.top20-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: visible;
  display: flex;
  flex-direction: column;
  max-height: 100%;
}

.disclaimer {
  grid-column: 1 / -1;
  text-align: center;
  color: #909399;
  font-size: 0.85rem;
  padding: 1rem 0;
  margin-top: 1rem;
  border-top: 1px dashed #ebeef5;
}

.top20-card h3 {
  margin: 0;
  padding: 0.75rem 1rem;
  background: #f5f7fa;
  font-size: 0.95rem;
  border-bottom: 1px solid #ebeef5;
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
  color: #909399;
  transition: color 0.2s ease;
}

.info-icon:hover svg {
  color: #409eff;
}

.tooltip {
  position: fixed;
  top: auto;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: white;
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

/* 当上方空间不足时，显示在下方 */
.tooltip-bottom {
  top: calc(100% + 8px);
  bottom: auto;
  white-space: normal;
  word-wrap: break-word;
  word-break: break-word;
}

.tooltip-bottom::before {
  top: -12px;
  border-color: transparent transparent #333 transparent;
}

.tooltip::before {
  content: '';
  position: fixed;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 6px;
  border-style: solid;
  border-color: #333 transparent transparent transparent;
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
  background: #f5f7fa;
}

.top20-item .rank {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f2f5;
  border-radius: 50%;
  font-size: 0.85rem;
  color: #606266;
  flex-shrink: 0;
  margin-right: 0.75rem;
}

.top20-item:nth-child(1) .rank {
  background: #ffd700;
  color: #fff;
}

.top20-item:nth-child(2) .rank {
  background: #c0c0c0;
  color: #fff;
}

.top20-item:nth-child(3) .rank {
  background: #cd7f32;
  color: #fff;
}

.top20-item .name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top20-item .relay-admin {
  color: #909399;
  font-size: 0.85rem;
}

.top20-item .count {
  flex-shrink: 0;
  margin-left: 0.5rem;
  color: #409eff;
}

.empty-item {
  text-align: center;
  color: #909399;
  padding: 2rem;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .top20-container {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .header {
    padding: 0.75rem;
  }

  .header h1 {
    font-size: 1.2rem;
  }

  .header-left {
    gap: 0.5rem;
  }

  .total-logs {
    font-size: 0.95rem;
  }

  .star {
    font-size: 1.2rem;
  }

  .content-area {
    padding: 0.75rem;
  }

  .query-types {
    gap: 1rem;
    font-size: 0.9rem;
  }

  .top20-container {
    grid-template-columns: 1fr;
  }

  .top20-card {
    max-height: 50vh;
  }

  .data-table {
    font-size: 0.8rem;
  }

  .data-table th,
  .data-table td {
    padding: 0.4rem;
  }

  /* 隐藏部分列 */
  .col-freqHz,
  .col-fromCallsign,
  .col-fromGrid,
  .col-toComment,
  .col-mode,
  .col-relayName {
    display: none;
  }

  /* 在中等屏幕上隐藏分页的首页和末页按钮 */
  .pagination .hidden-on-small {
    display: none;
  }

  .pagination {
    flex-wrap: nowrap;
    gap: 0.3rem;
  }
  .pagination button {
    padding: 0.3rem 0.6rem;
    font-size: 0.85rem;
  }

  .page-info {
    font-size: 0.85rem;
  }
}

/* 手机端只显示关键列 */
@media (max-width: 480px) {
  /* 隐藏除日期、接收方呼号、接收网格外的所有列 */
  .col-freqHz,
  .col-fromCallsign,
  .col-fromGrid,
  .col-toComment,
  .col-mode,
  .col-relayName {
    display: none;
  }

  /* 确保只显示日期、接收方呼号、接收网格列 */
  .col-timestamp,
  .col-toCallsign,
  .col-toGrid {
    display: table-cell;
  }

  /* 在小屏幕上隐藏分页的首页和末页按钮 */
  .pagination .hidden-on-small {
    display: none;
  }

  /* 确保分页信息文本适应较小空间 */
  .page-info {
    font-size: 0.8rem;
    margin: 0 0.5rem;
  }

  .header h1 {
    font-size: 1rem;
  }

  .query-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .search-box {
    width: 100%;
  }

  .search-box input {
    width: 100%;
  }

  .col-timestamp {
    width: 90px;
  }
}


</style>
