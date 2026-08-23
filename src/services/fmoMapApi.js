const DEFAULT_API_BASE_URL = 'https://map.srv.ink/v401'
const DEFAULT_QUERY_TIMEOUT = 12000

function getApiBaseUrl() {
  return (import.meta.env.VITE_FMO_MAP_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '')
}

/**
 * 将用户输入转换为地图接口支持的精确查询路径。
 * 仅对完整 UID、呼号或呼号-SSID 查询，避免输入过程中产生无效请求。
 */
export function getFmoMapDeviceQueryPath(input) {
  const query = input.trim().toUpperCase()
  const uidMatch = query.match(/^#(\d+)$/)
  if (uidMatch) return `/api/devices/uid/${encodeURIComponent(uidMatch[1])}`

  const callsignSsidMatch = query.match(/^([A-Z0-9]{1,15})-(1[0-5]|[0-9])$/)
  if (callsignSsidMatch) {
    // APRS 中 -0 等同于未附加 SSID，按呼号查询该呼号下的全部台站。
    const callsign = callsignSsidMatch[1]
    return `/api/devices/${encodeURIComponent(callsignSsidMatch[2] === '0' ? callsign : query)}`
  }

  if (/^[A-Z0-9]{1,15}$/.test(query)) return `/api/devices/${encodeURIComponent(query)}`
  return null
}

/**
 * 查询公开地图并仅保留可直接导入的中继 APRS 原始报文。
 */
export async function queryFmoMapStationPackets(
  input,
  { signal, timeout = DEFAULT_QUERY_TIMEOUT } = {}
) {
  const path = getFmoMapDeviceQueryPath(input)
  if (!path) return []

  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort()
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeout)

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    })
    if (response.status === 404) return []
    if (!response.ok) throw new Error(`在线查询失败（HTTP ${response.status}）`)

    const body = await response.json()
    const devices = Array.isArray(body) ? body : [body]
    return devices
      .map((device) => device?.Relay?.rawAprs)
      .filter((rawPacket) => typeof rawPacket === 'string' && rawPacket.trim().length > 0)
  } catch (error) {
    if (timedOut) return []
    throw error
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abort)
  }
}

export function isFmoMapQueryAbort(error) {
  return error instanceof DOMException && error.name === 'AbortError'
}
