import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core'
import confirmDialog from '../composables/useConfirm'
import toast from '../composables/useToast'

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
}

const FmoUpdater = registerPlugin<FmoUpdaterPlugin>('FmoUpdater')

const DAILY_CHECK_KEY = 'fmologs_update_last_checked_at'
const ONE_DAY_MS = 24 * 60 * 60 * 1000

function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

function getManifestUrl(): string {
  return import.meta.env.VITE_ANDROID_UPDATE_MANIFEST_URL?.trim() || ''
}

function getLastCheckedAt(): number {
  return Number(localStorage.getItem(DAILY_CHECK_KEY) || 0)
}

function setLastCheckedAt(value: number): void {
  localStorage.setItem(DAILY_CHECK_KEY, String(value))
}

async function fetchManifest(): Promise<UpdateManifest> {
  const manifestUrl = getManifestUrl()
  if (!manifestUrl) {
    throw new Error('未配置更新地址')
  }

  const sep = manifestUrl.includes('?') ? '&' : '?'
  const response = await CapacitorHttp.request({
    method: 'GET',
    url: `${manifestUrl}${sep}_t=${Date.now()}`,
    headers: {
      'Cache-Control': 'no-cache'
    }
  })
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`检查更新失败: HTTP ${response.status}`)
  }

  const manifest =
    typeof response.data === 'string'
      ? (JSON.parse(response.data) as UpdateManifest)
      : (response.data as UpdateManifest)
  if (manifest.platform !== 'android') {
    throw new Error('更新信息平台不匹配')
  }
  if (!manifest.versionName || !Number.isFinite(Number(manifest.versionCode)) || !manifest.apkUrl) {
    throw new Error('更新信息不完整')
  }

  manifest.versionCode = Number(manifest.versionCode)
  return manifest
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

export async function checkForAndroidUpdate(options: { silent?: boolean } = {}): Promise<boolean> {
  if (!isAndroidNative()) {
    if (!options.silent) toast.info('当前平台不支持安卓更新')
    return false
  }

  try {
    const [current, manifest] = await Promise.all([FmoUpdater.getCurrentVersion(), fetchManifest()])

    if (manifest.versionCode <= Number(current.versionCode)) {
      if (!options.silent) toast.success('当前已是最新版本')
      return false
    }

    const confirmed = await confirmDialog.show({
      title: '发现新版本',
      message: buildUpdateMessage(current, manifest),
      confirmText: '下载更新',
      cancelText: manifest.force ? '稍后' : '取消'
    })

    if (!confirmed) return true

    toast.info('正在下载更新，请稍候...', 5000)
    await FmoUpdater.downloadAndInstall({
      apkUrl: manifest.apkUrl,
      sha256: manifest.sha256
    })
    toast.success('下载完成，请按系统提示安装', 5000)
    return true
  } catch (err) {
    console.error('checkForAndroidUpdate failed:', err)
    if (!options.silent) {
      toast.error(err instanceof Error ? err.message : '检查更新失败')
    }
    return false
  }
}

export async function checkAndroidUpdateDaily(): Promise<void> {
  if (!isAndroidNative() || !getManifestUrl()) return

  const now = Date.now()
  if (now - getLastCheckedAt() < ONE_DAY_MS) return
  setLastCheckedAt(now)
  await checkForAndroidUpdate({ silent: true })
}

export function isAndroidUpdateEnabled(): boolean {
  return isAndroidNative() && Boolean(getManifestUrl())
}
