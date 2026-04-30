import type { IStorageService } from '../interfaces/IStorageService'

/**
 * Android 原生端存储。
 * PR-5 改为 @capacitor/preferences；骨架阶段先使用 localStorage（Capacitor WebView 可用）。
 */
export class NativeStorageService implements IStorageService {
  async get(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }
  async set(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value)
    } catch (e) {
      console.warn('[NativeStorageService] set failed:', e)
    }
  }
  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(key)
    } catch {
      // 忽略
    }
  }
}
