import { ref, onBeforeUnmount } from 'vue'
import { AudioStreamPlayer } from '../services/audioPlayer'
import { normalizeHost } from '../utils/urlUtils'

/**
 * 音频播放器组合式函数
 * 封装音频播放控制逻辑，管理 AudioStreamPlayer 实例
 * @returns {Object} 音频播放控制方法和状态
 */
export function useAudioPlayer() {
  // 响应式状态
  const isPlaying = ref(false) // 是否正在播放（已连接）
  const isMuted = ref(false) // 是否静音
  const audioStatus = ref('') // 状态文本

  // 内部：AudioStreamPlayer 实例（非响应式）
  let player = null

  /**
   * 切换播放/停止
   * @param {string} host - 主机地址
   * @param {string} protocol - 协议（ws 或 wss）
   */
  function toggleAudio(host, protocol) {
    if (isPlaying.value) {
      stopAudio()
    } else {
      startAudio(host, protocol)
    }
  }

  /**
   * 开始播放
   * @param {string} host - 主机地址
   * @param {string} protocol - 协议（ws 或 wss）
   */
  function startAudio(host, protocol) {
    if (!host) return

    // 如果已有连接，先停止
    if (player) {
      stopAudio()
    }

    // 构建 WebSocket URL
    const wsProtocol = protocol === 'wss' ? 'wss' : 'ws'
    const normalizedHost = normalizeHost(host)
    const url = `${wsProtocol}://${normalizedHost}/audio`

    // 创建 AudioStreamPlayer 实例
    player = new AudioStreamPlayer({ url })

    // 设置状态回调
    player.onStatus = (status) => {
      audioStatus.value = status
      // 连接断开或出错时，自动重置播放状态
      // 注意：'音频重连中...' 状态下保持 isPlaying = true，以便自动恢复
      if (status === '音频未连接' || status === '音频连接错误') {
        isPlaying.value = false
        isMuted.value = false
      }
    }

    // 连接到音频流
    player.connect()
    isPlaying.value = true
  }

  /**
   * 停止播放
   */
  function stopAudio() {
    if (player) {
      player.disconnect()
      player = null
    }
    isPlaying.value = false
    isMuted.value = false
    audioStatus.value = ''
  }

  /**
   * 静音（不断开连接）
   */
  function muteAudio() {
    if (player && isPlaying.value) {
      player.setVolume(0)
      isMuted.value = true
    }
  }

  /**
   * 取消静音
   * @param {number} volumePercent - 音量百分比（0-200），默认100
   */
  function unmuteAudio(volumePercent = 100) {
    if (player && isPlaying.value) {
      player.setVolume(volumePercent / 100) // 百分比转为 0-2.0 的系数
      isMuted.value = false
    }
  }

  /**
   * 设置播放音量
   * @param {number} volumePercent - 音量百分比（0-200）
   */
  function setVolume(volumePercent) {
    if (player && isPlaying.value && !isMuted.value) {
      player.setVolume(volumePercent / 100)
    }
  }

  /**
   * 恢复音频上下文（解决浏览器自动播放策略）
   * 应在用户手势事件中调用
   */
  function resumeAudio() {
    if (player) {
      player.resumeAudioContext()
    }
  }

  // 组件卸载时清理
  onBeforeUnmount(() => {
    stopAudio()
  })

  return {
    isPlaying,
    isMuted,
    audioStatus,
    toggleAudio,
    stopAudio,
    muteAudio,
    unmuteAudio,
    setVolume,
    resumeAudio
  }
}
