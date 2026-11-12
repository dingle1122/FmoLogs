interface ZipImage { name: string; image: Blob; createdAt: number }

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  return crc >>> 0
})

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]
  return (crc ^ 0xffffffff) >>> 0
}

function header(size: number, signature: number): { bytes: Uint8Array<ArrayBuffer>; view: DataView } {
  const bytes = new Uint8Array(size)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, signature, true)
  return { bytes, view }
}

export function safeImageName(name: string): string {
  return (name.replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g, '_').replace(/\.+$/g, '').trim().replace(/\.png$/i, '').trim() || 'SSTV').slice(0, 100)
}

export function historyImageName(name: string, createdAt: number): string {
  const date = new Date(createdAt)
  if (!Number.isFinite(date.getTime())) return safeImageName(name)
  const pad = (value: number) => String(value).padStart(2, '0')
  const timestamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `${safeImageName(name).slice(0, 70)}-${timestamp}`
}

/** PNG is already compressed, so ZIP entries use the portable STORE method. */
export async function createSstvZip(images: ZipImage[]): Promise<Blob> {
  if (images.length > 65535) throw new Error('图片数量超出 ZIP 限制')
  const parts: BlobPart[] = []
  const central: BlobPart[] = []
  const names = new Set<string>()
  const encoder = new TextEncoder()
  let offset = 0
  let centralSize = 0
  for (const image of images) {
    const base = safeImageName(image.name)
    let name = `${base}.png`
    for (let n = 2; names.has(name.toLowerCase()); n++) name = `${base} (${n}).png`
    names.add(name.toLowerCase())
    const filename = encoder.encode(name)
    const data = new Uint8Array(await image.image.arrayBuffer())
    const checksum = crc32(data)
    const date = new Date(image.createdAt)
    const year = Math.min(2107, Math.max(1980, date.getFullYear() || 1980))
    const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)
    const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    if (data.length > 0xffffffff || offset + data.length + filename.length + 30 > 0xffffffff) throw new Error('图片总大小超出 ZIP 限制')
    const local = header(30, 0x04034b50)
    local.view.setUint16(4, 20, true); local.view.setUint16(6, 0x800, true)
    local.view.setUint16(10, dosTime, true); local.view.setUint16(12, dosDate, true)
    local.view.setUint32(14, checksum, true); local.view.setUint32(18, data.length, true); local.view.setUint32(22, data.length, true)
    local.view.setUint16(26, filename.length, true)
    const directory = header(46, 0x02014b50)
    directory.view.setUint16(4, 20, true); directory.view.setUint16(6, 20, true); directory.view.setUint16(8, 0x800, true)
    directory.view.setUint16(12, dosTime, true); directory.view.setUint16(14, dosDate, true)
    directory.view.setUint32(16, checksum, true); directory.view.setUint32(20, data.length, true); directory.view.setUint32(24, data.length, true)
    directory.view.setUint16(28, filename.length, true); directory.view.setUint32(42, offset, true)
    parts.push(local.bytes, filename, data)
    central.push(directory.bytes, filename)
    offset += 30 + filename.length + data.length
    centralSize += 46 + filename.length
  }
  if (offset + centralSize > 0xffffffff) throw new Error('图片总大小超出 ZIP 限制')
  const end = header(22, 0x06054b50)
  end.view.setUint16(8, images.length, true); end.view.setUint16(10, images.length, true)
  end.view.setUint32(12, centralSize, true); end.view.setUint32(16, offset, true)
  return new Blob([...parts, ...central, end.bytes], { type: 'application/zip' })
}
