import type { ILocationService, PermissionCheckResult } from '../interfaces/ILocationService'
import { Capacitor } from '@capacitor/core'
import { registerPlugin } from '@capacitor/core'

interface FmoLocationPlugin {
  checkPermission(): Promise<{ granted: boolean; notificationGranted: boolean; backgroundGranted: boolean; needRationale: boolean }>
  requestPermission(): Promise<{ granted: boolean }>
  requestBackgroundPermission(): Promise<{ granted: boolean }>
  getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null>
  startWatching(options: { intervalSeconds: number }): Promise<void>
  stopWatching(): Promise<void>
  startForegroundService(options: { title: string; text: string; intervalMinutes: number }): Promise<void>
  stopForegroundService(): Promise<void>
  addListener(eventName: string, callback: (data: any) => void): void
}

const Location = registerPlugin<FmoLocationPlugin>('FmoLocation')

export class NativeLocationService implements ILocationService {
  private locationCallbacks: Array<(pos: { latitude: number; longitude: number }) => void> = []

  constructor() {
    // 监听原生 location 事件，分发给所有注册的回调
    Location.addListener('location', (data: { latitude: number; longitude: number }) => {
      if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        for (const cb of this.locationCallbacks) {
          try {
            cb({ latitude: data.latitude, longitude: data.longitude })
          } catch {
            // 忽略回调异常
          }
        }
      }
    })
  }

  async checkPermission(): Promise<PermissionCheckResult> {
    try {
      const result = await Location.checkPermission()
      return {
        granted: result.granted === true,
        notificationGranted: result.notificationGranted !== false,
        backgroundGranted: result.backgroundGranted !== false,
        needRationale: result.needRationale === true
      }
    } catch {
      return { granted: false, notificationGranted: false, backgroundGranted: false, needRationale: false }
    }
  }

  async requestPermission(): Promise<boolean> {
    try {
      const result = await Location.requestPermission()
      return result.granted === true
    } catch {
      return false
    }
  }

  async requestBackgroundPermission(): Promise<boolean> {
    try {
      const result = await Location.requestBackgroundPermission()
      return result.granted === true
    } catch {
      return false
    }
  }

  async getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null> {
    try {
      return await Location.getCurrentPosition()
    } catch {
      return null
    }
  }

  async startWatching(intervalSeconds: number): Promise<void> {
    await Location.startWatching({ intervalSeconds })
  }

  async stopWatching(): Promise<void> {
    await Location.stopWatching()
  }

  async startForegroundService(title: string, text: string, intervalMinutes: number): Promise<void> {
    await Location.startForegroundService({ title, text, intervalMinutes })
  }

  async stopForegroundService(): Promise<void> {
    await Location.stopForegroundService()
  }

  onLocation(callback: (pos: { latitude: number; longitude: number }) => void): void {
    this.locationCallbacks.push(callback)
  }
}
