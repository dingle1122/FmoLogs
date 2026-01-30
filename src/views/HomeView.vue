<template>
  <div class="container">
    <!-- 标题栏 -->
    <AppHeader
      :today-logs="todayLogs"
      :total-logs="totalLogs"
      :unique-callsigns="uniqueCallsigns"
      @open-settings="showSettings = true"
    />

    <!-- 发言状态条 -->
    <SpeakingBar
      :current-speaker="speakingStatus.currentSpeaker.value"
      :speaking-history="speakingStatus.speakingHistory.value"
      :fmo-address="settings.fmoAddress.value"
      :events-connected="speakingStatus.eventsConnected.value"
      @click="showSpeakingHistory = true"
    />

    <div class="content-area">
      <!-- 自动同步消息 -->
      <div v-if="fmoSync.autoSyncMessage.value" class="auto-sync-hint">
        {{ fmoSync.autoSyncMessage.value }}
      </div>

      <!-- 加载状态 -->
      <div v-if="loading || dataQuery.loading.value" class="loading">
        <template v-if="importProgress">
          正在导入数据... {{ importProgress.current }} /
          {{ importProgress.total }}
        </template>
        <template v-else> 加载中... </template>
      </div>

      <!-- 错误提示 -->
      <div v-if="error || dataQuery.error.value" class="error">
        {{ error || dataQuery.error.value }}
      </div>

      <!-- 查询区域 -->
      <QuerySection
        v-model:current-query-type="dataQuery.currentQueryType.value"
        v-model:search-keyword="dataQuery.searchKeyword.value"
        v-model:old-friends-search-keyword="dataQuery.oldFriendsSearchKeyword.value"
        :db-loaded="dbLoaded"
        @update:current-query-type="handleQueryTypeChange"
        @update:search-keyword="onSearchInput"
        @update:old-friends-search-keyword="onOldFriendsSearchInput"
      />

      <!-- TOP20汇总视图 -->
      <Top20Summary
        v-if="dataQuery.currentQueryType.value === 'top20Summary'"
        :top20-result="dataQuery.top20Result.value"
        :db-loaded="dbLoaded"
      />

      <!-- 老朋友卡片视图 -->
      <OldFriendsList
        v-else-if="dataQuery.currentQueryType.value === 'oldFriends'"
        :old-friends-result="dataQuery.oldFriendsResult.value"
        :db-loaded="dbLoaded"
        @show-records="handleShowCallsignRecords"
      />

      <!-- 数据表格 -->
      <LogDataTable
        v-else
        :query-result="dataQuery.queryResult.value"
        :display-columns="displayColumns"
        :db-loaded="dbLoaded"
        @show-detail="showDetailModal"
      />

      <!-- 分页 - 全部记录 -->
      <PaginationControl
        v-if="dataQuery.currentQueryType.value === 'all'"
        :current-page="dataQuery.currentPage.value"
        :total-pages="dataQuery.totalPages.value"
        :total-records="dataQuery.totalRecords.value"
        :disabled="!dbLoaded"
        @page-change="handlePageChange"
      />

      <!-- 分页 - 老朋友 -->
      <PaginationControl
        v-if="dataQuery.currentQueryType.value === 'oldFriends' && dataQuery.oldFriendsResult.value"
        :current-page="dataQuery.oldFriendsPage.value"
        :total-pages="dataQuery.oldFriendsTotalPages.value"
        :total-records="dataQuery.oldFriendsResult.value?.total"
        :disabled="!dbLoaded"
        @page-change="handleOldFriendsPageChange"
      />
    </div>

    <!-- 详情弹框 -->
    <DetailModal
      :visible="showDetailModalFlag"
      :row-data="selectedRowData"
      @close="showDetailModalFlag = false"
    />

    <!-- 通联记录弹框 -->
    <CallsignRecordsModal
      :visible="callsignRecords.showCallsignModal.value"
      :callsign="callsignRecords.currentCallsign.value"
      :records="callsignRecords.callsignRecords.value"
      :current-page="callsignRecords.callsignRecordsPage.value"
      @close="callsignRecords.closeCallsignModal()"
      @page-change="handleCallsignRecordsPageChange"
    />

    <!-- 设置弹框 -->
    <SettingsModal
      :visible="showSettings"
      :db-loaded="dbLoaded"
      :fmo-address="settings.fmoAddress.value"
      :protocol="settings.protocol.value"
      :available-from-callsigns="availableFromCallsigns"
      :selected-from-callsign="selectedFromCallsign"
      :syncing="fmoSync.syncing.value"
      :sync-status="fmoSync.syncStatus.value"
      @close="showSettings = false"
      @select-files="triggerFileInput"
      @export-data="handleExportData"
      @save-fmo-address="handleSaveFmoAddress"
      @sync-today="handleSyncToday"
      @backup-logs="settings.backupLogs()"
      @clear-all-data="handleClearAllData"
      @update:selected-from-callsign="handleFromCallsignChange"
      @update:protocol="settings.protocol.value = $event"
      @update:fmo-address="settings.fmoAddress.value = $event"
    />

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".db"
      multiple
      style="display: none"
      @change="handleFileSelect"
    />

    <!-- 发言历史弹框 -->
    <SpeakingHistoryModal
      :visible="showSpeakingHistory"
      :history="speakingStatus.speakingHistory.value"
      :today-contacted-callsigns="settings.todayContactedCallsigns.value"
      :station-connected="stationLoading || currentStation !== null"
      :current-station="currentStation"
      :station-busy="stationBusy"
      @close="showSpeakingHistory = false"
      @show-callsign-records="handleShowCallsignRecords"
      @station-prev="handleStationPrev"
      @station-next="handleStationNext"
      @station-open-list="handleOpenStationList"
    />

    <!-- 服务器列表弹框 -->
    <StationListModal
      :visible="showStationList"
      :station-list="stationList"
      :current-station="currentStation"
      :loading="stationListLoading"
      :no-more="stationListNoMore"
      @close="handleCloseStationList"
      @select="handleStationSelect"
      @load-more="handleLoadMoreStations"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

// 组件
import AppHeader from '../components/home/AppHeader.vue'
import SpeakingBar from '../components/home/SpeakingBar.vue'
import QuerySection from '../components/home/QuerySection.vue'
import Top20Summary from '../components/home/Top20Summary.vue'
import OldFriendsList from '../components/home/OldFriendsList.vue'
import LogDataTable from '../components/home/LogDataTable.vue'
import PaginationControl from '../components/home/PaginationControl.vue'
import DetailModal from '../components/home/modals/DetailModal.vue'
import CallsignRecordsModal from '../components/home/modals/CallsignRecordsModal.vue'
import SettingsModal from '../components/home/modals/SettingsModal.vue'
import SpeakingHistoryModal from '../components/home/modals/SpeakingHistoryModal.vue'
import StationListModal from '../components/home/modals/StationListModal.vue'

// Composables
import { useSpeakingStatus } from '../composables/useSpeakingStatus'
import { useFmoSync } from '../composables/useFmoSync'
import { useDataQuery, useCallsignRecords } from '../composables/useDataQuery'
import { useDbManager } from '../composables/useDbManager'
import { useSettings } from '../composables/useSettings'
import { exportDataToDbFile } from '../services/db'
import { FmoApiClient } from '../services/fmoApi'
import { normalizeHost } from '../utils/urlUtils'

// 常量
import { DEFAULT_COLUMNS } from '../components/home/constants'

// UI 状态
const showSettings = ref(false)
const showSpeakingHistory = ref(false)
const showDetailModalFlag = ref(false)
const selectedRowData = ref(null)
const fileInputRef = ref(null)

// 服务器列表弹框状态
const showStationList = ref(false)
const stationList = ref([])
const stationListLoading = ref(false)
const stationListNoMore = ref(false)
const stationListPage = ref(0)

// Station 状态
const currentStation = ref(null)
const stationBusy = ref(false)
const stationLoading = ref(false)
let stationPollTimer = null
let stationPollCount = 0

// Composables
const {
  dbLoaded,
  dbCount,
  availableFromCallsigns,
  selectedFromCallsign,
  importProgress,
  loading,
  error,
  totalLogs,
  todayLogs,
  uniqueCallsigns,
  updateStats,
  tryRestoreDirectory,
  selectFiles,
  clearAllData
} = useDbManager()
const settings = useSettings()
const speakingStatus = useSpeakingStatus()
const dataQuery = useDataQuery()
const callsignRecords = useCallsignRecords()

const fmoSync = useFmoSync({
  onSyncComplete: async ({ callsigns, syncedCount }) => {
    if (callsigns.length > 0) {
      availableFromCallsigns.value = callsigns
      if (!selectedFromCallsign.value) {
        selectedFromCallsign.value = callsigns[0]
      }
      dbLoaded.value = true
      dbCount.value = callsigns.length
    }
    if (syncedCount > 0) {
      await executeQuery()
      // 更新顶部统计数据
      await updateStats()
      if (showSpeakingHistory.value) {
        await settings.loadTodayContactedCallsigns(selectedFromCallsign.value)
      }
      // 如果通联记录弹框正在打开，自动刷新数据
      if (callsignRecords.showCallsignModal.value) {
        await callsignRecords.loadCallsignRecords(selectedFromCallsign.value)
      }
    }
  },
  getSpeakingHistory: () => speakingStatus.speakingHistory.value,
  getSelectedFromCallsign: () => selectedFromCallsign.value,
  getDbLoaded: () => dbLoaded.value,
  getTotalLogs: () => totalLogs.value
})

// 计算属性
const displayColumns = computed(() => {
  if (dataQuery.queryResult.value) {
    return dataQuery.queryResult.value.columns
  }
  return DEFAULT_COLUMNS
})

// 防抖定时器
let searchTimer = null
let oldFriendsSearchTimer = null

// 查询方法
async function executeQuery() {
  await dataQuery.executeQuery(selectedFromCallsign.value, dbLoaded.value)
}

function handleQueryTypeChange() {
  dataQuery.handleQueryTypeChange()
  executeQuery()
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    dataQuery.currentPage.value = 1
    executeQuery()
  }, 300)
}

function onOldFriendsSearchInput() {
  if (oldFriendsSearchTimer) clearTimeout(oldFriendsSearchTimer)
  oldFriendsSearchTimer = setTimeout(() => {
    dataQuery.oldFriendsPage.value = 1
    executeQuery()
  }, 300)
}

function handlePageChange(page) {
  dataQuery.goToPage(page)
  executeQuery()
}

function handleOldFriendsPageChange(page) {
  dataQuery.goToOldFriendsPage(page)
  executeQuery()
}

function handleFromCallsignChange(value) {
  selectedFromCallsign.value = value
  dataQuery.resetPagination()
  executeQuery()
}

function showDetailModal(row) {
  selectedRowData.value = row
  showDetailModalFlag.value = true
}

// 服务器列表弹框
const PAGE_SIZE = 10

// 创建临时 station client（按需连接，用完即关）
function createStationClient() {
  if (!settings.fmoAddress.value) return null
  const host = normalizeHost(settings.fmoAddress.value)
  const fullAddress = `${settings.protocol.value}://${host}`
  return new FmoApiClient(fullAddress)
}

// 获取当前服务器（按需连接）
async function fetchCurrentStation() {
  const client = createStationClient()
  if (!client) return

  stationLoading.value = true
  try {
    await client.connect()
    const data = await client.getCurrentStation()
    if (data) {
      currentStation.value = { uid: data.uid, name: data.name }
    }
  } catch (err) {
    console.error('获取当前服务器失败:', err)
  } finally {
    client.close()
    stationLoading.value = false
  }
}

// 轮询当前服务器状态（切换后服务器状态不是立即变化的）
function pollCurrentStation() {
  if (stationPollTimer) {
    clearTimeout(stationPollTimer)
  }
  stationPollCount = 0
  doPollStation()
}

function doPollStation() {
  if (stationPollCount >= 3) return // 最多 3 次
  stationPollCount++
  fetchCurrentStation()
  stationPollTimer = setTimeout(doPollStation, 1000) // 间隔 1 秒，总计约 3 秒
}

async function handleStationPrev() {
  if (stationBusy.value) return
  const client = createStationClient()
  if (!client) return

  stationBusy.value = true
  try {
    await client.connect()
    const result = await client.prevStation()
    if (result?.result === 0) {
      pollCurrentStation()
      speakingStatus.clearSpeakingHistory()
    }
  } catch (err) {
    console.error('切换上一个服务器失败:', err)
  } finally {
    client.close()
    stationBusy.value = false
  }
}

async function handleStationNext() {
  if (stationBusy.value) return
  const client = createStationClient()
  if (!client) return

  stationBusy.value = true
  try {
    await client.connect()
    const result = await client.nextStation()
    if (result?.result === 0) {
      pollCurrentStation()
      speakingStatus.clearSpeakingHistory()
    }
  } catch (err) {
    console.error('切换下一个服务器失败:', err)
  } finally {
    client.close()
    stationBusy.value = false
  }
}

function handleOpenStationList() {
  showStationList.value = true
  stationList.value = []
  stationListPage.value = 0
  stationListNoMore.value = false
  loadStationPage()
}

function handleCloseStationList() {
  showStationList.value = false
}

async function loadStationPage() {
  const client = createStationClient()
  if (!client) {
    stationListNoMore.value = true
    return
  }

  stationListLoading.value = true
  const start = stationListPage.value * PAGE_SIZE

  try {
    await client.connect()
    const result = await client.getStationList(start, PAGE_SIZE)
    if (result?.list) {
      if (result.list.length > 0) {
        stationList.value = [...stationList.value, ...result.list]
      }
      if (result.list.length < PAGE_SIZE) {
        stationListNoMore.value = true
      }
    } else {
      stationListNoMore.value = true
    }
  } catch (err) {
    console.error('获取服务器列表失败:', err)
    stationListNoMore.value = true
  } finally {
    client.close()
    stationListLoading.value = false
  }
}

function handleLoadMoreStations() {
  if (stationListLoading.value || stationListNoMore.value) return
  stationListPage.value++
  loadStationPage()
}

async function handleStationSelect(uid) {
  if (stationBusy.value) return
  const client = createStationClient()
  if (!client) return

  stationBusy.value = true
  try {
    await client.connect()
    const result = await client.setCurrentStation(uid)
    if (result?.result === 0) {
      pollCurrentStation()
    }
  } catch (err) {
    console.error('设置当前服务器失败:', err)
  } finally {
    client.close()
    stationBusy.value = false
  }
  speakingStatus.clearSpeakingHistory()
}

async function handleShowCallsignRecords(callsign) {
  await callsignRecords.showCallsignRecordsModal(callsign, selectedFromCallsign.value)
}

async function handleCallsignRecordsPageChange(page) {
  await callsignRecords.goToCallsignRecordsPage(page, selectedFromCallsign.value)
}

// 数据库操作
function triggerFileInput() {
  fileInputRef.value?.click()
}

async function handleFileSelect(event) {
  const files = event.target.files
  showSettings.value = false
  const success = await selectFiles(files)
  if (success) {
    dataQuery.currentQueryType.value = 'all'
    dataQuery.currentPage.value = 1
    executeQuery()
  }
  event.target.value = ''
}

async function handleClearAllData() {
  if (!window.confirm('确定要清空所有数据吗？此操作不可恢复。')) {
    return
  }
  await clearAllData()
  dataQuery.queryResult.value = null
  dataQuery.top20Result.value = null
  dataQuery.oldFriendsResult.value = null
  dataQuery.searchKeyword.value = ''
  dataQuery.oldFriendsSearchKeyword.value = ''
  showSettings.value = false
}

// 导出数据
async function handleExportData() {
  try {
    loading.value = true
    const result = await exportDataToDbFile(selectedFromCallsign.value)

    // 创建 Blob 并下载
    const blob = new Blob([result.data], { type: 'application/x-sqlite3' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = result.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    loading.value = false
  } catch (err) {
    loading.value = false
    alert(`导出失败: ${err.message}`)
  }
}

// FMO 设置操作
async function handleSaveFmoAddress() {
  loading.value = true
  const result = await settings.validateAndSaveFmoAddress()
  loading.value = false

  if (result.success) {
    if (result.reconnect) {
      speakingStatus.disconnectEventWs()
      speakingStatus.connectEventWs(settings.fmoAddress.value, settings.protocol.value)
    }
    alert(result.message)
  } else {
    alert(result.message)
  }
}

async function handleSyncToday() {
  try {
    await fmoSync.syncToday(settings.fmoAddress.value, settings.protocol.value)
    // 同步成功后自动保存地址
    await settings.quickSaveAddress()
  } catch (err) {
    dataQuery.error.value = `同步失败: ${err.message}`
  }
}

// 监听
watch(showSpeakingHistory, async (newValue) => {
  if (newValue) {
    await settings.loadTodayContactedCallsigns(selectedFromCallsign.value)
    // 打开时获取当前服务器
    fetchCurrentStation()
  } else {
    // 关闭时清理状态和轮询
    if (stationPollTimer) {
      clearTimeout(stationPollTimer)
      stationPollTimer = null
    }
    currentStation.value = null
  }
})

watch(
  () => selectedFromCallsign.value,
  async () => {
    if (showSpeakingHistory.value) {
      await settings.loadTodayContactedCallsigns(selectedFromCallsign.value)
    }
  }
)

// 生命周期
onMounted(async () => {
  const restored = await tryRestoreDirectory()
  if (restored) {
    executeQuery()
  }

  const hasSavedAddress = await settings.initFmoAddress()
  if (hasSavedAddress) {
    speakingStatus.connectEventWs(settings.fmoAddress.value, settings.protocol.value)
  }

  fmoSync.startAutoSyncTask(settings.fmoAddress.value, settings.protocol.value)
  speakingStatus.startSpeakingHistoryCleanup()
})

onUnmounted(() => {
  // 清理搜索防抖定时器
  if (searchTimer) clearTimeout(searchTimer)
  if (oldFriendsSearchTimer) clearTimeout(oldFriendsSearchTimer)
  if (stationPollTimer) clearTimeout(stationPollTimer)

  fmoSync.stopAutoSyncTask()
  speakingStatus.stopSpeakingHistoryCleanup()
  speakingStatus.disconnectEventWs()
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

.content-area {
  flex: 1;
  overflow: hidden;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  position: relative;
}

.auto-sync-hint {
  background: var(--bg-success-light);
  color: var(--color-success);
  padding: 8px 16px;
  border-radius: 4px;
  margin-bottom: 10px;
  border: 1px solid var(--color-success-border);
  font-size: 14px;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    transform: translateY(-10px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.loading {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.error {
  padding: 1rem;
  background: var(--bg-error-light);
  color: var(--color-danger);
  border-radius: 4px;
  margin-bottom: 1rem;
}

@media (max-width: 768px) {
  .content-area {
    padding: 0.75rem;
  }
}
</style>
