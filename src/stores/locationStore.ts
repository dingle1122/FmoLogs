import { defineStore } from 'pinia'
import { ref } from 'vue'
// @ts-ignore - legacy JS
import { FmoApiClient } from '../services/fmoApi'
// @ts-ignore - legacy JS
import { normalizeHost } from '../utils/urlUtils'
import { getPlatform } from '../platform'
import { useSettingsStore } from './settingsStore'

const ENABLED_KEY = 'fmo_location_report_enabled'
const INTERVAL_KEY = 'fmo_location_report_interval'

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
  const intervalMinutes = ref(5)
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

  // ========== 内部状态 ==========
  let reportTimer: number | null = null
  let isTearingDown = false

  // ========== 帮助方法 ==========

  /** 获取当前活跃的 FMO 地址信息 */
  function getActiveAddress(): { host: string; protocol: string } | null {
    const settingsStore = useSettingsStore()
    const host = settingsStore.fmoAddress as string
    const proto = settingsStore.protocol as string
    if (!host) return null
    return { host, protocol: proto || 'ws' }
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

  // ========== actions ==========

  /** 从持久化存储恢复状态，并自动处理权限与GPS */
  async function init() {
    const platform = getPlatform()
    const savedEnabled = await platform.storage.get(ENABLED_KEY)
    if (savedEnabled !== null) {
      enabled.value = savedEnabled === 'true'
    }
    const savedInterval = await platform.storage.get(INTERVAL_KEY)
    if (savedInterval !== null) {
      const val = parseInt(savedInterval, 10)
      if (!isNaN(val) && val >= 1 && val <= 30) {
        intervalMinutes.value = val
      }
    }

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
      fetchFmoCoordinate()
    }

    // 如果之前开启了，重启上报
    if (enabled.value) {
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

  /** 设置上报间隔（分钟），1-30 */
  async function setInterval(minutes: number) {
    const clamped = Math.max(1, Math.min(30, Math.round(minutes)))
    intervalMinutes.value = clamped
    await getPlatform().storage.set(INTERVAL_KEY, String(clamped))
    // 如果正在上报，重启定时器以应用新间隔
    if (enabled.value && reportTimer) {
      stopTimer()
      startTimer()
    }
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
    const pos = await platform.location.getCurrentPosition()
    if (!pos) {
      lastReportResult.value = '获取 GPS 定位失败'
      return false
    }
    currentGps.value = { lat: pos.latitude, lng: pos.longitude }

    // 上报到 FMO
    const client = createClient()
    if (!client) {
      lastReportResult.value = '未配置 FMO 地址'
      return false
    }
    try {
      const data = await client.setCoordinate(
        pos.latitude,
        pos.longitude
      )
      const time = formatNow()
      lastReportTime.value = time
      lastReportResult.value = `上报成功 (${time})`
      // 更新通知栏文案
      platform.location.startForegroundService(
        'FMO 位置上报中',
        `最近上报: ${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)} (${time})`,
        intervalMinutes.value
      )
      // 上报后等 5s 再从 FMO 拉取坐标（等 server 处理完落库）
      window.setTimeout(() => {
        if (!isTearingDown) {
          fetchFmoCoordinate()
        }
      }, 5000)
      return true
    } catch (err: any) {
      const time = formatNow()
      lastReportResult.value = `上报失败 (${time}): ${err?.message || String(err)}`
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

  /** 启动定时上报 */
  async function startReporting() {
    if (isTearingDown || isReporting.value) return

    const platform = getPlatform()

    // 再次确认权限（toggleEnabled 已请求过，此处做兜底检查）
    if (!permissionGranted.value) {
      await checkPermission()
    }
    if (!permissionGranted.value) {
      console.warn('[locationStore] 定位权限未授予，无法启动上报')
      return
    }

    // 启动前台服务
    try {
      await platform.location.startForegroundService(
        'FMO 位置上报中',
        `间隔 ${intervalMinutes.value} 分钟，等待首次上报`,
        intervalMinutes.value
      )
    } catch (e) {
      console.warn('[locationStore] 启动前台服务失败:', e)
    }

    isReporting.value = true
    startTimer()

    // 立即执行一次上报
    await reportLocation()
  }

  /** 停止定时上报 */
  async function stopReporting() {
    isReporting.value = false
    stopTimer()

    try {
      await getPlatform().location.stopForegroundService()
    } catch (e) {
      console.warn('[locationStore] 停止前台服务失败:', e)
    }
  }

  /** 启动定时器 */
  function startTimer() {
    stopTimer()
    const ms = intervalMinutes.value * 60 * 1000
    reportTimer = window.setInterval(() => {
      if (!enabled.value || isTearingDown) {
        stopTimer()
        return
      }
      reportLocation()
    }, ms)
  }

  /** 停止定时器 */
  function stopTimer() {
    if (reportTimer !== null) {
      window.clearInterval(reportTimer)
      reportTimer = null
    }
  }

  /** 组件卸载时清理 */
  function teardown() {
    isTearingDown = true
    stopTimer()
    // 不停止前台服务和 enabled 状态，因为这是全局配置
    isTearingDown = false
  }

  return {
    // state
    enabled,
    intervalMinutes,
    currentGps,
    fmoCoordinate,
    isReporting,
    lastReportTime,
    lastReportResult,
    permissionGranted,
    backgroundGranted,
    isRequestingPermission,
    // actions
    init,
    toggleEnabled,
    setInterval,
    fetchFmoCoordinate,
    reportLocation,
    refreshGps,
    startReporting,
    stopReporting,
    teardown,
    checkPermission,
    requestPermission
  }
})
