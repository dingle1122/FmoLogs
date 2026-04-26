<template>
  <div class="container">
    <!-- 标题栏（含桌面端导航） -->
    <AppHeader
      :today-logs="todayLogs"
      :total-logs="totalLogs"
      :unique-callsigns="uniqueCallsigns"
      :db-loaded="dbLoaded"
      :has-unread-messages="hasUnreadMessages"
      @open-nav-menu="showQuickNav = true"
    />

    <!-- 发言状态条 -->
    <SpeakingBar
      :current-speaker="speakingStatus.currentSpeaker.value"
      :current-speaker-address="speakingStatus.currentSpeakerAddress.value"
      :speaking-history="speakingStatus.speakingHistory.value"
      :fmo-address="settings.fmoAddress.value"
      :events-connected="speakingStatus.eventsConnected.value"
      :selected-from-callsign="selectedFromCallsign"
      :all-speaking-histories="speakingStatus.allSpeakingHistories.value"
      :all-current-speakers="speakingStatus.allCurrentSpeakers.value"
      :address-list="settings.addressList.value"
      :multi-select-mode="settings.multiSelectMode.value"
      :active-address-id="settings.activeAddressId.value"
      :is-audio-playing="isAudioPlaying"
      :is-audio-muted="isAudioMuted"
      :today-contacted-callsigns="settings.todayContactedCallsigns.value"
      :contact-counts="settings.contactCounts.value"
      @click="showSpeakingHistory = true"
      @toggle-audio="handleToggleAudio"
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
          :active-address-id="settings.activeAddressId.value"
          :address-list="settings.addressList.value"
          :fmo-address="settings.fmoAddress.value"
          :protocol="settings.protocol.value"
          :syncing="fmoSync.syncing.value"
          :sync-status="fmoSync.syncStatus.value"
          :multi-select-mode="settings.multiSelectMode.value"
          :selected-address-ids="settings.selectedAddressIds.value"
          :multi-sync-progress="fmoSync.multiSyncProgress.value"
          :audio-volume="settings.audioVolume.value"
          :contact-counts="settings.contactCounts.value"
          @execute-query="executeQuery"
          @show-callsign-records="handleShowCallsignRecords"
          @select-files="triggerFileInput"
          @export-data="handleExportData"
          @export-adif="handleExportAdif"
          @sync-days="handleSyncDays"
          @sync-incremental="handleSyncIncremental"
          @sync-full="handleSyncFull"
          @backup-logs="settings.backupLogs()"
          @clear-all-data="handleClearAllData"
          @update:multi-select-mode="handleSetMultiSelectMode"
          @toggle-address-selection="handleToggleAddressSelection"
          @sync-multiple="handleSyncMultiple"
          @add-address="handleAddAddress"
          @update-address="handleUpdateAddress"
          @delete-address="handleDeleteAddress"
          @select-address="handleSelectAddress"
          @clear-all-addresses="handleClearAllAddresses"
          @refresh-user-info="handleRefreshUserInfo"
          @validate-and-select="handleValidateAndSelect"
          @update-audio-volume="handleUpdateAudioVolume"
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

    <!-- 通联记录弹框 -->
    <CallsignRecordsModal
      :visible="callsignRecords.showCallsignModal.value"
      :callsign="callsignRecords.currentCallsign.value"
      :records="callsignRecords.callsignRecords.value"
      :highlight-timestamp="callsignRecords.highlightTimestamp.value"
      @close="callsignRecords.closeCallsignModal()"
    />

    <!-- 隐藏的文件输入 -->
    <input
      id="db-file-input"
      ref="fileInputRef"
      type="file"
      accept=".db,.adi,.adif"
      multiple
      class="hidden-input"
      @change="handleFileSelect"
    />

    <!-- 发言历史弹框 -->
    <SpeakingHistoryModal
      :visible="showSpeakingHistory"
      :history="speakingStatus.speakingHistory.value"
      :today-contacted-callsigns="settings.todayContactedCallsigns.value"
      :station-connected="speakingStatus.primaryConnected.value"
      :current-station="speakingStatus.primaryServerInfo.value"
      :station-busy="stationBusy"
      :selected-from-callsign="selectedFromCallsign"
      :all-speaking-histories="speakingStatus.allSpeakingHistories.value"
      :all-current-speakers="speakingStatus.allCurrentSpeakers.value"
      :address-list="settings.addressList.value"
      :multi-select-mode="settings.multiSelectMode.value"
      :active-address-id="settings.activeAddressId.value"
      :contact-counts="settings.contactCounts.value"
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
      :current-station="speakingStatus.primaryServerInfo.value"
      :loading="stationListLoading"
      :show-primary-badge="settings.multiSelectMode.value"
      @close="handleCloseStationList"
      @select="handleStationSelect"
      @refresh="handleRefreshStationList"
    />

    <!-- 快捷导航弹框 -->
    <QuickNavModal :visible="showQuickNav" :db-loaded="dbLoaded" @close="showQuickNav = false" />

    <!-- 底部导航栏（手机端显示） -->
    <nav class="query-nav mobile-nav">
      <router-link
        v-for="route in NAV_ROUTES"
        :key="route.path"
        :to="dbLoaded || ['messages', 'more'].includes(route.type) ? route.path : $route.path"
        class="nav-tab"
        :class="{ disabled: !dbLoaded && !['messages', 'more'].includes(route.type) }"
      >
        <SvgIcon :name="route.icon" :size="22" class="nav-icon" />
        <span class="nav-label">{{ route.label }}</span>
        <span
          v-if="route.type === 'messages' && hasUnreadMessages"
          class="mobile-unread-badge"
        ></span>
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
import CallsignRecordsModal from '../components/home/modals/CallsignRecordsModal.vue'

import SpeakingHistoryModal from '../components/home/modals/SpeakingHistoryModal.vue'
import StationListModal from '../components/home/modals/StationListModal.vue'
import QuickNavModal from '../components/home/modals/QuickNavModal.vue'
import SvgIcon from '../components/common/SvgIcon.vue'

// Composables
import { useSpeakingStatus } from '../composables/useSpeakingStatus'
import { useFmoSync } from '../composables/useFmoSync'
import { useDataQuery, useCallsignRecords } from '../composables/useDataQuery'
import { useDbManager } from '../composables/useDbManager'
import { useSettings } from '../composables/useSettings'
import { useAudioPlayer } from '../composables/useAudioPlayer'
import toast from '../composables/useToast'
import confirmDialog from '../composables/useConfirm'
import { exportDataToDbFile, exportDataToAdif } from '../services/db'
import { FmoApiClient } from '../services/fmoApi'
import { normalizeHost } from '../utils/urlUtils'
import { NAV_ROUTES } from '../components/home/constants'
import { getMessageService } from '../services/messageService'
import packageInfo from '../../package.json'

// 路由
const route = useRoute()
const router = useRouter()

// UI 状态
const showSpeakingHistory = ref(false)
const fileInputRef = ref(null)
const contentAreaRef = ref(null)
const showBackToTop = ref(false)
let scrollTimer = null

// 快捷导航弹框状态
const showQuickNav = ref(false)

// 服务器列表弹框状态
const showStationList = ref(false)

// 从 localStorage 读取缓存的服务器列表
function getCachedStationList() {
  try {
    const cached = localStorage.getItem('stationListCache')
    if (cached) {
      const parsed = JSON.parse(cached)
      return { list: parsed.list || [], fetchedAt: parsed.fetchedAt || null }
    }
  } catch (e) {
    console.error('读取服务器列表缓存失败:', e)
  }
  return { list: [], fetchedAt: null }
}

const cachedStations = getCachedStationList()
const stationList = ref(cachedStations.list)
const stationListLoading = ref(false)
const stationListFetchedAt = ref(cachedStations.fetchedAt)

// Station 状态
const stationBusy = ref(false)

// 消息未读状态
const hasUnreadMessages = computed(() => {
  return messageService.messageList.value.some((msg) => !msg.isRead)
})

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

// 消息服务
const messageService = getMessageService()

const {
  isPlaying: isAudioPlaying,
  isMuted: isAudioMuted,
  toggleAudio,
  stopAudio,
  muteAudio,
  unmuteAudio,
  setVolume: setAudioVolumePlayer,
  resumeAudio
} = useAudioPlayer()

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
      // 重置老朋友页面流式加载状态，确保同步后从第1页重新加载
      dataQuery.oldFriendsPage.value = 1
      await executeQuery()
      // 更新顶部统计数据
      await updateStats()
      if (showSpeakingHistory.value) {
        await settings.loadTodayContactedCallsigns(selectedFromCallsign.value)
      }
      if (selectedFromCallsign.value) {
        await settings.loadContactCounts(selectedFromCallsign.value)
      }
      // 如果通联记录弹框正在打开，自动刷新数据
      if (callsignRecords.showCallsignModal.value) {
        await callsignRecords.loadCallsignRecords(selectedFromCallsign.value)
      }
    }
  },
  getSpeakingHistory: (addressId) => speakingStatus.getSpeakingHistoryFor(addressId),
  getSelectedFromCallsign: () => selectedFromCallsign.value,
  getDbLoaded: () => dbLoaded.value,
  getTotalLogs: () => totalLogs.value,
  getEventsConnected: (addressId) => speakingStatus.isAddressConnected(addressId)
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

// 呼号自动推断：根据当前激活地址的 userInfo 自动推断
function inferFromCallsign() {
  const activeAddr = settings.activeAddress.value
  const callsignFromAddr = activeAddr?.userInfo?.callsign

  if (callsignFromAddr && availableFromCallsigns.value.includes(callsignFromAddr)) {
    selectedFromCallsign.value = callsignFromAddr
  } else if (availableFromCallsigns.value.length > 0) {
    // 退回到第一个可用呼号
    selectedFromCallsign.value = availableFromCallsigns.value[0]
  }
}

// 创建临时 station client（按需连接，用完即关）
function createStationClient() {
  if (!settings.fmoAddress.value) return null
  const host = normalizeHost(settings.fmoAddress.value)
  const fullAddress = `${settings.protocol.value}://${host}`
  return new FmoApiClient(fullAddress)
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
      const primaryId = speakingStatus.primaryAddressId.value
      if (primaryId) {
        await speakingStatus.getServerInfo(primaryId, true)
      }
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
      const primaryId = speakingStatus.primaryAddressId.value
      if (primaryId) {
        await speakingStatus.getServerInfo(primaryId, true)
      }
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
  const expired =
    !stationListFetchedAt.value || Date.now() - stationListFetchedAt.value > 60 * 60 * 1000
  if (expired) {
    fetchAllStations()
  }
}

function handleCloseStationList() {
  showStationList.value = false
}

async function fetchAllStations() {
  if (stationListLoading.value) return
  const client = createStationClient()
  if (!client) return
  stationListLoading.value = true
  try {
    const [list, pinnedList] = await Promise.all([
      client.getAllStations(),
      client.getAllPinnedStations()
    ])

    // 将收藏信息合并到服务器列表
    const pinnedUids = new Set(pinnedList.map((s) => s.uid))
    const mergedList = list.map((station) => ({
      ...station,
      isPinned: pinnedUids.has(station.uid)
    }))

    stationList.value = mergedList
    stationListFetchedAt.value = Date.now()
    // 写入 localStorage 缓存
    try {
      localStorage.setItem(
        'stationListCache',
        JSON.stringify({ list: stationList.value, fetchedAt: stationListFetchedAt.value })
      )
    } catch (e) {
      console.error('保存服务器列表缓存失败:', e)
    }
  } catch (e) {
    console.error('获取服务器列表失败:', e)
  } finally {
    stationListLoading.value = false
    client.close()
  }
}

function handleRefreshStationList() {
  fetchAllStations()
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
      const primaryId = speakingStatus.primaryAddressId.value
      if (primaryId) {
        await speakingStatus.getServerInfo(primaryId, true)
      }
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

async function handleShowCallsignRecords(payload) {
  let callsign = payload
  let timestamp = null
  if (typeof payload === 'object' && payload !== null) {
    callsign = payload.callsign
    timestamp = payload.timestamp
  }
  await callsignRecords.showCallsignRecordsModal(callsign, selectedFromCallsign.value, timestamp)
}

// 数据库操作
function triggerFileInput() {
  fileInputRef.value?.click()
}

async function handleFileSelect(event) {
  const files = event.target.files
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
  const confirmed = await confirmDialog.show('确定要清空所有通联日志吗？此操作不可恢复。')
  if (!confirmed) {
    return
  }
  await clearAllData()
  dataQuery.queryResult.value = null
  dataQuery.top20Result.value = null
  dataQuery.oldFriendsResult.value = null
  dataQuery.searchKeyword.value = ''
  dataQuery.oldFriendsSearchKeyword.value = ''
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

// 导出ADIF文件
async function handleExportAdif() {
  try {
    loading.value = true
    const appVersion = packageInfo.version
    const result = await exportDataToAdif(selectedFromCallsign.value, appVersion)

    // 创建 Blob 并下载
    const blob = new Blob([result.content], { type: 'text/plain' })
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
    toast.error(`导出ADIF失败: ${err.message}`)
  }
}

// FMO 地址管理
async function handleAddAddress({ name, host, protocol }) {
  const result = await settings.addFmoAddress(name, host, protocol)
  if (!result.success) {
    toast.warning(result.message)
    return
  }

  // 如果正在播放音频，先停止（地址切换需要重新连接）
  if (isAudioPlaying.value) {
    stopAudio()
  }

  // 添加成功后重连到新地址
  if (result.reconnect) {
    speakingStatus.disconnectEventWs('single')
    fmoSync.stopAutoSyncTask()
    messageService.disconnect()
    speakingStatus.connectEventWs(settings.fmoAddress.value, settings.protocol.value)
    speakingStatus.setOnMessageCallback((data) => {
      messageService.handleNewMessageSummary(data)
    })
    messageService.connect(settings.fmoAddress.value, settings.protocol.value).catch((err) => {
      console.error('消息服务连接失败:', err)
    })
    fmoSync.startAutoSyncTask(getSyncAddresses)
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

  // 如果正在播放音频，先停止（地址切换需要重新连接）
  if (isAudioPlaying.value) {
    stopAudio()
  }

  // 如果删除的是当前选中地址，需要重连
  if (result.reconnect) {
    messageService.disconnect()

    if (settings.multiSelectMode.value && settings.selectedAddressIds.value.length > 0) {
      // 多选模式：重建 events 连接
      speakingStatus.disconnectAllEventWs()
      const selectedAddresses = settings.addressList.value
        .filter((a) => settings.selectedAddressIds.value.includes(a.id))
        .map((a) => ({ id: a.id, host: a.host, protocol: a.protocol }))
      speakingStatus.connectMultipleEventWs(selectedAddresses, settings.activeAddressId.value)
    } else if (settings.fmoAddress.value) {
      // 单选模式：连接到新的选中地址
      speakingStatus.disconnectEventWs('single')
      speakingStatus.connectEventWs(settings.fmoAddress.value, settings.protocol.value)
    } else {
      // 没有地址了，断开所有连接
      speakingStatus.disconnectAllEventWs()
    }

    speakingStatus.setOnMessageCallback((data) => {
      messageService.handleNewMessageSummary(data)
    })

    if (settings.fmoAddress.value) {
      messageService.connect(settings.fmoAddress.value, settings.protocol.value).catch((err) => {
        console.error('消息服务连接失败:', err)
      })
    }
    // 定时同步不需要重启（因为用的是 getAddresses 函数，自动获取最新地址）
  }
}

async function handleSelectAddress(id) {
  // 如果正在播放音频，先停止（地址切换需要重新连接）
  if (isAudioPlaying.value) {
    stopAudio()
  }

  const result = await settings.selectFmoAddress(id)

  if (result.success) {
    if (result.reconnect) {
      // 切换主服务器时需要重建 events 连接（因为 primaryId 变了）
      if (settings.multiSelectMode.value && settings.selectedAddressIds.value.length > 0) {
        // 多选模式：重建所有 events 连接
        speakingStatus.disconnectAllEventWs()
        const selectedAddresses = settings.addressList.value
          .filter((a) => settings.selectedAddressIds.value.includes(a.id))
          .map((a) => ({ id: a.id, host: a.host, protocol: a.protocol }))
        speakingStatus.connectMultipleEventWs(selectedAddresses, id)
      } else {
        // 单选模式：保持现有逻辑
        speakingStatus.disconnectEventWs('single')
        speakingStatus.connectEventWs(settings.fmoAddress.value, settings.protocol.value)
      }

      speakingStatus.setOnMessageCallback((data) => {
        messageService.handleNewMessageSummary(data)
      })
      messageService.disconnect()
      messageService.connect(settings.fmoAddress.value, settings.protocol.value).catch((err) => {
        console.error('消息服务连接失败:', err)
      })
      // 定时同步不需要重启（因为用的是 getAddresses 函数，自动获取最新地址）
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

  // 如果正在播放音频，先停止
  if (isAudioPlaying.value) {
    stopAudio()
  }

  // 断开连接并停止同步任务
  if (result.reconnect) {
    speakingStatus.disconnectAllEventWs()
    messageService.disconnect()
    fmoSync.stopAutoSyncTask()
  }
}

async function handleRefreshUserInfo(id, onDone) {
  const result = await settings.refreshUserInfo(id)

  if (result.success) {
    toast.success(result.message)
  } else {
    toast.error(result.message)
  }
  onDone?.()
}

async function handleSyncDays(days = 1) {
  try {
    await fmoSync.syncToday(settings.fmoAddress.value, settings.protocol.value, days)
  } catch (err) {
    dataQuery.error.value = `同步失败: ${err.message}`
  }
}

async function handleSyncIncremental() {
  try {
    await fmoSync.syncIncremental(settings.fmoAddress.value, settings.protocol.value)
  } catch (err) {
    dataQuery.error.value = `增量同步失败: ${err.message}`
  }
}

async function handleSyncFull() {
  try {
    await fmoSync.syncFull(settings.fmoAddress.value, settings.protocol.value)
  } catch (err) {
    dataQuery.error.value = `全量同步失败: ${err.message}`
  }
}

// 多地址同步处理
async function handleSyncMultiple({ syncType, days }) {
  // 获取选中的地址对象
  const selectedIds = settings.selectedAddressIds.value
  const addresses = settings.addressList.value.filter((addr) => selectedIds.includes(addr.id))

  if (addresses.length === 0) {
    toast.error('未选择任何地址')
    return
  }

  try {
    await fmoSync.syncMultiple(addresses, syncType, days)

    // 同步完成后，检查失败的地址并取消选中
    const failedResults = fmoSync.multiSyncProgress.value.results.filter((r) => !r.success)
    if (failedResults.length > 0) {
      // 取消选中失败的地址
      for (const result of failedResults) {
        if (settings.selectedAddressIds.value.includes(result.addressId)) {
          settings.toggleAddressSelection(result.addressId)
        }
      }
      // 显示失败提示
      const failedNames = failedResults.map((r) => r.name).join('、')
      toast.error(`以下服务器同步失败: ${failedNames}`)
    }
  } catch (err) {
    dataQuery.error.value = `多地址同步失败: ${err.message}`
  }
}

// 多选模式下验证并选中地址
async function handleValidateAndSelect({ id, host, protocol }) {
  try {
    // 测试连接
    const isConnected = await settings.validateConnection(host, protocol)

    if (isConnected) {
      // 连接成功，选中该地址
      settings.toggleAddressSelection(id)

      // 选中后重建 events 连接（因为选中地址列表变了）
      speakingStatus.disconnectAllEventWs()
      const selectedAddresses = settings.addressList.value
        .filter((a) => settings.selectedAddressIds.value.includes(a.id) || a.id === id)
        .map((a) => ({ id: a.id, host: a.host, protocol: a.protocol }))
      speakingStatus.connectMultipleEventWs(selectedAddresses, settings.activeAddressId.value)
    } else {
      // 连接失败，显示提示
      toast.error(`连接失败: ${host}`)
    }
  } catch (err) {
    toast.error(`连接验证失败: ${err.message}`)
  } finally {
    // connecting 状态由页面自行管理
  }
}

// 处理多选模式切换
async function handleSetMultiSelectMode(value) {
  const oldMode = settings.multiSelectMode.value
  const newMode = value

  // 如果正在播放音频，先停止（地址切换需要重新连接）
  if (isAudioPlaying.value) {
    stopAudio()
  }

  // 先更新设置
  await settings.setMultiSelectMode(value)

  // 如果模式发生变化，重建 events 连接和定时同步
  if (oldMode !== newMode) {
    if (newMode) {
      // 从单选切到多选
      speakingStatus.disconnectEventWs('single')
      if (settings.selectedAddressIds.value.length > 0) {
        const selectedAddresses = settings.addressList.value
          .filter((a) => settings.selectedAddressIds.value.includes(a.id))
          .map((a) => ({ id: a.id, host: a.host, protocol: a.protocol }))
        speakingStatus.connectMultipleEventWs(selectedAddresses, settings.activeAddressId.value)
      }
    } else {
      // 从多选切到单选
      speakingStatus.disconnectAllEventWs()
      if (settings.fmoAddress.value) {
        speakingStatus.connectEventWs(settings.fmoAddress.value, settings.protocol.value)
      }
    }

    // 重建定时同步（使用新的 getAddresses 函数）
    fmoSync.stopAutoSyncTask()
    fmoSync.startAutoSyncTask(getSyncAddresses)
  }
}

// 处理地址选择切换（多选模式下）
async function handleToggleAddressSelection(id) {
  const isCurrentlySelected = settings.selectedAddressIds.value.includes(id)

  // 如果正在播放音频，先停止（地址切换需要重新连接）
  if (isAudioPlaying.value) {
    stopAudio()
  }

  // 执行 toggle
  await settings.toggleAddressSelection(id)

  // 如果是取消选择，需要清理连接和数据
  if (isCurrentlySelected) {
    // 断开该服务器的 events 连接并清理发言数据
    speakingStatus.disconnectEventWs(id)

    // 判断是否需要切换主服务器
    const remainingSelected = settings.selectedAddressIds.value
    const wasPrimary = id === settings.activeAddressId.value

    if (wasPrimary && remainingSelected.length > 0) {
      // 切换主服务器到剩余选中中 numId 最小的
      const smallestAddr = settings.addressList.value
        .filter((a) => remainingSelected.includes(a.id))
        .sort((a, b) => (a.numId || Infinity) - (b.numId || Infinity))[0]

      if (smallestAddr) {
        // 设置新的主服务器
        await settings.setActiveAddressId(smallestAddr.id)
      }
    }

    // 重建剩余服务器的 events 连接
    if (remainingSelected.length > 0) {
      connectEventsWebSocket()
    } else {
      speakingStatus.disconnectAllEventWs()
    }

    // 重启同步任务
    fmoSync.stopAutoSyncTask()
    if (remainingSelected.length > 0) {
      fmoSync.startAutoSyncTask(getSyncAddresses)
    }
  } else {
    // 新增选择：重建连接以包含新服务器
    connectEventsWebSocket()
  }
}

// 监听
watch(showSpeakingHistory, async (newValue) => {
  if (newValue) {
    await settings.loadTodayContactedCallsigns(selectedFromCallsign.value)
    await settings.loadContactCounts(selectedFromCallsign.value)
  }
})

watch(
  () => selectedFromCallsign.value,
  async (newVal) => {
    if (newVal) {
      await settings.loadContactCounts(newVal)
    }
    if (showSpeakingHistory.value && newVal) {
      await settings.loadTodayContactedCallsigns(newVal)
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

// 监听 activeAddress 变化，自动推断呼号
watch(
  () => settings.activeAddress.value,
  () => {
    if (dbLoaded.value && availableFromCallsigns.value.length > 0) {
      inferFromCallsign()
    }
  },
  { deep: true }
)

// 监听 availableFromCallsigns 变化，自动推断呼号
watch(
  () => availableFromCallsigns.value,
  (newVal) => {
    if (newVal.length > 0 && dbLoaded.value) {
      inferFromCallsign()
    }
  }
)

// 音频控制
function handleToggleAudio() {
  toggleAudio(settings.fmoAddress.value, settings.protocol.value)
  // 同步播放状态到缓存
  settings.setAudioPlaying(isAudioPlaying.value)
  // 如果刚开始播放，应用用户设定的音量
  if (isAudioPlaying.value && !isAudioMuted.value) {
    setAudioVolumePlayer(settings.audioVolume.value)
  }
}

// 恢复音频播放状态（页面加载时调用）
function restoreAudioPlayback() {
  if (settings.audioPlaying.value && settings.fmoAddress.value) {
    toggleAudio(settings.fmoAddress.value, settings.protocol.value)
    if (isAudioPlaying.value && !isAudioMuted.value) {
      setAudioVolumePlayer(settings.audioVolume.value)
    }
    // 注册一次性用户交互监听，恢复 AudioContext
    setupAudioContextResume()
  }
}

function setupAudioContextResume() {
  const handler = () => {
    resumeAudio()
    document.removeEventListener('click', handler)
    document.removeEventListener('touchstart', handler)
  }
  document.addEventListener('click', handler, { once: true })
  document.addEventListener('touchstart', handler, { once: true })
}

// 处理音量更新
function handleUpdateAudioVolume(value) {
  settings.setAudioVolume(value)
  // 如果正在播放且未静音，实时应用新音量
  if (isAudioPlaying.value && !isAudioMuted.value) {
    setAudioVolumePlayer(value)
  }
}

// 监听 isAudioPlaying 变化，同步到 settings
watch(isAudioPlaying, (val) => {
  settings.setAudioPlaying(val)
})

// 自动静音：当自己在发言时自动静音
watch(
  () => speakingStatus.currentSpeaker.value,
  (speaker) => {
    if (!isAudioPlaying.value) return
    if (speaker && speaker === selectedFromCallsign.value) {
      muteAudio()
    } else {
      unmuteAudio(settings.audioVolume.value)
    }
  }
)

// 获取同步地址列表的函数（用于定时同步）
function getSyncAddresses() {
  if (settings.multiSelectMode.value && settings.selectedAddressIds.value.length > 0) {
    return settings.addressList.value
      .filter((a) => settings.selectedAddressIds.value.includes(a.id))
      .map((a) => ({ id: a.id, host: a.host, protocol: a.protocol }))
  }
  // 单选模式
  if (settings.fmoAddress.value) {
    return [{ id: 'single', host: settings.fmoAddress.value, protocol: settings.protocol.value }]
  }
  return []
}

// 连接 events WebSocket（根据当前模式）
function connectEventsWebSocket() {
  const hasSavedAddress = settings.addressList.value.length > 0
  if (!hasSavedAddress) return

  if (settings.multiSelectMode.value && settings.selectedAddressIds.value.length > 0) {
    // 多选模式：连接所有选中地址的 events
    const selectedAddresses = settings.addressList.value
      .filter((a) => settings.selectedAddressIds.value.includes(a.id))
      .map((a) => ({ id: a.id, host: a.host, protocol: a.protocol }))
    speakingStatus.connectMultipleEventWs(selectedAddresses, settings.activeAddressId.value)
  } else {
    // 单选模式：保持原有单连接
    speakingStatus.connectEventWs(settings.fmoAddress.value, settings.protocol.value)
  }
}

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
    // 数据库加载后执行呼号自动推断
    inferFromCallsign()
  }

  const hasSavedAddress = await settings.initFmoAddress()
  if (hasSavedAddress) {
    // 根据模式连接 events
    connectEventsWebSocket()

    // 注册消息事件回调，让 speakingStatus 的 events 连接转发消息摘要
    speakingStatus.setOnMessageCallback((data) => {
      messageService.handleNewMessageSummary(data)
    })
    // 按需获取消息列表（短连接，获取后自动断开）- 只连主服务器
    messageService.getList(settings.fmoAddress.value, settings.protocol.value, 0).catch((err) => {
      console.error('获取消息列表失败:', err)
    })
  }

  // 定时同步：使用 getAddresses 函数模式
  fmoSync.startAutoSyncTask(getSyncAddresses)

  // 恢复音频播放状态（地址初始化完成后）
  restoreAudioPlayback()
})

onUnmounted(() => {
  if (scrollTimer) clearTimeout(scrollTimer)
  contentAreaRef.value?.removeEventListener('scroll', handleScroll)

  fmoSync.stopAutoSyncTask()
  speakingStatus.stopSpeakingHistoryCleanup()
  speakingStatus.disconnectAllEventWs()
  messageService.disconnect()
})

// 提供共享状态给子组件
provide('dbLoaded', dbLoaded)
provide('selectedFromCallsign', selectedFromCallsign)
provide('executeQuery', executeQuery)
provide('fmoAddress', settings.fmoAddress)
provide('protocol', settings.protocol)
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
  position: relative;
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
  color: var(--color-success);
}

.mobile-nav .nav-tab.disabled {
  color: var(--text-disabled);
  cursor: not-allowed;
  pointer-events: none;
}

.nav-icon {
  color: currentColor;
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
  overflow-y: auto;
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
    padding: 0 0.5rem 0.5rem;
    overflow-y: auto;
    min-height: 0;
  }

  .mobile-nav {
    display: flex;
  }

  .mobile-unread-badge {
    position: absolute;
    top: 0.25rem;
    right: calc(50% - 1.2rem);
    width: 7px;
    height: 7px;
    background: #ef4444;
    border-radius: 50%;
    border: 1.5px solid var(--bg-header, var(--bg-page));
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
