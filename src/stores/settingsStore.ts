import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
// @ts-ignore - legacy JS
import {
  saveFmoAddresses,
  getFmoAddresses,
  getAllRecordsFromIndexedDB,
  getContactCountsFromIndexedDB
} from '../services/db'
// @ts-ignore - legacy JS
import { FmoApiClient } from '../services/fmoApi'
// @ts-ignore - legacy JS
import {
  buildWebSocketUrl,
  normalizeHost,
  normalizeWebSocketEndpoint
} from '../utils/urlUtils'
// @ts-ignore - legacy JS
import { downloadRemoteFile } from '../utils/exportFile'
import { getPlatform } from '../platform'
import {
  DEFAULT_THEME_ID,
  applyThemeCss,
  clearAppliedThemeCss,
  normalizeThemeCss,
  type CustomThemePreset,
  type ThemeActionResult
} from '../utils/themeManager'

const AUDIO_VOLUME_KEY = 'fmo_audio_volume'
const AUDIO_PLAYING_KEY = 'fmo_audio_playing'
const PRIORITIZE_TODAY_KEY = 'fmo_prioritize_today'
const CUSTOM_THEMES_KEY = 'fmo_custom_themes'
const ACTIVE_THEME_KEY = 'fmo_active_theme'
const DASHBOARD_CONFIG_KEY = 'fmo_dashboard_config'
const LEGACY_DASHBOARD_LAYOUT_KEY = 'fmo_dashboard_layout'
const LEGACY_DASHBOARD_HERO_ELEMENTS_KEY = 'fmo_dashboard_hero_elements'
const LEGACY_DASHBOARD_STATION_INFO_LAYOUT_KEY = 'fmo_dashboard_station_info_layout'

export type DashboardPanelId =
  | 'reachability-info'
  | 'recent-speaking'
  | 'speaking-history'
  | 'today-contacts'

export interface DashboardPanelLayout {
  id: DashboardPanelId
  visible: boolean
}

export type DashboardStationInfoCardId =
  | 'station'
  | 'contact-stats'
  | 'device'
  | 'radio-setup'
  | 'coordinate'
  | 'grid'
  | 'screen-mode'

export interface DashboardStationInfoCardLayout {
  id: DashboardStationInfoCardId
  visible: boolean
}

export type DashboardHeroElementId =
  | 'local-time'
  | 'utc-time'
  | 'watermark'
  | 'callsign'
  | 'contact-meta'
  | 'server-name'
  | 'grid'
  | 'address'
  | 'geo'
  | 'duration'

export type DashboardHeroElementVisibility = Record<DashboardHeroElementId, boolean>

const DEFAULT_DASHBOARD_LAYOUT: DashboardPanelLayout[] = [
  { id: 'reachability-info', visible: true },
  { id: 'recent-speaking', visible: true },
  { id: 'speaking-history', visible: true },
  { id: 'today-contacts', visible: true }
]

const DEFAULT_DASHBOARD_STATION_INFO_LAYOUT: DashboardStationInfoCardLayout[] = [
  { id: 'station', visible: true },
  { id: 'contact-stats', visible: true },
  { id: 'device', visible: true },
  { id: 'radio-setup', visible: true },
  { id: 'coordinate', visible: true },
  { id: 'grid', visible: true },
  { id: 'screen-mode', visible: true }
]

const DEFAULT_DASHBOARD_HERO_ELEMENTS: DashboardHeroElementVisibility = {
  'local-time': true,
  'utc-time': true,
  watermark: true,
  callsign: true,
  'contact-meta': true,
  'server-name': true,
  grid: true,
  address: true,
  geo: true,
  duration: true
}

interface UserInfo {
  callsign: string
  uid: number | null
  wlanIP: string
}

interface AddressItem {
  id: string
  numId?: number
  name: string
  host: string
  protocol: string
  userInfo?: UserInfo
}

interface AddressStorage {
  addresses: AddressItem[]
  activeId: string | null
  selectedIds: string[]
  multiSelectMode?: boolean
}

interface ActionResult {
  success: boolean
  message?: string
  reconnect?: boolean
  id?: string
}

interface ThemeStorage {
  themes: CustomThemePreset[]
  activeId: string
}

interface DashboardConfigStorage {
  layout?: unknown
  heroElements?: unknown
  stationInfoLayout?: unknown
}

/**
 * 设置/存储 store（替代 composables/useSettings.js）。
 *
 * 职责：
 * - 多地址管理（fmoAddresses 通过 db.js 的 IndexedDB 读写）
 * - 全局音量、音频播放状态（通过 platform.storage 跨端持久化）
 * - 今日通联呼号、通联次数（从 IndexedDB 派生）
 * - 备份导出、连接验证、用户信息刷新等 actions
 */
export const useSettingsStore = defineStore('settings', () => {
  // ========== state ==========
  const fmoAddressStorage = ref<AddressStorage>({
    addresses: [],
    activeId: null,
    selectedIds: []
  })
  const todayContactedCallsigns = ref<Set<string>>(new Set())
  const contactCounts = ref<Map<string, number>>(new Map())

  const selectedAddressIds = ref<string[]>([])
  const multiSelectMode = ref(false)

  const audioVolume = ref(100)
  const audioPlaying = ref(false)
  const prioritizeToday = ref(false)
  const customThemes = ref<CustomThemePreset[]>([])
  const activeThemeId = ref(DEFAULT_THEME_ID)
  const dashboardLayout = ref<DashboardPanelLayout[]>(cloneDefaultDashboardLayout())
  const dashboardStationInfoLayout = ref<DashboardStationInfoCardLayout[]>(
    cloneDefaultDashboardStationInfoLayout()
  )
  const dashboardHeroElements = ref<DashboardHeroElementVisibility>(
    cloneDefaultDashboardHeroElements()
  )

  const isHttps = window.location.protocol === 'https:'
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )

  // ========== getters ==========
  const activeAddress = computed<AddressItem | null>(() => {
    if (!fmoAddressStorage.value.activeId) return null
    return (
      fmoAddressStorage.value.addresses.find((a) => a.id === fmoAddressStorage.value.activeId) ||
      null
    )
  })

  const fmoAddress = computed(() => activeAddress.value?.host || '')
  const protocol = computed(() => activeAddress.value?.protocol || 'ws')
  const addressList = computed(() => fmoAddressStorage.value.addresses)
  const activeAddressId = computed(() => fmoAddressStorage.value.activeId)

  const remoteControlUrl = computed(() => {
    if (!fmoAddress.value) return '#'
    const host = normalizeHost(fmoAddress.value)
    return `http://${host}/remote.html`
  })

  const themeList = computed(() => [
    {
      id: DEFAULT_THEME_ID,
      name: '默认主题',
      css: '',
      createdAt: 0,
      updatedAt: 0,
      builtin: true
    },
    ...customThemes.value.map((theme) => ({
      ...theme,
      builtin: false
    }))
  ])

  function normalizeAddressItem(address: AddressItem): boolean {
    const endpoint = normalizeWebSocketEndpoint(address.host, address.protocol)
    if (!endpoint.host) return false

    const changed = address.host !== endpoint.host || address.protocol !== endpoint.protocol
    if (changed) {
      address.host = endpoint.host
      address.protocol = endpoint.protocol
    }
    return changed
  }

  function cloneDefaultDashboardLayout(): DashboardPanelLayout[] {
    return DEFAULT_DASHBOARD_LAYOUT.map((panel) => ({ ...panel }))
  }

  function cloneDefaultDashboardStationInfoLayout(): DashboardStationInfoCardLayout[] {
    return DEFAULT_DASHBOARD_STATION_INFO_LAYOUT.map((card) => ({ ...card }))
  }

  function cloneDefaultDashboardHeroElements(): DashboardHeroElementVisibility {
    return { ...DEFAULT_DASHBOARD_HERO_ELEMENTS }
  }

  function normalizeDashboardLayout(value: unknown): DashboardPanelLayout[] {
    const knownIds = new Set(DEFAULT_DASHBOARD_LAYOUT.map((panel) => panel.id))
    const normalized: DashboardPanelLayout[] = []

    if (Array.isArray(value)) {
      for (const item of value) {
        if (
          item &&
          typeof item === 'object' &&
          'id' in item &&
          typeof item.id === 'string' &&
          knownIds.has(item.id as DashboardPanelId) &&
          !normalized.some((panel) => panel.id === item.id)
        ) {
          normalized.push({
            id: item.id as DashboardPanelId,
            visible: !('visible' in item) || item.visible !== false
          })
        }
      }
    }

    for (const [defaultIndex, panel] of DEFAULT_DASHBOARD_LAYOUT.entries()) {
      if (!normalized.some((item) => item.id === panel.id)) {
        normalized.splice(Math.min(defaultIndex, normalized.length), 0, { ...panel })
      }
    }

    return normalized
  }

  function normalizeDashboardStationInfoLayout(value: unknown): DashboardStationInfoCardLayout[] {
    const knownIds = new Set(DEFAULT_DASHBOARD_STATION_INFO_LAYOUT.map((card) => card.id))
    const normalized: DashboardStationInfoCardLayout[] = []

    if (Array.isArray(value)) {
      for (const item of value) {
        if (
          item &&
          typeof item === 'object' &&
          'id' in item &&
          typeof item.id === 'string' &&
          knownIds.has(item.id as DashboardStationInfoCardId) &&
          !normalized.some((card) => card.id === item.id)
        ) {
          normalized.push({
            id: item.id as DashboardStationInfoCardId,
            visible: !('visible' in item) || item.visible !== false
          })
        }
      }
    }

    for (const [defaultIndex, card] of DEFAULT_DASHBOARD_STATION_INFO_LAYOUT.entries()) {
      if (!normalized.some((item) => item.id === card.id)) {
        normalized.splice(Math.min(defaultIndex, normalized.length), 0, { ...card })
      }
    }

    return normalized
  }

  function normalizeDashboardHeroElements(value: unknown): DashboardHeroElementVisibility {
    if (!value || typeof value !== 'object') return cloneDefaultDashboardHeroElements()

    const parsed = value as Record<string, unknown>
    const legacyClockVisible = typeof parsed.clock === 'boolean' ? parsed.clock : undefined
    const legacySpeakerDetailsVisible =
      typeof parsed['speaker-details'] === 'boolean' ? parsed['speaker-details'] : undefined

    return Object.fromEntries(
      Object.entries(DEFAULT_DASHBOARD_HERO_ELEMENTS).map(([id, defaultVisible]) => {
        let visible = typeof parsed[id] === 'boolean' ? parsed[id] : defaultVisible
        if ((id === 'local-time' || id === 'utc-time') && legacyClockVisible !== undefined) {
          visible = legacyClockVisible
        }
        if (
          (id === 'server-name' || id === 'grid' || id === 'address') &&
          legacySpeakerDetailsVisible !== undefined
        ) {
          visible = legacySpeakerDetailsVisible
        }
        return [id, visible]
      })
    ) as DashboardHeroElementVisibility
  }

  async function persistDashboardConfig() {
    await getPlatform().storage.set(
      DASHBOARD_CONFIG_KEY,
      JSON.stringify({
        layout: dashboardLayout.value,
        heroElements: dashboardHeroElements.value,
        stationInfoLayout: dashboardStationInfoLayout.value
      })
    )
  }

  async function initDashboardLayout() {
    const savedConfig = await getPlatform().storage.get(DASHBOARD_CONFIG_KEY)
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig) as DashboardConfigStorage
        dashboardLayout.value = normalizeDashboardLayout(parsed.layout)
        dashboardStationInfoLayout.value = normalizeDashboardStationInfoLayout(
          parsed.stationInfoLayout
        )
        dashboardHeroElements.value = normalizeDashboardHeroElements(parsed.heroElements)
        return
      } catch (error) {
        console.error('解析 Dashboard 配置失败:', error)
      }
    }

    let migrated = false

    const saved = await getPlatform().storage.get(LEGACY_DASHBOARD_LAYOUT_KEY)
    if (saved) {
      try {
        dashboardLayout.value = normalizeDashboardLayout(JSON.parse(saved))
        migrated = true
      } catch (error) {
        console.error('解析 Dashboard 布局失败:', error)
        dashboardLayout.value = cloneDefaultDashboardLayout()
      }
    }

    const savedStationInfoLayout = await getPlatform().storage.get(
      LEGACY_DASHBOARD_STATION_INFO_LAYOUT_KEY
    )
    if (savedStationInfoLayout) {
      try {
        dashboardStationInfoLayout.value = normalizeDashboardStationInfoLayout(
          JSON.parse(savedStationInfoLayout)
        )
        migrated = true
      } catch (error) {
        console.error('解析 Dashboard 可达性卡片布局失败:', error)
        dashboardStationInfoLayout.value = cloneDefaultDashboardStationInfoLayout()
      }
    }

    const savedHeroElements = await getPlatform().storage.get(LEGACY_DASHBOARD_HERO_ELEMENTS_KEY)
    if (savedHeroElements) {
      try {
        dashboardHeroElements.value = normalizeDashboardHeroElements(JSON.parse(savedHeroElements))
        migrated = true
      } catch (error) {
        console.error('解析 Dashboard 当前发言卡片设置失败:', error)
        dashboardHeroElements.value = cloneDefaultDashboardHeroElements()
      }
    }

    if (migrated) {
      await persistDashboardConfig()
    }
  }

  async function moveDashboardPanel(id: DashboardPanelId, direction: -1 | 1) {
    const currentIndex = dashboardLayout.value.findIndex((panel) => panel.id === id)
    if (currentIndex < 0) {
      return
    }

    let targetIndex = currentIndex + direction
    while (
      targetIndex >= 0 &&
      targetIndex < dashboardLayout.value.length &&
      !dashboardLayout.value[targetIndex].visible
    ) {
      targetIndex += direction
    }

    if (targetIndex < 0 || targetIndex >= dashboardLayout.value.length) return

    const nextLayout = [...dashboardLayout.value]
    const targetPanel = nextLayout[targetIndex]
    nextLayout[targetIndex] = nextLayout[currentIndex]
    nextLayout[currentIndex] = targetPanel
    dashboardLayout.value = nextLayout
    await persistDashboardConfig()
  }

  async function setDashboardPanelVisible(id: DashboardPanelId, visible: boolean) {
    dashboardLayout.value = dashboardLayout.value.map((panel) =>
      panel.id === id ? { ...panel, visible } : panel
    )
    await persistDashboardConfig()
  }

  async function moveDashboardStationInfoCard(id: DashboardStationInfoCardId, direction: -1 | 1) {
    const currentIndex = dashboardStationInfoLayout.value.findIndex((card) => card.id === id)
    if (currentIndex < 0) {
      return
    }

    let targetIndex = currentIndex + direction
    while (
      targetIndex >= 0 &&
      targetIndex < dashboardStationInfoLayout.value.length &&
      !dashboardStationInfoLayout.value[targetIndex].visible
    ) {
      targetIndex += direction
    }

    if (targetIndex < 0 || targetIndex >= dashboardStationInfoLayout.value.length) return

    const nextLayout = [...dashboardStationInfoLayout.value]
    const targetCard = nextLayout[targetIndex]
    nextLayout[targetIndex] = nextLayout[currentIndex]
    nextLayout[currentIndex] = targetCard
    dashboardStationInfoLayout.value = nextLayout
    await persistDashboardConfig()
  }

  async function setDashboardStationInfoCardVisible(
    id: DashboardStationInfoCardId,
    visible: boolean
  ) {
    dashboardStationInfoLayout.value = dashboardStationInfoLayout.value.map((card) =>
      card.id === id ? { ...card, visible } : card
    )
    await persistDashboardConfig()
  }

  async function resetDashboardLayout() {
    dashboardLayout.value = cloneDefaultDashboardLayout()
    dashboardStationInfoLayout.value = cloneDefaultDashboardStationInfoLayout()
    dashboardHeroElements.value = cloneDefaultDashboardHeroElements()
    await persistDashboardConfig()
  }

  async function setDashboardHeroElementVisible(id: DashboardHeroElementId, visible: boolean) {
    dashboardHeroElements.value = {
      ...dashboardHeroElements.value,
      [id]: visible
    }
    await persistDashboardConfig()
  }

  // ========== 音量 / 播放状态（走 platform.storage） ==========
  async function initAudioVolume() {
    const saved = await getPlatform().storage.get(AUDIO_VOLUME_KEY)
    if (saved !== null) {
      const val = Number(saved)
      if (!isNaN(val) && val >= 0 && val <= 200) {
        audioVolume.value = val
      }
    }
  }

  async function setAudioVolume(value: number | string) {
    const num = Number(value)
    const val = Math.max(0, Math.min(200, isNaN(num) ? 100 : num))
    audioVolume.value = val
    await getPlatform().storage.set(AUDIO_VOLUME_KEY, String(val))
  }

  async function initAudioPlaying() {
    const saved = await getPlatform().storage.get(AUDIO_PLAYING_KEY)
    audioPlaying.value = saved === 'true'
  }

  async function setAudioPlaying(value: boolean) {
    audioPlaying.value = !!value
    await getPlatform().storage.set(AUDIO_PLAYING_KEY, String(!!value))
  }

  async function initPrioritizeToday() {
    const saved = await getPlatform().storage.get(PRIORITIZE_TODAY_KEY)
    prioritizeToday.value = saved === 'true'
  }

  async function setPrioritizeToday(value: boolean) {
    prioritizeToday.value = !!value
    await getPlatform().storage.set(PRIORITIZE_TODAY_KEY, String(!!value))
  }

  async function loadThemeStorage(): Promise<ThemeStorage> {
    const savedThemes = await getPlatform().storage.get(CUSTOM_THEMES_KEY)
    const savedActiveId = await getPlatform().storage.get(ACTIVE_THEME_KEY)

    let themes: CustomThemePreset[] = []
    if (savedThemes) {
      try {
        const parsed = JSON.parse(savedThemes)
        if (Array.isArray(parsed)) {
          themes = parsed
            .filter(
              (item) =>
                item &&
                typeof item.id === 'string' &&
                typeof item.name === 'string' &&
                typeof item.css === 'string'
            )
            .map((item) => ({
              id: item.id,
              name: item.name,
              css: normalizeThemeCss(item.css),
              createdAt: Number(item.createdAt) || Date.now(),
              updatedAt: Number(item.updatedAt) || Date.now()
            }))
        }
      } catch (error) {
        console.error('解析主题配置失败:', error)
      }
    }

    return {
      themes,
      activeId: savedActiveId || DEFAULT_THEME_ID
    }
  }

  async function persistThemeStorage() {
    await getPlatform().storage.set(CUSTOM_THEMES_KEY, JSON.stringify(customThemes.value))
    await getPlatform().storage.set(ACTIVE_THEME_KEY, activeThemeId.value)
  }

  function applyActiveTheme() {
    if (activeThemeId.value === DEFAULT_THEME_ID) {
      clearAppliedThemeCss()
      return
    }

    const activeTheme = customThemes.value.find((theme) => theme.id === activeThemeId.value)
    if (!activeTheme) {
      activeThemeId.value = DEFAULT_THEME_ID
      clearAppliedThemeCss()
      return
    }

    applyThemeCss(activeTheme.css)
  }

  async function initThemeSettings() {
    const storage = await loadThemeStorage()
    customThemes.value = storage.themes
    activeThemeId.value = storage.activeId

    if (
      activeThemeId.value !== DEFAULT_THEME_ID &&
      !customThemes.value.some((theme) => theme.id === activeThemeId.value)
    ) {
      activeThemeId.value = DEFAULT_THEME_ID
    }

    applyActiveTheme()
    await persistThemeStorage()
  }

  async function importCustomTheme(name: string, cssText: string): Promise<ThemeActionResult> {
    const normalizedCss = normalizeThemeCss(cssText)
    const trimmedName = name.trim()

    if (!trimmedName) {
      return { success: false, message: '请输入主题名称' }
    }

    if (!normalizedCss) {
      return { success: false, message: 'CSS 内容不能为空' }
    }

    if (normalizedCss.length > 200 * 1024) {
      return { success: false, message: '主题文件过大，请控制在 200KB 内' }
    }

    const now = Date.now()
    const existing = customThemes.value.find((theme) => theme.name === trimmedName)

    if (existing) {
      existing.css = normalizedCss
      existing.updatedAt = now
      activeThemeId.value = existing.id
      applyActiveTheme()
      await persistThemeStorage()
      return { success: true, message: `已更新并启用主题：${trimmedName}` }
    }

    const theme: CustomThemePreset = {
      id: `theme_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      css: normalizedCss,
      createdAt: now,
      updatedAt: now
    }

    customThemes.value.unshift(theme)
    activeThemeId.value = theme.id
    applyActiveTheme()
    await persistThemeStorage()
    return { success: true, message: `已导入并启用主题：${trimmedName}` }
  }

  async function setActiveTheme(themeId: string): Promise<ThemeActionResult> {
    if (themeId !== DEFAULT_THEME_ID && !customThemes.value.some((theme) => theme.id === themeId)) {
      return { success: false, message: '主题不存在' }
    }

    activeThemeId.value = themeId
    applyActiveTheme()
    await persistThemeStorage()

    return {
      success: true,
      message: themeId === DEFAULT_THEME_ID ? '已切换到默认主题' : '主题已切换'
    }
  }

  async function deleteCustomTheme(themeId: string): Promise<ThemeActionResult> {
    const index = customThemes.value.findIndex((theme) => theme.id === themeId)
    if (index === -1) {
      return { success: false, message: '主题不存在' }
    }

    const [removedTheme] = customThemes.value.splice(index, 1)
    if (activeThemeId.value === themeId) {
      activeThemeId.value = DEFAULT_THEME_ID
      clearAppliedThemeCss()
    }

    await persistThemeStorage()

    return { success: true, message: `已删除主题：${removedTheme.name}` }
  }

  async function renameCustomTheme(themeId: string, name: string): Promise<ThemeActionResult> {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return { success: false, message: '请输入主题名称' }
    }

    const targetTheme = customThemes.value.find((theme) => theme.id === themeId)
    if (!targetTheme) {
      return { success: false, message: '主题不存在' }
    }

    const duplicateTheme = customThemes.value.find(
      (theme) => theme.id !== themeId && theme.name === trimmedName
    )
    if (duplicateTheme) {
      return { success: false, message: '已存在同名主题' }
    }

    targetTheme.name = trimmedName
    targetTheme.updatedAt = Date.now()
    await persistThemeStorage()

    return { success: true, message: `已重命名为：${trimmedName}` }
  }

  // ========== 地址初始化与管理 ==========
  async function initFmoAddress(): Promise<boolean> {
    await initAudioVolume()
    await initAudioPlaying()
    await initPrioritizeToday()
    await initThemeSettings()
    await initDashboardLayout()

    const storage: AddressStorage = await getFmoAddresses()
    let addressStorageChanged = false
    storage.addresses.forEach((address) => {
      if (normalizeAddressItem(address)) addressStorageChanged = true
    })
    fmoAddressStorage.value = storage

    selectedAddressIds.value = storage.selectedIds || []
    multiSelectMode.value = storage.multiSelectMode || false

    if (storage.addresses.length > 0) {
      if (addressStorageChanged) await saveFmoAddresses(storage)

      if (storage.activeId) {
        const activeAddr = storage.addresses.find((a) => a.id === storage.activeId)
        if (activeAddr && !activeAddr.userInfo) {
          try {
            const host = normalizeHost(activeAddr.host)
            const fullAddress = `${activeAddr.protocol}://${host}`
            const client = new FmoApiClient(fullAddress)
            const userInfo = await client.getUserInfo()

            const index = fmoAddressStorage.value.addresses.findIndex(
              (a) => a.id === storage.activeId
            )
            if (index !== -1) {
              fmoAddressStorage.value.addresses[index] = {
                ...fmoAddressStorage.value.addresses[index],
                userInfo: {
                  callsign: userInfo.callsign || '',
                  uid: userInfo.uid || null,
                  wlanIP: userInfo.wlanIP || ''
                }
              }
              await saveFmoAddresses(fmoAddressStorage.value)
            }
            client.close()
          } catch (err) {
            console.log('初始化时获取用户信息失败:', err)
          }
        }
      }

      return true
    }

    return false
  }

  async function validateConnection(host: string, proto: string): Promise<boolean> {
    const wsUrl = buildWebSocketUrl(host, '/ws', proto)
    return new Promise((resolve) => {
      const socket = new WebSocket(wsUrl)
      const timeout = setTimeout(() => {
        socket.close()
        resolve(false)
      }, 5000)
      socket.onopen = () => {
        clearTimeout(timeout)
        socket.close()
        resolve(true)
      }
      socket.onerror = () => {
        clearTimeout(timeout)
        socket.close()
        resolve(false)
      }
    })
  }

  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 11)
  }

  function generateNumId(): number {
    const usedIds = new Set(fmoAddressStorage.value.addresses.map((a) => a.numId).filter(Boolean))
    let id = 1
    while (usedIds.has(id)) id++
    return id
  }

  async function toggleAddressSelection(id: string) {
    const index = selectedAddressIds.value.indexOf(id)
    if (index === -1) {
      selectedAddressIds.value.push(id)
    } else {
      selectedAddressIds.value.splice(index, 1)
    }
    fmoAddressStorage.value.selectedIds = [...selectedAddressIds.value]
    await saveFmoAddresses(fmoAddressStorage.value)
  }

  async function setMultiSelectMode(value: boolean) {
    multiSelectMode.value = value
    fmoAddressStorage.value.multiSelectMode = value
    await saveFmoAddresses(fmoAddressStorage.value)
  }

  async function addFmoAddress(name: string, host: string, proto: string): Promise<ActionResult> {
    const endpoint = normalizeWebSocketEndpoint(host, proto)
    const client = new FmoApiClient(`${endpoint.protocol}://${endpoint.host}`)
    if (!client.isValidAddress(endpoint.host)) {
      return { success: false, message: '请输入有效的IP地址或域名' }
    }

    const exists = fmoAddressStorage.value.addresses.some((a) => {
      const current = normalizeWebSocketEndpoint(a.host, a.protocol)
      return current.host === endpoint.host && current.protocol === endpoint.protocol
    })
    if (exists) {
      return { success: false, message: '该地址已存在' }
    }

    const id = generateId()
    const numId = generateNumId()
    const newAddress: AddressItem = {
      id,
      numId,
      name: name || endpoint.host,
      host: endpoint.host,
      protocol: endpoint.protocol
    }

    try {
      const fullAddress = `${endpoint.protocol}://${endpoint.host}`
      const apiClient = new FmoApiClient(fullAddress)
      const userInfo = await apiClient.getUserInfo()
      newAddress.userInfo = {
        callsign: userInfo.callsign || '',
        uid: userInfo.uid || null,
        wlanIP: userInfo.wlanIP || ''
      }
      apiClient.close()
    } catch (err) {
      console.log('获取用户信息失败:', err)
    }

    fmoAddressStorage.value.addresses.push(newAddress)
    fmoAddressStorage.value.activeId = id

    await saveFmoAddresses(fmoAddressStorage.value)
    return { success: true, message: '地址已添加', id, reconnect: true }
  }

  async function updateFmoAddress(
    id: string,
    name: string,
    host: string,
    proto: string
  ): Promise<ActionResult> {
    const index = fmoAddressStorage.value.addresses.findIndex((a) => a.id === id)
    if (index === -1) {
      return { success: false, message: '地址不存在' }
    }

    const endpoint = normalizeWebSocketEndpoint(host, proto)
    const client = new FmoApiClient(`${endpoint.protocol}://${endpoint.host}`)
    if (!client.isValidAddress(endpoint.host)) {
      return { success: false, message: '请输入有效的IP地址或域名' }
    }

    const duplicate = fmoAddressStorage.value.addresses.some((a, i) => {
      if (i === index) return false
      const current = normalizeWebSocketEndpoint(a.host, a.protocol)
      return current.host === endpoint.host && current.protocol === endpoint.protocol
    })
    if (duplicate) {
      return { success: false, message: '该地址已存在' }
    }

    fmoAddressStorage.value.addresses[index] = {
      ...fmoAddressStorage.value.addresses[index],
      name: name || endpoint.host,
      host: endpoint.host,
      protocol: endpoint.protocol
    }

    await saveFmoAddresses(fmoAddressStorage.value)
    return { success: true, message: '地址已更新' }
  }

  async function deleteFmoAddress(id: string): Promise<ActionResult> {
    const index = fmoAddressStorage.value.addresses.findIndex((a) => a.id === id)
    if (index === -1) {
      return { success: false, message: '地址不存在' }
    }

    const wasActive = fmoAddressStorage.value.activeId === id
    fmoAddressStorage.value.addresses.splice(index, 1)

    if (wasActive) {
      if (fmoAddressStorage.value.addresses.length > 0) {
        fmoAddressStorage.value.activeId = fmoAddressStorage.value.addresses[0].id
      } else {
        fmoAddressStorage.value.activeId = null
      }
    }

    const selectedIndex = selectedAddressIds.value.indexOf(id)
    if (selectedIndex !== -1) {
      selectedAddressIds.value.splice(selectedIndex, 1)
    }

    fmoAddressStorage.value.selectedIds = [...selectedAddressIds.value]
    await saveFmoAddresses(fmoAddressStorage.value)
    return { success: true, message: '地址已删除', reconnect: wasActive }
  }

  async function selectFmoAddress(id: string): Promise<ActionResult> {
    const address = fmoAddressStorage.value.addresses.find((a) => a.id === id)
    if (!address) {
      return { success: false, message: '地址不存在' }
    }

    const isConnected = await validateConnection(address.host, address.protocol)

    if (isConnected) {
      fmoAddressStorage.value.activeId = id

      try {
        const host = normalizeHost(address.host)
        const fullAddress = `${address.protocol}://${host}`
        const client = new FmoApiClient(fullAddress)
        const userInfo = await client.getUserInfo()

        const index = fmoAddressStorage.value.addresses.findIndex((a) => a.id === id)
        if (index !== -1) {
          fmoAddressStorage.value.addresses[index] = {
            ...fmoAddressStorage.value.addresses[index],
            userInfo: {
              callsign: userInfo.callsign || '',
              uid: userInfo.uid || null,
              wlanIP: userInfo.wlanIP || ''
            }
          }
        }
        client.close()
      } catch (err) {
        console.log('获取用户信息失败:', err)
      }

      await saveFmoAddresses(fmoAddressStorage.value)
      return { success: true, message: '已切换到: ' + address.name, reconnect: true }
    } else {
      if (isHttps && address.protocol === 'ws') {
        return {
          success: false,
          message:
            '连接失败。提示：HTTPS 网站无法直接连接局域网设备，请开启浏览器"不安全内容"访问权限，或选择 wss:// 协议。'
        }
      } else {
        return { success: false, message: '连接失败，请确认地址是否正确' }
      }
    }
  }

  async function clearAllAddresses(): Promise<ActionResult> {
    const hadAddresses = fmoAddressStorage.value.addresses.length > 0
    fmoAddressStorage.value.addresses = []
    fmoAddressStorage.value.activeId = null
    selectedAddressIds.value = []
    fmoAddressStorage.value.selectedIds = []
    await saveFmoAddresses(fmoAddressStorage.value)
    return { success: true, reconnect: hadAddresses }
  }

  async function refreshUserInfo(id: string): Promise<ActionResult> {
    const address = fmoAddressStorage.value.addresses.find((a) => a.id === id)
    if (!address) {
      return { success: false, message: '地址不存在' }
    }

    try {
      const host = normalizeHost(address.host)
      const fullAddress = `${address.protocol}://${host}`
      const client = new FmoApiClient(fullAddress)
      const userInfo = await client.getUserInfo()

      const index = fmoAddressStorage.value.addresses.findIndex((a) => a.id === id)
      if (index !== -1) {
        fmoAddressStorage.value.addresses[index] = {
          ...fmoAddressStorage.value.addresses[index],
          userInfo: {
            callsign: userInfo.callsign || '',
            uid: userInfo.uid || null,
            wlanIP: userInfo.wlanIP || ''
          }
        }
        await saveFmoAddresses(fmoAddressStorage.value)
      }
      client.close()
      return { success: true, message: '用户信息已更新' }
    } catch (err) {
      console.log('刷新用户信息失败:', err)
      return { success: false, message: '获取用户信息失败' }
    }
  }

  async function validateAndSaveFmoAddress(): Promise<ActionResult> {
    const address = fmoAddress.value
    if (!address) {
      return { success: true, message: '设置已保存' }
    }

    const isConnected = await validateConnection(address, protocol.value)
    if (isConnected) {
      return { success: true, message: '设置已保存', reconnect: true }
    } else {
      if (isHttps && protocol.value === 'ws') {
        return {
          success: false,
          message:
            '请确认 fmo 地址。提示：HTTPS 网站无法直接连接局域网设备，请按界面提示开启浏览器"不安全内容"访问权限，或选择 wss:// 协议。'
        }
      } else {
        return { success: false, message: '请确认fmo地址' }
      }
    }
  }

  async function backupLogs() {
    if (!fmoAddress.value) return

    let address = fmoAddress.value.trim()
    const httpProtocol = protocol.value === 'wss' ? 'https' : 'http'

    if (!address.startsWith('http://') && !address.startsWith('https://')) {
      address = `${httpProtocol}://${address}`
    }
    address = address.replace(/\/+$/, '')

    const url = `${address}/api/qso/backup`
    return await downloadRemoteFile(url, `fmo-backup-${Date.now()}.db`)
  }

  async function loadTodayContactedCallsigns(selectedFromCallsign: string) {
    if (!selectedFromCallsign) {
      todayContactedCallsigns.value = new Set()
      return
    }

    try {
      const allRecords = await getAllRecordsFromIndexedDB(1, 999999, '', selectedFromCallsign)
      const callsigns = new Set<string>()
      const today = new Date()

      for (const record of allRecords.data) {
        if (record.timestamp) {
          const contactDate = new Date(record.timestamp * 1000)
          const isToday =
            contactDate.getUTCFullYear() === today.getUTCFullYear() &&
            contactDate.getUTCMonth() === today.getUTCMonth() &&
            contactDate.getUTCDate() === today.getUTCDate()
          if (isToday && record.toCallsign) {
            callsigns.add(record.toCallsign)
          }
        }
      }

      todayContactedCallsigns.value = callsigns
    } catch (error) {
      console.error('查询今日通联呼号失败:', error)
      todayContactedCallsigns.value = new Set()
    }
  }

  async function loadContactCounts(selectedFromCallsign: string) {
    if (!selectedFromCallsign) {
      contactCounts.value = new Map()
      return
    }

    try {
      contactCounts.value = await getContactCountsFromIndexedDB(selectedFromCallsign)
    } catch (error) {
      console.error('加载通联次数失败:', error)
      contactCounts.value = new Map()
    }
  }

  async function setActiveAddressId(id: string) {
    fmoAddressStorage.value.activeId = id
    await saveFmoAddresses(fmoAddressStorage.value)
  }

  return {
    // state / getters
    fmoAddress,
    protocol,
    todayContactedCallsigns,
    isHttps,
    isMobileDevice,
    remoteControlUrl,
    addressList,
    activeAddressId,
    activeAddress,
    contactCounts,
    selectedAddressIds,
    multiSelectMode,
    audioVolume,
    audioPlaying,
    prioritizeToday,
    customThemes,
    activeThemeId,
    themeList,
    dashboardLayout,
    dashboardStationInfoLayout,
    dashboardHeroElements,
    // actions
    initFmoAddress,
    validateAndSaveFmoAddress,
    backupLogs,
    loadTodayContactedCallsigns,
    loadContactCounts,
    addFmoAddress,
    updateFmoAddress,
    deleteFmoAddress,
    selectFmoAddress,
    clearAllAddresses,
    refreshUserInfo,
    validateConnection,
    toggleAddressSelection,
    setMultiSelectMode,
    setActiveAddressId,
    setAudioVolume,
    setAudioPlaying,
    setPrioritizeToday,
    importCustomTheme,
    setActiveTheme,
    deleteCustomTheme,
    renameCustomTheme,
    moveDashboardPanel,
    setDashboardPanelVisible,
    moveDashboardStationInfoCard,
    setDashboardStationInfoCardVisible,
    setDashboardHeroElementVisible,
    resetDashboardLayout
  }
})
