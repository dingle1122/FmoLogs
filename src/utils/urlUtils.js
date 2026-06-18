/**
 * 标准化地址，移除协议前缀和尾部斜杠
 * @param {string} address - 原始地址
 * @returns {string} - 标准化后的主机名
 */
export function normalizeHost(address) {
  if (!address) return ''
  return address
    .trim()
    .replace(/^(https?|wss?):?\/\//, '')
    .replace(/\/+$/, '')
}

export function resolveWebSocketProtocol(addressOrProtocol, fallback = 'ws') {
  const value = String(addressOrProtocol || '').trim().toLowerCase()
  const fallbackValue = String(fallback || '').trim().toLowerCase()

  if (
    value === 'wss' ||
    value === 'https' ||
    value.startsWith('wss://') ||
    value.startsWith('https://')
  ) {
    return 'wss'
  }
  if (
    value === 'ws' ||
    value === 'http' ||
    value.startsWith('ws://') ||
    value.startsWith('http://')
  ) {
    return 'ws'
  }
  if (fallbackValue === 'wss' || fallbackValue === 'https') {
    return 'wss'
  }
  return 'ws'
}

export function buildWebSocketUrl(address, path = '/ws', fallbackProtocol = 'ws') {
  const host = normalizeHost(address)
  const protocol = resolveWebSocketProtocol(address, fallbackProtocol)
  const normalizedPath = path ? `/${String(path).replace(/^\/+/, '')}` : ''

  if (!normalizedPath || host.endsWith(normalizedPath)) {
    return `${protocol}://${host}`
  }
  return `${protocol}://${host}${normalizedPath}`
}

export function resolveHttpProtocol(addressOrProtocol, fallback = 'http') {
  const wsProtocol = resolveWebSocketProtocol(addressOrProtocol, fallback)
  return wsProtocol === 'wss' ? 'https' : 'http'
}

export function buildHttpUrl(address, path = '', fallbackProtocol = 'http') {
  const host = normalizeHost(address)
  const protocol = resolveHttpProtocol(address, fallbackProtocol)
  const normalizedPath = path ? `/${String(path).replace(/^\/+/, '')}` : ''

  if (!normalizedPath || host.endsWith(normalizedPath)) {
    return `${protocol}://${host}`
  }
  return `${protocol}://${host}${normalizedPath}`
}

export function normalizeWebSocketEndpoint(address, fallbackProtocol = 'ws') {
  return {
    host: normalizeHost(address),
    protocol: resolveWebSocketProtocol(address, fallbackProtocol)
  }
}
