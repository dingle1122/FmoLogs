import { ref, computed } from 'vue'
import { saveFmoAddress, getFmoAddress, getAllRecordsFromIndexedDB } from '../services/db'
import { FmoApiClient } from '../services/fmoApi'
import { normalizeHost } from '../utils/urlUtils'

export function useSettings() {
  const fmoAddress = ref('')
  const protocol = ref('ws')
  const todayContactedCallsigns = ref(new Set())

  const isHttps = window.location.protocol === 'https:'
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )

  const remoteControlUrl = computed(() => {
    if (!fmoAddress.value) return '#'
    const host = normalizeHost(fmoAddress.value)
    return `http://${host}/remote.html`
  })

  async function initFmoAddress() {
    const savedAddress = await getFmoAddress()
    if (savedAddress) {
      if (savedAddress.startsWith('wss://')) {
        protocol.value = 'wss'
        fmoAddress.value = savedAddress.replace(/^wss:\/\//, '')
      } else if (savedAddress.startsWith('ws://')) {
        protocol.value = 'ws'
        fmoAddress.value = savedAddress.replace(/^ws:\/\//, '')
      } else {
        fmoAddress.value = savedAddress
      }
      return true
    } else {
      fmoAddress.value = isMobileDevice ? '' : 'fmo.local'
      return false
    }
  }

  async function validateAndSaveFmoAddress() {
    let address = fmoAddress.value.trim()

    if (!address) {
      await saveFmoAddress('')
      return { success: true, message: '设置已保存' }
    }

    const host = normalizeHost(address)
    const fullAddress = `${protocol.value}://${host}`

    const client = new FmoApiClient(`${protocol.value}://${host}`)
    if (!client.isValidAddress(host)) {
      return { success: false, message: '请输入有效的IP地址或域名' }
    }

    const wsUrl = `${protocol.value}://${host}/ws`

    const isConnected = await new Promise((resolve) => {
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

    if (isConnected) {
      await saveFmoAddress(fullAddress)
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
    const link = document.createElement('a')
    link.href = url
    link.target = '_blank'
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

  async function quickSaveAddress() {
    const address = fmoAddress.value.trim()
    if (!address) return

    const host = normalizeHost(address)
    const fullAddress = `${protocol.value}://${host}`
    await saveFmoAddress(fullAddress)
  }

  return {
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
    quickSaveAddress
  }
}
