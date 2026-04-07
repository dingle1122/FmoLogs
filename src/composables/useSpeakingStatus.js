import { ref, computed, onUnmounted } from 'vue'
import { formatTimeAgo } from '../components/home/constants'
import { normalizeHost } from '../utils/urlUtils'

const STORAGE_KEY = 'fmo_speaking_history'

export function useSpeakingStatus() {
  const currentSpeaker = ref('')
  const speakingHistory = ref(loadSpeakingHistoryFromStorage())

  // 多连接管理
  const eventConnections = new Map() // key: addressId, value: WebSocket
  const reconnectTimers = new Map() // key: addressId, value: timer
  const connectionConfigs = new Map() // key: addressId, value: {host, protocol, isPrimary}
  let speakingHistoryCleanupTimer = null
  let isManualDisconnect = false
  let primaryAddressId = null

  // 主服务器连接状态
  const primaryConnected = ref(false)

  // 任一连接存活即为 true
  const eventsConnected = computed(() => {
    for (const ws of eventConnections.values()) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        return true
      }
    }
    return false
  })

  // 从 localStorage 加载发言历史
  function loadSpeakingHistoryFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const history = JSON.parse(stored)
        // 过滤掉超过30分钟的记录
        const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000
        const filteredHistory = history.filter((h) => {
          const time = h.endTime || h.startTime
          return time > thirtyMinutesAgo
        })
        // 将所有记录标记为已结束（设置 endTime）
        return filteredHistory.map((h) => ({
          ...h,
          endTime: h.endTime || h.startTime
        }))
      }
    } catch (err) {
      console.error('加载发言历史失败:', err)
    }
    return []
  }

  // 保存发言历史到 localStorage
  function saveSpeakingHistoryToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(speakingHistory.value))
    } catch (err) {
      console.error('保存发言历史失败:', err)
    }
  }

  // 创建单个事件 WebSocket 连接
  function createEventWsConnection(addressId, host, protocol, isPrimary) {
    const normalizedHost = normalizeHost(host)
    const wsUrl = `${protocol}://${normalizedHost}/events`

    console.log(`[${addressId}] Connecting to events: ${wsUrl}`)

    const ws = new WebSocket(wsUrl)
    eventConnections.set(addressId, ws)
    connectionConfigs.set(addressId, { host, protocol, isPrimary })

    ws.onopen = () => {
      console.log(`[${addressId}] Events WebSocket connected`)
      // 清除该连接的重连定时器
      if (reconnectTimers.has(addressId)) {
        clearTimeout(reconnectTimers.get(addressId))
        reconnectTimers.delete(addressId)
      }
      // 更新主服务器连接状态
      if (isPrimary) {
        primaryConnected.value = true
      }
    }

    ws.onmessage = (event) => {
      handleEventMessage(event.data, isPrimary)
    }

    ws.onclose = () => {
      console.log(`[${addressId}] Events WebSocket closed`)
      // 更新主服务器连接状态
      if (isPrimary) {
        primaryConnected.value = false
      }
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

  // 连接多个事件 WebSocket（多选模式）
  function connectMultipleEventWs(addresses, primaryId) {
    if (!addresses || addresses.length === 0) return

    isManualDisconnect = false
    primaryAddressId = primaryId

    // 先断开所有旧连接
    disconnectAllEventWs()

    // 为每个地址创建连接
    for (const addr of addresses) {
      const isPrimary = addr.id === primaryId
      createEventWsConnection(addr.id, addr.host, addr.protocol, isPrimary)
    }
  }

  // 断开所有事件 WebSocket 连接
  function disconnectAllEventWs() {
    isManualDisconnect = true

    // 清除所有重连定时器
    for (const timer of reconnectTimers.values()) {
      clearTimeout(timer)
    }
    reconnectTimers.clear()

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

    currentSpeaker.value = ''
    primaryConnected.value = false
    primaryAddressId = null
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
    createEventWsConnection('single', fmoAddress, protocol, true)
  }

  // 断开事件 WebSocket（兼容单连接模式）
  function disconnectEventWs() {
    disconnectAllEventWs()
  }

  // 消息事件回调
  let onMessageCallback = null

  // 设置消息回调
  function setOnMessageCallback(callback) {
    onMessageCallback = callback
  }

  // 处理事件消息
  // isPrimary: 是否来自主服务器连接，只有主服务器的消息才更新 currentSpeaker 和触发消息摘要回调
  function handleEventMessage(data, isPrimary) {
    const messages = data.split('}{').map((msg, index, arr) => {
      if (arr.length === 1) return msg
      if (index === 0) return msg + '}'
      if (index === arr.length - 1) return '{' + msg
      return '{' + msg + '}'
    })

    for (const msgStr of messages) {
      try {
        const msg = JSON.parse(msgStr)
        if (msg.type === 'qso' && msg.subType === 'callsign' && msg.data) {
          const { callsign, isSpeaking } = msg.data
          const now = Date.now()

          if (isSpeaking && callsign) {
            // 开始发言 - 先结束之前所有未结束的记录
            speakingHistory.value.forEach((h) => {
              if (!h.endTime) {
                h.endTime = now
              }
            })
            // 只有主服务器才更新当前发言者
            if (isPrimary) {
              currentSpeaker.value = callsign
            }
            const existingIndex = speakingHistory.value.findIndex((h) => h.callsign === callsign)
            if (existingIndex >= 0) {
              const existing = speakingHistory.value.splice(existingIndex, 1)[0]
              existing.startTime = now
              existing.endTime = null
              speakingHistory.value.unshift(existing)
            } else {
              speakingHistory.value.unshift({
                callsign,
                startTime: now,
                endTime: null
              })
            }
            saveSpeakingHistoryToStorage()
          } else {
            // 结束发言
            speakingHistory.value.forEach((h) => {
              if (!h.endTime) {
                h.endTime = now
              }
            })
            // 只有主服务器才清空当前发言者
            if (isPrimary) {
              currentSpeaker.value = ''
            }
            saveSpeakingHistoryToStorage()
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
  }

  // 清理超过30分钟的发言历史
  function cleanupSpeakingHistory() {
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000
    const oldLength = speakingHistory.value.length
    speakingHistory.value = speakingHistory.value.filter((h) => {
      const time = h.endTime || h.startTime
      return time > thirtyMinutesAgo
    })
    if (oldLength !== speakingHistory.value.length) {
      saveSpeakingHistoryToStorage()
    }
  }

  // 启动发言历史清理定时器
  function startSpeakingHistoryCleanup() {
    if (speakingHistoryCleanupTimer) return
    speakingHistoryCleanupTimer = setInterval(cleanupSpeakingHistory, 60000)
  }

  // 停止清理定时器
  function stopSpeakingHistoryCleanup() {
    if (speakingHistoryCleanupTimer) {
      clearInterval(speakingHistoryCleanupTimer)
      speakingHistoryCleanupTimer = null
    }
  }

  // 清空发言历史
  function clearSpeakingHistory() {
    speakingHistory.value = []
    currentSpeaker.value = ''
    saveSpeakingHistoryToStorage()
  }

  // 组件卸载时清理
  onUnmounted(() => {
    stopSpeakingHistoryCleanup()
    disconnectAllEventWs()
  })

  return {
    currentSpeaker,
    speakingHistory,
    eventsConnected,
    primaryConnected,
    connectEventWs,
    disconnectEventWs,
    connectMultipleEventWs,
    disconnectAllEventWs,
    startSpeakingHistoryCleanup,
    stopSpeakingHistoryCleanup,
    clearSpeakingHistory,
    formatTimeAgo,
    setOnMessageCallback
  }
}
