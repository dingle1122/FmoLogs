// useAprsControl.js - APRS 远程控制 Composable
import { ref, computed } from 'vue'
import CryptoJS from 'crypto-js'

// LocalStorage 键名
const STORAGE_KEY = {
  PARAMS: 'fmo_aprs_params',
  HISTORY: 'fmo_aprs_history',
  COUNTER: 'fmo_aprs_counter',
  SERVER_LIST: 'fmo_aprs_server_list', // 服务器列表
  ACTIVE_SERVER_ID: 'fmo_aprs_active_server_id' // 当前选中的服务器ID
}

// 默认服务器地址
const DEFAULT_SERVER = 'wss://fmoac.srv.ink/api/ws'

// 默认服务器对象（不可删除）
const DEFAULT_SERVER_ITEM = {
  id: 'default',
  url: DEFAULT_SERVER,
  isDefault: true
}

// ========== APRS 协议实现 ==========

// 解析呼号和 SSID
function parseCallsignSsid(callsignWithSsid) {
  const s = callsignWithSsid.trim().toUpperCase()
  if (!s) throw new Error('呼号为空')

  if (s.includes('-')) {
    const [call, ssidStr] = s.split('-')
    if (!call) throw new Error('呼号缺失')
    const ssid = parseInt(ssidStr, 10)
    if (isNaN(ssid) || ssid < 0 || ssid > 15) {
      throw new Error('SSID 必须是 0-15 的数字')
    }
    return { call, ssid }
  }
  return { call: s, ssid: 0 }
}

// 格式化目标呼号（右填充空格到 9 位）
function formatAddressee(toCall, toSsid) {
  let addr = toSsid && toSsid !== 0 ? `${toCall}-${toSsid}` : toCall
  if (addr.length > 9) throw new Error(`目标呼号过长: ${addr}`)
  return addr.padEnd(9, ' ')
}

// 计算 HMAC-SHA1 签名
function calcSignature(fromCall, fromSsid, typeStr, actionStr, timeSlot, counter, secret) {
  const raw = `${fromCall}${fromSsid}${typeStr}${actionStr}${timeSlot}${counter}`
  const hash = CryptoJS.HmacSHA1(raw, secret)
  // 取前 8 字节(16 个十六进制字符)
  return hash.toString(CryptoJS.enc.Hex).substring(0, 16).toUpperCase()
}

// 构造完整的 APRS 数据包
function buildAPRSPacket(mycall, mySSID, tocall, toSSID, action, secret) {
  const timeSlot = Math.floor(Date.now() / 1000 / 60)
  const counter = getNextCounter(timeSlot)
  const sig = calcSignature(mycall, mySSID, 'CONTROL', action, timeSlot, counter, secret)

  const addressee = formatAddressee(tocall, toSSID)
  const payload = `CONTROL,${action},${timeSlot},${counter},${sig}`

  return `${mycall}-${mySSID}>APFMO0,TCPIP*::${addressee}:${payload}`
}

// ========== 本地存储 ==========

// 保存参数（包含尾缀配置）
function saveParams(params) {
  localStorage.setItem(STORAGE_KEY.PARAMS, JSON.stringify(params))
}

// 加载参数（包含尾缀配置）
function loadParams() {
  const data = localStorage.getItem(STORAGE_KEY.PARAMS)
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

// 保存历史记录
function saveHistoryRecord(record) {
  let history = JSON.parse(localStorage.getItem(STORAGE_KEY.HISTORY) || '[]')
  history.unshift({
    ...record,
    timestamp: new Date().toISOString()
  })
  // 只保留最近 20 条
  if (history.length > 20) {
    history = history.slice(0, 20)
  }
  localStorage.setItem(STORAGE_KEY.HISTORY, JSON.stringify(history))
}

// 加载历史记录
function loadHistory() {
  const data = localStorage.getItem(STORAGE_KEY.HISTORY)
  if (!data) return []
  try {
    return JSON.parse(data)
  } catch {
    return []
  }
}

// 清空历史记录
function clearHistoryStorage() {
  localStorage.removeItem(STORAGE_KEY.HISTORY)
}

// 获取并递增计数器
function getNextCounter(timeSlot) {
  const data = localStorage.getItem(STORAGE_KEY.COUNTER)
  let state = { time_slot: -1, counter: -1 }

  if (data) {
    try {
      state = JSON.parse(data)
    } catch {
      state = { time_slot: -1, counter: -1 }
    }
  }

  let counter
  if (state.time_slot === timeSlot) {
    counter = state.counter + 1
  } else {
    counter = 0
  }

  const newState = {
    time_slot: timeSlot,
    counter: counter,
    last_updated: new Date().toISOString()
  }
  localStorage.setItem(STORAGE_KEY.COUNTER, JSON.stringify(newState))

  return counter
}

// ========== 服务器列表管理 ==========

// 保存服务器列表
function saveServerList(serverList) {
  // 过滤掉默认服务器，只保存自定义服务器
  const customServers = serverList.filter((s) => !s.isDefault)
  localStorage.setItem(STORAGE_KEY.SERVER_LIST, JSON.stringify(customServers))
}

// 加载服务器列表
function loadServerList() {
  const data = localStorage.getItem(STORAGE_KEY.SERVER_LIST)
  let customServers = []
  if (data) {
    try {
      customServers = JSON.parse(data)
    } catch {
      customServers = []
    }
  }
  // 默认服务器始终在第一位
  return [DEFAULT_SERVER_ITEM, ...customServers]
}

// 保存当前选中的服务器ID
function saveActiveServerId(serverId) {
  localStorage.setItem(STORAGE_KEY.ACTIVE_SERVER_ID, serverId)
}

// 加载当前选中的服务器ID
function loadActiveServerId() {
  return localStorage.getItem(STORAGE_KEY.ACTIVE_SERVER_ID) || 'default'
}

// 获取当前服务器地址
function getCurrentServerUrl(serverList, activeServerId) {
  const server = serverList.find((s) => s.id === activeServerId)
  return server ? server.url : DEFAULT_SERVER
}

// ========== Composable (单例模式 - 所有组件共享状态) ==========

// 模块级别的状态（单例）
const ws = ref(null)
const wsConnected = ref(false)
const wsConnecting = ref(false)
const statusMessage = ref('未连接')
const statusType = ref('info') // 'info' | 'success'
const history = ref([])
const sending = ref(false)

// 自动断开定时器（发送指令后60秒自动断开）
let autoDisconnectTimer = null
const AUTO_DISCONNECT_DELAY = 60000 // 60秒

// 服务器配置
const serverList = ref([DEFAULT_SERVER_ITEM])
const activeServerId = ref('default')
const currentServerUrl = computed(() => getCurrentServerUrl(serverList.value, activeServerId.value))

// 表单参数
const mycall = ref('')
const passcode = ref('')
const secret = ref('')
const tocall = ref('')

export function useAprsControl() {
  // 初始化
  function init() {
    // 加载保存的参数（包含尾缀）
    const params = loadParams()
    if (params) {
      mycall.value = params.mycall || ''
      passcode.value = params.passcode || ''
      secret.value = params.secret || ''
      tocall.value = params.tocall || ''
    }

    // 加载历史记录
    history.value = loadHistory()

    // 加载服务器列表
    serverList.value = loadServerList()
    activeServerId.value = loadActiveServerId()

    // 返回加载的参数（供组件使用，包含尾缀信息）
    return params
  }

  // 保存当前参数（包含尾缀，供外部调用）
  function saveCurrentParams(controlSsid, fmoSsid) {
    const params = {
      mycall: mycall.value,
      passcode: passcode.value,
      secret: secret.value,
      tocall: tocall.value
    }
    // 如果提供了尾缀参数，一并保存
    if (controlSsid !== undefined && fmoSsid !== undefined) {
      params.controlSsid = controlSsid
      params.fmoSsid = fmoSsid
    }
    saveParams(params)
  }

  // 清除自动断开定时器
  function clearAutoDisconnectTimer() {
    if (autoDisconnectTimer) {
      clearTimeout(autoDisconnectTimer)
      autoDisconnectTimer = null
    }
  }

  // 重置自动断开定时器
  function resetAutoDisconnectTimer() {
    clearAutoDisconnectTimer()
    autoDisconnectTimer = setTimeout(() => {
      if (wsConnected.value && !sending.value) {
        console.log('[APRS] 空闲超时，自动断开连接')
        // 关闭WebSocket但保持成功状态显示
        if (ws.value) {
          ws.value.close()
          ws.value = null
        }
        clearAutoDisconnectTimer()
        // 保持wsConnected=true，显示绿灯
        // statusMessage保持原样，不修改
      }
    }, AUTO_DISCONNECT_DELAY)
  }

  // 连接 WebSocket（按需连接）
  // testOnly: 如果为true，连接成功后立即断开（用于测试服务器）
  function connectWebSocket(testOnly = false) {
    const serverUrl = currentServerUrl.value

    if (!serverUrl) {
      statusMessage.value = '请先选择服务器'
      statusType.value = 'info'
      return Promise.reject(new Error('请先选择服务器'))
    }

    // 如果已经连接（真实连接，不是测试后的虚拟状态）
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      if (testOnly) {
        // 测试模式：已连接则立即断开
        disconnectWebSocket()
        statusMessage.value = '测试成功'
        statusType.value = 'success'
        return Promise.resolve()
      } else {
        // 正常模式：重置自动断开定时器
        resetAutoDisconnectTimer()
        return Promise.resolve()
      }
    }

    // 如果是测试成功后的虚拟连接状态（wsConnected=true但ws已关闭）
    // 需要重新建立真实连接
    if (wsConnected.value && (!ws.value || ws.value.readyState !== WebSocket.OPEN)) {
      // 重置状态，准备重新连接
      wsConnected.value = false
    }

    // 如果正在连接，等待连接完成
    if (wsConnecting.value) {
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (wsConnected.value) {
            clearInterval(checkInterval)
            resolve()
          } else if (!wsConnecting.value) {
            clearInterval(checkInterval)
            reject(new Error('连接失败'))
          }
        }, 100)
      })
    }

    wsConnecting.value = true
    statusMessage.value = '正在连接...'
    statusType.value = 'info'

    return new Promise((resolve, reject) => {
      try {
        ws.value = new WebSocket(serverUrl)
      } catch (err) {
        wsConnecting.value = false
        statusMessage.value = `连接失败: ${err.message}`
        statusType.value = 'info'
        reject(err)
        return
      }

      ws.value.onopen = () => {
        wsConnecting.value = false
        wsConnected.value = true

        if (testOnly) {
          // 测试模式：连接成功后立即断开，但保持成功状态显示
          statusMessage.value = '测试成功'
          statusType.value = 'success'
          setTimeout(() => {
            if (ws.value) {
              ws.value.close()
              ws.value = null
            }
            // 保持wsConnected为true，显示绿灯
            // wsConnected.value = false // 不设置为false
          }, 500) // 延迟500ms断开
          resolve()
        } else {
          // 正常模式：启动自动断开定时器
          statusMessage.value = '已连接'
          statusType.value = 'success'
          resetAutoDisconnectTimer()
          resolve()
        }
      }

      ws.value.onclose = () => {
        wsConnecting.value = false
        clearAutoDisconnectTimer()

        // 只有在非测试模式且非自动断开时才改变状态
        // 如果statusType是success，说明是测试成功或正常使用后的自动断开，保持绿灯
        if (!testOnly && statusType.value !== 'success') {
          wsConnected.value = false
          statusMessage.value = '连接已断开'
          statusType.value = 'info'
        }
      }

      ws.value.onerror = () => {
        wsConnecting.value = false
        wsConnected.value = false
        clearAutoDisconnectTimer()
        statusMessage.value = '连接错误'
        statusType.value = 'info'
        reject(new Error('连接错误'))
      }

      ws.value.onmessage = (event) => {
        try {
          const result = JSON.parse(event.data)
          handleServerResponse(result)
        } catch {
          console.error('[APRS] 消息解析失败')
        }
        // 收到消息后重置自动断开定时器（仅在非测试模式）
        if (!testOnly) {
          resetAutoDisconnectTimer()
        }
      }
    })
  }

  // 断开 WebSocket
  function disconnectWebSocket() {
    clearAutoDisconnectTimer()
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
    // 主动断开时才重置状态
    wsConnected.value = false
    wsConnecting.value = false
  }

  // 处理服务端响应
  function handleServerResponse(result) {
    sending.value = false

    const { success, type, message, raw, timestamp } = result

    const historyRecord = {
      operationType: success ? 'success' : 'fail', // 操作类型: send/success/fail
      success,
      type,
      message,
      raw: raw || '',
      timestamp: timestamp || new Date().toISOString()
    }

    saveHistoryRecord(historyRecord)
    history.value = loadHistory()

    if (success) {
      statusMessage.value = `✅ ${message}`
      statusType.value = 'success'
    } else {
      statusMessage.value = `❌ ${message}`
      statusType.value = 'info'
    }
  }

  // 发送控制指令（按需连接）
  async function sendCommand(action) {
    sending.value = true

    try {
      // 先确保连接
      await connectWebSocket()

      if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket 未连接')
      }

      const mycallInput = mycall.value.trim()
      const passcodeInput = passcode.value.trim()
      const secretInput = secret.value.trim()
      let tocallInput = tocall.value.trim()

      if (!mycallInput) {
        throw new Error('请输入登录呼号')
      }
      if (!passcodeInput) {
        throw new Error('请输入 APRS 密钥')
      }
      if (!secretInput) {
        throw new Error('请输入设备密钥')
      }

      // 如果 tocall 为空，默认与 mycall 相同
      if (!tocallInput) {
        tocallInput = mycallInput
      }

      const { call: myCall, ssid: mySsid } = parseCallsignSsid(mycallInput)
      const { call: toCall, ssid: toSsid } = parseCallsignSsid(tocallInput)

      // 保存参数（不包含尾缀，尾缀在组件中单独保存）
      saveParams({
        mycall: mycallInput,
        passcode: passcodeInput,
        secret: secretInput,
        tocall: tocallInput
      })

      // 构造 APRS 数据包
      const rawPacket = buildAPRSPacket(myCall, mySsid, toCall, toSsid, action, secretInput)

      const request = {
        type: 'send',
        mycall: `${myCall}-${mySsid}`,
        passcode: passcodeInput,
        tocall: `${toCall}-${toSsid}`,
        rawPacket,
        waitAck: 20
      }

      // 记录发送操作到历史记录
      const actionMap = {
        NORMAL: '普通模式',
        STANDBY: '待机模式',
        REBOOT: '软重启'
      }
      const actionText = actionMap[action] || action
      const sendHistoryRecord = {
        operationType: 'send',
        success: null, // 发送阶段不设置成功/失败
        type: 'send',
        message: `${myCall}-${mySsid} -> ${toCall}-${toSsid} 发送「${actionText}」控制指令`,
        raw: rawPacket,
        timestamp: new Date().toISOString()
      }
      saveHistoryRecord(sendHistoryRecord)
      history.value = loadHistory()

      ws.value.send(JSON.stringify(request))
      statusMessage.value = `正在发送 ${action} 指令...`
      statusType.value = 'info'

      // 发送后重置自动断开定时器
      resetAutoDisconnectTimer()
    } catch (err) {
      sending.value = false
      statusMessage.value = `错误: ${err.message}`
      statusType.value = 'info'
    }
  }

  // 清空历史记录
  function clearHistory() {
    clearHistoryStorage()
    history.value = []
  }

  // 添加服务器
  function addServer(name, url) {
    const newServer = {
      id: Date.now().toString(),
      url,
      isDefault: false
    }
    serverList.value.push(newServer)
    saveServerList(serverList.value)
    return newServer.id
  }

  // 删除服务器
  function deleteServer(serverId) {
    if (serverId === 'default') return // 不能删除默认服务器

    serverList.value = serverList.value.filter((s) => s.id !== serverId)
    saveServerList(serverList.value)

    // 如果删除的是当前选中的服务器，切换到默认服务器
    if (activeServerId.value === serverId) {
      selectServer('default')
    }
  }

  // 编辑服务器
  function updateServer(serverId, name, url) {
    if (serverId === 'default') return // 不能编辑默认服务器

    const server = serverList.value.find((s) => s.id === serverId)
    if (server) {
      server.url = url
      saveServerList(serverList.value)
    }
  }

  // 选择服务器
  function selectServer(serverId) {
    activeServerId.value = serverId
    saveActiveServerId(serverId)

    // 如果已连接，需要断开
    if (wsConnected.value) {
      disconnectWebSocket()
    }

    // 立即测试新服务器连接（测试模式）
    statusMessage.value = '正在测试服务器连接...'
    statusType.value = 'info'

    connectWebSocket(true) // 传入 testOnly=true
      .then(() => {
        console.log('[APRS] 服务器连接测试成功')
      })
      .catch((err) => {
        console.error('[APRS] 服务器连接测试失败:', err)
        statusMessage.value = `连接失败: ${err.message}`
        statusType.value = 'info'
      })
  }

  // 更新SSID配置
  function updateSsidConfig(controlSsid, fmoSsid) {
    saveSsidConfig(controlSsid, fmoSsid)
  }

  // 加载SSID配置
  function getSsidConfig() {
    return loadSsidConfig()
  }

  // 外部更新登录呼号(用于从设置中自动填充)
  function updateCallsign(newCallsign) {
    if (newCallsign && typeof newCallsign === 'string') {
      mycall.value = newCallsign.toUpperCase()
      // 同时更新 tocall 如果当前为空或未编辑
      if (!tocall.value || tocall.value === mycall.value) {
        tocall.value = newCallsign.toUpperCase()
      }
    }
  }

  // 验证规则
  const VALIDATION = {
    CALLSIGN: /^B[A-Z][0-9][A-Z]{2,3}$/,
    SECRET: /^[A-Z0-9]{12}$/,
    PASSCODE: /^\d{1,5}$/
  }

  // 计算属性
  const canSend = computed(() => {
    // 正在发送时不能发送
    if (sending.value) return false

    // 验证登录呼号 (base)
    try {
      const { call: myCallBase } = parseCallsignSsid(mycall.value)
      console.log('myCallBase', myCallBase, VALIDATION.CALLSIGN.test(myCallBase))
      if (!VALIDATION.CALLSIGN.test(myCallBase)) return false
    } catch {
      return false
    }

    // 验证目标呼号 (base)
    try {
      const { call: toCallBase } = parseCallsignSsid(tocall.value)
      if (!VALIDATION.CALLSIGN.test(toCallBase)) return false
    } catch {
      return false
    }

    // 验证 Passcode
    if (!VALIDATION.PASSCODE.test(passcode.value)) return false

    // 验证密钥
    if (!VALIDATION.SECRET.test(secret.value)) return false

    return true
  })

  return {
    // 状态
    wsConnected,
    wsConnecting,
    statusMessage,
    statusType,
    history,
    sending,
    canSend,
    // 服务器配置
    serverList,
    activeServerId,
    currentServerUrl,
    // 表单
    mycall,
    passcode,
    secret,
    tocall,
    // 方法
    init,
    connectWebSocket,
    disconnectWebSocket,
    sendCommand,
    clearHistory,
    addServer,
    deleteServer,
    updateServer,
    selectServer,
    updateCallsign,
    saveCurrentParams
  }
}
