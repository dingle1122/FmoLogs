/**
 * Android 原生 APRS 控制插件 JS 封装
 *
 * 通过原生 TCP 直连 APRS-IS（china.aprs2.net:14580），
 * 不依赖 WebSocket 中转服务（避免 Origin/403 问题）。
 *
 * 仅在 Capacitor 原生端可用（主要是 Android）。Web/iOS 仍走 WebSocket。
 */

import { Capacitor, registerPlugin } from '@capacitor/core'

const FmoAprs = registerPlugin('FmoAprs')

export function isNativeAprsAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

/**
 * 发送一条 APRS 控制指令（单次短连接）。
 *
 * @param {Object} params
 * @param {string} params.mycall    登录呼号（含 SSID），如 "BG9JYT-0"
 * @param {string} params.passcode  APRS-IS passcode
 * @param {string} params.tocall    目标设备呼号（含 SSID），如 "BG9JYT-14"
 * @param {string} params.rawPacket 已签名的完整 APRS 数据包
 * @param {number} [params.waitAck=20] 等待 ACK 的秒数
 * @param {string} [params.host]    APRS-IS 主机，默认 china.aprs2.net
 * @param {number} [params.port]    APRS-IS 端口，默认 14580
 * @returns {Promise<{ success: boolean, type: string, message: string, raw?: string, timestamp: number }>}
 */
export async function sendAprsCommand(params) {
  if (!isNativeAprsAvailable()) {
    throw new Error('FmoAprs 原生插件仅在 Android 端可用')
  }
  return FmoAprs.sendCommand({
    mycall: params.mycall,
    passcode: params.passcode,
    tocall: params.tocall || '',
    rawPacket: params.rawPacket,
    waitAck: typeof params.waitAck === 'number' ? params.waitAck : 20,
    host: params.host,
    port: params.port
  })
}
