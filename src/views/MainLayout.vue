<template>
  <div class="container">
    <!-- 标题栏（含桌面端导航） -->
    <AppHeader
      :today-logs="todayLogs"
      :total-logs="totalLogs"
      :unique-callsigns="uniqueCallsigns"
      :db-loaded="dbLoaded"
      @open-settings="showSettings = true"
    />

    <!-- 发言状态条 -->
    <SpeakingBar
      :current-speaker="speakingStatus.currentSpeaker.value"
      :speaking-history="speakingStatus.speakingHistory.value"
      :fmo-address="settings.fmoAddress.value"
      :events-connected="speakingStatus.eventsConnected.value"
      :selected-from-callsign="selectedFromCallsign"
      @click="showSpeakingHistory = true"
    />

    <!-- 路由视图 -->
    <div ref="contentAreaRef" class="content-area">
      <router-view v-slot="{ Component }">
        <component
          :is="Component"
          :db-loaded="dbLoaded"
          :selected-from-callsign="selectedFromCallsign"
          :loading="loading || dataQuery.loading.value"
          :error="error || dataQuery.error.value"
          :import-progress="importProgress"
          :fmo-sync-message="fmoSync.autoSyncMessage.value"
          :data-query="dataQuery"
          :callsign-records="callsignRecords"
          @execute-query="executeQuery"
          @show-detail="showDetailModal"
          @show-callsign-records="handleShowCallsignRecords"
        />
      </router-view>

      <!-- 回到顶部按钮（仅移动端显示） -->
      <transition name="fade">
        <button v-show="showBackToTop" class="back-to-top-btn" @click="scrollToTop">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      </transition>
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
      ref="settingsModalRef"
      :visible="showSettings"
      :db-loaded="dbLoaded"
      :fmo-address="settings.fmoAddress.value"
      :protocol="settings.protocol.value"
      :address-list="settings.addressList.value"
      :active-address-id="settings.activeAddressId.value"
      :available-from-callsigns="availableFromCallsigns"
      :selected-from-callsign="selectedFromCallsign"
      :syncing="fmoSync.syncing.value"
      :sync-status="fmoSync.syncStatus.value"
      @close="showSettings = false"
      @select-files="triggerFileInput"
      @export-data="handleExportData"
      @sync-today="handleSyncToday"
      @backup-logs="settings.backupLogs()"
      @clear-all-data="handleClearAllData"
      @update:selected-from-callsign="handleFromCallsignChange"
      @add-address="handleAddAddress"
      @update-address="handleUpdateAddress"
      @delete-address="handleDeleteAddress"
      @select-address="handleSelectAddress"
      @clear-all-addresses="handleClearAllAddresses"
      @refresh-user-info="handleRefreshUserInfo"
    />

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".db"
      multiple
      class="hidden-input"
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
      :selected-from-callsign="selectedFromCallsign"
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

    <!-- 底部导航栏（手机端显示） -->
    <nav class="query-nav mobile-nav">
      <router-link
        v-for="route in NAV_ROUTES"
        :key="route.path"
        :to="dbLoaded ? route.path : $route.path"
        class="nav-tab"
        :class="{ disabled: !dbLoaded }"
      >
        <!-- 全部记录图标 -->
        <svg
          v-if="route.type === 'logs'"
          class="nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        <!-- TOP20图标 -->
        <svg
          v-else-if="route.type === 'top20'"
          class="nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C5.3 4 6 4.7 6 5.5V20" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5c-.8 0-1.5.7-1.5 1.5V20" />
          <path d="M6 13h12" />
          <path d="M8 20h8" />
        </svg>
        <!-- 老朋友图标 -->
        <svg
          v-else-if="route.type === 'oldFriends'"
          class="nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span class="nav-label">{{ route.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// 组件
import AppHeader from '../components/home/AppHeader.vue'
import SpeakingBar from '../components/home/SpeakingBar.vue'
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
import toast from '../composables/useToast'
import confirmDialog from '../composables/useConfirm'
import { exportDataToDbFile } from '../services/db'
import { FmoApiClient } from '../services/fmoApi'
import { normalizeHost } from '../utils/urlUtils'
import { NAV_ROUTES } from '../components/home/constants'

// 路由
const route = useRoute()
const router = useRouter()

// UI 状态
const showSettings = ref(false)
const showSpeakingHistory = ref(false)
const showDetailModalFlag = ref(false)
const selectedRowData = ref(null)
const fileInputRef = ref(null)
const settingsModalRef = ref(null)
const contentAreaRef = ref(null)
const showBackToTop = ref(false)
let scrollTimer = null

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
  getTotalLogs: () => totalLogs.value,
  getEventsConnected: () => speakingStatus.eventsConnected.value
})

// 计算当前查询类型（根据路由名称映射）
const routeToQueryType = {
  logs: 'all',
  top20: 'top20Summary',
  oldFriends: 'oldFriends'
}

const currentQueryType = computed(() => {
  const routeName = route.name
  return routeToQueryType[routeName] || 'all'
})

// 同步路由变化到 dataQuery
watch(currentQueryType, (newType) => {
  if (dataQuery.currentQueryType.value !== newType) {
    dataQuery.currentQueryType.value = newType
  }
})

// 查询方法
async function executeQuery() {
  await dataQuery.executeQuery(selectedFromCallsign.value, dbLoaded.value)
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
    try {
      client.close()
    } catch (closeErr) {
      console.error('关闭客户端连接失败:', closeErr)
    }
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
    try {
      client.close()
    } catch (closeErr) {
      console.error('关闭客户端连接失败:', closeErr)
    }
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
    try {
      client.close()
    } catch (closeErr) {
      console.error('关闭客户端连接失败:', closeErr)
    }
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
    try {
      client.close()
    } catch (closeErr) {
      console.error('关闭客户端连接失败:', closeErr)
    }
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
    try {
      client.close()
    } catch (closeErr) {
      console.error('关闭客户端连接失败:', closeErr)
    }
    stationBusy.value = false
  }
  speakingStatus.clearSpeakingHistory()
}

// 回到顶部 - 带防抖的滚动处理
function handleScroll() {
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    if (contentAreaRef.value) {
      showBackToTop.value = contentAreaRef.value.scrollTop > 200
    }
  }, 100)
}

function scrollToTop() {
  contentAreaRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
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
    router.push('/logs')
    executeQuery()
  }
  event.target.value = ''
}

async function handleClearAllData() {
  const confirmed = await confirmDialog.show('确定要清空所有数据吗？此操作不可恢复。')
  if (!confirmed) {
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
    toast.error(`导出失败: ${err.message}`)
  }
}

// FMO 地址管理
async function handleAddAddress({ name, host, protocol }) {
  const result = await settings.addFmoAddress(name, host, protocol)
  if (!result.success) {
    toast.warning(result.message)
    return
  }

  // 添加成功后重连到新地址
  if (result.reconnect) {
    speakingStatus.disconnectEventWs()
    fmoSync.stopAutoSyncTask()
    speakingStatus.connectEventWs(settings.fmoAddress.value, settings.protocol.value)
    fmoSync.startAutoSyncTask(settings.fmoAddress.value, settings.protocol.value)
  }
}

async function handleUpdateAddress({ id, name, host, protocol }) {
  const result = await settings.updateFmoAddress(id, name, host, protocol)
  if (!result.success) {
    toast.warning(result.message)
  }
}

async function handleDeleteAddress(id) {
  const result = await settings.deleteFmoAddress(id)
  if (!result.success) {
    toast.warning(result.message)
    return
  }

  // 如果删除的是当前选中地址，需要重连
  if (result.reconnect) {
    speakingStatus.disconnectEventWs()
    fmoSync.stopAutoSyncTask()

    // 如果还有其他地址，连接到新的选中地址
    if (settings.fmoAddress.value) {
      speakingStatus.connectEventWs(settings.fmoAddress.value, settings.protocol.value)
      fmoSync.startAutoSyncTask(settings.fmoAddress.value, settings.protocol.value)
    }
  }
}

async function handleSelectAddress(id) {
  const result = await settings.selectFmoAddress(id)
  settingsModalRef.value?.clearConnecting()

  if (result.success) {
    if (result.reconnect) {
      speakingStatus.disconnectEventWs()
      speakingStatus.connectEventWs(settings.fmoAddress.value, settings.protocol.value)
      fmoSync.stopAutoSyncTask()
      fmoSync.startAutoSyncTask(settings.fmoAddress.value, settings.protocol.value)
    }
  } else {
    toast.warning(result.message)
  }
}

async function handleClearAllAddresses() {
  const result = await settings.clearAllAddresses()
  if (!result.success) {
    toast.warning(result.message)
    return
  }

  // 断开连接并停止同步任务
  if (result.reconnect) {
    speakingStatus.disconnectEventWs()
    fmoSync.stopAutoSyncTask()
    currentStation.value = null
  }
}

async function handleRefreshUserInfo(id) {
  const result = await settings.refreshUserInfo(id)
  settingsModalRef.value?.clearRefreshing()

  if (result.success) {
    toast.success(result.message)
  } else {
    toast.error(result.message)
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

// 路由变化时执行查询
watch(
  () => route.name,
  async (newName, oldName) => {
    if (newName !== oldName && dbLoaded.value) {
      // 更新 dataQuery 的查询类型
      const queryType = routeToQueryType[newName]
      if (queryType && dataQuery.currentQueryType.value !== queryType) {
        dataQuery.currentQueryType.value = queryType
        dataQuery.handleQueryTypeChange()
        await executeQuery()
      }
    }
  }
)

// 生命周期
onMounted(async () => {
  // 回到顶部滚动监听
  contentAreaRef.value?.addEventListener('scroll', handleScroll, { passive: true })

  const restored = await tryRestoreDirectory()
  if (restored) {
    // 根据当前路由设置查询类型
    const queryType = routeToQueryType[route.name] || 'all'
    dataQuery.currentQueryType.value = queryType
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
  if (stationPollTimer) clearTimeout(stationPollTimer)
  if (scrollTimer) clearTimeout(scrollTimer)
  contentAreaRef.value?.removeEventListener('scroll', handleScroll)

  fmoSync.stopAutoSyncTask()
  speakingStatus.stopSpeakingHistoryCleanup()
  speakingStatus.disconnectEventWs()
})

// 提供共享状态给子组件
provide('dbLoaded', dbLoaded)
provide('selectedFromCallsign', selectedFromCallsign)
provide('executeQuery', executeQuery)
</script>

<style scoped>
.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

/* 底部导航栏（手机端） */
.mobile-nav {
  display: none;
  flex-shrink: 0;
  background: var(--bg-header);
  border-top: 1px solid var(--border-light);
  padding: 0.25rem 0;
  padding-bottom: calc(0.25rem + env(safe-area-inset-bottom, 0px));
  justify-content: space-around;
  z-index: 200;
}

.mobile-nav .nav-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  background: none;
  border: none;
  border-radius: 0;
  padding: 0.2rem 0.8rem;
  font-size: 1rem;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color 0.2s;
  font-family: inherit;
  text-decoration: none;
}

.mobile-nav .nav-tab:hover:not(.disabled) {
  background: none;
}

.mobile-nav .nav-tab.router-link-active {
  color: var(--color-primary);
}

.mobile-nav .nav-tab.disabled {
  color: var(--text-disabled);
  cursor: not-allowed;
  pointer-events: none;
}

.nav-icon {
  width: 22px;
  height: 22px;
}

.nav-label {
  font-size: 0.7rem;
  line-height: 1;
}

.hidden-input {
  display: none;
}

.content-area {
  flex: 1;
  overflow: hidden;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  position: relative;
}

.back-to-top-btn {
  display: none;
}

@media (max-width: 768px) {
  .content-area {
    padding: 0.5rem;
    overflow-y: auto;
  }

  .mobile-nav {
    display: flex;
  }

  .back-to-top-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    right: 1rem;
    bottom: calc(60px + env(safe-area-inset-bottom, 0px) + 0.75rem);
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--bg-header);
    border: 1px solid var(--border-primary);
    box-shadow: 0 2px 8px var(--shadow-card);
    color: var(--text-secondary);
    cursor: pointer;
    z-index: 190;
    padding: 0;
  }

  .back-to-top-btn svg {
    width: 20px;
    height: 20px;
  }

  .back-to-top-btn:focus {
    outline: none;
  }
}

/* 回到顶部按钮淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
