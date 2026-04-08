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
  const syncFailedRecords = ref([])

  // 多地址同步进度
  const multiSyncProgress = ref({
    current: 0,
    total: 0,
    currentName: '',
    results: []
  })

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

  // 辅助函数：获取N天前的时间戳（UTC零点）
  function getDaysAgoTimestamp(days) {
    const now = new Date()
    const target = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
    return Math.floor(target.setUTCHours(0, 0, 0, 0) / 1000)
  }

  // 核心同步逻辑：同步指定天数范围内的数据
  async function syncRecentData(client, days = 1, statusCallback = null) {
    const rangeStart = getDaysAgoTimestamp(days)
    let page = 0
    let hasMoreInRange = true
    let totalSynced = 0
    const currentFromCallsign = getSelectedFromCallsign?.() || ''

    while (hasMoreInRange) {
      if (statusCallback) {
        statusCallback(`获取第 ${page + 1} 页列表...`)
      }

      const response = await client.getQsoList(page, 20, currentFromCallsign)
      const list = response.list

      if (!list || list.length === 0) break

      for (const item of list) {
        if (item.timestamp >= rangeStart) {
          const qso = await processSingleQsoItem(item, rangeStart, currentFromCallsign, client)
          if (qso) {
            if (statusCallback) {
              statusCallback(`保存记录: ${qso.toCallsign}...`)
            }
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

  // 为了向后兼容，保留 syncTodayData 作为别名
  async function syncTodayData(client, statusCallback = null) {
    return syncRecentData(client, 1, statusCallback)
  }

  // 处理单条QSO记录
  async function processSingleQsoItem(item, todayStart, currentFromCallsign, client) {
    if (item.timestamp < todayStart) return null

    let qso = null
    try {
      if (currentFromCallsign) {
        const exists = await isQsoExistsInIndexedDB(
          currentFromCallsign,
          item.timestamp,
          item.toCallsign
        )
        if (!exists) {
          // 在请求详情前延迟100ms
          await new Promise((resolve) => setTimeout(resolve, 100))
          const detailResponse = await client.getQsoDetail(item.logId)
          qso = detailResponse.log
          if (qso && qso.fromCallsign !== currentFromCallsign) qso = null
        }
      } else {
        // 在请求详情前延迟100ms
        await new Promise((resolve) => setTimeout(resolve, 100))
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
    } catch (err) {
      console.warn(`获取详情失败 logId=${item.logId}, toCallsign=${item.toCallsign}:`, err.message)
      syncFailedRecords.value.push({
        logId: item.logId,
        toCallsign: item.toCallsign,
        timestamp: item.timestamp,
        error: err.message
      })
      return null
    }
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

  // 检查是否应该同步（按服务器独立决策）
  function checkShouldSync(addressId) {
    const eventsConnected = getEventsConnected?.(addressId) || false
    const speakingHistory = getSpeakingHistory?.(addressId) || []
    const currentCallsign = getSelectedFromCallsign?.()

    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const hasRecentSpeaking = speakingHistory.some((h) => {
      const time = h.endTime || h.startTime
      return h.callsign === currentCallsign && time > fiveMinutesAgo
    })

    // 如果 /events 连接成功，则严格按照"5 分钟内有发言记录"来决定是否同步
    if (eventsConnected) {
      return hasRecentSpeaking
    }

    // /events 未连接或断开时，继续使用降级逻辑
    if (!speakingHistory || speakingHistory.length === 0) {
      return true
    }

    if (!currentCallsign) {
      return true
    }

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
  // getAddresses: 返回 [{host, protocol}] 数组的函数，每次同步周期调用获取最新地址列表
  function startAutoSyncTask(getAddresses) {
    if (autoSyncTimer) return

    autoSyncTimer = setInterval(async () => {
      if (isAutoSyncing || syncing.value) {
        return
      }

      // 获取当前需要同步的地址列表
      const addresses = typeof getAddresses === 'function' ? getAddresses() : []
      if (!addresses || addresses.length === 0) {
        return
      }

      isAutoSyncing = true

      try {
        const now = Date.now()
        const oneHour = 60 * 60 * 1000
        const needsFullSync = now - lastFullSyncTime >= oneHour

        // 依次同步所有地址（非并行）
        for (const address of addresses) {
          if (!address || !address.host) continue

          try {
            if (needsFullSync) {
              console.log(`执行每小时今日数据同步: ${address.host}`)
              await performTodaySync(address.host, address.protocol)
            } else {
              // 每个地址用自己的 addressId 判断
              const shouldSync = checkShouldSync(address.id)
              if (shouldSync) {
                await performIncrementalSync(address.host, address.protocol)
              } else {
                console.log(`当前呼号5分钟内未在 ${address.host} 发言，跳过本次同步`)
              }
            }
          } catch (err) {
            console.error(`同步 ${address.host} 失败:`, err)
          }

          // 地址之间间隔 300ms
          await new Promise((resolve) => setTimeout(resolve, 300))
        }

        // 更新最后全量同步时间（整个周期结束后统一更新）
        if (needsFullSync) {
          lastFullSyncTime = now
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

  // 手动同步今日通联（支持指定天数）
  async function syncToday(fmoAddress, protocol, days = 1) {
    if (!fmoAddress || syncing.value || isUnmounted) return

    syncing.value = true
    syncStatus.value = '连接 FMO...'
    syncFailedRecords.value = []

    const host = normalizeHost(fmoAddress)
    const fullAddress = `${protocol}://${host}`
    const client = new FmoApiClient(fullAddress)
    activeClients.add(client)

    try {
      if (isUnmounted) return

      const totalSynced = await syncRecentData(client, days, (status) => {
        syncStatus.value = status
      })

      const failedCount = syncFailedRecords.value.length
      if (failedCount > 0) {
        syncStatus.value = `同步完成，共更新 ${totalSynced} 条记录，${failedCount} 条失败`
        console.warn('同步失败的记录:', syncFailedRecords.value)
      } else {
        syncStatus.value = `同步完成，共更新 ${totalSynced} 条记录`
      }

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

  // 增量同步：分页查询所有日志，只插入不存在的记录
  async function syncIncremental(fmoAddress, protocol) {
    if (!fmoAddress || syncing.value || isUnmounted) return

    syncing.value = true
    syncStatus.value = '连接 FMO...'
    syncFailedRecords.value = []

    const host = normalizeHost(fmoAddress)
    const fullAddress = `${protocol}://${host}`
    const client = new FmoApiClient(fullAddress)
    activeClients.add(client)

    try {
      if (isUnmounted) return

      const currentFromCallsign = getSelectedFromCallsign?.() || ''
      let page = 0
      let hasMore = true
      let totalSynced = 0
      let totalProcessed = 0

      while (hasMore && !isUnmounted) {
        syncStatus.value = `正在获取第 ${page + 1} 页数据...`

        const response = await client.getQsoList(page, 20, currentFromCallsign)
        const list = response.list || []

        if (list.length === 0) break

        totalProcessed += list.length

        for (const item of list) {
          if (isUnmounted) break

          try {
            let qso = null
            let exists = false

            if (currentFromCallsign) {
              exists = await isQsoExistsInIndexedDB(
                currentFromCallsign,
                item.timestamp,
                item.toCallsign
              )
              if (!exists) {
                // 在请求详情前延迟100ms
                await new Promise((resolve) => setTimeout(resolve, 100))
                const detailResponse = await client.getQsoDetail(item.logId)
                qso = detailResponse.log
                if (qso && qso.fromCallsign !== currentFromCallsign) qso = null
              }
            } else {
              // 在请求详情前延迟100ms
              await new Promise((resolve) => setTimeout(resolve, 100))
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
              syncStatus.value = `已处理 ${totalProcessed} 条，新增 ${totalSynced} 条`
            }
          } catch (err) {
            console.warn(
              `获取详情失败 logId=${item.logId}, toCallsign=${item.toCallsign}:`,
              err.message
            )
            syncFailedRecords.value.push({
              logId: item.logId,
              toCallsign: item.toCallsign,
              timestamp: item.timestamp,
              error: err.message
            })
            // 继续处理下一条记录
          }
        }

        if (list.length < 20) {
          hasMore = false
        } else {
          page++
          // 每页延迟0.2秒
          if (!isUnmounted) {
            await new Promise((resolve) => setTimeout(resolve, 200))
          }
        }
      }

      const failedCount = syncFailedRecords.value.length
      if (failedCount > 0) {
        syncStatus.value = `增量同步完成，共处理 ${totalProcessed} 条记录，新增 ${totalSynced} 条，${failedCount} 条失败`
        console.warn('同步失败的记录:', syncFailedRecords.value)
      } else {
        syncStatus.value = `增量同步完成，共处理 ${totalProcessed} 条记录，新增 ${totalSynced} 条`
      }

      const callsigns = await getAvailableFromCallsigns()
      onSyncComplete?.({ callsigns, syncedCount: totalSynced, reload: true })

      if (!isUnmounted) {
        reloadTimer = setTimeout(() => {
          window.location.reload()
        }, 2000)
      }
    } catch (err) {
      syncStatus.value = `增量同步失败: ${err.message}`
      console.error('增量同步失败:', err)
    } finally {
      syncing.value = false
      client.close()
      activeClients.delete(client)
    }
  }

  // 全量同步：分页查询所有日志，用FMO数据替换本地数据
  async function syncFull(fmoAddress, protocol) {
    if (!fmoAddress || syncing.value || isUnmounted) return

    syncing.value = true
    syncStatus.value = '连接 FMO...'
    syncFailedRecords.value = []

    const host = normalizeHost(fmoAddress)
    const fullAddress = `${protocol}://${host}`
    const client = new FmoApiClient(fullAddress)
    activeClients.add(client)

    try {
      if (isUnmounted) return

      const currentFromCallsign = getSelectedFromCallsign?.() || ''
      let page = 0
      let hasMore = true
      let totalSynced = 0
      let totalProcessed = 0

      while (hasMore && !isUnmounted) {
        syncStatus.value = `正在获取第 ${page + 1} 页数据...`

        const response = await client.getQsoList(page, 20, currentFromCallsign)
        const list = response.list || []

        if (list.length === 0) break

        totalProcessed += list.length

        for (const item of list) {
          if (isUnmounted) break

          try {
            let qso = null

            if (currentFromCallsign) {
              // 在请求详情前延迟100ms
              await new Promise((resolve) => setTimeout(resolve, 100))
              const detailResponse = await client.getQsoDetail(item.logId)
              qso = detailResponse.log
              if (qso && qso.fromCallsign !== currentFromCallsign) qso = null
            } else {
              // 在请求详情前延迟100ms
              await new Promise((resolve) => setTimeout(resolve, 100))
              const detailResponse = await client.getQsoDetail(item.logId)
              qso = detailResponse.log
            }

            if (qso) {
              // 直接保存，覆盖已存在的记录
              await saveSingleQsoToIndexedDB(qso)
              totalSynced++
              syncStatus.value = `已处理 ${totalProcessed} 条，已同步 ${totalSynced} 条`
            }
          } catch (err) {
            console.warn(
              `获取详情失败 logId=${item.logId}, toCallsign=${item.toCallsign}:`,
              err.message
            )
            syncFailedRecords.value.push({
              logId: item.logId,
              toCallsign: item.toCallsign,
              timestamp: item.timestamp,
              error: err.message
            })
            // 继续处理下一条记录
          }
        }

        if (list.length < 20) {
          hasMore = false
        } else {
          page++
          // 每页延迟0.2秒
          if (!isUnmounted) {
            await new Promise((resolve) => setTimeout(resolve, 200))
          }
        }
      }

      const failedCount = syncFailedRecords.value.length
      if (failedCount > 0) {
        syncStatus.value = `全量同步完成，共处理 ${totalProcessed} 条记录，已同步 ${totalSynced} 条，${failedCount} 条失败`
        console.warn('同步失败的记录:', syncFailedRecords.value)
      } else {
        syncStatus.value = `全量同步完成，共处理 ${totalProcessed} 条记录，已同步 ${totalSynced} 条`
      }

      const callsigns = await getAvailableFromCallsigns()
      onSyncComplete?.({ callsigns, syncedCount: totalSynced, reload: true })

      if (!isUnmounted) {
        reloadTimer = setTimeout(() => {
          window.location.reload()
        }, 2000)
      }
    } catch (err) {
      syncStatus.value = `全量同步失败: ${err.message}`
      console.error('全量同步失败:', err)
    } finally {
      syncing.value = false
      client.close()
      activeClients.delete(client)
    }
  }

  // 多地址依次同步
  // addresses: 地址对象数组，每个包含 {id, name, host, protocol}
  // syncType: 'today' | 'incremental' | 'full'
  // days: 天数（用于 today 类型）
  async function syncMultiple(addresses, syncType, days = 1) {
    if (!addresses || addresses.length === 0 || syncing.value || isUnmounted) return

    syncing.value = true
    syncFailedRecords.value = []

    // 初始化进度
    multiSyncProgress.value = {
      current: 0,
      total: addresses.length,
      currentName: '',
      results: []
    }

    const allResults = []

    try {
      // 依次同步（非并行）
      for (let i = 0; i < addresses.length; i++) {
        if (isUnmounted) break

        const address = addresses[i]
        multiSyncProgress.value.current = i + 1
        multiSyncProgress.value.currentName = address.name || address.host

        const host = normalizeHost(address.host)
        const fullAddress = `${address.protocol}://${host}`
        const client = new FmoApiClient(fullAddress)
        activeClients.add(client)

        let syncedCount = 0
        let success = true
        let errorMsg = ''

        try {
          syncStatus.value = `正在同步 ${address.name || address.host}...`

          if (syncType === 'today') {
            syncedCount = await syncRecentData(client, days, (status) => {
              syncStatus.value = `${address.name || address.host}: ${status}`
            })
          } else if (syncType === 'incremental') {
            syncedCount = await syncIncrementalForAddress(client)
          } else if (syncType === 'full') {
            syncedCount = await syncFullForAddress(client)
          }
        } catch (err) {
          success = false
          errorMsg = err.message
          console.error(`同步 ${address.name || address.host} 失败:`, err)
        } finally {
          client.close()
          activeClients.delete(client)
        }

        const result = {
          addressId: address.id,
          name: address.name || address.host,
          success,
          syncedCount,
          error: errorMsg
        }

        allResults.push(result)
        multiSyncProgress.value.results.push(result)

        // 每个地址同步后短暂延迟，避免资源竞争
        if (!isUnmounted && i < addresses.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300))
        }
      }

      // 同步完成后调用回调
      const totalSynced = allResults.reduce((sum, r) => sum + r.syncedCount, 0)
      const callsigns = await getAvailableFromCallsigns()

      const failedCount = syncFailedRecords.value.length
      if (failedCount > 0) {
        syncStatus.value = `多地址同步完成，共 ${addresses.length} 个地址，新增 ${totalSynced} 条记录，${failedCount} 条失败`
        console.warn('同步失败的记录:', syncFailedRecords.value)
      } else {
        syncStatus.value = `多地址同步完成，共 ${addresses.length} 个地址，新增 ${totalSynced} 条记录`
      }

      // 先调用 onSyncComplete 回调刷新数据
      await onSyncComplete?.({ callsigns, syncedCount: totalSynced, reload: true, multiSync: true })

      // 同步完成后刷新页面（与单选模式保持一致）
      if (!isUnmounted) {
        reloadTimer = setTimeout(() => {
          window.location.reload()
        }, 2000)
      }
    } catch (err) {
      syncStatus.value = `多地址同步失败: ${err.message}`
      console.error('多地址同步失败:', err)
    } finally {
      syncing.value = false
    }
  }

  // 为指定地址执行增量同步（内部方法）
  async function syncIncrementalForAddress(client) {
    const currentFromCallsign = getSelectedFromCallsign?.() || ''
    let page = 0
    let hasMore = true
    let totalSynced = 0

    while (hasMore && !isUnmounted) {
      let response
      try {
        response = await client.getQsoList(page, 20, currentFromCallsign)
      } catch (err) {
        // 连接失败或请求失败，抛出错误让上层处理
        throw new Error(`获取日志列表失败: ${err.message}`)
      }

      const list = response.list || []

      if (list.length === 0) break

      for (const item of list) {
        if (isUnmounted) break

        try {
          let qso = null
          let exists = false

          if (currentFromCallsign) {
            exists = await isQsoExistsInIndexedDB(
              currentFromCallsign,
              item.timestamp,
              item.toCallsign
            )
            if (!exists) {
              await new Promise((resolve) => setTimeout(resolve, 100))
              const detailResponse = await client.getQsoDetail(item.logId)
              qso = detailResponse.log
              if (qso && qso.fromCallsign !== currentFromCallsign) qso = null
            }
          } else {
            await new Promise((resolve) => setTimeout(resolve, 100))
            const detailResponse = await client.getQsoDetail(item.logId)
            qso = detailResponse.log
            if (qso) {
              exists = await isQsoExistsInIndexedDB(qso.fromCallsign, qso.timestamp, qso.toCallsign)
            }
          }

          if (qso && !exists) {
            await saveSingleQsoToIndexedDB(qso)
            totalSynced++
          }
        } catch (err) {
          console.warn(`获取详情失败 logId=${item.logId}:`, err.message)
          syncFailedRecords.value.push({
            logId: item.logId,
            toCallsign: item.toCallsign,
            timestamp: item.timestamp,
            error: err.message
          })
        }
      }

      if (list.length < 20) {
        hasMore = false
      } else {
        page++
        if (!isUnmounted) {
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }
    }

    return totalSynced
  }

  // 为指定地址执行全量同步（内部方法）
  async function syncFullForAddress(client) {
    const currentFromCallsign = getSelectedFromCallsign?.() || ''
    let page = 0
    let hasMore = true
    let totalSynced = 0

    while (hasMore && !isUnmounted) {
      let response
      try {
        response = await client.getQsoList(page, 20, currentFromCallsign)
      } catch (err) {
        // 连接失败或请求失败，抛出错误让上层处理
        throw new Error(`获取日志列表失败: ${err.message}`)
      }

      const list = response.list || []

      if (list.length === 0) break

      for (const item of list) {
        if (isUnmounted) break

        try {
          let qso = null

          if (currentFromCallsign) {
            await new Promise((resolve) => setTimeout(resolve, 100))
            const detailResponse = await client.getQsoDetail(item.logId)
            qso = detailResponse.log
            if (qso && qso.fromCallsign !== currentFromCallsign) qso = null
          } else {
            await new Promise((resolve) => setTimeout(resolve, 100))
            const detailResponse = await client.getQsoDetail(item.logId)
            qso = detailResponse.log
          }

          if (qso) {
            await saveSingleQsoToIndexedDB(qso)
            totalSynced++
          }
        } catch (err) {
          console.warn(`获取详情失败 logId=${item.logId}:`, err.message)
          syncFailedRecords.value.push({
            logId: item.logId,
            toCallsign: item.toCallsign,
            timestamp: item.timestamp,
            error: err.message
          })
        }
      }

      if (list.length < 20) {
        hasMore = false
      } else {
        page++
        if (!isUnmounted) {
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }
    }

    return totalSynced
  }

  return {
    syncing,
    syncStatus,
    autoSyncMessage,
    syncFailedRecords,
    syncToday,
    syncIncremental,
    syncFull,
    startAutoSyncTask,
    stopAutoSyncTask,
    showAutoSyncMessage,
    // 新增多地址同步接口
    syncMultiple,
    multiSyncProgress
  }
}
