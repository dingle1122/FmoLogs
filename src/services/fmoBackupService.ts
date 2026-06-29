import { CapacitorHttp } from '@capacitor/core'
import { getPlatform, getEffectivePlatform } from '../platform'
import { buildHttpUrl, buildWebSocketUrl, normalizeHost } from '../utils/urlUtils'
import {
  downloadRemoteFile,
  downloadRemoteFileData,
  fallbackFilenameFromUrl,
  parseFilenameFromHeaders
} from '../utils/exportFile'

const BACKUP_PATH = '/api/qso/backup'
const FIRST_PROGRESS_TIMEOUT_MS = 15000
const EXPORT_COMPLETE_TIMEOUT_MS = 180000

export interface BackupLogsOptions {
  host: string
  protocol: string
  onProgress?: (state: BackupProgressState) => void
}

export interface BackupLogsResult {
  mode: 'legacy' | 'async'
  platform: string
  savedPath?: string
  uri?: string
  displayPath?: string
}

export interface BackupLogsDataResult {
  mode: 'legacy' | 'async'
  platform: string
  filename: string
  data: Uint8Array
  headers?: Record<string, string>
  status?: number
}

export interface BackupProgressState {
  phase: 'starting' | 'exporting' | 'downloading' | 'completed' | 'error'
  percent?: number
  mode?: 'legacy' | 'async'
  message?: string
}

function buildBackupUrl(host: string, protocol: string) {
  return buildHttpUrl(`${protocol}://${host}`, BACKUP_PATH)
}

async function requestRemote(url: string, method: 'POST'): Promise<{ status: number }> {
  const platform = getEffectivePlatform()
  console.info('[Backup] start request', { platform, method, url })

  if (platform === 'web') {
    return requestRemoteByForm(url, method)
  }

  const response = await CapacitorHttp.request({
    method,
    url,
    responseType: 'text',
    headers: {
      'Cache-Control': 'no-cache'
    }
  })
  console.info('[Backup] native request completed', { method, url, status: response.status })
  return { status: response.status }
}

async function requestRemoteByForm(
  url: string,
  method: 'POST'
): Promise<{ status: number }> {
  return await new Promise((resolve, reject) => {
    const frameName = `fmo-backup-post-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const iframe = document.createElement('iframe')
    iframe.name = frameName
    iframe.style.display = 'none'

    const form = document.createElement('form')
    form.method = method
    form.action = url
    form.target = frameName
    form.style.display = 'none'

    let settled = false
    let submitted = false
    let handledLoadAfterSubmit = false
    const cleanup = () => {
      iframe.onload = null
      iframe.onerror = null
      setTimeout(() => {
        form.remove()
        iframe.remove()
      }, 0)
    }
    const settle = (result: { status: number }, isError = false) => {
      if (settled) return
      settled = true
      cleanup()
      if (isError) {
        console.warn('[Backup] web form POST failed', { method, url })
        reject(new Error('FORM_POST_FAILED'))
      } else {
        console.info('[Backup] web form POST accepted', { method, url, status: result.status })
        resolve(result)
      }
    }

    iframe.onload = () => {
      if (!submitted) {
        console.info('[Backup] ignoring iframe initial load before form submit', {
          method,
          url,
          frameName
        })
        return
      }
      if (handledLoadAfterSubmit) return
      handledLoadAfterSubmit = true
      settle({ status: 202 })
    }
    iframe.onerror = () => {
      settle({ status: 0 }, true)
    }

    document.body.appendChild(iframe)
    document.body.appendChild(form)

    try {
      submitted = true
      console.info('[Backup] submitting web form POST', { method, url, frameName })
      form.submit()
    } catch {
      settle({ status: 0 }, true)
      return
    }

    setTimeout(() => {
      settle({ status: 202 })
    }, 1200)
  })
}

function shouldFallbackToLegacy(status: number) {
  return status === 404 || status === 405 || status === 501
}

async function downloadBackupFile(url: string, fallbackFilename: string) {
  console.info('[Backup] downloading backup file', { url, fallbackFilename })
  return downloadRemoteFile(url, fallbackFilename)
}

async function downloadBackupFileData(url: string): Promise<BackupLogsDataResult> {
  console.info('[Backup] downloading backup file to memory', { url })
  const result = await downloadRemoteFileData(url)
  const headers = result.headers || {}
  const filename = parseFilenameFromHeaders(headers, fallbackFilenameFromUrl(url, 'fmo-backup'))
  return {
    mode: 'legacy',
    platform: getEffectivePlatform(),
    filename,
    data: result.data,
    headers,
    status: result.status
  }
}

async function waitForAsyncBackupReady(
  host: string,
  protocol: string,
  onProgress?: (state: BackupProgressState) => void
): Promise<void> {
  const addressId = `backup:${protocol}:${normalizeHost(host)}`
  const wsUrl = buildWebSocketUrl(host, '/events', protocol)
  const apiUrl = buildWebSocketUrl(host, '/ws', protocol)
  const events = getPlatform().events

  let seenExportProgress = false
  console.info('[Backup] waiting async export progress', { addressId, wsUrl, apiUrl })

  try {
    await events.connect({ addressId, url: wsUrl, apiUrl })
    console.info('[Backup] events connected for async export', { addressId })
  } catch {
    console.warn('[Backup] failed to connect events for async export', { addressId })
    throw new Error('ASYNC_BACKUP_LISTEN_FAILED')
  }

  try {
    await new Promise<void>((resolve, reject) => {
      let finished = false
      let unsubscribe = () => {}
      let firstProgressTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        if (finished || seenExportProgress) return
        finished = true
        unsubscribe()
        console.warn('[Backup] async export progress timeout, fallback to legacy', { addressId })
        reject(new Error('ASYNC_BACKUP_PROGRESS_TIMEOUT'))
      }, FIRST_PROGRESS_TIMEOUT_MS)
      let completeTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        if (finished) return
        finished = true
        unsubscribe()
        console.warn('[Backup] async export completion timeout', { addressId })
        reject(new Error('ASYNC_BACKUP_COMPLETE_TIMEOUT'))
      }, EXPORT_COMPLETE_TIMEOUT_MS)

      const clearTimers = () => {
        if (firstProgressTimer) clearTimeout(firstProgressTimer)
        if (completeTimer) clearTimeout(completeTimer)
        firstProgressTimer = null
        completeTimer = null
      }

      unsubscribe = events.onMessage((msgAddressId, raw) => {
        if (msgAddressId !== addressId || finished) return

        let message: any
        try {
          message = typeof raw === 'string' ? JSON.parse(raw) : raw
        } catch {
          return
        }

        if (!message || message.type !== 'qso' || message.subType !== 'progress') return

        const data = message.data || {}
        if (data.stage !== 'export') return

        seenExportProgress = true
        onProgress?.({
          phase: 'exporting',
          mode: 'async',
          percent: Number(data.percent ?? 0),
          message: '正在导出备份'
        })
        console.info('[Backup] async export progress event', {
          addressId,
          percent: Number(data.percent ?? 0),
          error: !!data.error
        })
        if (firstProgressTimer) {
          clearTimeout(firstProgressTimer)
          firstProgressTimer = null
        }

        if (data.error) {
          finished = true
          clearTimers()
          unsubscribe()
          console.warn('[Backup] async export reported error', { addressId })
          reject(new Error('FMO_BACKUP_EXPORT_FAILED'))
          return
        }

        const percent = Number(data.percent ?? 0)
        if (percent >= 100) {
          finished = true
          clearTimers()
          unsubscribe()
          console.info('[Backup] async export complete', { addressId, percent })
          resolve()
        }
      })
    })
  } finally {
    console.info('[Backup] disconnect async export events', { addressId })
    await events.disconnect(addressId).catch(() => {})
  }
}

export async function backupLogsWithCompatibility(
  options: BackupLogsOptions
): Promise<BackupLogsResult> {
  const host = normalizeHost(options.host)
  if (!host) {
    throw new Error('未配置 FMO 地址')
  }

  const url = buildBackupUrl(host, options.protocol)
  options.onProgress?.({ phase: 'starting', percent: 0, message: '正在启动备份' })
  console.info('[Backup] begin compatibility backup', {
    host,
    protocol: options.protocol,
    url
  })

  let startResponse: { status: number } | null = null
  try {
    startResponse = await requestRemote(url, 'POST')
  } catch {
    console.warn('[Backup] start request failed, fallback to legacy GET', { url })
    startResponse = null
  }

  if (!startResponse || shouldFallbackToLegacy(startResponse.status)) {
    options.onProgress?.({
      phase: 'downloading',
      mode: 'legacy',
      percent: 100,
      message: '正在下载备份'
    })
    console.info('[Backup] using legacy backup flow', {
      reason: !startResponse ? 'start-failed' : `status-${startResponse.status}`,
      url
    })
    const result = await downloadBackupFile(url, 'fmo-backup.db')
    options.onProgress?.({
      phase: 'completed',
      mode: 'legacy',
      percent: 100,
      message: '备份完成'
    })
    return { mode: 'legacy', ...result }
  }

  if (startResponse.status < 200 || startResponse.status >= 300) {
    console.warn('[Backup] start request returned unexpected status', {
      url,
      status: startResponse.status
    })
    options.onProgress?.({
      phase: 'error',
      message: `启动 FMO 备份失败: HTTP ${startResponse.status}`
    })
    throw new Error(`启动 FMO 备份失败: HTTP ${startResponse.status}`)
  }

  console.info('[Backup] async backup flow started', {
    url,
    status: startResponse.status
  })
  options.onProgress?.({
    phase: 'exporting',
    mode: 'async',
    percent: 0,
    message: '正在导出备份'
  })

  try {
    await waitForAsyncBackupReady(host, options.protocol, options.onProgress)
  } catch (err: any) {
    if (err?.message === 'ASYNC_BACKUP_LISTEN_FAILED') {
      options.onProgress?.({
        phase: 'downloading',
        mode: 'legacy',
        percent: 100,
        message: '正在下载备份'
      })
      console.info('[Backup] fallback to legacy because events listener failed', { url })
      const result = await downloadBackupFile(url, 'fmo-backup.zip')
      options.onProgress?.({
        phase: 'completed',
        mode: 'legacy',
        percent: 100,
        message: '备份完成'
      })
      return { mode: 'legacy', ...result }
    }
    if (err?.message === 'ASYNC_BACKUP_PROGRESS_TIMEOUT') {
      options.onProgress?.({
        phase: 'downloading',
        mode: 'legacy',
        percent: 100,
        message: '正在下载备份'
      })
      console.info('[Backup] fallback to legacy because no async progress arrived', { url })
      const result = await downloadBackupFile(url, 'fmo-backup.zip')
      options.onProgress?.({
        phase: 'completed',
        mode: 'legacy',
        percent: 100,
        message: '备份完成'
      })
      return { mode: 'legacy', ...result }
    }
    if (err?.message === 'ASYNC_BACKUP_COMPLETE_TIMEOUT') {
      options.onProgress?.({ phase: 'error', message: '等待 FMO 备份完成超时' })
      throw new Error('等待 FMO 备份完成超时')
    }
    if (err?.message === 'FMO_BACKUP_EXPORT_FAILED') {
      options.onProgress?.({ phase: 'error', message: 'FMO 设备导出备份失败' })
      throw new Error('FMO 设备导出备份失败')
    }
    options.onProgress?.({ phase: 'error', message: err?.message || '备份失败' })
    throw err
  }

  console.info('[Backup] async backup ready, start final download', { url })
  options.onProgress?.({
    phase: 'downloading',
    mode: 'async',
    percent: 100,
    message: '正在下载备份'
  })
  const result = await downloadBackupFile(url, 'fmo-backup.zip')
  options.onProgress?.({
    phase: 'completed',
    mode: 'async',
    percent: 100,
    message: '备份完成'
  })
  return { mode: 'async', ...result }
}

export async function backupLogsDataWithCompatibility(
  options: BackupLogsOptions
): Promise<BackupLogsDataResult> {
  const host = normalizeHost(options.host)
  if (!host) {
    throw new Error('未配置 FMO 地址')
  }

  const url = buildBackupUrl(host, options.protocol)
  options.onProgress?.({ phase: 'starting', percent: 0, message: '正在启动备份' })

  let startResponse: { status: number } | null = null
  try {
    startResponse = await requestRemote(url, 'POST')
  } catch {
    startResponse = null
  }

  if (!startResponse || shouldFallbackToLegacy(startResponse.status)) {
    options.onProgress?.({
      phase: 'downloading',
      mode: 'legacy',
      percent: 100,
      message: '正在下载备份'
    })
    const result = await downloadBackupFileData(url)
    options.onProgress?.({
      phase: 'completed',
      mode: 'legacy',
      percent: 100,
      message: '备份完成'
    })
    return result
  }

  if (startResponse.status < 200 || startResponse.status >= 300) {
    options.onProgress?.({
      phase: 'error',
      message: `启动 FMO 备份失败: HTTP ${startResponse.status}`
    })
    throw new Error(`启动 FMO 备份失败: HTTP ${startResponse.status}`)
  }

  options.onProgress?.({
    phase: 'exporting',
    mode: 'async',
    percent: 0,
    message: '正在导出备份'
  })

  try {
    await waitForAsyncBackupReady(host, options.protocol, options.onProgress)
  } catch (err: any) {
    if (
      err?.message === 'ASYNC_BACKUP_LISTEN_FAILED' ||
      err?.message === 'ASYNC_BACKUP_PROGRESS_TIMEOUT'
    ) {
      options.onProgress?.({
        phase: 'downloading',
        mode: 'legacy',
        percent: 100,
        message: '正在下载备份'
      })
      const result = await downloadBackupFileData(url)
      options.onProgress?.({
        phase: 'completed',
        mode: 'legacy',
        percent: 100,
        message: '备份完成'
      })
      return result
    }
    if (err?.message === 'ASYNC_BACKUP_COMPLETE_TIMEOUT') {
      options.onProgress?.({ phase: 'error', message: '等待 FMO 备份完成超时' })
      throw new Error('等待 FMO 备份完成超时')
    }
    if (err?.message === 'FMO_BACKUP_EXPORT_FAILED') {
      options.onProgress?.({ phase: 'error', message: 'FMO 设备导出备份失败' })
      throw new Error('FMO 设备导出备份失败')
    }
    options.onProgress?.({ phase: 'error', message: err?.message || '备份失败' })
    throw err
  }

  options.onProgress?.({
    phase: 'downloading',
    mode: 'async',
    percent: 100,
    message: '正在下载备份'
  })
  const result = await downloadBackupFileData(url)
  options.onProgress?.({
    phase: 'completed',
    mode: 'async',
    percent: 100,
    message: '备份完成'
  })
  return {
    ...result,
    mode: 'async'
  }
}
