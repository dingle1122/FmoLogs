import { ref, onUnmounted } from 'vue'
import { formatTimeAgo } from '../components/home/constants'
import { normalizeHost } from '../utils/urlUtils'

const STORAGE_KEY = 'fmo_speaking_history'

export function useSpeakingStatus() {
  const currentSpeaker = ref('')
  const speakingHistory = ref(loadSpeakingHistoryFromStorage())
  const eventsConnected = ref(false)

  let eventWs = null
  let eventWsReconnectTimer = null
  let speakingHistoryCleanupTimer = null
  let isManualDisconnect = false

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

  // 连接事件 WebSocket
  function connectEventWs(fmoAddress, protocol) {
    if (!fmoAddress) return

    isManualDisconnect = false

    // 检查是否已有连接或正在连接
    if (eventWs) {
      const state = eventWs.readyState
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        return
      }
      if (state === WebSocket.CLOSING) {
        setTimeout(() => connectEventWs(fmoAddress, protocol), 500)
        return
      }
    }

    const host = normalizeHost(fmoAddress)
    const wsUrl = `${protocol}://${host}/events`

    console.log(`Connecting to events: ${wsUrl}`)
    eventWs = new WebSocket(wsUrl)

    eventWs.onopen = () => {
      console.log('Events WebSocket connected')
      if (eventWsReconnectTimer) {
        clearTimeout(eventWsReconnectTimer)
        eventWsReconnectTimer = null
      }
      eventsConnected.value = true
    }

    eventWs.onmessage = (event) => {
      handleEventMessage(event.data)
    }

    eventWs.onclose = () => {
      console.log('Events WebSocket closed')
      eventsConnected.value = false
      // 只有非主动断开才重连
      if (!isManualDisconnect && !eventWsReconnectTimer && fmoAddress) {
        eventWsReconnectTimer = setTimeout(() => {
          eventWsReconnectTimer = null
          connectEventWs(fmoAddress, protocol)
        }, 5000)
      }
    }

    eventWs.onerror = () => {
      // onclose 会自动触发
    }
  }

  // 断开事件 WebSocket
  function disconnectEventWs() {
    isManualDisconnect = true

    if (eventWsReconnectTimer) {
      clearTimeout(eventWsReconnectTimer)
      eventWsReconnectTimer = null
    }

    if (eventWs) {
      try {
        const state = eventWs.readyState
        if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
          eventWs.close()
        }
      } catch (err) {
        console.error('关闭事件 WebSocket 失败:', err)
      }
      eventWs = null
    }

    currentSpeaker.value = ''
    eventsConnected.value = false
  }

  // 处理事件消息
  function handleEventMessage(data) {
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
            currentSpeaker.value = callsign
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
            currentSpeaker.value = ''
            saveSpeakingHistoryToStorage()
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
    disconnectEventWs()
  })

  return {
    currentSpeaker,
    speakingHistory,
    eventsConnected,
    connectEventWs,
    disconnectEventWs,
    startSpeakingHistoryCleanup,
    stopSpeakingHistoryCleanup,
    clearSpeakingHistory,
    formatTimeAgo
  }
}
