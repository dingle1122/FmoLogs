import type { ILocationService, PermissionCheckResult } from '../interfaces/ILocationService'

export class WebLocationService implements ILocationService {
  async checkPermission(): Promise<PermissionCheckResult> {
    return { granted: false, notificationGranted: false, backgroundGranted: false, needRationale: false }
  }

  async requestPermission(): Promise<boolean> {
    return false
  }

  async requestBackgroundPermission(): Promise<boolean> {
    return false
  }

  async getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null> {
    return null
  }

  async startWatching(_intervalSeconds: number): Promise<void> {
    // no-op
  }

  async stopWatching(): Promise<void> {
    // no-op
  }

  async startForegroundService(_title: string, _text: string, _intervalMinutes: number): Promise<void> {
    // no-op
  }

  async stopForegroundService(): Promise<void> {
    // no-op
  }

  onLocation(_callback: (pos: { latitude: number; longitude: number }) => void): void {
    // no-op
  }
}
