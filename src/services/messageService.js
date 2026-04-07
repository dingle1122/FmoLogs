/**
 * 消息服务 - 处理 WebSocket 通信和消息管理
 * 基于 message-api-documentation.md 实现
 */

import { ref } from 'vue'
import { normalizeHost } from '../utils/urlUtils'

// 单例实例
let messageServiceInstance = null

/**
 * 消息服务类
 */
export class MessageService {
  constructor() {
    // 状态
    this.connected = ref(false)
    this.busy = ref(false)
    this.messageList = ref([])
    this.hasMore = ref(true)
    this.nextAnchorId = ref(0)

    // 请求队列
    this.requestQueue = []
    this.currentRequest = null
    this.requestTimeout = 5000 // 5秒超时

    // 事件订阅者
    this.subscribers = new Map()

    // WebSocket
    this.socket = null
    this.connectPromise = null
    this.fmoAddress = null
    this.protocol = null
  }

  /**
   * 连接到 FMO 服务器
   */
  async connect(fmoAddress, protocol) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return
    }

    if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
      return this.connectPromise
    }

    this.fmoAddress = fmoAddress
    this.protocol = protocol

    // fmoAddress 是 host（如 192.168.1.100:8080），protocol 是 http/https/ws/wss
    const host = normalizeHost(fmoAddress)
    // 将 http/https 转换为 ws/wss
    const wsProtocol = protocol === 'https' || protocol === 'wss' ? 'wss' : 'ws'
    const wsUrl = `${wsProtocol}://${host}/ws`

    this.connectPromise = new Promise((resolve, reject) => {
      console.log(`[MessageService] 连接到: ${wsUrl}`)
      this.socket = new WebSocket(wsUrl)

      this.socket.onopen = () => {
        console.log('[MessageService] WebSocket 已连接')
        this.connected.value = true
        this.connectPromise = null
        this.emit('onDeviceStatusChange', { status: 'connected' })
        resolve()
      }

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.handleWebSocketMessage(message)
        } catch (err) {
          console.error('[MessageService] 解析消息失败:', err)
        }
      }

      this.socket.onerror = (error) => {
        console.error('[MessageService] WebSocket 错误:', error)
        this.connected.value = false
        this.connectPromise = null
        this.emit('onDeviceStatusChange', { status: 'error' })
        reject(error)
      }

      this.socket.onclose = () => {
        console.log('[MessageService] WebSocket 已关闭')
        this.connected.value = false
        this.connectPromise = null
        this.clearQueue()
        this.emit('onDeviceStatusChange', { status: 'disconnected' })
      }
    })

    return this.connectPromise
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.socket) {
      try {
        if (
          this.socket.readyState === WebSocket.OPEN ||
          this.socket.readyState === WebSocket.CONNECTING
        ) {
          this.socket.close()
        }
      } catch (err) {
        console.error('[MessageService] 关闭 WebSocket 失败:', err)
      }
      this.socket = null
    }
    this.connected.value = false
    this.clearQueue()
  }

  /**
   * 处理 WebSocket 消息
   */
  handleWebSocketMessage(msg) {
    console.log('[MessageService] 收到消息:', msg)

    // 处理服务端推送事件
    if (msg.type === 'message') {
      if (msg.subType === 'summary') {
        // 新消息摘要推送
        this.handleNewMessageSummary(msg.data)
      } else if (msg.subType === 'ack') {
        // 发送确认推送
        this.emit('ack', msg.data)
      } else if (msg.subType?.endsWith('Response')) {
        // 处理响应
        this.handleResponse(msg)
      }
    }
  }

  /**
   * 处理新消息摘要推送
   */
  handleNewMessageSummary(data) {
    // 将新消息添加到列表顶部
    const summary = {
      messageId: data.messageId || data.id,
      from: data.from || data.callsign,
      timestamp: data.timestamp,
      // isRead 可能是布尔值或数字，统一转换为布尔值
      isRead: data.isRead === true || data.isRead === 1
    }

    // 避免重复
    const exists = this.messageList.value.some((m) => m.messageId === summary.messageId)
    if (!exists) {
      // 使用 splice 触发响应式更新
      this.messageList.value.splice(0, 0, summary)
      this.emit('newMessage', summary)
    }
  }

  /**
   * 处理响应消息
   */
  handleResponse(msg) {
    if (!this.currentRequest) return

    const { subType, data, code } = msg
    const requestSubType = this.currentRequest.subType

    // 映射响应类型到请求类型 (getListResponse -> getList)
    const responseMap = {
      getListResponse: 'getList',
      getDetailResponse: 'getDetail',
      setReadResponse: 'setRead',
      sendResponse: 'send',
      deleteItemResponse: 'deleteItem',
      deleteAllResponse: 'deleteAll'
    }

    if (responseMap[subType] === requestSubType) {
      // 清除超时定时器
      if (this.currentRequest.timeoutId) {
        clearTimeout(this.currentRequest.timeoutId)
      }

      // code 为 0 表示成功
      const isSuccess = code === 0

      // 对于 getDetail，数据嵌套在 data.message 中
      let resultData = data
      if (requestSubType === 'getDetail' && data && data.message) {
        resultData = { ...data.message, status: isSuccess ? 'success' : 'error' }
      } else {
        resultData = { ...data, status: isSuccess ? 'success' : 'error' }
      }

      this.currentRequest.resolve(resultData)
      this.emit(requestSubType, resultData)

      this.currentRequest = null
      this.busy.value = false
      this.processQueue()
    }
  }

  /**
   * 发送 WebSocket 请求
   */
  sendRequest(subType, data) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket 未连接'))
    }

    const request = {
      type: 'message',
      subType,
      data
    }

    console.log('[MessageService] 发送请求:', request)
    this.socket.send(JSON.stringify(request))
  }

  /**
   * 队列请求（自动连接）
   */
  queueRequest(subType, data) {
    return new Promise((resolve, reject) => {
      const requestItem = {
        subType,
        data,
        resolve,
        reject
      }

      this.requestQueue.push(requestItem)
      this.processQueue()
    })
  }

  /**
   * 按需执行请求（自动连接/断开）
   */
  async requestWithConnection(fmoAddress, protocol, subType, data) {
    const shouldDisconnect = !this.connected.value
    if (shouldDisconnect) {
      await this.connect(fmoAddress, protocol)
    }

    try {
      return await this.queueRequest(subType, data)
    } finally {
      if (shouldDisconnect) {
        this.disconnect()
      }
    }
  }

  /**
   * 处理请求队列
   */
  processQueue() {
    if (this.busy.value || this.requestQueue.length === 0) return
    if (!this.connected.value) return

    this.busy.value = true
    this.currentRequest = this.requestQueue.shift()

    // 设置超时
    this.currentRequest.timeoutId = setTimeout(() => {
      if (this.currentRequest) {
        const result = { status: 'timeout', subType: this.currentRequest.subType }
        this.currentRequest.resolve(result)
        this.emit(this.currentRequest.subType, result)
        this.currentRequest = null
        this.busy.value = false
        this.processQueue()
      }
    }, this.requestTimeout)

    this.sendRequest(this.currentRequest.subType, this.currentRequest.data)
  }

  /**
   * 清空队列
   */
  clearQueue() {
    if (this.currentRequest?.timeoutId) {
      clearTimeout(this.currentRequest.timeoutId)
    }

    // 拒绝所有待处理的请求
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()
      request.reject(new Error('WebSocket 断开'))
    }

    this.currentRequest = null
    this.busy.value = false
  }

  /**
   * 订阅事件
   */
  subscribe(event, callback) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set())
    }
    this.subscribers.get(event).add(callback)

    // 返回取消订阅函数
    return () => {
      this.subscribers.get(event)?.delete(callback)
    }
  }

  /**
   * 触发事件
   */
  emit(event, data) {
    const callbacks = this.subscribers.get(event)
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data)
        } catch (err) {
          console.error(`事件处理错误 [${event}]:`, err)
        }
      })
    }
  }

  // ==================== API 方法 ====================

  /**
   * 获取消息列表（按需连接，获取后自动断开）
   */
  async getList(fmoAddress, protocol, anchorId = 0, pageSize = 20) {
    // 按需连接
    const shouldDisconnect = !this.connected.value
    if (shouldDisconnect) {
      await this.connect(fmoAddress, protocol)
    }

    try {
      const result = await this.queueRequest('getList', {
        pageSize,
        anchorId
      })

      if (result.status === 'success') {
        // 更新本地列表（第一页时替换，否则追加）
        const list = result.list || []
        if (anchorId === 0) {
          // 使用 splice 触发响应式更新
          this.messageList.value.splice(0, this.messageList.value.length, ...list)
        } else {
          const existingIds = new Set(this.messageList.value.map((m) => m.messageId))
          const newItems = list.filter((m) => !existingIds.has(m.messageId))
          this.messageList.value.push(...newItems)
        }

        this.nextAnchorId.value = result.nextAnchorId || 0
        this.hasMore.value = result.nextAnchorId !== 0
      }

      return result
    } finally {
      // 按需断开连接
      if (shouldDisconnect) {
        this.disconnect()
      }
    }
  }

  /**
   * 获取消息详情（按需连接）
   */
  getDetail(fmoAddress, protocol, messageId) {
    return this.requestWithConnection(fmoAddress, protocol, 'getDetail', { messageId })
  }

  /**
   * 标记消息已读（按需连接）
   */
  async setRead(fmoAddress, protocol, messageId) {
    const result = await this.requestWithConnection(fmoAddress, protocol, 'setRead', { messageId })

    if (result.status === 'success' && result.result === 0) {
      // 更新本地状态
      const msg = this.messageList.value.find((m) => m.messageId === messageId)
      if (msg) {
        msg.isRead = true
      }
    }

    return result
  }

  /**
   * 发送消息（按需连接）
   */
  send(fmoAddress, protocol, callsign, ssid, message) {
    return this.requestWithConnection(fmoAddress, protocol, 'send', { callsign, ssid, message })
  }

  /**
   * 删除单条消息（按需连接）
   */
  async deleteItem(fmoAddress, protocol, messageId) {
    const result = await this.requestWithConnection(fmoAddress, protocol, 'deleteItem', {
      messageId
    })

    if (result.status === 'success' && result.result === 0) {
      // 从本地列表移除
      const index = this.messageList.value.findIndex((m) => m.messageId === messageId)
      if (index > -1) {
        this.messageList.value.splice(index, 1)
      }
    }

    return result
  }

  /**
   * 删除所有消息（按需连接）
   */
  async deleteAll(fmoAddress, protocol) {
    const result = await this.requestWithConnection(fmoAddress, protocol, 'deleteAll', {})

    if (result.status === 'success' && result.result === 0) {
      this.messageList.value = []
      this.hasMore.value = false
      this.nextAnchorId.value = 0
    }

    return result
  }

  // ==================== 状态方法 ====================

  isBusy() {
    return this.busy.value
  }

  isConnected() {
    return this.connected.value
  }
}

/**
 * 获取消息服务单例
 */
export function getMessageService() {
  if (!messageServiceInstance) {
    messageServiceInstance = new MessageService()
  }
  return messageServiceInstance
}

/**
 * 呼号验证规则
 */
export function validateCallsign(callsign) {
  const pattern = /^[A-Z0-9]{1,15}$/
  return pattern.test(callsign)
}

/**
 * SSID 验证
 */
export function validateSSID(ssid) {
  const num = parseInt(ssid, 10)
  return !isNaN(num) && num >= 1 && num <= 15
}
