import { normalizeHost } from '../utils/urlUtils'

export class FmoApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl
    this.socket = null
    this.pendingRequests = new Map()
    this.connectPromise = null
    this.timeoutTimers = new Map()
  }

  // 检查是否为有效的IP地址或域名（可带端口号）
  isValidAddress(address) {
    // 分离主机名和端口号
    let host = address
    let port = null

    // 检查是否包含端口号
    const portMatch = address.match(/^(.+):(\d+)$/)
    if (portMatch) {
      host = portMatch[1]
      port = parseInt(portMatch[2], 10)

      // 验证端口号范围
      if (port < 1 || port > 65535) {
        return false
      }
    }

    // 检查是否为IPv4地址
    const ipv4Regex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    // 检查是否为域名（包括.fmo.local等）
    const domainRegex =
      /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/

    return ipv4Regex.test(host) || domainRegex.test(host)
  }

  async connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return
    }

    if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
      return this.connectPromise
    }

    let host = normalizeHost(this.baseUrl)
    const wsUrl = `${this.baseUrl.startsWith('wss') ? 'wss' : 'ws'}://${host}/ws`

    this.connectPromise = new Promise((resolve, reject) => {
      console.log(`Connecting to FMO: ${wsUrl}`)
      this.socket = new WebSocket(wsUrl)

      this.socket.onopen = () => {
        console.log('FMO WebSocket connected')
        this.connectPromise = null
        resolve()
      }

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (err) {
          console.error('Failed to parse FMO message:', err)
        }
      }

      this.socket.onerror = (error) => {
        console.error('FMO WebSocket error:', error)
        this.connectPromise = null
        reject(error)
      }

      this.socket.onclose = () => {
        console.log('FMO WebSocket closed')
        this.connectPromise = null
      }
    })

    return this.connectPromise
  }

  handleMessage(message) {
    const { type, subType, code, data } = message
    // 简单的响应匹配逻辑：getList -> getListResponse, getDetail -> getDetailResponse
    let requestSubType = subType.replace('Response', '')

    // 特殊处理：station API 的 getListRange 请求返回 getListResponse
    if (type === 'station' && requestSubType === 'getList') {
      requestSubType = 'getListRange'
    }

    const key = `${type}:${requestSubType}`

    if (this.pendingRequests.has(key)) {
      const { resolve, reject } = this.pendingRequests.get(key)
      this.pendingRequests.delete(key)

      // 清理对应的超时定时器
      if (this.timeoutTimers.has(key)) {
        clearTimeout(this.timeoutTimers.get(key))
        this.timeoutTimers.delete(key)
      }

      if (code === 0) {
        resolve(data)
      } else {
        reject(new Error(`FMO API Error: code ${code}`))
      }
    }
  }

  async sendRequest(type, subType, data = {}) {
    await this.connect()

    return new Promise((resolve, reject) => {
      const key = `${type}:${subType}`
      this.pendingRequests.set(key, { resolve, reject })

      const message = {
        type,
        subType,
        data
      }

      const payload = JSON.stringify(message)
      console.log(`[FmoApi] 发送数据 (${type}:${subType}):`, message)
      this.socket.send(payload)

      // 设置超时
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(key)) {
          this.pendingRequests.delete(key)
          this.timeoutTimers.delete(key)
          reject(new Error(`Request timeout: ${key}`))
        }
      }, 15000)

      this.timeoutTimers.set(key, timeoutId)
    })
  }

  async getQsoList(page = 0, pageSize = 20, fromCallsign = '') {
    const params = { page, pageSize }
    if (fromCallsign) {
      params.fromCallsign = fromCallsign
    }
    return this.sendRequest('qso', 'getList', params)
  }

  async getQsoDetail(logId) {
    return this.sendRequest('qso', 'getDetail', { logId })
  }

  // Station 相关方法
  async getStationList(start = 0, count = 10) {
    return this.sendRequest('station', 'getListRange', { start, count })
  }

  async getCurrentStation() {
    return this.sendRequest('station', 'getCurrent', {})
  }

  async setCurrentStation(uid) {
    return this.sendRequest('station', 'setCurrent', { uid })
  }

  async nextStation() {
    return this.sendRequest('station', 'next', {})
  }

  async prevStation() {
    return this.sendRequest('station', 'prev', {})
  }

  async getUserInfo() {
    return this.sendRequest('user', 'getInfo', {})
  }

  close() {
    // 清理连接 Promise
    this.connectPromise = null

    // 关闭 WebSocket
    if (this.socket) {
      try {
        // 只关闭处于 OPEN 或 CONNECTING 状态的连接
        if (
          this.socket.readyState === WebSocket.OPEN ||
          this.socket.readyState === WebSocket.CONNECTING
        ) {
          this.socket.close()
        }
      } catch (err) {
        console.error('关闭 WebSocket 失败:', err)
      }
      this.socket = null
    }

    // 清理所有待处理的请求
    this.pendingRequests.clear()

    // 清理所有超时定时器
    this.timeoutTimers.forEach((timerId) => {
      try {
        clearTimeout(timerId)
      } catch (err) {
        console.error('清理超时定时器失败:', err)
      }
    })
    this.timeoutTimers.clear()
  }
}
