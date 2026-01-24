export class FmoApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl
    this.socket = null
    this.pendingRequests = new Map()
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 3
  }

  async connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return
    }

    let host = this.baseUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')
    const wsUrl = `ws://${host}/ws`

    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(wsUrl)

      this.socket.onopen = () => {
        console.log('FMO WebSocket connected')
        this.reconnectAttempts = 0
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
        reject(error)
      }

      this.socket.onclose = () => {
        console.log('FMO WebSocket closed')
      }
    })
  }

  handleMessage(message) {
    const { type, subType, code, data } = message
    // 简单的响应匹配逻辑：getList -> getListResponse, getDetail -> getDetailResponse
    const requestSubType = subType.replace('Response', '')
    const key = `${type}:${requestSubType}`

    if (this.pendingRequests.has(key)) {
      const { resolve, reject } = this.pendingRequests.get(key)
      this.pendingRequests.delete(key)

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

      this.socket.send(JSON.stringify(message))

      // 设置超时
      setTimeout(() => {
        if (this.pendingRequests.has(key)) {
          this.pendingRequests.delete(key)
          reject(new Error(`Request timeout: ${key}`))
        }
      }, 10000)
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

  close() {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }
}
