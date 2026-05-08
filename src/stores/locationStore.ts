import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
// @ts-ignore - legacy JS
import { FmoApiClient } from '../services/fmoApi'
// @ts-ignore - legacy JS
import { normalizeHost } from '../utils/urlUtils'
import { getPlatform } from '../platform'
import { useSettingsStore } from './settingsStore'

const ENABLED_KEY = 'fmo_location_report_enabled'
const INTERVAL_KEY = 'fmo_location_report_interval'

// 上报间隔选项（秒）
export const INTERVAL_OPTIONS = [
  { value: 10, label: '10秒' },
  { value: 15, label: '15秒' },
  { value: 30, label: '30秒' },
  { value: 60, label: '1分钟' },
  { value: 120, label: '2分钟' },
  { value: 180, label: '3分钟' },
  { value: 300, label: '5分钟' },
  { value: 600, label: '10分钟' },
  { value: 900, label: '15分钟' },
  { value: 1200, label: '20分钟' },
  { value: 1800, label: '30分钟' }
]

// 获取默认间隔（秒），默认 15 分钟
export function getDefaultInterval(): number {
  return 900
}

/**
 * 定位上报 store。
 *
 * 职责：
 * - 管理自动上报开关与间隔配置（持久化到 platform.storage）
 * - 通过 FmoApiClient 与 FMO /ws 接口通信（getCordinate / setCordinate）
 * - 通过 platform.location（Android 原生插件）获取 GPS 定位与前台服务
 * - 定时任务生命周期管理
 */
export const useLocationStore = defineStore('location', () => {
  // ========== state ==========
  const enabled = ref(false)
  const intervalSeconds = ref(getDefaultInterval())
  const currentGps = ref<{ lat: number; lng: number } | null>(null)
  const fmoCoordinate = ref<{ lat: number; lng: number } | null>(null)
  const isReporting = ref(false)
  const lastReportTime = ref('')
  const lastReportResult = ref('')
  /** 定位权限是否已授予 */
  const permissionGranted = ref(false)
  /** 后台定位权限是否已授予（Android 10+） */
  const backgroundGranted = ref(false)
  /** 是否正在请求权限中 */
  const isRequestingPermission = ref(false)
  /** 上一次成功上报的坐标（用于漂移过滤） */
  const lastReportedPos = ref<{ lat: number; lng: number } | null>(null)
  /** 最近一次检查时间（即使跳过上报也更新通知） */
  const lastCheckTime = ref('')

  // GPS 可靠性阈值
  const ACCURACY_THRESHOLD = 100  // 精度 > 100m 视为不可靠，放弃本次上报
  const DRIFT_THRESHOLD = 10     // 偏移 < 10m 视为未移动，跳过上报（仅刷新通知时间）

  // ========== 内部状态 ==========
  let isTearingDown = false
  let _initCalled = false

  // ========== 帮助方法 ==========

  /** 获取当前活跃的 FMO 地址信息 */
  function getActiveAddress(): { host: string; protocol: string } | null {
    const settingsStore = useSettingsStore()
    const host = settingsStore.fmoAddress as string
    const proto = settingsStore.protocol as string
    if (!host) return null
    return { host, protocol: proto || 'ws' }
  }

  /** 获取当前 FMO 服务器的 WebSocket URL */
  function getFmoUrl(): string {
    const addr = getActiveAddress()
    if (!addr) return ''
    const host = normalizeHost(addr.host)
    return `${addr.protocol}://${host}/ws`
  }

  /** 创建 FmoApiClient 连接当前活跃地址 */
  function createClient(): FmoApiClient | null {
    const addr = getActiveAddress()
    if (!addr) return null
    const baseUrl = `${addr.protocol}://${normalizeHost(addr.host)}`
    return new FmoApiClient(baseUrl)
  }

  /** 格式化当前时间为 HH:mm:ss */
  function formatNow(): string {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const ss = String(now.getSeconds()).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }

  /** 计算两点间近似距离（米），适用于短距离 < 1km */
  function calcDistance(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 111320 // meters per degree latitude
    const dLat = (b.lat - a.lat) * R
    const dLng = (b.lng - a.lng) * R * Math.cos(a.lat * Math.PI / 180)
    return Math.sqrt(dLat * dLat + dLng * dLng)
  }

  /** 更新Android前台通知栏文案（即使跳过上报也更新时间） */
  async function updateNotification(label: string, checkTime: string) {
    const pos = currentGps.value
    if (!pos) return
    try {
      await getPlatform().location.startForegroundService(
        'FMO 位置上报中',
        `${label}: ${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)} (${checkTime})`,
        Math.ceil(intervalSeconds.value / 60)
      )
    } catch { /* ignore */ }
  }

  // ========== actions ==========

  /** 从持久化存储恢复状态，并自动处理权限与GPS */
  async function init() {
    if (!_initCalled) {
      _initCalled = true

      // 注册原生上报状态监听（仅一次）
      getPlatform().location.onReportStatus((result) => {
        lastReportResult.value = result.message
        if (result.isFmoCoord) {
          // FMO 坐标回执
          fmoCoordinate.value = { lat: result.latitude, lng: result.longitude }
          return
        }
        if (result.success) {
          lastReportTime.value = result.time
          currentGps.value = { lat: result.latitude, lng: result.longitude }
        }
        lastCheckTime.value = result.time
      })

      // 恢复持久化设置（仅一次）
      const platform = getPlatform()
      const savedEnabled = await platform.storage.get(ENABLED_KEY)
      if (savedEnabled !== null) {
        enabled.value = savedEnabled === 'true'
      }
      const savedInterval = await platform.storage.get(INTERVAL_KEY)
      if (savedInterval !== null) {
        const val = parseInt(savedInterval, 10)
        // 验证是否为有效的间隔选项
        const validOption = INTERVAL_OPTIONS.find(opt => opt.value === val)
        if (validOption) {
          intervalSeconds.value = val
        }
      }

      // 如果之前开启了，冷启动自动恢复上报
      if (enabled.value) {
        const settingsStore = useSettingsStore()
        // FMO 地址可能尚未加载（IndexedDB 异步），等待就绪后再启动
        if (settingsStore.fmoAddress) {
          await checkPermission()
          if (permissionGranted.value) {
            await startReporting()
          }
        } else {
          const unwatch = watch(
            () => settingsStore.fmoAddress,
            async (addr) => {
              if (!addr || !enabled.value || isReporting.value) return
              await checkPermission()
              if (permissionGranted.value) {
                await startReporting()
              }
              unwatch()
            }
          )
        }
      }
    }

    // 以下每次进入自动定位页面都执行
    // 检查权限状态
    await checkPermission()

    // 没有权限则自动发起系统权限请求
    if (!permissionGranted.value) {
      await requestPermission()
      // 请求后再检查一次确保状态同步
      await checkPermission()
    }

    // 前台定位已授权，尝试请求后台定位（即使已授予也再调一次确保弹框）
    if (permissionGranted.value) {
      await getPlatform().location.requestBackgroundPermission()
      await checkPermission()
    }

    // 权限已授予，自动获取 GPS 坐标展示
    if (permissionGranted.value) {
      await refreshGps()
      // 同时拉取 FMO 当前坐标（server 端已知的最新位置）
      // 注意：冷启动时 settingsStore.fmoAddress 可能尚未从 IndexedDB 加载完毕，
      // 如果地址为空则静默跳过，避免误报"未配置 FMO 地址"
      if (getActiveAddress()) {
        fetchFmoCoordinate()
      }
    }

    // 如果之前开启了但还没启动（比如之前权限不足），补启动上报
    // 注意：冷启动时地址可能尚未从 IndexedDB 加载完毕，
    // 此时若跳过则交由上方的 watch 在地址就绪后补启动，
    // 避免以空地址启动原生服务导致通知栏显示"未配置地址"
    if (enabled.value && !isReporting.value && permissionGranted.value && getActiveAddress()) {
      await startReporting()
    }
  }

  /** 切换自动上报开关 */
  async function toggleEnabled() {
    enabled.value = !enabled.value
    await getPlatform().storage.set(ENABLED_KEY, String(enabled.value))
    if (enabled.value) {
      // 开启前先确保权限已授予
      if (!permissionGranted.value) {
        await requestPermission()
      }
      if (permissionGranted.value) {
        await startReporting()
      } else {
        // 权限未授予，回退开关
        enabled.value = false
        await getPlatform().storage.set(ENABLED_KEY, 'false')
        lastReportResult.value = '需要授予定位权限后才能开启自动上报'
      }
    } else {
      await stopReporting()
    }
  }

  /** 设置上报间隔（秒），从预设选项中选择最近的 
   * @deprecated 使用 setIntervalByIndex 更精确
   */
  async function setInterval(seconds: number) {
    // 找到最接近的预设值
    const closest = INTERVAL_OPTIONS.reduce((prev, curr) => {
      return Math.abs(curr.value - seconds) < Math.abs(prev.value - seconds) ? curr : prev
    })
    intervalSeconds.value = closest.value
    await getPlatform().storage.set(INTERVAL_KEY, String(closest.value))
    // 如果正在上报，重启服务以应用新间隔
    if (enabled.value && isReporting.value) {
      await stopReporting()
      await startReporting()
    }
  }

  /** 通过索引设置间隔（精确选择预设选项） */
  async function setIntervalByIndex(index: number) {
    if (index < 0 || index >= INTERVAL_OPTIONS.length) return
    const option = INTERVAL_OPTIONS[index]
    intervalSeconds.value = option.value
    await getPlatform().storage.set(INTERVAL_KEY, String(option.value))
    // 如果正在上报，重启服务以应用新间隔
    if (enabled.value && isReporting.value) {
      await stopReporting()
      await startReporting()
    }
  }

  /** 获取当前间隔选项的索引 */
  function getIntervalIndex(): number {
    const index = INTERVAL_OPTIONS.findIndex(opt => opt.value === intervalSeconds.value)
    return index >= 0 ? index : INTERVAL_OPTIONS.findIndex(opt => opt.value === 900) // 默认15分钟
  }

  /** 格式化间隔时间为友好显示 */
  function formatInterval(seconds: number): string {
    const option = INTERVAL_OPTIONS.find(opt => opt.value === seconds)
    return option ? option.label : `${seconds}秒`
  }

  /**
   * 检查权限状态（不弹框），并更新 permissionGranted。
   * 仅初始化后后台静默调用；页面 UI 也通过此方法获取最新状态。
   */
  async function checkPermission(): Promise<boolean> {
    const result = await getPlatform().location.checkPermission()
    permissionGranted.value = result.granted
    backgroundGranted.value = result.backgroundGranted
    return result.granted
  }

  /**
   * 发起系统权限请求（弹出系统对话框），等待用户操作后更新状态。
   * 返回 true 表示所有权限均已授予。
   */
  async function requestPermission(): Promise<boolean> {
    if (isRequestingPermission.value) return permissionGranted.value
    isRequestingPermission.value = true
    try {
      const granted = await getPlatform().location.requestPermission()
      permissionGranted.value = granted
      return granted
    } finally {
      isRequestingPermission.value = false
    }
  }
  async function fetchFmoCoordinate(): Promise<boolean> {
    const client = createClient()
    if (!client) {
      lastReportResult.value = '未配置 FMO 地址'
      return false
    }
    try {
      const data = await client.getCoordinate()
      if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        fmoCoordinate.value = { lat: data.latitude, lng: data.longitude }
        return true
      }
      return false
    } catch (err: any) {
      console.error('获取 FMO 坐标失败:', err)
      return false
    } finally {
      client.close()
    }
  }

  /** 立即上报一次定位 */
  async function reportLocation(): Promise<boolean> {
    const platform = getPlatform()

    // 获取 GPS
    const rawPos = await platform.location.getCurrentPosition()
    const checkTime = formatNow()
    lastCheckTime.value = checkTime

    if (!rawPos) {
      lastReportResult.value = '获取 GPS 定位失败'
      return false
    }

    // 更新 GPS 展示（始终更新，即使不上报）
    currentGps.value = { lat: rawPos.latitude, lng: rawPos.longitude }

    // --- 精度门限检查 ---
    if (rawPos.accuracy > ACCURACY_THRESHOLD) {
      lastReportResult.value = `GPS 精度不足 (${rawPos.accuracy.toFixed(0)}m > ${ACCURACY_THRESHOLD}m)`
      return false
    }

    // --- 漂移过滤：与上次上报位置比较 ---
    if (lastReportedPos.value) {
      const dist = calcDistance(lastReportedPos.value, currentGps.value)
      if (dist < DRIFT_THRESHOLD) {
        lastReportResult.value = `位置未变化 (偏移 ${dist.toFixed(1)}m < ${DRIFT_THRESHOLD}m)，跳过上报`
        return true
      }
    }

    // --- 上报到 FMO ---
    const client = createClient()
    if (!client) {
      lastReportResult.value = '未配置 FMO 地址'
      return false
    }
    try {
      await client.setCoordinate(
        rawPos.latitude,
        rawPos.longitude
      )
      lastReportTime.value = checkTime
      lastReportedPos.value = { lat: rawPos.latitude, lng: rawPos.longitude }
      lastReportResult.value = `上报成功 (${checkTime})`
      // 上报后等 5s 再从 FMO 拉取坐标（等 server 处理完落库）
      window.setTimeout(() => {
        if (!isTearingDown) {
          fetchFmoCoordinate()
        }
      }, 5000)
      return true
    } catch (err: any) {
      lastReportResult.value = `上报失败 (${formatNow()}): ${err?.message || String(err)}`
      return false
    } finally {
      client.close()
    }
  }

  /** 仅获取 GPS 坐标（不上报） */
  async function refreshGps(): Promise<boolean> {
    if (!permissionGranted.value) {
      await checkPermission()
      if (!permissionGranted.value) {
        lastReportResult.value = '未授予定位权限'
        return false
      }
    }
    const pos = await getPlatform().location.getCurrentPosition()
    if (pos) {
      currentGps.value = { lat: pos.latitude, lng: pos.longitude }
      return true
    }
    return false
  }

  /** 设置 FMO 配置到原生侧（用于息屏定时上报） */
  async function setFmoConfigAction() {
    const fmoUrl = getFmoUrl()
    if (!fmoUrl) return
    try {
      // 转换为分钟（向上取整）
      const intervalMinutes = Math.ceil(intervalSeconds.value / 60)
      await getPlatform().location.setFmoConfig(fmoUrl, intervalMinutes)
    } catch (e) {
      console.warn('[locationStore] setFmoConfig failed:', e)
    }
  }

  /** 启动定时上报 */
  async function startReporting() {
    if (isTearingDown || isReporting.value) return

    // 再次确认权限（toggleEnabled 已请求过，此处做兜底检查）
    if (!permissionGranted.value) {
      await checkPermission()
    }
    if (!permissionGranted.value) {
      console.warn('[locationStore] 定位权限未授予，无法启动上报')
      return
    }

    // 配置 FMO URL 到原生侧
    await setFmoConfigAction()

    // 启动前台服务（原生侧接管定时上报 + 通知栏管理）
    // 转换为分钟（向上取整，至少1分钟）
    const intervalMinutes = Math.max(1, Math.ceil(intervalSeconds.value / 60))
    try {
      await getPlatform().location.startForegroundService(
        'FMO 位置上报中',
        `间隔 ${formatInterval(intervalSeconds.value)}，等待首次上报`,
        intervalMinutes
      )
    } catch (e) {
      console.warn('[locationStore] 启动前台服务失败:', e)
    }

    isReporting.value = true
  }

  /** 停止定时上报 */
  async function stopReporting() {
    isReporting.value = false

    try {
      await getPlatform().location.stopForegroundService()
    } catch (e) {
      console.warn('[locationStore] 停止前台服务失败:', e)
    }
  }

  /** 组件卸载时清理 */
  function teardown() {
    isTearingDown = true
    isTearingDown = false
  }

  return {
    // state
    enabled,
    intervalSeconds,
    currentGps,
    fmoCoordinate,
    isReporting,
    lastReportTime,
    lastReportResult,
    permissionGranted,
    backgroundGranted,
    isRequestingPermission,
    lastReportedPos,
    lastCheckTime,
    // actions
    init,
    toggleEnabled,
    setInterval,
    setIntervalByIndex,
    getIntervalIndex,
    fetchFmoCoordinate,
    reportLocation,
    refreshGps,
    startReporting,
    stopReporting,
    teardown,
    checkPermission,
    requestPermission,
    // constants & utils
    INTERVAL_OPTIONS,
    formatInterval
  }
})
