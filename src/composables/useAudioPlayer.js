import { ref, onBeforeUnmount } from 'vue'
import { AudioStreamPlayer } from '../services/audioPlayer'
import { normalizeHost } from '../utils/urlUtils'
import { BackgroundMode } from '@anuradev/capacitor-background-mode'
import { Capacitor } from '@capacitor/core'

/**
 * 生成一段极短的静音 WAV 数据 URI
 * 用于创建 <audio> 保活元素，让 WebView 认为有媒体在播放
 * 格式：8kHz 采样率、单声道、16bit、1 秒静音
 */
function generateSilentWavDataUri() {
  const sampleRate = 8000
  const numChannels = 1
  const bitsPerSample = 16
  const numSamples = sampleRate // 1 秒
  const dataSize = numSamples * numChannels * (bitsPerSample / 8)
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // RIFF header
  view.setUint32(0, 0x52494646, false) // 'RIFF'
  view.setUint32(4, 36 + dataSize, true) // file size - 8
  view.setUint32(8, 0x57415645, false) // 'WAVE'

  // fmt chunk
  view.setUint32(12, 0x666d7420, false) // 'fmt '
  view.setUint32(16, 16, true) // chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true) // byte rate
  view.setUint16(32, numChannels * (bitsPerSample / 8), true) // block align
  view.setUint16(34, bitsPerSample, true)

  // data chunk
  view.setUint32(36, 0x64617461, false) // 'data'
  view.setUint32(40, dataSize, true)
  // 样本数据全为 0（静音）

  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return 'data:audio/wav;base64,' + btoa(binary)
}

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

  // 是否为 Android 原生平台
  const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

  // 内部：AudioStreamPlayer 实例（非响应式）
  let player = null

  // 屏幕唤醒锁引用（跨平台辅助保活）
  let wakeLockRef = null

  // 静音 <audio> 保活元素（Android 后台保活关键）
  let silentAudioEl = null
  // AudioContext 定时恢复器
  let _keepAliveInterval = null

  /**
   * 创建静音 <audio> 保活元素
   * WebView 在识别到 <audio> 播放时不会挂起 AudioContext
   * 这是解决后台 WebAudio 停止播放的核心技巧
   */
  function startSilentAudioKeepAlive() {
    if (!isAndroid) return
    stopSilentAudioKeepAlive()

    const audio = document.createElement('audio')
    audio.src = generateSilentWavDataUri()
    audio.loop = true
    audio.volume = 0.01 // 极低音量，几乎听不到
    audio.setAttribute('playsinline', '')
    audio.setAttribute('webkit-playsinline', '')
    audio.style.display = 'none'
    document.body.appendChild(audio)
    audio.play().catch(() => {})

    silentAudioEl = audio

    // 设置 MediaSession，让系统识别为媒体播放
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'FMO 音频流',
        artist: 'FMO Logs',
        album: ''
      })
      navigator.mediaSession.setActionHandler('pause', () => {
        stopAudio()
      })
      navigator.mediaSession.setActionHandler('stop', () => {
        stopAudio()
      })
    }
  }

  /**
   * 停止并移除静音 <audio> 保活元素
   */
  function stopSilentAudioKeepAlive() {
    if (silentAudioEl) {
      silentAudioEl.pause()
      silentAudioEl.src = ''
      silentAudioEl.load()
      if (silentAudioEl.parentNode) {
        silentAudioEl.parentNode.removeChild(silentAudioEl)
      }
      silentAudioEl = null
    }
    // 清除 MediaSession
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('stop', null)
    }
  }

  /**
   * 启动 AudioContext 后台保活定时器
   * 定期检查并恢复被系统挂起的 AudioContext
   */
  function startKeepAliveTimer() {
    if (!isAndroid) return
    stopKeepAliveTimer()
    _keepAliveInterval = setInterval(() => {
      if (player?.audioCtx?.state === 'suspended') {
        player.audioCtx.resume().catch(() => {})
      }
    }, 2000)
  }

  /**
   * 停止 AudioContext 保活定时器
   */
  function stopKeepAliveTimer() {
    if (_keepAliveInterval) {
      clearInterval(_keepAliveInterval)
      _keepAliveInterval = null
    }
  }

  /**
   * 启用安卓后台模式
   * 创建前台服务通知，防止系统杀死/节流 WebView
   */
  async function enableBackgroundMode() {
    if (!isAndroid) return
    try {
      // 配置通知栏信息
      await BackgroundMode.setSettings({
        title: 'FMO 音频播放中',
        text: '正在播放音频流...',
        subText: 'FMO Logs',
        bigText: true,
        resume: true,
        silent: true,
        hidden: false,
        color: '#1a73e8',
        channelName: 'FMO 音频播放',
        channelDescription: '保持音频流在后台持续播放',
        allowClose: true,
        closeTitle: '停止播放',
        showWhen: true,
        visibility: 'public',
        disableWebViewOptimization: true
      })
      await BackgroundMode.enable()
      // 关键：禁用 WebView 后台优化，防止 WebView 挂起
      await BackgroundMode.disableWebViewOptimizations()
    } catch (e) {
      console.debug('后台模式启用失败:', e)
    }
  }

  /**
   * 禁用安卓后台模式
   */
  async function disableBackgroundMode() {
    if (!isAndroid) return
    try {
      await BackgroundMode.enableWebViewOptimizations()
    } catch (e) {
      // 忽略
    }
    try {
      await BackgroundMode.disable()
    } catch (e) {
      console.debug('后台模式禁用失败:', e)
    }
  }

  // 页面可见性变化监听：重新获取已释放的唤醒锁 + 恢复 AudioContext
  function handleVisibilityChange() {
    if (isPlaying.value) {
      // 恢复 AudioContext（浏览器可能因页面隐藏而自动挂起）
      if (player && player.audioCtx?.state === 'suspended') {
        player.audioCtx.resume().catch(() => {})
      }
      // 页面重新可见时重新获取唤醒锁（仅非 Android 原生平台）
      if (!isAndroid && document.visibilityState === 'visible' && 'wakeLock' in navigator) {
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
   * 请求屏幕唤醒锁（仅非 Android 原生平台使用，Android 由后台模式接管）
   */
  function requestWakeLock() {
    if (isAndroid) return // Android 由 BackgroundMode 接管
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
   * 释放屏幕唤醒锁（仅非 Android 原生平台）
   */
  function releaseWakeLock() {
    if (isAndroid) return
    if (wakeLockRef) {
      wakeLockRef.release().catch(() => {})
      wakeLockRef = null
    }
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

    // 请求屏幕唤醒锁（跨平台辅助保活）
    requestWakeLock()

    // Android: 启用后台模式，创建前台服务保活
    enableBackgroundMode()
    // Android: 静音 <audio> 保活 + MediaSession
    startSilentAudioKeepAlive()
    // Android: AudioContext 定时恢复保活
    startKeepAliveTimer()

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
        // Android: 连接彻底断开时禁用后台模式
        disableBackgroundMode()
        stopSilentAudioKeepAlive()
        stopKeepAliveTimer()
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

    // 释放屏幕唤醒锁
    releaseWakeLock()

    // Android: 禁用后台模式
    disableBackgroundMode()
    // Android: 停止静音保活
    stopSilentAudioKeepAlive()
    // Android: 停止 AudioContext 保活定时器
    stopKeepAliveTimer()
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
