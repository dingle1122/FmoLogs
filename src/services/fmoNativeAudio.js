import { registerPlugin } from '@capacitor/core'

/**
 * Android 原生 FmoAudio 插件桥
 * 由 android/app/src/main/java/com/fmologs/app/FmoAudioPlugin.java 提供
 *
 * 方法：
 *   - start({ url, volumePercent?, muted? })
 *   - stop()
 *   - setVolume({ volumePercent })
 *   - setMuted({ muted })
 * 事件：
 *   - 'status' -> { status: 'connecting' | 'connected' | 'playing' | 'reconnecting' | 'disconnected' | 'error' }
 */
export const FmoAudio = registerPlugin('FmoAudio')

/**
 * 将内部原生状态映射为与 Web 端 AudioStreamPlayer 对齐的 statusText
 * @param {string} nativeStatus
 * @returns {string}
 */
export function mapNativeStatus(nativeStatus) {
  switch (nativeStatus) {
    case 'connecting':
      return '音频连接中...'
    case 'connected':
      return '音频已连接'
    case 'playing':
      return '播放中'
    case 'reconnecting':
      return '音频重连中...'
    case 'error':
      return '音频连接错误'
    case 'disconnected':
    default:
      return '音频未连接'
  }
}
