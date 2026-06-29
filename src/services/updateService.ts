import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core'
import { reactive } from 'vue'
import packageInfo from '../../package.json'
import confirmDialog from '../composables/useConfirm'
import toast from '../composables/useToast'
import { isAndroidNativeRuntimeAvailable } from '../platform/runtime'

interface CurrentVersion {
  versionName: string
  versionCode: number
}

interface UpdateManifest {
  platform: string
  versionName: string
  versionCode: number
  apkUrl: string
  sha256?: string
  releaseNotes?: string
  force?: boolean
  publishedAt?: string
}

interface FmoUpdaterPlugin {
  getCurrentVersion(): Promise<CurrentVersion>
  downloadAndInstall(opts: { apkUrl: string; sha256?: string }): Promise<{ path: string }>
  cancelUpdate(): Promise<{ cancelled: boolean }>
  installDownloadedUpdate(): Promise<{ path: string }>
  addListener(
    event: 'progress',
    cb: (data: {
      percent: number
      downloadedBytes: number
      totalBytes: number
      status: string
    }) => void
  ): Promise<{ remove: () => Promise<void> }>
}

const FmoUpdater = registerPlugin<FmoUpdaterPlugin>('FmoUpdater')

let listenerInstalled = false
let progressHandle: { remove: () => Promise<void> } | null = null

export const updateState = reactive({
  visible: false,
  phase: 'idle',
  active: false,
  downloadable: false,
  title: '',
  message: '',
  currentVersion: '',
  latestVersion: '',
  percent: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  status: ''
})

function isAndroidNative(): boolean {
  return isAndroidNativeRuntimeAvailable()
}

function isAndroidRuntime(): boolean {
  try {
    return (
      Capacitor.getPlatform() === 'android' ||
      /Android/i.test(globalThis.navigator?.userAgent || '')
    )
  } catch {
    return /Android/i.test(globalThis.navigator?.userAgent || '')
  }
}

function getFallbackVersionCode(versionName: string): number {
  const [major = 0, minor = 0, patch = 0] = versionName
    .replace(/[^0-9.].*$/, '')
    .split('.')
    .map((part) => Number(part) || 0)

  return major * 10000 + minor * 100 + patch
}

function getWebCurrentVersion(): CurrentVersion {
  const versionName = packageInfo.version
  return {
    versionName,
    versionCode: getFallbackVersionCode(versionName)
  }
}

function getManifestUrl(): string {
  return import.meta.env.VITE_ANDROID_UPDATE_MANIFEST_URL?.trim() || ''
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

function setUpdateState(partial: Partial<typeof updateState>): void {
  Object.assign(updateState, partial)
}

async function installProgressListener(): Promise<void> {
  if (listenerInstalled || !isAndroidNative()) return
  listenerInstalled = true
  progressHandle = await FmoUpdater.addListener('progress', (payload) => {
    setUpdateState({
      visible: true,
      phase: payload.status === 'installing' ? 'installing' : 'downloading',
      percent: Math.max(0, Math.min(100, Math.round(payload.percent || 0))),
      downloadedBytes: Number(payload.downloadedBytes || 0),
      totalBytes: Number(payload.totalBytes || 0),
      status: payload.status || ''
    })
  })
}

export function resetUpdateState(): void {
  setUpdateState({
    visible: false,
    phase: 'idle',
    active: false,
    downloadable: false,
    title: '',
    message: '',
    currentVersion: '',
    latestVersion: '',
    percent: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    status: ''
  })
}

async function fetchManifest(): Promise<UpdateManifest> {
  const manifestUrl = getManifestUrl()
  if (!manifestUrl) {
    throw new Error('未配置更新地址')
  }

  const url = `${manifestUrl}${manifestUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`
  const manifest = isAndroidNative()
    ? await fetchManifestWithNativeHttp(url)
    : await fetchManifestWithWebHttp(url)

  validateManifest(manifest)
  manifest.versionCode = Number(manifest.versionCode)
  return manifest
}

async function fetchManifestWithNativeHttp(url: string): Promise<UpdateManifest> {
  const response = await CapacitorHttp.request({
    method: 'GET',
    url,
    headers: {
      'Cache-Control': 'no-cache'
    }
  })
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`检查更新失败: HTTP ${response.status}`)
  }

  return typeof response.data === 'string'
    ? (JSON.parse(response.data) as UpdateManifest)
    : (response.data as UpdateManifest)
}

async function fetchManifestWithWebHttp(url: string): Promise<UpdateManifest> {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache'
    }
  })
  if (!response.ok) {
    throw new Error(`检查更新失败: HTTP ${response.status}`)
  }

  return (await response.json()) as UpdateManifest
}

function validateManifest(manifest: UpdateManifest): void {
  if (manifest.platform !== 'android') {
    throw new Error('更新信息平台不匹配')
  }
  if (!manifest.versionName || !Number.isFinite(Number(manifest.versionCode)) || !manifest.apkUrl) {
    throw new Error('更新信息不完整')
  }
}

function buildUpdateMessage(current: CurrentVersion, manifest: UpdateManifest): string {
  const lines = [
    `当前版本：${current.versionName} (${current.versionCode})`,
    `最新版本：${manifest.versionName} (${manifest.versionCode})`
  ]

  if (manifest.releaseNotes?.trim()) {
    lines.push('', manifest.releaseNotes.trim())
  }

  return lines.join('\n')
}

export async function cancelAndroidUpdate(): Promise<void> {
  if (!isAndroidNative()) return
  try {
    await FmoUpdater.cancelUpdate()
  } finally {
    resetUpdateState()
  }
}

function isUpdateDownloadingState(): boolean {
  return updateState.active && updateState.phase === 'downloading'
}

export async function checkForAndroidUpdate(options: { silent?: boolean } = {}): Promise<boolean> {
  if (!isAndroidRuntime()) {
    if (!options.silent) toast.info('当前平台不支持安卓更新')
    return false
  }

  try {
    const useNativeUpdater = isAndroidNative()
    if (useNativeUpdater) {
      await installProgressListener()
    }

    const [current, manifest] = await Promise.all([
      useNativeUpdater ? FmoUpdater.getCurrentVersion() : getWebCurrentVersion(),
      fetchManifest()
    ])

    if (manifest.versionCode <= Number(current.versionCode)) {
      if (!options.silent) toast.success('当前已是最新版本')
      return false
    }

    const confirmed = await confirmDialog.show({
      title: '发现新版本',
      message: manifest.releaseNotes?.trim() || buildUpdateMessage(current, manifest),
      confirmText: '开始下载',
      cancelText: manifest.force ? '稍后' : '取消'
    })

    if (!confirmed) return true

    if (!useNativeUpdater) {
      openUpdateUrl(manifest.apkUrl)
      setUpdateState({
        visible: true,
        phase: 'downloaded',
        active: false,
        downloadable: false,
        title: '已开始下载',
        message: `当前版本：${current.versionName}，最新版本：${manifest.versionName}`,
        currentVersion: current.versionName,
        latestVersion: manifest.versionName,
        percent: 100,
        downloadedBytes: 0,
        totalBytes: 0,
        status: 'web-download'
      })
      toast.info('已开始下载更新包，请按系统提示完成安装')
      return true
    }

    setUpdateState({
      visible: true,
      phase: 'downloading',
      active: true,
      downloadable: false,
      title: '正在下载更新',
      message: `当前版本：${current.versionName}，最新版本：${manifest.versionName}`,
      currentVersion: current.versionName,
      latestVersion: manifest.versionName,
      percent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      status: 'downloading'
    })
    await FmoUpdater.downloadAndInstall({
      apkUrl: manifest.apkUrl,
      sha256: manifest.sha256
    })
    setUpdateState({
      phase: 'installing',
      active: false,
      downloadable: false,
      percent: 100,
      status: 'installing',
      title: '正在打开安装器',
      message: '请按系统提示完成安装'
    })
    return true
  } catch (err) {
    console.error('checkForAndroidUpdate failed:', err)
    resetUpdateState()
    if (!options.silent) {
      toast.error(err instanceof Error ? err.message : '检查更新失败')
    }
    return false
  }
}

function openUpdateUrl(apkUrl: string): void {
  window.location.assign(`fmologs://webview-download?url=${encodeURIComponent(apkUrl)}`)
}

export async function checkAndroidUpdateOnStartup(): Promise<void> {
  if (!isAndroidRuntime() || !getManifestUrl()) return
  await checkForAndroidUpdate({ silent: true })
}

export function isAndroidUpdateEnabled(): boolean {
  return isAndroidRuntime() && Boolean(getManifestUrl())
}

export function getUpdateProgressText(): string {
  if (updateState.status === 'web-download') return ''

  const total = updateState.totalBytes > 0 ? formatBytes(updateState.totalBytes) : ''
  const current = formatBytes(updateState.downloadedBytes)
  return total ? `${current} / ${total}` : current
}

export function isUpdateDownloading(): boolean {
  return isUpdateDownloadingState()
}

export async function installDownloadedAndroidUpdate(): Promise<void> {
  if (!isAndroidNative()) return
  await FmoUpdater.installDownloadedUpdate()
  resetUpdateState()
}
