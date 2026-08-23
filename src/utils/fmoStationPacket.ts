export interface ParsedFmoStation {
  rawPacket: string
  uid: number
  callsign: string
  ssid: number | null
  latitudeRaw: string
  longitudeRaw: string
  countryCode: string
  name: string
  host: string
  port: number
  filterKm: number
  online: number
  peak: number
}

type CborValue = string | number | Uint8Array | CborValue[]

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function readCborValue(bytes: Uint8Array, offset: number): [CborValue, number] {
  if (offset >= bytes.length) throw new Error('CBOR 数据不完整')
  const initial = bytes[offset++]
  const major = initial >> 5
  const additional = initial & 31
  let length: number

  if (additional < 24) length = additional
  else if (additional === 24) length = bytes[offset++]
  else if (additional === 25) {
    length = (bytes[offset++] << 8) | bytes[offset++]
  } else if (additional === 26) {
    length =
      bytes[offset++] * 0x1000000 +
      (bytes[offset++] << 16) +
      (bytes[offset++] << 8) +
      bytes[offset++]
  } else {
    throw new Error('不支持的 CBOR 长度')
  }

  if (major === 0) return [length, offset]
  if (major === 2 || major === 3) {
    const end = offset + length
    if (end > bytes.length) throw new Error('CBOR 数据不完整')
    const chunk = bytes.slice(offset, end)
    return [major === 2 ? chunk : new TextDecoder().decode(chunk), end]
  }
  if (major === 4) {
    const values: CborValue[] = []
    for (let index = 0; index < length; index++) {
      const [value, nextOffset] = readCborValue(bytes, offset)
      values.push(value)
      offset = nextOffset
    }
    return [values, offset]
  }
  throw new Error('不支持的 CBOR 类型')
}

function parseCertificateUid(certToken: string) {
  const cert = base64UrlToBytes(certToken.replace(/^CERT:/, ''))
  const [value] = readCborValue(cert, 0)
  const uid = Array.isArray(value) ? value[5] : null
  if (typeof uid !== 'number' || !Number.isSafeInteger(uid) || uid <= 0) {
    throw new Error('证书中未找到 UID')
  }
  return uid
}

/** 仅进行报文结构解析；证书链和签名由 FMO 设备在导入时验证。 */
export function parseFmoStationPacket(input: string): ParsedFmoStation | null {
  try {
    const rawPacket = input.trim()
    const header = rawPacket.match(/^([A-Z0-9]+)(?:-(\d{1,2}))?>APFMO4(?:,[^:]+)?:/i)
    const markerIndex = rawPacket.indexOf('FMO-V4,STATION,')
    if (!header || markerIndex < 0) return null

    const position = rawPacket.slice(header[0].length, markerIndex)
    const coordinates = position.match(/(\d{4}\.\d{2}[NS]).(\d{5}\.\d{2}[EW])/i)
    if (!coordinates) return null

    const tokens = rawPacket.slice(markerIndex).split(',')
    if (tokens.length < 10 || tokens[0] !== 'FMO-V4' || tokens[1] !== 'STATION') return null
    const cert = tokens[2]
    const countryCode = tokens[3]
    const name = tokens[4]?.trim()
    const host = tokens[5]?.trim()
    const portMatch = tokens[6]?.match(/^P(\d+)$/i)
    const filterMatch = tokens[7]?.match(/^F(\d+)KM$/i)
    const usersMatch = tokens[8]?.match(/^U(\d+)\/(\d+)$/i)
    const signature = tokens[tokens.length - 1]
    if (
      !cert?.startsWith('CERT:') ||
      !/^[A-Z]{2}$/.test(countryCode) ||
      !name ||
      !host ||
      !portMatch ||
      !filterMatch ||
      !usersMatch ||
      !signature?.startsWith('SIG:')
    )
      return null

    const port = Number(portMatch[1])
    if (port < 1 || port > 65535) return null
    return {
      rawPacket,
      uid: parseCertificateUid(cert),
      callsign: header[1].toUpperCase(),
      ssid: header[2] === undefined ? null : Number(header[2]),
      latitudeRaw: coordinates[1].toUpperCase(),
      longitudeRaw: coordinates[2].toUpperCase(),
      countryCode,
      name,
      host,
      port,
      filterKm: Number(filterMatch[1]),
      online: Number(usersMatch[1]),
      peak: Number(usersMatch[2])
    }
  } catch {
    return null
  }
}
