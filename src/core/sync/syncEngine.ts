/**
 * 同步引擎：与 Vue 无关的纯算法层。
 *
 * - 分页拉取 QSO 列表，按天数范围 / 按整库策略判断是否需要详情拉取
 * - 通过 callbacks（statusCallback / onFailed）把进度抛回编排层
 * - 不直接依赖任何 Pinia / Vue 响应式 API
 *
 * 所有函数接受 client (FmoApiClient) 作为入参，由编排层负责创建与关闭。
 */

import { getEffectivePlatform } from '../../platform/runtime'
// @ts-ignore - legacy JS
import {
  importFmoBackupDataToIndexedDB,
  isQsoExistsInIndexedDB,
  saveSingleQsoToIndexedDB
  // @ts-ignore
} from '../../services/db'
import { backupLogsDataWithCompatibility } from '../../services/fmoBackupService'
// @ts-ignore - legacy JS
import { buildHttpUrl } from '../../utils/urlUtils'

export interface SyncFailedRecord {
  logId: any
  toCallsign: string
  timestamp: number
  error: string
}

export interface SyncContext {
  /** 当前选中的 fromCallsign（过滤非本呼号记录） */
  currentFromCallsign?: string
  /** 状态文本回调（供编排层反映到 UI） */
  statusCallback?: (msg: string) => void
  /** 失败记录回调 */
  onFailed?: (rec: SyncFailedRecord) => void
  /** 中止信号（编排层 unmount / 主动取消时会变 true） */
  isAborted?: () => boolean
}

function noop() {
  /* no-op */
}
function never() {
  return false
}

function isValidQsoTimestamp(timestamp: number): boolean {
  return Number.isFinite(timestamp) && timestamp > 0
}

function isValidQsoListItem(item: any): boolean {
  return (
    isValidQsoTimestamp(item?.timestamp) &&
    typeof item?.toCallsign === 'string' &&
    item.toCallsign.trim().length > 0
  )
}

function parseBaseUrl(baseUrl: string): { host: string; protocol: string } {
  const url = new URL(baseUrl)
  return {
    host: url.host,
    protocol: url.protocol.replace(/:$/, '')
  }
}

function isSameOriginUrl(targetUrl: string): boolean {
  if (typeof window === 'undefined' || !window.location) return false
  try {
    const target = new URL(targetUrl, window.location.href)
    return target.origin === window.location.origin
  } catch {
    return false
  }
}

async function probeWebBackupReadAccess(host: string, protocol: string): Promise<boolean> {
  const probeUrl = buildHttpUrl(`${protocol}://${host}`, '/favicon.ico')
  try {
    await fetch(probeUrl, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store'
    })
    return true
  } catch {
    return false
  }
}

/** 获取 N 天前 UTC 零点时间戳（单位秒） */
export function getDaysAgoTimestamp(days: number): number {
  const now = new Date()
  const target = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
  return Math.floor(target.setUTCHours(0, 0, 0, 0) / 1000)
}

/**
 * 处理单条 QSO：判断是否需要拉详情 + 入库。
 * 返回实际落库的 qso（否则 null）。
 */
export async function processSingleQsoItem(
  item: any,
  rangeStart: number,
  client: any,
  ctx: SyncContext
): Promise<any | null> {
  if (!isValidQsoListItem(item)) return null
  if (item.timestamp < rangeStart) return null

  const onFailed = ctx.onFailed ?? noop
  const currentFromCallsign = ctx.currentFromCallsign || ''

  try {
    let qso: any = null

    if (currentFromCallsign) {
      const exists = await isQsoExistsInIndexedDB(
        currentFromCallsign,
        item.timestamp,
        item.toCallsign
      )
      if (!exists) {
        await new Promise((r) => setTimeout(r, 100))
        const detailResponse = await client.getQsoDetail(item.logId)
        qso = detailResponse.log
        if (qso && qso.fromCallsign !== currentFromCallsign) qso = null
      }
    } else {
      await new Promise((r) => setTimeout(r, 100))
      const detailResponse = await client.getQsoDetail(item.logId)
      qso = detailResponse.log
      if (qso) {
        const exists = await isQsoExistsInIndexedDB(
          qso.fromCallsign,
          qso.timestamp,
          qso.toCallsign
        )
        if (exists) qso = null
      }
    }

    if (qso) {
      await saveSingleQsoToIndexedDB(qso)
    }

    return qso
  } catch (err: any) {
    console.warn(
      `获取详情失败 logId=${item.logId}, toCallsign=${item.toCallsign}:`,
      err?.message
    )
    onFailed({
      logId: item.logId,
      toCallsign: item.toCallsign,
      timestamp: item.timestamp,
      error: err?.message || String(err)
    })
    return null
  }
}

/**
 * 同步最近 N 天（默认 1 天）的 QSO。
 */
export async function syncRecentData(
  client: any,
  days: number,
  ctx: SyncContext
): Promise<number> {
  const rangeStart = getDaysAgoTimestamp(days)
  const statusCallback = ctx.statusCallback ?? noop
  const isAborted = ctx.isAborted ?? never
  const currentFromCallsign = ctx.currentFromCallsign || ''

  let page = 0
  let hasMoreInRange = true
  let totalSynced = 0

  while (hasMoreInRange && !isAborted()) {
    statusCallback(`获取第 ${page + 1} 页列表...`)

    const response = await client.getQsoList(page, 20)
    const list = response.list

    if (!list || list.length === 0) break

    for (const item of list) {
      if (isAborted()) break
      if (!isValidQsoListItem(item)) {
        continue
      }

      if (item.timestamp >= rangeStart) {
        const qso = await processSingleQsoItem(item, rangeStart, client, ctx)
        if (qso) {
          statusCallback(`保存记录: ${qso.toCallsign}...`)
          totalSynced++
        }
      } else {
        hasMoreInRange = false
        break
      }
    }

    if (list.length < 20) break
    page++
  }

  return totalSynced
}

/**
 * 增量同步：分页遍历所有日志，只插入不存在的记录。
 */
export async function syncIncrementalForAddress(
  client: any,
  ctx: SyncContext
): Promise<{ totalSynced: number; totalProcessed: number }> {
  const currentFromCallsign = ctx.currentFromCallsign || ''
  const statusCallback = ctx.statusCallback ?? noop
  const onFailed = ctx.onFailed ?? noop
  const isAborted = ctx.isAborted ?? never

  let page = 0
  let hasMore = true
  let totalSynced = 0
  let totalProcessed = 0

  while (hasMore && !isAborted()) {
    statusCallback(`正在获取第 ${page + 1} 页数据...`)

    let response: any
    try {
      response = await client.getQsoList(page, 20)
    } catch (err: any) {
      throw new Error(`获取日志列表失败: ${err?.message || String(err)}`)
    }

    const list = response.list || []
    if (list.length === 0) break

    totalProcessed += list.length

    for (const item of list) {
      if (isAborted()) break
      if (!isValidQsoListItem(item)) continue

      try {
        let qso: any = null
        let exists = false

        if (currentFromCallsign) {
          exists = await isQsoExistsInIndexedDB(
            currentFromCallsign,
            item.timestamp,
            item.toCallsign
          )
          if (!exists) {
            await new Promise((r) => setTimeout(r, 100))
            const detailResponse = await client.getQsoDetail(item.logId)
            qso = detailResponse.log
            if (qso && qso.fromCallsign !== currentFromCallsign) qso = null
          }
        } else {
          await new Promise((r) => setTimeout(r, 100))
          const detailResponse = await client.getQsoDetail(item.logId)
          qso = detailResponse.log
          if (qso) {
            exists = await isQsoExistsInIndexedDB(
              qso.fromCallsign,
              qso.timestamp,
              qso.toCallsign
            )
          }
        }

        if (qso && !exists) {
          await saveSingleQsoToIndexedDB(qso)
          totalSynced++
          statusCallback(`已处理 ${totalProcessed} 条，新增 ${totalSynced} 条`)
        }
      } catch (err: any) {
        console.warn(`获取详情失败 logId=${item.logId}:`, err?.message)
        onFailed({
          logId: item.logId,
          toCallsign: item.toCallsign,
          timestamp: item.timestamp,
          error: err?.message || String(err)
        })
      }
    }

    if (list.length < 20) {
      hasMore = false
    } else {
      page++
      if (!isAborted()) {
        await new Promise((r) => setTimeout(r, 200))
      }
    }
  }

  return { totalSynced, totalProcessed }
}

/**
 * 浏览器全量同步：保留 WebSocket RPC 路径，避免浏览器直接下载数据库文件遇到 CORS。
 */
async function syncFullViaWebSocketForAddress(
  client: any,
  ctx: SyncContext
): Promise<{ totalSynced: number; totalProcessed: number }> {
  const currentFromCallsign = ctx.currentFromCallsign || ''
  const statusCallback = ctx.statusCallback ?? noop
  const onFailed = ctx.onFailed ?? noop
  const isAborted = ctx.isAborted ?? never

  let page = 0
  let hasMore = true
  let totalSynced = 0
  let totalProcessed = 0

  while (hasMore && !isAborted()) {
    statusCallback(`正在获取第 ${page + 1} 页数据...`)

    let response: any
    try {
      response = await client.getQsoList(page, 20)
    } catch (err: any) {
      throw new Error(`获取日志列表失败: ${err?.message || String(err)}`)
    }

    const list = response.list || []
    if (list.length === 0) break

    totalProcessed += list.length

    for (const item of list) {
      if (isAborted()) break
      if (!isValidQsoListItem(item)) continue

      try {
        let qso: any = null

        if (currentFromCallsign) {
          await new Promise((r) => setTimeout(r, 100))
          const detailResponse = await client.getQsoDetail(item.logId)
          qso = detailResponse.log
          if (qso && qso.fromCallsign !== currentFromCallsign) qso = null
        } else {
          await new Promise((r) => setTimeout(r, 100))
          const detailResponse = await client.getQsoDetail(item.logId)
          qso = detailResponse.log
        }

        if (qso) {
          await saveSingleQsoToIndexedDB(qso)
          totalSynced++
          statusCallback(`已处理 ${totalProcessed} 条，已同步 ${totalSynced} 条`)
        }
      } catch (err: any) {
        console.warn(`获取详情失败 logId=${item.logId}:`, err?.message)
        onFailed({
          logId: item.logId,
          toCallsign: item.toCallsign,
          timestamp: item.timestamp,
          error: err?.message || String(err)
        })
      }
    }

    if (list.length < 20) {
      hasMore = false
    } else {
      page++
      if (!isAborted()) {
        await new Promise((r) => setTimeout(r, 200))
      }
    }
  }

  return { totalSynced, totalProcessed }
}

/**
 * 全量同步优先路径：复用兼容备份流程，下载备份产物（.db/.zip）后统一导入。
 */
async function syncFullViaDbBackupForAddress(
  client: any,
  ctx: SyncContext
): Promise<{ totalSynced: number; totalProcessed: number }> {
  const currentFromCallsign = ctx.currentFromCallsign || ''
  const statusCallback = ctx.statusCallback ?? noop
  const isAborted = ctx.isAborted ?? never

  if (isAborted()) {
    return { totalSynced: 0, totalProcessed: 0 }
  }

  let downloaded: { filename: string; data: Uint8Array }
  try {
    const { host, protocol } = parseBaseUrl(client.baseUrl)
    downloaded = await backupLogsDataWithCompatibility({
      host,
      protocol,
      onProgress: (state) => {
        if (isAborted()) return
        statusCallback(state.message || '正在备份 FMO 日志...')
      }
    })
  } catch (err: any) {
    throw new Error(`备份 FMO 日志失败: ${err?.message || String(err)}`)
  }

  if (isAborted()) {
    return { totalSynced: 0, totalProcessed: 0 }
  }

  statusCallback('正在导入备份文件...')
  const result = await importFmoBackupDataToIndexedDB(
    {
      name: downloaded.filename || `fmo-backup-${Date.now()}`,
      data: downloaded.data
    },
    (progress: any) => {
      if (isAborted()) return
      statusCallback(`正在导入 ${progress.callsign}：${progress.current}/${progress.total}`)
    },
    currentFromCallsign ? { fromCallsign: currentFromCallsign } : {}
  )

  return {
    totalSynced: result.totalRecords || 0,
    totalProcessed: result.totalRecords || 0
  }
}

/**
 * 全量同步：
 * - 所有平台优先走“备份 FMO 日志 + 导入 FMO 日志”的组合流程，兼容 .db/.zip 备份产物。
 * - 备份或导入失败时，回落到原有 WebSocket RPC 逻辑。
 */
export async function syncFullForAddress(
  client: any,
  ctx: SyncContext
): Promise<{ totalSynced: number; totalProcessed: number }> {
  const statusCallback = ctx.statusCallback ?? noop
  const platform = getEffectivePlatform()

  if (platform === 'web') {
    const { host, protocol } = parseBaseUrl(client.baseUrl)
    const backupUrl = buildHttpUrl(`${protocol}://${host}`, '/api/qso/backup')

    if (!isSameOriginUrl(backupUrl)) {
      statusCallback('正在探测备份接口可访问性...')
      const canReadBackup = await probeWebBackupReadAccess(host, protocol)
      if (!canReadBackup) {
        statusCallback('跨源备份不可读，直接使用 WebSocket RPC...')
        return syncFullViaWebSocketForAddress(client, ctx)
      }
    }
  }

  try {
    return await syncFullViaDbBackupForAddress(client, ctx)
  } catch (err: any) {
    const reason = err?.message || String(err)
    console.warn('全量同步备份导入失败，回落 WebSocket RPC:', reason)
    statusCallback(`备份导入失败，回落 RPC：${reason}`)
  }

  if (ctx.isAborted?.()) {
    return { totalSynced: 0, totalProcessed: 0 }
  }

  statusCallback('正在回落到 WebSocket RPC 全量同步...')
  return syncFullViaWebSocketForAddress(client, ctx)
}
