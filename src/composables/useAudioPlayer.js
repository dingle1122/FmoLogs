import { ref, onBeforeUnmount } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { AudioStreamPlayer } from '../services/audioPlayer'
import { normalizeHost } from '../utils/urlUtils'

/**
 * 将音量百分比转换为非线性 gain 值
 * 使用指数曲线使音量调节更符合人耳感知，基础增益为 5
 * 0% → 0, 50% → 1.77, 100% → 5.0, 150% → 9.19, 200% → 14.14
 * @param {number} percent - 音量百分比（0-200）
 * @returns {number} gain 值
 */
function percentToGain(percent) {
  if (percent <= 0) return 0
  // 使用指数曲线: gain = 5 * (percent/100)^1.5
  // 基础增益 5 使 100% 时音量更响亮，适合原始音频流偏小的场景
  const ratio = percent / 100
  return 5 * Math.pow(ratio, 1.5)
}

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

  // 屏幕唤醒锁引用（跨平台辅助保活）
  let wakeLockRef = null

  // 页面可见性变化监听：重新获取已释放的唤醒锁 + 恢复 AudioContext
  function handleVisibilityChange() {
    if (isPlaying.value) {
      // 恢复 AudioContext（浏览器可能因页面隐藏而自动挂起）
      if (player && player.audioCtx?.state === 'suspended') {
        player.audioCtx.resume().catch(() => {})
      }
      // 页面重新可见时重新获取唤醒锁
      if (document.visibilityState === 'visible' && 'wakeLock' in navigator) {
        navigator.wakeLock
          .request('screen')
          .then((lock) => {
            wakeLockRef = lock
          })
          .catch(() => {})
      }
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)

  /**
   * 请求屏幕唤醒锁
   */
  function requestWakeLock() {
    if ('wakeLock' in navigator) {
      navigator.wakeLock
        .request('screen')
        .then((lock) => {
          wakeLockRef = lock
        })
        .catch((e) => {
          console.debug('屏幕唤醒锁请求失败:', e)
        })
    }
  }

  /**
   * 释放屏幕唤醒锁
   */
  function releaseWakeLock() {
    if (wakeLockRef) {
      wakeLockRef.release().catch(() => {})
      wakeLockRef = null
    }
  }

  /**
   * 启动 Android 后台播放服务
   */
  function startBackgroundService() {
    invoke('plugin:background-audio|start').catch((e) => {
      console.debug('后台音频服务启动失败或不可用:', e)
    })
  }

  /**
   * 停止 Android 后台播放服务
   */
  function stopBackgroundService() {
    invoke('plugin:background-audio|stop').catch((e) => {
      console.debug('后台音频服务停止失败或不可用:', e)
    })
  }

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

    // 启动 Android 后台播放服务（息屏保活）
    startBackgroundService()

    // 请求屏幕唤醒锁（跨平台辅助保活）
    requestWakeLock()

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

    // 停止 Android 后台播放服务
    stopBackgroundService()

    // 释放屏幕唤醒锁
    releaseWakeLock()
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
      player.setVolume(percentToGain(volumePercent)) // 百分比转为非线性 gain 值
      isMuted.value = false
    }
  }

  /**
   * 设置播放音量
   * @param {number} volumePercent - 音量百分比（0-200）
   */
  function setVolume(volumePercent) {
    if (player && isPlaying.value && !isMuted.value) {
      player.setVolume(percentToGain(volumePercent)) // 百分比转为非线性 gain 值
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
    document.removeEventListener('visibilitychange', handleVisibilityChange)
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
