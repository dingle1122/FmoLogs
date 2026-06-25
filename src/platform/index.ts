import type {
  IAprsService,
  IAudioService,
  IBackgroundService,
  ICapabilities,
  IEventsService,
  IGridService,
  ILocationService,
  IStorageService
} from './interfaces'
import { createWebPlatform } from './web'
import { createNativePlatform } from './native-capacitor'
import { isAndroidNativeRuntimeAvailable } from './runtime'

export interface Platform {
  events: IEventsService
  audio: IAudioService
  aprs: IAprsService
  grid: IGridService
  background: IBackgroundService
  location: ILocationService
  storage: IStorageService
  capabilities: ICapabilities
}

let instance: Platform | null = null

/**
 * 获取当前平台实例（单例）。
 * - Android 且原生插件完整可用：Capacitor 原生实现
 * - 原生桥初始化失败、插件缺失、Web / Tauri 桌面：Web 实现
 */
export function getPlatform(): Platform {
  if (instance) return instance
  const useNativeAndroid = isAndroidNativeRuntimeAvailable()
  instance = useNativeAndroid ? createNativePlatform() : createWebPlatform()

  if (!useNativeAndroid) {
    console.info('[Platform] 使用 Web 平台实现')
  }
  return instance
}

/** 仅测试用：重置单例 */
export function __resetPlatform(): void {
  instance = null
}

export type {
  IAprsService,
  IAudioService,
  IBackgroundService,
  ICapabilities,
  IEventsService,
  IGridService,
  ILocationService,
  IStorageService
}

export {
  getEffectivePlatform,
  isAndroidNativeRuntimeAvailable
} from './runtime'
