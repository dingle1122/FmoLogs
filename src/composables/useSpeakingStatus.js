import { ref, computed, onUnmounted, reactive } from 'vue'
import { Capacitor } from '@capacitor/core'
import { formatTimeAgo } from '../components/home/constants'
import { normalizeHost } from '../utils/urlUtils'
import { gridToAddress } from '../services/gridService'
import { FmoApiClient } from '../services/fmoApi'
import { FmoEvents } from '../services/fmoNativeEvents'

const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

export function useSpeakingStatus() {
  // ========== 数据结构改造：按 addressId 隔离 ==========
  // currentSpeakerMap: key 为 addressId，value 为 callsign 字符串
  const currentSpeakerMap = reactive(new Map())
  // speakingHistoryMap: key 为 addressId，value 为 history 数组
  const speakingHistoryMap = reactive(new Map())
  // speakerAddressMap: key 为 addressId，value 为格式化后的地址字符串
  const speakerAddressMap = reactive(new Map())
  // isHostSpeakingMap: key 为 addressId，value 为 boolean（当前发言人是否为 host）
  const isHostSpeakingMap = reactive(new Map())

  // 多连接管理
  const eventConnections = new Map() // key: addressId, value: WebSocket
  const reconnectTimers = new Map() // key: addressId, value: timer
  const connectionConfigs = new Map() // key: addressId, value: {host, protocol, isPrimary}
  const speakingHistoryCleanupTimers = new Map() // key: addressId, value: timer
  const serverInfoTimers = new Map() // key: addressId, value: timer
  const serverInfoPollTimers = new Map() // key: addressId, value: timer
  const serverInfoMap = reactive(new Map()) // key: addressId, value: {uid, name}
  let isManualDisconnect = false
  const primaryAddressId = ref(null)

  // 格式化地址数据（优先显示市名，直辖市回退到省名）
  function formatAddress(data) {
    if (!data) return ''
    return data.city || data.province || ''
  }

  // 主服务器连接状态
  const primaryConnected = ref(false)

  // 连接状态变化计数器，用于触发响应式更新
  const connectionChangeCounter = ref(0)

  // 任一连接存活即为 true
  const eventsConnected = computed(() => {
    connectionChangeCounter.value // track reactivity
    for (const ws of eventConnections.values()) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        return true
      }
    }
    return false
  })

  // ========== 向后兼容的 computed ==========
  // 返回主服务器的当前发言者
  const currentSpeaker = computed(() => {
    if (!primaryAddressId.value) return ''
    return currentSpeakerMap.get(primaryAddressId.value) || ''
  })

  // 返回主服务器的发言历史
  const speakingHistory = computed(() => {
    if (!primaryAddressId.value) return []
    return speakingHistoryMap.get(primaryAddressId.value) || []
  })

  // 返回主服务器当前发言者的 grid
  const currentSpeakerGrid = computed(() => {
    if (!primaryAddressId.value) return ''
    const callsign = currentSpeakerMap.get(primaryAddressId.value)
    if (!callsign) return ''
    const history = speakingHistoryMap.get(primaryAddressId.value) || []
    const record = history.find((h) => !h.endTime && h.callsign === callsign)
    return record?.grid || ''
  })

  // 返回主服务器当前发言者的地址
  const currentSpeakerAddress = computed(() => {
    if (!primaryAddressId.value) return ''
    return speakerAddressMap.get(primaryAddressId.value) || ''
  })

  // 返回主服务器当前发言者是否为 host（当前用户自己）
  const isHostSpeaking = computed(() => {
    if (!primaryAddressId.value) return false
    return isHostSpeakingMap.get(primaryAddressId.value) || false
  })

  // 合并所有服务器的发言历史，按时间排序，每条记录带 addressId 字段
  const allSpeakingHistories = computed(() => {
    const allHistories = []
    for (const [addressId, history] of speakingHistoryMap.entries()) {
      for (const record of history) {
        allHistories.push({
          ...record,
          addressId
        })
      }
    }
    // 按 startTime 降序排序
    return allHistories.sort((a, b) => b.startTime - a.startTime)
  })

  // 返回所有服务器的当前发言者数组 [{addressId, callsign, address}]
  const allCurrentSpeakers = computed(() => {
    const speakers = []
    for (const [addressId, callsign] of currentSpeakerMap.entries()) {
      if (callsign) {
        speakers.push({ addressId, callsign, address: speakerAddressMap.get(addressId) || '' })
      }
    }
    return speakers
  })

  // ========== localStorage 相关方法（按 addressId 分离） ==========
  // 获取指定 addressId 的 storage key
  function getStorageKey(addressId) {
    return `fmo_speaking_history_${addressId}`
  }

  // 从 localStorage 加载指定服务器的发言历史
  // Android 端由原生 SharedPreferences 持久化，不需要 localStorage
  function loadSpeakingHistoryFromStorage(addressId) {
    if (isAndroid) return []
    try {
      const stored = localStorage.getItem(getStorageKey(addressId))
      if (stored) {
        const history = JSON.parse(stored)
        // 过滤掉超过1小时的记录
        const oneHourAgo = Date.now() - 60 * 60 * 1000
        const filteredHistory = history.filter((h) => {
          const time = h.endTime || h.startTime
          return time > oneHourAgo
        })
        // 将所有记录标记为已结束（设置 endTime）
        return filteredHistory.map((h) => ({
          ...h,
          endTime: h.endTime || h.startTime
        }))
      }
    } catch (err) {
      console.error(`[${addressId}] 加载发言历史失败:`, err)
    }
    return []
  }

  // 保存指定服务器的发言历史到 localStorage
  // Android 端由原生 SharedPreferences 持久化，不需要 localStorage
  function saveSpeakingHistoryToStorage(addressId) {
    if (isAndroid) return
    try {
      const history = speakingHistoryMap.get(addressId) || []
      localStorage.setItem(getStorageKey(addressId), JSON.stringify(history))
    } catch (err) {
      console.error(`[${addressId}] 保存发言历史失败:`, err)
    }
  }

  // ========== 新增方法 ==========
  // 获取指定服务器的发言历史数组
  function getSpeakingHistoryFor(addressId) {
    return speakingHistoryMap.get(addressId) || []
  }

  // 检查指定 addressId 的 WebSocket 是否连接
  function isAddressConnected(addressId) {
    const ws = eventConnections.get(addressId)
    return ws && ws.readyState === WebSocket.OPEN
  }

  // ========== WebSocket 连接管理 ==========
  // 创建单个事件 WebSocket 连接
  function createEventWsConnection(addressId, host, protocol, isPrimary) {
    const normalizedHost = normalizeHost(host)
    const wsUrl = `${protocol}://${normalizedHost}/events`

    console.log(`[${addressId}] Connecting to events: ${wsUrl}`)

    connectionConfigs.set(addressId, { host, protocol, isPrimary })

    // 连接建立时自动从 localStorage 加载对应 addressId 的历史
    const loadedHistory = loadSpeakingHistoryFromStorage(addressId)
    speakingHistoryMap.set(addressId, loadedHistory)

    // 启动该 addressId 的清理定时器
    startSpeakingHistoryCleanup(addressId)

    // ========== Android 原生路径：交给 FmoEventsPlugin 处理 ==========
    if (isAndroid) {
      const fakeWs = {
        readyState: WebSocket.CONNECTING,
        close() {
          /* 真正关闭由 FmoEvents.disconnect 完成 */
        }
      }
      eventConnections.set(addressId, fakeWs)
      // 原生 connect 会在插件内新建 BusinessState（serverName=""）；
      // 若本地已有缓存名（如断线重连场景），立刻推进去覆盖初始空值。
      pushCachedServerNameIfAny(addressId)
      // apiUrl 用于原生轮询 station:getCurrent（同 host、同协议，路径换成 /ws）
      const apiUrl = `${protocol}://${normalizedHost}/ws`
      FmoEvents.connect({ addressId, url: wsUrl, apiUrl }).catch((err) => {
        console.warn(`[${addressId}] FmoEvents.connect failed`, err)
      })
      return fakeWs
    }

    // ========== Web 路径：浏览器原生 WebSocket ==========
    const ws = new WebSocket(wsUrl)
    eventConnections.set(addressId, ws)

    ws.onopen = () => {
      console.log(`[${addressId}] Events WebSocket connected`)
      connectionChangeCounter.value++
      // 清除该连接的重连定时器
      if (reconnectTimers.has(addressId)) {
        clearTimeout(reconnectTimers.get(addressId))
        reconnectTimers.delete(addressId)
      }
      // 更新主服务器连接状态
      if (isPrimary) {
        primaryConnected.value = true
      }
      // 启动服务器信息定时获取
      startServerInfoPolling(addressId)
    }

    ws.onmessage = (event) => {
      handleEventMessage(event.data, addressId, isPrimary)
    }

    ws.onclose = () => {
      console.log(`[${addressId}] Events WebSocket closed`)
      connectionChangeCounter.value++
      // 更新主服务器连接状态
      if (isPrimary) {
        primaryConnected.value = false
      }
      // 停止该 addressId 的清理定时器
      stopSpeakingHistoryCleanup(addressId)
      // 只有非主动断开才重连
      if (!isManualDisconnect && !reconnectTimers.has(addressId)) {
        const timer = setTimeout(() => {
          reconnectTimers.delete(addressId)
          const config = connectionConfigs.get(addressId)
          if (config) {
            createEventWsConnection(addressId, config.host, config.protocol, config.isPrimary)
          }
        }, 5000)
        reconnectTimers.set(addressId, timer)
      }
    }

    ws.onerror = () => {
      // onclose 会自动触发
    }

    return ws
  }

  // ========== Android 原生插件的全局事件监听 ==========
  let nativeMsgHandle = null
  let nativeStatusHandle = null
  let nativeServerInfoHandle = null

  function onNativeMessage({ addressId, data }) {
    const cfg = connectionConfigs.get(addressId)
    if (!cfg) return
    handleEventMessage(data, addressId, cfg.isPrimary)
  }

  function onNativeStatus({ addressId, status }) {
    const cfg = connectionConfigs.get(addressId)
    if (!cfg) return
    const fakeWs = eventConnections.get(addressId)
    if (status === 'connected') {
      if (fakeWs) fakeWs.readyState = WebSocket.OPEN
      if (cfg.isPrimary) primaryConnected.value = true
      connectionChangeCounter.value++
      startServerInfoPolling(addressId)
      // 连上后从原生插件拉一次快照（JS 冻结期间的累积状态都在原生侧）
      syncFromNativeSnapshot(addressId)
    } else if (status === 'reconnecting') {
      if (fakeWs) fakeWs.readyState = WebSocket.CLOSED
      if (cfg.isPrimary) primaryConnected.value = false
      connectionChangeCounter.value++
    } else if (status === 'disconnected') {
      if (fakeWs) fakeWs.readyState = WebSocket.CLOSED
      if (cfg.isPrimary) primaryConnected.value = false
      stopSpeakingHistoryCleanup(addressId)
      connectionChangeCounter.value++
    }
  }

  // ========== 从原生插件拉取快照并合并到响应式状态 ==========
  /**
   * 合并原生快照与 JS 现有历史，避免原生空快照覆盖 localStorage 数据。
   * 去重策略与实时处理一致：按 callsign 去重（每个呼号只保留一条记录），
   * 冲突时优先原生数据（原生 endTime 更准确），最终按 startTime 降序排列并过滤 >1h 记录。
   */
  function applyNativeSnapshot(entry) {
    if (!entry || !entry.addressId) return
    const { addressId, currentSpeaker, currentGrid, currentIsHost, history: nativeHistory } = entry
    if (!connectionConfigs.has(addressId)) return

    // 当前发言人
    currentSpeakerMap.set(addressId, currentSpeaker || '')
    // 同步 host 发言状态
    isHostSpeakingMap.set(addressId, !!currentIsHost)

    // 地址解析（仅当前发言人的 grid）
    if (currentGrid) {
      gridToAddress(currentGrid)
        .then((result) => {
          speakerAddressMap.set(addressId, formatAddress(result))
        })
        .catch(() => {
          speakerAddressMap.set(addressId, '')
        })
    } else {
      speakerAddressMap.set(addressId, '')
    }

    // 合并原生快照与 JS 现有历史（按 callsign 去重，与实时处理逻辑一致）
    const existingHistory = speakingHistoryMap.get(addressId) || []
    const serverInfo = serverInfoMap.get(addressId)
    const oneHourAgo = Date.now() - 60 * 60 * 1000

    // 用 Map 以 callsign 去重，冲突时原生数据优先（endTime 更准确，特别是进行中的记录）
    const mergedMap = new Map()
    function toRecord(h) {
      const rec = {
        callsign: h.callsign,
        grid: h.grid || '',
        startTime: h.startTime,
        endTime: h.endTime == null ? null : h.endTime
      }
      if (serverInfo) {
        rec.serverName = serverInfo.name
        rec.serverUid = serverInfo.uid
      }
      return rec
    }

    // 先放 JS 现有记录
    for (const h of existingHistory) {
      const t = h.endTime || h.startTime
      if (t < oneHourAgo) continue
      mergedMap.set(h.callsign, toRecord(h))
    }
    // 原生记录覆盖同名 callsign（原生 endTime 更准确，特别是进行中的记录）
    for (const h of nativeHistory || []) {
      const t = (h.endTime != null ? h.endTime : h.startTime)
      if (t < oneHourAgo) continue
      mergedMap.set(h.callsign, toRecord(h))
    }

    const newHistory = Array.from(mergedMap.values()).sort((a, b) => b.startTime - a.startTime)
    speakingHistoryMap.set(addressId, newHistory)
    saveSpeakingHistoryToStorage(addressId)
    connectionChangeCounter.value++
  }

  async function syncFromNativeSnapshot(addressId) {
    if (!isAndroid) return
    try {
      const payload = addressId ? { addressId } : {}
      const snapshot = await FmoEvents.getSnapshot(payload)
      const list = (snapshot && snapshot.connections) || []
      for (const entry of list) applyNativeSnapshot(entry)
    } catch (err) {
      console.warn('[FmoEvents] getSnapshot failed', err)
    }
  }

  // 切回前台时从原生拉一次全量快照
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      syncFromNativeSnapshot()
    }
  }

  // 原生侧轮询到服务器信息后会把 {addressId,uid,name} 推过来
  // JS 只需写 serverInfoMap；bs.serverName 已由原生自己写入并刷通知栏
  function onNativeServerInfo({ addressId, uid, name }) {
    if (!addressId || !uid) return
    serverInfoMap.set(addressId, { uid, name: name || '' })
    connectionChangeCounter.value++
  }

  if (isAndroid) {
    FmoEvents.addListener('message', onNativeMessage).then((h) => {
      nativeMsgHandle = h
    })
    FmoEvents.addListener('status', onNativeStatus).then((h) => {
      nativeStatusHandle = h
    })
    FmoEvents.addListener('serverInfo', onNativeServerInfo).then((h) => {
      nativeServerInfoHandle = h
    })
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  // 连接多个事件 WebSocket（多选模式）
  function connectMultipleEventWs(addresses, primaryId) {
    if (!addresses || addresses.length === 0) return

    // 先断开所有旧连接
    disconnectAllEventWs()

    // 重置手动断开标志，允许新连接自动重连
    isManualDisconnect = false

    // 设置主服务器ID（必须在 disconnectAllEventWs 之后）
    primaryAddressId.value = primaryId
    if (isAndroid) {
      // 先把已缓存的主服务器名推给原生，再 setPrimary，避免短暂 fallback 文案
      pushCachedServerNameIfAny(primaryId)
      FmoEvents.setPrimary({ addressId: primaryId || '' }).catch(() => {})
    }

    // 为每个地址创建连接
    for (const addr of addresses) {
      const isPrimary = addr.id === primaryId
      createEventWsConnection(addr.id, addr.host, addr.protocol, isPrimary)
    }
  }

  // 断开所有事件 WebSocket 连接
  function disconnectAllEventWs() {
    isManualDisconnect = true

    // 原生路径：一次性关闭插件内所有连接
    if (isAndroid) {
      FmoEvents.disconnectAll().catch(() => {})
    }

    // 清除所有重连定时器
    for (const timer of reconnectTimers.values()) {
      clearTimeout(timer)
    }
    reconnectTimers.clear()

    // 停止所有清理定时器
    for (const addressId of speakingHistoryCleanupTimers.keys()) {
      stopSpeakingHistoryCleanup(addressId)
    }
    speakingHistoryCleanupTimers.clear()

    // 停止所有服务器信息定时获取
    for (const addressId of serverInfoTimers.keys()) {
      stopServerInfoPolling(addressId)
    }
    serverInfoTimers.clear()
    // 停止所有服务器信息轮询
    for (const [addressId, timer] of serverInfoPollTimers.entries()) {
      clearTimeout(timer)
    }
    serverInfoPollTimers.clear()
    serverInfoMap.clear()

    // 关闭所有连接
    for (const [addressId, ws] of eventConnections.entries()) {
      try {
        const state = ws.readyState
        if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
          ws.close()
        }
      } catch (err) {
        console.error(`[${addressId}] 关闭事件 WebSocket 失败:`, err)
      }
    }
    eventConnections.clear()
    connectionConfigs.clear()

    // 清理 Map 中的状态
    currentSpeakerMap.clear()
    speakingHistoryMap.clear()
    speakerAddressMap.clear()
    isHostSpeakingMap.clear()

    primaryConnected.value = false
    primaryAddressId.value = null
    if (isAndroid) {
      FmoEvents.setPrimary({ addressId: '' }).catch(() => {})
    }
    connectionChangeCounter.value++
  }

  // 断开单个事件 WebSocket（内部方法）
  function disconnectEventWs(addressId) {
    // 先从 connectionConfigs 中删除配置，防止 onclose 回调中自动重连
    connectionConfigs.delete(addressId)

    // 原生路径：告知插件关闭该连接
    if (isAndroid) {
      FmoEvents.disconnect({ addressId }).catch(() => {})
    }

    const ws = eventConnections.get(addressId)
    if (ws) {
      try {
        const state = ws.readyState
        if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
          ws.close()
        }
      } catch (err) {
        console.error(`[${addressId}] 关闭事件 WebSocket 失败:`, err)
      }
      eventConnections.delete(addressId)
    }

    // 清理该连接的重连定时器
    if (reconnectTimers.has(addressId)) {
      clearTimeout(reconnectTimers.get(addressId))
      reconnectTimers.delete(addressId)
    }

    // 停止该 addressId 的清理定时器
    stopSpeakingHistoryCleanup(addressId)

    // 停止该 addressId 的服务器信息定时获取
    stopServerInfoPolling(addressId)
    // 停止该 addressId 的服务器信息轮询
    if (serverInfoPollTimers.has(addressId)) {
      clearTimeout(serverInfoPollTimers.get(addressId))
      serverInfoPollTimers.delete(addressId)
    }

    // 清理该 addressId 在 Map 中的状态
    currentSpeakerMap.delete(addressId)
    speakingHistoryMap.delete(addressId)
    speakerAddressMap.delete(addressId)
    isHostSpeakingMap.delete(addressId)
    serverInfoMap.delete(addressId)

    // 如果是主服务器，更新状态
    if (addressId === primaryAddressId.value) {
      primaryConnected.value = false
      primaryAddressId.value = null
      if (isAndroid) {
        FmoEvents.setPrimary({ addressId: '' }).catch(() => {})
      }
    }

    connectionChangeCounter.value++
  }

  // 连接单个事件 WebSocket（单选模式兼容）
  function connectEventWs(fmoAddress, protocol) {
    if (!fmoAddress) return

    isManualDisconnect = false

    // 检查是否已有连接或正在连接
    const existingWs = eventConnections.get('single')
    if (existingWs) {
      const state = existingWs.readyState
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        return
      }
      if (state === WebSocket.CLOSING) {
        setTimeout(() => connectEventWs(fmoAddress, protocol), 500)
        return
      }
    }

    // 使用 'single' 作为 addressId，标记为主服务器
    primaryAddressId.value = 'single'
    if (isAndroid) {
      // 先把已缓存的服务器名推给原生，再 setPrimary，避免短暂 fallback 文案
      pushCachedServerNameIfAny('single')
      FmoEvents.setPrimary({ addressId: 'single' }).catch(() => {})
    }
    createEventWsConnection('single', fmoAddress, protocol, true)
  }

  // 消息事件回调
  let onMessageCallback = null

  // 设置消息回调
  function setOnMessageCallback(callback) {
    onMessageCallback = callback
  }

  // ========== 处理事件消息（改造后） ==========
  // addressId: 服务器标识
  // isPrimary: 是否来自主服务器连接
  function handleEventMessage(data, addressId, isPrimary) {
    const messages = data.split('}{').map((msg, index, arr) => {
      if (arr.length === 1) return msg
      if (index === 0) return msg + '}'
      if (index === arr.length - 1) return '{' + msg
      return '{' + msg + '}'
    })

    // 获取该 addressId 的发言历史数组
    let history = speakingHistoryMap.get(addressId)
    if (!history) {
      history = []
      speakingHistoryMap.set(addressId, history)
    }

    let hasChanges = false

    for (const msgStr of messages) {
      try {
        const msg = JSON.parse(msgStr)
        if (msg.type === 'qso' && msg.subType === 'callsign' && msg.data) {
          const { callsign, isSpeaking } = msg.data
          const isHost = !!msg.data.isHost
          const now = Date.now()

          if (isSpeaking && callsign) {
            const grid = msg.data.grid || ''
            // 异步获取地址信息（Android 原生侧同步会根据 grid 自行查缓存/解析，
            // 不再需要这里回推）
            if (grid) {
              gridToAddress(grid)
                .then((result) => {
                  speakerAddressMap.set(addressId, formatAddress(result))
                })
                .catch((err) => {
                  console.warn(`[${addressId}] grid 转地址失败:`, err.message)
                  speakerAddressMap.set(addressId, '')
                })
            } else {
              speakerAddressMap.set(addressId, '')
            }
            // 开始发言 - 只结束该服务器列表中的旧发言，不影响其他服务器
            history.forEach((h) => {
              if (!h.endTime) {
                h.endTime = now
              }
            })
            // 更新该服务器的当前发言者
            const prevSpeaker = currentSpeakerMap.get(addressId) || ''
            console.log(
              `[speaker][${addressId}] recv START: "${callsign}" (prev="${prevSpeaker || '-'}"${grid ? ', grid=' + grid : ''}${isHost ? ', HOST' : ''})`
            )
            currentSpeakerMap.set(addressId, callsign)
            isHostSpeakingMap.set(addressId, isHost)

            const serverInfo = serverInfoMap.get(addressId)
            const existingIndex = history.findIndex((h) => h.callsign === callsign)
            if (existingIndex >= 0) {
              const existing = history.splice(existingIndex, 1)[0]
              existing.startTime = now
              existing.endTime = null
              existing.grid = grid
              if (serverInfo) {
                existing.serverName = serverInfo.name
                existing.serverUid = serverInfo.uid
              }
              history.unshift(existing)
            } else {
              const newRecord = {
                callsign,
                grid,
                startTime: now,
                endTime: null
              }
              if (serverInfo) {
                newRecord.serverName = serverInfo.name
                newRecord.serverUid = serverInfo.uid
              }
              history.unshift(newRecord)
            }
            hasChanges = true
            saveSpeakingHistoryToStorage(addressId)
          } else {
            // 结束发言 - 只结束该服务器列表中的记录
            history.forEach((h) => {
              if (!h.endTime) {
                h.endTime = now
              }
            })
            // 清空该服务器的当前发言者
            const prevSpeaker = currentSpeakerMap.get(addressId) || ''
            console.log(
              `[speaker][${addressId}] recv END  : raw="${callsign || '-'}" (prev="${prevSpeaker || '-'}")`
            )
            currentSpeakerMap.set(addressId, '')
            isHostSpeakingMap.set(addressId, false)
            hasChanges = true
            saveSpeakingHistoryToStorage(addressId)
          }
        } else if (msg.type === 'message' && msg.subType === 'summary') {
          // 只有主服务器才转发消息摘要事件
          if (isPrimary && onMessageCallback) {
            onMessageCallback(msg.data)
          }
        }
      } catch {
        // 忽略解析错误
      }
    }

    // 强制触发 Map 响应更新
    if (hasChanges) {
      speakingHistoryMap.set(addressId, [...history])
    }
  }

  // ========== 清理定时器（按 addressId 分离） ==========
  // 清理指定服务器超过1小时的发言历史
  function cleanupSpeakingHistory(addressId) {
    const history = speakingHistoryMap.get(addressId)
    if (!history) return

    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const oldLength = history.length
    const filteredHistory = history.filter((h) => {
      const time = h.endTime || h.startTime
      return time > oneHourAgo
    })

    if (oldLength !== filteredHistory.length) {
      speakingHistoryMap.set(addressId, filteredHistory)
      saveSpeakingHistoryToStorage(addressId)
    }
  }

  // 启动指定 addressId 的发言历史清理定时器
  function startSpeakingHistoryCleanup(addressId) {
    if (speakingHistoryCleanupTimers.has(addressId)) return
    const timer = setInterval(() => {
      cleanupSpeakingHistory(addressId)
    }, 60000)
    speakingHistoryCleanupTimers.set(addressId, timer)
  }

  // 停止指定 addressId 的清理定时器
  function stopSpeakingHistoryCleanup(addressId) {
    const timer = speakingHistoryCleanupTimers.get(addressId)
    if (timer) {
      clearInterval(timer)
      speakingHistoryCleanupTimers.delete(addressId)
    }
  }

  // 在调用 setPrimary / 建立原生连接前，若 serverInfoMap 已有该 addressId 的
  // 服务器名，就先推给原生，避免通知栏出现 "FMO 音频播放中：{呼号}" 的空窗口。
  // 冷启动首次 serverInfoMap 为空时会 no-op，后续由 fetchServerInfo 兜底。
  function pushCachedServerNameIfAny(addressId) {
    if (!isAndroid || !addressId) return
    const info = serverInfoMap.get(addressId)
    const name = info && info.name ? info.name : ''
    if (!name) return
    FmoEvents.updateServerName({ addressId, name }).catch(() => {})
  }

  // ========== 服务器信息定时获取 ==========
  // Android 下轮询交给原生 FmoEventsPlugin（不受 WebView 冻结影响），
  // JS 这层只在 Web 路径跑 WebSocket 查询。
  async function fetchServerInfo(addressId) {
    if (isAndroid) return
    const config = connectionConfigs.get(addressId)
    if (!config) return

    try {
      const normalizedHost = normalizeHost(config.host)
      const fullAddress = `${config.protocol}://${normalizedHost}`
      const client = new FmoApiClient(fullAddress)
      await client.connect()
      const data = await client.getCurrentStation()
      if (data && data.uid) {
        serverInfoMap.set(addressId, { uid: data.uid, name: data.name || '' })
      }
      client.close()
    } catch (err) {
      console.warn(`[${addressId}] 获取服务器信息失败:`, err.message)
    }
  }

  function startServerInfoPolling(addressId) {
    // Android 下原生接管（见 FmoEventsPlugin.startServerInfoPolling），JS 侧不再跑定时器
    if (isAndroid) return
    if (serverInfoTimers.has(addressId)) return
    // 立即获取一次
    fetchServerInfo(addressId)
    // 每30秒定时获取
    const timer = setInterval(() => {
      fetchServerInfo(addressId)
    }, 30000)
    serverInfoTimers.set(addressId, timer)
  }

  function stopServerInfoPolling(addressId) {
    const timer = serverInfoTimers.get(addressId)
    if (timer) {
      clearInterval(timer)
      serverInfoTimers.delete(addressId)
    }
  }

  // 手动更新指定 addressId 的服务器信息（供外部调用，如电台切换后）
  function updateServerInfo(addressId, info) {
    if (info && info.uid) {
      serverInfoMap.set(addressId, { uid: info.uid, name: info.name || '' })
    }
  }

  // 轮询获取服务器信息（切换后状态不是立即变化的，最多3次，间隔1秒）
  function pollServerInfo(addressId) {
    if (serverInfoPollTimers.has(addressId)) return

    let count = 0
    const maxCount = 3

    async function doPoll() {
      if (count >= maxCount) {
        serverInfoPollTimers.delete(addressId)
        return
      }
      count++
      await fetchServerInfo(addressId)
      const timer = setTimeout(doPoll, 1000)
      serverInfoPollTimers.set(addressId, timer)
    }

    doPoll()
  }

  // 获取指定 addressId 的服务器信息
  // forceRefresh = true 时：
  //   - Android：通知原生立即拉一次（后续通过 serverInfo 事件回填 serverInfoMap）
  //   - Web：先立即同步获取一次并等待完成，再启动轮询做后续确认
  async function getServerInfo(addressId, forceRefresh = false) {
    if (forceRefresh) {
      if (isAndroid) {
        FmoEvents.refreshServerInfo({ addressId }).catch(() => {})
      } else {
        await fetchServerInfo(addressId)
        pollServerInfo(addressId)
      }
    }
    return serverInfoMap.get(addressId) || null
  }

  // 主服务器当前电台信息
  const primaryServerInfo = computed(() => {
    if (!primaryAddressId.value) return null
    return serverInfoMap.get(primaryAddressId.value) || null
  })

  // 清空所有发言历史
  function clearSpeakingHistory() {
    // 清空所有服务器的当前发言者和历史
    for (const addressId of currentSpeakerMap.keys()) {
      currentSpeakerMap.set(addressId, '')
    }
    for (const addressId of speakingHistoryMap.keys()) {
      speakingHistoryMap.set(addressId, [])
      saveSpeakingHistoryToStorage(addressId)
    }
  }

  // 组件卸载时清理
  onUnmounted(() => {
    // 清理 Android 原生插件监听
    if (nativeMsgHandle) {
      nativeMsgHandle.remove && nativeMsgHandle.remove()
      nativeMsgHandle = null
    }
    if (nativeStatusHandle) {
      nativeStatusHandle.remove && nativeStatusHandle.remove()
      nativeStatusHandle = null
    }
    if (nativeServerInfoHandle) {
      nativeServerInfoHandle.remove && nativeServerInfoHandle.remove()
      nativeServerInfoHandle = null
    }
    if (isAndroid) {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    // 停止所有清理定时器
    for (const addressId of speakingHistoryCleanupTimers.keys()) {
      stopSpeakingHistoryCleanup(addressId)
    }
    // 停止所有服务器信息轮询
    for (const timer of serverInfoPollTimers.values()) {
      clearTimeout(timer)
    }
    serverInfoPollTimers.clear()
    disconnectAllEventWs()
  })

  return {
    // 向后兼容的 computed
    currentSpeaker, // computed - 主服务器的当前发言者
    currentSpeakerGrid, // computed - 主服务器当前发言者的 grid
    currentSpeakerAddress, // computed - 主服务器当前发言者的地址
    isHostSpeaking, // computed - 主服务器当前发言者是否为 host
    speakingHistory, // computed - 主服务器的发言历史

    // 新增的 computed
    allSpeakingHistories, // computed - 合并所有服务器的发言历史（带 addressId）
    allCurrentSpeakers, // computed - 所有服务器的当前发言者（带 address）

    // 新增的方法
    getSpeakingHistoryFor, // method - 获取指定服务器的发言历史
    isAddressConnected, // method - 检查指定 addressId 的连接状态

    // 服务器信息
    primaryAddressId, // ref - 主服务器 addressId
    primaryServerInfo, // computed - 主服务器当前电台信息
    getServerInfo, // method - 获取指定服务器信息，支持 forceRefresh 强制轮询
    updateServerInfo, // 手动更新服务器信息（供外部调用）

    // 原有导出
    eventsConnected, // computed - 任一连接存活即为 true
    primaryConnected, // ref - 主服务器连接状态
    connectEventWs, // 单连接
    disconnectEventWs, // 断开单个（内部使用）
    connectMultipleEventWs, // 多连接
    disconnectAllEventWs, // 断开所有
    startSpeakingHistoryCleanup, // 启动清理（内部使用）
    stopSpeakingHistoryCleanup, // 停止清理（内部使用）
    clearSpeakingHistory, // 清除所有服务器的历史
    formatTimeAgo,
    setOnMessageCallback // 消息回调
  }
}
