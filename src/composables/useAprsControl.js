// useAprsControl.js - APRS 远程控制 Composable
import { ref, computed } from 'vue'

// LocalStorage 键名
const STORAGE_KEY = {
    PARAMS: 'fmo_aprs_params',
    HISTORY: 'fmo_aprs_history',
    COUNTER: 'fmo_aprs_counter',
    SERVER: 'fmo_aprs_server',
    SERVER_MODE: 'fmo_aprs_server_mode'  // 'default' | 'custom'
}

// 默认服务器地址（根据当前页面协议动态选择 ws/wss）
const getDefaultServer = () => {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
    return isHttps ? 'wss://fmoac.srv.ink/api/ws' : 'ws://fmoac.srv.ink/api/ws'
}
const DEFAULT_SERVER = getDefaultServer()

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
    // eslint-disable-next-line no-undef
    const hash = CryptoJS.HmacSHA1(raw, secret)
    // 取前 8 字节（16 个十六进制字符）
    // eslint-disable-next-line no-undef
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

// 保存参数
function saveParams(params) {
    localStorage.setItem(STORAGE_KEY.PARAMS, JSON.stringify(params))
}

// 加载参数
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

// 保存服务器配置
function saveServerConfig(mode, customAddress) {
    localStorage.setItem(STORAGE_KEY.SERVER_MODE, mode)
    if (customAddress !== undefined) {
        localStorage.setItem(STORAGE_KEY.SERVER, customAddress)
    }
}

// 加载服务器配置
function loadServerConfig() {
    const mode = localStorage.getItem(STORAGE_KEY.SERVER_MODE) || 'default'
    const customAddress = localStorage.getItem(STORAGE_KEY.SERVER) || ''
    return { mode, customAddress }
}

// 获取当前服务器地址
function getServerAddress() {
    const { mode, customAddress } = loadServerConfig()
    return mode === 'custom' ? customAddress : DEFAULT_SERVER
}

// ========== Composable (单例模式 - 所有组件共享状态) ==========

// 模块级别的状态（单例）
const ws = ref(null)
const wsConnected = ref(false)
const wsConnecting = ref(false)
const statusMessage = ref('未连接')
const statusType = ref('info') // 'info' | 'success' | 'error'
const history = ref([])
const sending = ref(false)

// 服务器配置
const serverMode = ref('default') // 'default' | 'custom'
const customServerAddress = ref('')

// 表单参数
const mycall = ref('')
const passcode = ref('')
const secret = ref('')
const tocall = ref('')

export function useAprsControl() {

    // 初始化
    function init() {
        // 加载保存的参数
        const params = loadParams()
        if (params) {
            mycall.value = params.mycall || ''
            passcode.value = params.passcode || ''
            secret.value = params.secret || ''
            tocall.value = params.tocall || ''
        }

        // 加载历史记录
        history.value = loadHistory()

        // 加载服务器配置
        const config = loadServerConfig()
        serverMode.value = config.mode
        customServerAddress.value = config.customAddress
    }

    // 初始化并自动连接
    function initAndConnect() {
        init()
        // 自动连接
        connectWebSocket()
    }

    // 连接 WebSocket
    function connectWebSocket() {
        const serverUrl = getServerAddress()

        if (serverMode.value === 'custom' && !customServerAddress.value) {
            statusMessage.value = '请先配置自定义服务器地址'
            statusType.value = 'error'
            return
        }

        if (ws.value && ws.value.readyState === WebSocket.OPEN) {
            return
        }

        wsConnecting.value = true
        statusMessage.value = '正在连接...'
        statusType.value = 'info'

        try {
            ws.value = new WebSocket(serverUrl)
        } catch (err) {
            wsConnecting.value = false
            statusMessage.value = `连接失败: ${err.message}`
            statusType.value = 'error'
            return
        }

        ws.value.onopen = () => {
            wsConnecting.value = false
            wsConnected.value = true
            statusMessage.value = '已连接'
            statusType.value = 'success'
        }

        ws.value.onclose = () => {
            wsConnecting.value = false
            wsConnected.value = false
            statusMessage.value = '连接已断开'
            statusType.value = 'error'
        }

        ws.value.onerror = () => {
            wsConnecting.value = false
            wsConnected.value = false
            statusMessage.value = '连接错误'
            statusType.value = 'error'
        }

        ws.value.onmessage = (event) => {
            try {
                const result = JSON.parse(event.data)
                handleServerResponse(result)
            } catch {
                console.error('[APRS] 消息解析失败')
            }
        }
    }

    // 断开 WebSocket
    function disconnectWebSocket() {
        if (ws.value) {
            ws.value.close()
            ws.value = null
        }
        wsConnected.value = false
        wsConnecting.value = false
    }

    // 处理服务端响应
    function handleServerResponse(result) {
        sending.value = false

        const { success, type, message, raw, timestamp } = result

        const historyRecord = {
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
            statusType.value = 'error'
        }
    }

    // 发送控制指令
    function sendCommand(action) {
        if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
            statusMessage.value = 'WebSocket 未连接'
            statusType.value = 'error'
            return
        }

        sending.value = true

        try {
            const mycallInput = mycall.value.trim()
            const passcodeInput = passcode.value.trim()
            const secretInput = secret.value.trim()
            let tocallInput = tocall.value.trim()

            if (!mycallInput) {
                throw new Error('请输入登录呼号')
            }
            if (!passcodeInput) {
                throw new Error('请输入 APRS-IS Passcode')
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

            // 保存参数
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

            ws.value.send(JSON.stringify(request))
            statusMessage.value = `正在发送 ${action} 指令...`
            statusType.value = 'info'
        } catch (err) {
            sending.value = false
            statusMessage.value = `错误: ${err.message}`
            statusType.value = 'error'
        }
    }

    // 清空历史记录
    function clearHistory() {
        clearHistoryStorage()
        history.value = []
    }

    // 更新服务器配置
    function updateServerConfig(mode, customAddress) {
        serverMode.value = mode
        if (customAddress !== undefined) {
            customServerAddress.value = customAddress
        }
        saveServerConfig(mode, customAddress)
        // 如果已连接，断开（切换 Tab 时会重新连接）
        if (wsConnected.value) {
            disconnectWebSocket()
        }
    }

    // 外部更新登录呼号（用于从设置中自动填充）
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
        if (!wsConnected.value || sending.value) return false

        // 验证登录呼号 (base)
        try {
            const { call: myCallBase } = parseCallsignSsid(mycall.value)
            console.log('myCallBase', myCallBase, VALIDATION.CALLSIGN.test(myCallBase))
            if (!VALIDATION.CALLSIGN.test(myCallBase)) return false
        } catch { return false }

        // 验证目标呼号 (base)
        try {
            const { call: toCallBase } = parseCallsignSsid(tocall.value)
            if (!VALIDATION.CALLSIGN.test(toCallBase)) return false
        } catch { return false }

        // 验证 Passcode
        if (!VALIDATION.PASSCODE.test(passcode.value)) return false

        // 验证密钥
        if (!VALIDATION.SECRET.test(secret.value)) return false

        return true
    })

    // 获取当前服务器显示地址
    const currentServerUrl = computed(() => {
        return getServerAddress()
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
        currentServerUrl,
        // 服务器配置
        serverMode,
        customServerAddress,
        // 表单
        mycall,
        passcode,
        secret,
        tocall,
        // 方法
        init,
        initAndConnect,
        connectWebSocket,
        disconnectWebSocket,
        sendCommand,
        clearHistory,
        updateServerConfig,
        updateCallsign
    }
}
