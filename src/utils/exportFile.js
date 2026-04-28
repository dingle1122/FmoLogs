/**
 * 跨平台文件导出工具
 * 在 Web 端使用浏览器原生下载，在 Capacitor 端使用原生文件系统 + 分享面板
 */

import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/**
 * 将 Blob 转换为 Base64 字符串
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * 触发浏览器原生下载
 * @param {string} filename
 * @param {Blob} blob
 */
function downloadInBrowser(filename, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 跨平台文件导出
 * @param {string} filename - 文件名
 * @param {Uint8Array|string} data - 文件数据
 * @param {string} mimeType - MIME 类型
 */
export async function exportFile(filename, data, mimeType) {
  const platform = Capacitor.getPlatform() // 'web' | 'android' | 'ios'

  // ========== Web 端：保持原有浏览器下载体验 ==========
  if (platform === 'web') {
    const blob =
      data instanceof Uint8Array
        ? new Blob([data], { type: mimeType })
        : new Blob([data], { type: mimeType || 'text/plain' })

    downloadInBrowser(filename, blob)
    return
  }

  // ========== Android/iOS：先写入缓存再调用系统分享面板 ==========
  const blob =
    data instanceof Uint8Array
      ? new Blob([data], { type: mimeType })
      : new Blob([data], { type: mimeType || 'text/plain' })

  const base64 = await blobToBase64(blob)

  // 写入应用缓存目录
  const result = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
    recursive: true
  })

  // 弹出系统分享面板，让用户选择保存位置或分享方式
  await Share.share({
    title: `导出 ${filename}`,
    files: [result.uri],
    dialogTitle: '选择导出方式'
  })
}
