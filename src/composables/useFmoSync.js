import { ref, onUnmounted } from 'vue'
import { FmoApiClient } from '../services/fmoApi'
import {
  isQsoExistsInIndexedDB,
  saveSingleQsoToIndexedDB,
  getAvailableFromCallsigns
} from '../services/db'
import { normalizeHost } from '../utils/urlUtils'

export function useFmoSync(options = {}) {
  const {
    onSyncComplete,
    getSpeakingHistory,
    getSelectedFromCallsign,
    getDbLoaded,
    getTotalLogs,
    getEventsConnected
  } = options

  const syncing = ref(false)
  const syncStatus = ref('')
  const autoSyncMessage = ref('')

  let autoSyncTimer = null
  let autoSyncMessageTimer = null
  let isAutoSyncing = false
  let lastFullSyncTime = 0
  let reloadTimer = null
  let activeClients = new Set()
  let isUnmounted = false

  function showAutoSyncMessage(msg) {
    autoSyncMessage.value = msg
    if (autoSyncMessageTimer) clearTimeout(autoSyncMessageTimer)
    autoSyncMessageTimer = setTimeout(() => {
      autoSyncMessage.value = ''
    }, 5000)
  }

  // 核心同步逻辑：同步今日所有数据
  async function syncTodayData(client, statusCallback = null) {
    const todayStart = Math.floor(new Date().setUTCHours(0, 0, 0, 0) / 1000)
    let page = 0
    let hasMoreToday = true
    let totalSynced = 0
    const currentFromCallsign = getSelectedFromCallsign?.() || ''

    while (hasMoreToday) {
      if (statusCallback) {
        statusCallback(`获取第 ${page + 1} 页列表...`)
      }

      const response = await client.getQsoList(page, 20, currentFromCallsign)
      const list = response.list

      if (!list || list.length === 0) break

      for (const item of list) {
        if (item.timestamp >= todayStart) {
          const qso = await processSingleQsoItem(item, todayStart, currentFromCallsign, client)
          if (qso) {
            if (statusCallback) {
              statusCallback(`保存记录: ${qso.toCallsign}...`)
            }
            totalSynced++
          }
        } else {
          hasMoreToday = false
          break
        }
      }

      if (list.length < 20) break
      page++
    }

    return totalSynced
  }

  // 处理单条QSO记录
  async function processSingleQsoItem(item, todayStart, currentFromCallsign, client) {
    if (item.timestamp < todayStart) return null

    let qso = null
    if (currentFromCallsign) {
      const exists = await isQsoExistsInIndexedDB(
        currentFromCallsign,
        item.timestamp,
        item.toCallsign
      )
      if (!exists) {
        const detailResponse = await client.getQsoDetail(item.logId)
        qso = detailResponse.log
        if (qso && qso.fromCallsign !== currentFromCallsign) qso = null
      }
    } else {
      const detailResponse = await client.getQsoDetail(item.logId)
      qso = detailResponse.log
      if (qso) {
        const exists = await isQsoExistsInIndexedDB(qso.fromCallsign, qso.timestamp, qso.toCallsign)
        if (exists) qso = null
      }
    }

    if (qso) {
      await saveSingleQsoToIndexedDB(qso)
    }

    return qso
  }

  // 同步后的数据更新
  async function updateAfterSync(wasEmpty, syncedCount, message) {
    if (syncedCount === 0) return { callsigns: [], wasEmpty }

    const callsigns = await getAvailableFromCallsigns()

    if (wasEmpty && syncedCount > 0) {
      window.location.reload()
      return { callsigns, wasEmpty: true }
    }

    if (message) {
      showAutoSyncMessage(message)
    }

    onSyncComplete?.({ callsigns, syncedCount })

    return { callsigns, wasEmpty }
  }

  // 检查是否应该同步
  function checkShouldSync() {
    const eventsConnected = getEventsConnected?.() || false
    const speakingHistory = getSpeakingHistory?.() || []
    const currentCallsign = getSelectedFromCallsign?.()

    // 如果 /events 连接成功
    if (eventsConnected) {
      // 检查发言历史中是否有当前呼号
      if (currentCallsign && speakingHistory.length > 0) {
        // 查找当前呼号在发言历史中的记录
        const currentCallsignHistory = speakingHistory.find((h) => h.callsign === currentCallsign)
        if (currentCallsignHistory) {
          // 有当前呼号发言记录，继续定时同步（考虑日志记录延迟）
          return true
        }
      }
      // /events 连接成功但列表中没有当前呼号，不需要定时同步
      return false
    }

    // /events 未连接或断开，继续使用原来的逻辑
    if (!speakingHistory || speakingHistory.length === 0) {
      return true
    }

    if (!currentCallsign) {
      return true
    }

    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const hasRecentSpeaking = speakingHistory.some((h) => {
      const time = h.endTime || h.startTime
      return h.callsign === currentCallsign && time > fiveMinutesAgo
    })

    return hasRecentSpeaking
  }

  // 执行增量同步
  async function performIncrementalSync(fmoAddress, protocol) {
    if (isUnmounted) return

    const host = normalizeHost(fmoAddress)
    const fullAddress = `${protocol}://${host}`
    const client = new FmoApiClient(fullAddress)
    activeClients.add(client)

    try {
      if (isUnmounted) return

      const wasEmpty = !getDbLoaded?.() || (getTotalLogs?.() || 0) === 0
      const todayStart = Math.floor(new Date().setUTCHours(0, 0, 0, 0) / 1000)
      const currentFromCallsign = getSelectedFromCallsign?.() || ''
      const response = await client.getQsoList(0, 10, currentFromCallsign)
      const list = response.list || []
      const newCallsigns = []

      for (const item of list) {
        if (isUnmounted) break
        const qso = await processSingleQsoItem(item, todayStart, currentFromCallsign, client)
        if (qso) {
          newCallsigns.push(qso.toCallsign)
        }
      }

      if (!isUnmounted) {
        await updateAfterSync(
          wasEmpty,
          newCallsigns.length,
          newCallsigns.length > 0 ? `同步到和 ${newCallsigns.join(', ')} 的通联` : null
        )
      }
    } catch (err) {
      console.error('增量同步失败:', err)
    } finally {
      client.close()
      activeClients.delete(client)
    }
  }

  // 执行今日数据同步
  async function performTodaySync(fmoAddress, protocol) {
    if (isUnmounted) return

    const host = normalizeHost(fmoAddress)
    const fullAddress = `${protocol}://${host}`
    const client = new FmoApiClient(fullAddress)
    activeClients.add(client)

    try {
      if (isUnmounted) return

      const wasEmpty = !getDbLoaded?.() || (getTotalLogs?.() || 0) === 0
      const totalSynced = await syncTodayData(client)

      if (!isUnmounted) {
        await updateAfterSync(
          wasEmpty,
          totalSynced,
          totalSynced > 0 ? `每小时同步完成，共更新 ${totalSynced} 条记录` : null
        )
      }

      if (totalSynced === 0) {
        console.log('每小时同步完成，无新数据')
      }
    } catch (err) {
      console.error('今日数据同步失败:', err)
    } finally {
      client.close()
      activeClients.delete(client)
    }
  }

  // 启动自动同步任务
  function startAutoSyncTask(fmoAddress, protocol) {
    if (autoSyncTimer) return

    autoSyncTimer = setInterval(async () => {
      if (isAutoSyncing || syncing.value || !fmoAddress) {
        return
      }

      isAutoSyncing = true

      try {
        const now = Date.now()
        const oneHour = 60 * 60 * 1000
        const needsFullSync = now - lastFullSyncTime >= oneHour

        if (needsFullSync) {
          console.log('执行每小时今日数据同步')
          await performTodaySync(fmoAddress, protocol)
          lastFullSyncTime = now
        } else {
          const shouldSync = checkShouldSync()
          if (shouldSync) {
            await performIncrementalSync(fmoAddress, protocol)
          } else {
            console.log('当前呼号5分钟内未发言，跳过本次同步')
          }
        }
      } catch (err) {
        console.error('定时同步失败:', err)
      } finally {
        isAutoSyncing = false
      }
    }, 10000)
  }

  // 停止自动同步任务
  function stopAutoSyncTask() {
    if (autoSyncTimer) {
      clearInterval(autoSyncTimer)
      autoSyncTimer = null
    }
  }

  // 手动同步今日通联
  async function syncToday(fmoAddress, protocol) {
    if (!fmoAddress || syncing.value || isUnmounted) return

    syncing.value = true
    syncStatus.value = '连接 FMO...'

    const host = normalizeHost(fmoAddress)
    const fullAddress = `${protocol}://${host}`
    const client = new FmoApiClient(fullAddress)
    activeClients.add(client)

    try {
      if (isUnmounted) return

      const totalSynced = await syncTodayData(client, (status) => {
        syncStatus.value = status
      })

      syncStatus.value = `同步完成，共更新 ${totalSynced} 条记录`

      const callsigns = await getAvailableFromCallsigns()
      onSyncComplete?.({ callsigns, syncedCount: totalSynced, reload: true })

      if (!isUnmounted) {
        reloadTimer = setTimeout(() => {
          window.location.reload()
        }, 1500)
      }
    } finally {
      syncing.value = false
      client.close()
      activeClients.delete(client)
    }
  }

  onUnmounted(() => {
    isUnmounted = true

    stopAutoSyncTask()

    if (autoSyncMessageTimer) {
      clearTimeout(autoSyncMessageTimer)
      autoSyncMessageTimer = null
    }

    if (reloadTimer) {
      clearTimeout(reloadTimer)
      reloadTimer = null
    }

    // 关闭所有活跃的客户端连接
    activeClients.forEach((client) => {
      client.close()
    })
    activeClients.clear()
  })

  return {
    syncing,
    syncStatus,
    autoSyncMessage,
    syncToday,
    startAutoSyncTask,
    stopAutoSyncTask,
    showAutoSyncMessage
  }
}
