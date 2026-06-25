import { Capacitor } from '@capacitor/core'

/**
 * 原生平台实现依赖的自定义插件。
 *
 * 这里要求整组插件都已被 Capacitor 原生桥注册成功，避免部分插件初始化失败时
 * 混用 Native/Web 两套实现。旧 WebView 无法执行 Capacitor native-bridge.js 时，
 * isPluginAvailable 会对这些插件全部返回 false，此时应用整体按纯 Web 运行。
 */
const REQUIRED_ANDROID_PLUGINS = [
  'FmoAudio',
  'FmoEvents',
  'FmoAprs',
  'FmoGrid',
  'FmoLocation',
  'FmoSystemUi',
  'FmoUpdater'
] as const

export function isAndroidNativeRuntimeAvailable(): boolean {
  try {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return false
    }

    return REQUIRED_ANDROID_PLUGINS.every((pluginName) =>
      Capacitor.isPluginAvailable(pluginName)
    )
  } catch (err) {
    console.warn('[Platform] 检测 Android 原生桥失败，将使用 Web 模式:', err)
    return false
  }
}

/**
 * 返回应用实际采用的平台，而不是 WebView 容器声明的平台。
 */
export function getEffectivePlatform(): 'android' | 'web' {
  return isAndroidNativeRuntimeAvailable() ? 'android' : 'web'
}
