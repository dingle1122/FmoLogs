<template>
  <div class="container">
    <!-- 标题栏 -->
    <AppHeader
      :today-logs="dbManager.todayLogs.value"
      :total-logs="dbManager.totalLogs.value"
      :unique-callsigns="dbManager.uniqueCallsigns.value"
      @open-settings="showSettings = true"
    />

    <!-- 发言状态条 -->
    <SpeakingBar
      :current-speaker="speakingStatus.currentSpeaker.value"
      :speaking-history="speakingStatus.speakingHistory.value"
      :fmo-address="settings.fmoAddress.value"
      @click="showSpeakingHistory = true"
    />

    <div class="content-area">
      <!-- 自动同步消息 -->
      <div v-if="fmoSync.autoSyncMessage.value" class="auto-sync-hint">
        {{ fmoSync.autoSyncMessage.value }}
      </div>

      <!-- 加载状态 -->
      <div v-if="dbManager.loading.value || dataQuery.loading.value" class="loading">
        <template v-if="dbManager.importProgress.value">
          正在导入数据... {{ dbManager.importProgress.value.current }} /
          {{ dbManager.importProgress.value.total }}
        </template>
        <template v-else> 加载中... </template>
      </div>

      <!-- 错误提示 -->
      <div v-if="dbManager.error.value || dataQuery.error.value" class="error">
        {{ dbManager.error.value || dataQuery.error.value }}
      </div>

      <!-- 查询区域 -->
      <QuerySection
        v-model:current-query-type="dataQuery.currentQueryType.value"
        v-model:search-keyword="dataQuery.searchKeyword.value"
        v-model:old-friends-search-keyword="dataQuery.oldFriendsSearchKeyword.value"
        :db-loaded="dbManager.dbLoaded.value"
        @update:current-query-type="handleQueryTypeChange"
        @update:search-keyword="onSearchInput"
        @update:old-friends-search-keyword="onOldFriendsSearchInput"
      />

      <!-- TOP20汇总视图 -->
      <Top20Summary
        v-if="dataQuery.currentQueryType.value === 'top20Summary'"
        :top20-result="dataQuery.top20Result.value"
        :db-loaded="dbManager.dbLoaded.value"
      />

      <!-- 老朋友卡片视图 -->
      <OldFriendsList
        v-else-if="dataQuery.currentQueryType.value === 'oldFriends'"
        :old-friends-result="dataQuery.oldFriendsResult.value"
        :db-loaded="dbManager.dbLoaded.value"
        @show-records="handleShowCallsignRecords"
      />

      <!-- 数据表格 -->
      <LogDataTable
        v-else
        :query-result="dataQuery.queryResult.value"
        :display-columns="displayColumns"
        :db-loaded="dbManager.dbLoaded.value"
        @show-detail="showDetailModal"
      />

      <!-- 分页 - 全部记录 -->
      <PaginationControl
        v-if="dataQuery.currentQueryType.value === 'all'"
        :current-page="dataQuery.currentPage.value"
        :total-pages="dataQuery.totalPages.value"
        :total-records="dataQuery.totalRecords.value"
        :disabled="!dbManager.dbLoaded.value"
        @page-change="handlePageChange"
      />

      <!-- 分页 - 老朋友 -->
      <PaginationControl
        v-if="dataQuery.currentQueryType.value === 'oldFriends' && dataQuery.oldFriendsResult.value"
        :current-page="dataQuery.oldFriendsPage.value"
        :total-pages="dataQuery.oldFriendsTotalPages.value"
        :total-records="dataQuery.oldFriendsResult.value?.total"
        :disabled="!dbManager.dbLoaded.value"
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
      :db-loaded="dbManager.dbLoaded.value"
      :fmo-address="settings.fmoAddress.value"
      :protocol="settings.protocol.value"
      :available-from-callsigns="dbManager.availableFromCallsigns.value"
      :selected-from-callsign="dbManager.selectedFromCallsign.value"
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
      @close="showSpeakingHistory = false"
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

// Composables
import { useSpeakingStatus } from '../composables/useSpeakingStatus'
import { useFmoSync } from '../composables/useFmoSync'
import { useDataQuery, useCallsignRecords } from '../composables/useDataQuery'
import { useDbManager } from '../composables/useDbManager'
import { useSettings } from '../composables/useSettings'
import { exportDataToDbFile } from '../services/db'

// 常量
import { DEFAULT_COLUMNS } from '../components/home/constants'

// UI 状态
const showSettings = ref(false)
const showSpeakingHistory = ref(false)
const showDetailModalFlag = ref(false)
const selectedRowData = ref(null)
const fileInputRef = ref(null)

// Composables
const dbManager = useDbManager()
const settings = useSettings()
const speakingStatus = useSpeakingStatus()
const dataQuery = useDataQuery()
const callsignRecords = useCallsignRecords()

const fmoSync = useFmoSync({
  onSyncComplete: async ({ callsigns, syncedCount }) => {
    if (callsigns.length > 0) {
      dbManager.availableFromCallsigns.value = callsigns
      if (!dbManager.selectedFromCallsign.value) {
        dbManager.selectedFromCallsign.value = callsigns[0]
      }
      dbManager.dbLoaded.value = true
      dbManager.dbCount.value = callsigns.length
    }
    if (syncedCount > 0) {
      await executeQuery()
      if (showSpeakingHistory.value) {
        await settings.loadTodayContactedCallsigns(dbManager.selectedFromCallsign.value)
      }
    }
  },
  getSpeakingHistory: () => speakingStatus.speakingHistory.value,
  getSelectedFromCallsign: () => dbManager.selectedFromCallsign.value,
  getDbLoaded: () => dbManager.dbLoaded.value,
  getTotalLogs: () => dbManager.totalLogs.value
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
  await dataQuery.executeQuery(dbManager.selectedFromCallsign.value, dbManager.dbLoaded.value)
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
  dbManager.selectedFromCallsign.value = value
  dataQuery.resetPagination()
  executeQuery()
}

function showDetailModal(row) {
  selectedRowData.value = row
  showDetailModalFlag.value = true
}

async function handleShowCallsignRecords(callsign) {
  await callsignRecords.showCallsignRecordsModal(callsign, dbManager.selectedFromCallsign.value)
}

async function handleCallsignRecordsPageChange(page) {
  await callsignRecords.goToCallsignRecordsPage(page, dbManager.selectedFromCallsign.value)
}

// 数据库操作
function triggerFileInput() {
  fileInputRef.value?.click()
}

async function handleFileSelect(event) {
  const files = event.target.files
  showSettings.value = false
  const success = await dbManager.selectFiles(files)
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
  await dbManager.clearAllData()
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
    dbManager.loading.value = true
    const result = await exportDataToDbFile(dbManager.selectedFromCallsign.value)
    
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
    
    dbManager.loading.value = false
  } catch (err) {
    dbManager.loading.value = false
    alert(`导出失败: ${err.message}`)
  }
}

// FMO 设置操作
async function handleSaveFmoAddress() {
  dbManager.loading.value = true
  const result = await settings.validateAndSaveFmoAddress()
  dbManager.loading.value = false

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
  } catch (err) {
    dataQuery.error.value = `同步失败: ${err.message}`
  }
}

// 监听
watch(showSpeakingHistory, async (newValue) => {
  if (newValue) {
    await settings.loadTodayContactedCallsigns(dbManager.selectedFromCallsign.value)
  }
})

watch(
  () => dbManager.selectedFromCallsign.value,
  async () => {
    if (showSpeakingHistory.value) {
      await settings.loadTodayContactedCallsigns(dbManager.selectedFromCallsign.value)
    }
  }
)

// 生命周期
onMounted(async () => {
  const restored = await dbManager.tryRestoreDirectory()
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

  fmoSync.stopAutoSyncTask()
  speakingStatus.stopSpeakingHistoryCleanup()
  speakingStatus.disconnectEventWs()
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
