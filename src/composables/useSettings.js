import { ref, computed } from 'vue'
import { saveFmoAddresses, getFmoAddresses, getAllRecordsFromIndexedDB } from '../services/db'
import { FmoApiClient } from '../services/fmoApi'
import { normalizeHost } from '../utils/urlUtils'

export function useSettings() {
  // 多地址存储
  const fmoAddressStorage = ref({ addresses: [], activeId: null })
  const todayContactedCallsigns = ref(new Set())

  const isHttps = window.location.protocol === 'https:'
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )

  // 当前选中的地址对象
  const activeAddress = computed(() => {
    if (!fmoAddressStorage.value.activeId) return null
    return fmoAddressStorage.value.addresses.find((a) => a.id === fmoAddressStorage.value.activeId)
  })

  // 兼容：当前地址（不含协议）
  const fmoAddress = computed(() => {
    return activeAddress.value?.host || ''
  })

  // 兼容：当前协议
  const protocol = computed(() => {
    return activeAddress.value?.protocol || 'ws'
  })

  // 地址列表
  const addressList = computed(() => {
    return fmoAddressStorage.value.addresses
  })

  // 当前选中ID
  const activeAddressId = computed(() => {
    return fmoAddressStorage.value.activeId
  })

  const remoteControlUrl = computed(() => {
    if (!fmoAddress.value) return '#'
    const host = normalizeHost(fmoAddress.value)
    return `http://${host}/remote.html`
  })

  // 初始化地址（支持迁移）
  async function initFmoAddress() {
    const storage = await getFmoAddresses()
    fmoAddressStorage.value = storage

    // 如果迁移后有数据，保存一次确保新格式持久化
    if (storage.addresses.length > 0) {
      await saveFmoAddresses(storage)
      return true
    }

    return false
  }

  // 验证WebSocket连接
  async function validateConnection(host, proto) {
    const wsUrl = `${proto}://${normalizeHost(host)}/ws`

    return new Promise((resolve) => {
      const socket = new WebSocket(wsUrl)
      const timeout = setTimeout(() => {
        socket.close()
        resolve(false)
      }, 5000)

      socket.onopen = () => {
        clearTimeout(timeout)
        socket.close()
        resolve(true)
      }

      socket.onerror = () => {
        clearTimeout(timeout)
        socket.close()
        resolve(false)
      }
    })
  }

  // 生成唯一ID
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 11)
  }

  // 添加新地址
  async function addFmoAddress(name, host, proto) {
    const client = new FmoApiClient(`${proto}://${host}`)
    if (!client.isValidAddress(host)) {
      return { success: false, message: '请输入有效的IP地址或域名' }
    }

    // 检查是否已存在相同地址
    const exists = fmoAddressStorage.value.addresses.some(
      (a) => a.host === host && a.protocol === proto
    )
    if (exists) {
      return { success: false, message: '该地址已存在' }
    }

    const id = generateId()
    const newAddress = { id, name: name || host, host, protocol: proto }

    fmoAddressStorage.value.addresses.push(newAddress)

    // 自动选中新添加的地址
    fmoAddressStorage.value.activeId = id

    await saveFmoAddresses(fmoAddressStorage.value)
    return { success: true, message: '地址已添加', id, reconnect: true }
  }

  // 更新地址
  async function updateFmoAddress(id, name, host, proto) {
    const index = fmoAddressStorage.value.addresses.findIndex((a) => a.id === id)
    if (index === -1) {
      return { success: false, message: '地址不存在' }
    }

    const client = new FmoApiClient(`${proto}://${host}`)
    if (!client.isValidAddress(host)) {
      return { success: false, message: '请输入有效的IP地址或域名' }
    }

    // 检查是否与其他地址重复
    const duplicate = fmoAddressStorage.value.addresses.some(
      (a, i) => i !== index && a.host === host && a.protocol === proto
    )
    if (duplicate) {
      return { success: false, message: '该地址已存在' }
    }

    fmoAddressStorage.value.addresses[index] = {
      ...fmoAddressStorage.value.addresses[index],
      name: name || host,
      host,
      protocol: proto
    }

    await saveFmoAddresses(fmoAddressStorage.value)
    return { success: true, message: '地址已更新' }
  }

  // 删除地址
  async function deleteFmoAddress(id) {
    const index = fmoAddressStorage.value.addresses.findIndex((a) => a.id === id)
    if (index === -1) {
      return { success: false, message: '地址不存在' }
    }

    const wasActive = fmoAddressStorage.value.activeId === id
    fmoAddressStorage.value.addresses.splice(index, 1)

    // 如果删除的是当前选中地址，自动切换到其他地址
    if (wasActive) {
      if (fmoAddressStorage.value.addresses.length > 0) {
        fmoAddressStorage.value.activeId = fmoAddressStorage.value.addresses[0].id
      } else {
        fmoAddressStorage.value.activeId = null
      }
    }

    await saveFmoAddresses(fmoAddressStorage.value)
    return { success: true, message: '地址已删除', reconnect: wasActive }
  }

  // 切换地址（验证后切换）
  async function selectFmoAddress(id) {
    const address = fmoAddressStorage.value.addresses.find((a) => a.id === id)
    if (!address) {
      return { success: false, message: '地址不存在' }
    }

    // 验证连接
    const isConnected = await validateConnection(address.host, address.protocol)

    if (isConnected) {
      fmoAddressStorage.value.activeId = id
      await saveFmoAddresses(fmoAddressStorage.value)
      return { success: true, message: '已切换到: ' + address.name, reconnect: true }
    } else {
      if (isHttps && address.protocol === 'ws') {
        return {
          success: false,
          message:
            '连接失败。提示：HTTPS 网站无法直接连接局域网设备，请开启浏览器"不安全内容"访问权限，或选择 wss:// 协议。'
        }
      } else {
        return { success: false, message: '连接失败，请确认地址是否正确' }
      }
    }
  }

  // 清除全部地址
  async function clearAllAddresses() {
    const hadAddresses = fmoAddressStorage.value.addresses.length > 0
    fmoAddressStorage.value.addresses = []
    fmoAddressStorage.value.activeId = null
    await saveFmoAddresses(fmoAddressStorage.value)
    return { success: true, reconnect: hadAddresses }
  }

  // 兼容旧接口：验证并保存当前输入的地址
  async function validateAndSaveFmoAddress() {
    // 此函数在新UI中不再直接使用，但保留兼容
    const address = fmoAddress.value
    if (!address) {
      return { success: true, message: '设置已保存' }
    }

    const isConnected = await validateConnection(address, protocol.value)

    if (isConnected) {
      return { success: true, message: '设置已保存', reconnect: true }
    } else {
      if (isHttps && protocol.value === 'ws') {
        return {
          success: false,
          message:
            '请确认 fmo 地址。提示：HTTPS 网站无法直接连接局域网设备，请按界面提示开启浏览器"不安全内容"访问权限，或选择 wss:// 协议。'
        }
      } else {
        return { success: false, message: '请确认fmo地址' }
      }
    }
  }

  function backupLogs() {
    if (!fmoAddress.value) return

    let address = fmoAddress.value.trim()
    if (!address.startsWith('http://') && !address.startsWith('https://')) {
      address = 'http://' + address
    }
    address = address.replace(/\/+$/, '')

    const url = `${address}/api/qso/backup`
    
    // 在 HTTPS 网站上访问 HTTP 资源会被浏览器阻止（混合内容策略）
    // 去除 target='_blank'，直接在当前页面触发下载
    const link = document.createElement('a')
    link.href = url
    link.download = '' // 添加 download 属性触发下载行为，空值表示使用服务器指定的文件名
    // 不设置 target='_blank'，避免弹出被阻止的空白窗口
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function loadTodayContactedCallsigns(selectedFromCallsign) {
    if (!selectedFromCallsign) {
      todayContactedCallsigns.value = new Set()
      return
    }

    try {
      const allRecords = await getAllRecordsFromIndexedDB(1, 999999, '', selectedFromCallsign)
      const callsigns = new Set()
      const today = new Date()

      for (const record of allRecords.data) {
        if (record.timestamp) {
          const contactDate = new Date(record.timestamp * 1000)
          const isToday =
            contactDate.getUTCFullYear() === today.getUTCFullYear() &&
            contactDate.getUTCMonth() === today.getUTCMonth() &&
            contactDate.getUTCDate() === today.getUTCDate()
          if (isToday && record.toCallsign) {
            callsigns.add(record.toCallsign)
          }
        }
      }

      todayContactedCallsigns.value = callsigns
    } catch (error) {
      console.error('查询今日通联呼号失败:', error)
      todayContactedCallsigns.value = new Set()
    }
  }

  return {
    // 兼容旧接口
    fmoAddress,
    protocol,
    todayContactedCallsigns,
    isHttps,
    isMobileDevice,
    remoteControlUrl,
    initFmoAddress,
    validateAndSaveFmoAddress,
    backupLogs,
    loadTodayContactedCallsigns,
    // 新增多地址管理接口
    addressList,
    activeAddressId,
    activeAddress,
    addFmoAddress,
    updateFmoAddress,
    deleteFmoAddress,
    selectFmoAddress,
    clearAllAddresses,
    validateConnection
  }
}
