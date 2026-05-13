import { FmoApiClient } from './fmoApi'
import { normalizeHost } from '../utils/urlUtils'

const DEFAULT_CONTROL_HOST = '192.168.31.146'
const DEFAULT_CONTROL_PROTOCOL = 'ws'

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getControlTarget(host = '', protocol = 'ws') {
  const savedHost = localStorage.getItem('fmo_control_host') || ''
  const savedProtocol = localStorage.getItem('fmo_control_protocol') || ''

  return {
    host: normalizeHost(host || savedHost || DEFAULT_CONTROL_HOST),
    protocol: protocol || savedProtocol || DEFAULT_CONTROL_PROTOCOL
  }
}

function matchStationByName(stations, relayName) {
  const target = String(relayName || '').trim()
  if (!target) return null

  const exact = stations.find((station) => String(station.name || '').trim() === target)
  if (exact) return exact

  const normalized = target.toLowerCase()
  return (
    stations.find((station) => String(station.name || '').trim().toLowerCase() === normalized) ||
    null
  )
}

export async function switchStationByRelayName(relayName, host = '', protocol = 'ws') {
  const target = getControlTarget(host, protocol)
  if (!target.host) {
    throw new Error('请先设置 FMO 控制地址')
  }

  const client = new FmoApiClient(`${target.protocol}://${target.host}`)

  try {
    const stations = await client.getAllStations()
    const station = matchStationByName(stations, relayName)

    if (!station) {
      throw new Error(`未在中继列表中找到「${relayName}」`)
    }

    await client.setCurrentStation(station.uid)
    await wait(700)

    const current = await client.getCurrentStation()
    return { station, current }
  } finally {
    client.close()
  }
}
