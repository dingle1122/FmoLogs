import { registerPlugin } from '@capacitor/core'
import type { IEventsService, EventsConnectConfig } from '../interfaces/IEventsService'
import type { EventsSnapshot, EventsStatus, ServerInfo } from '../types/speaking'
import { WebEventsService } from '../web/EventsService.web'

/**
 * FmoEvents 原生插件契约（Android）。
 *
 * - connect({ addressId, url, apiUrl }): 建立一条连接，apiUrl 用于原生轮询 station:getCurrent
 * - disconnect({ addressId }) / disconnectAll()
 * - setPrimary({ addressId }): 切换主地址（影响通知栏文案）
 * - refreshServerInfo({ addressId }): 立即触发一次服务器信息查询
 * - getSnapshot({ addressId? }): 拉取某一条/全部连接的发言状态快照
 * - updateServerName({ addressId, name }): 业务侧缓存已知服务器名，避免通知栏空窗
 * - addListener('message'|'status'|'serverInfo', cb)
 */
interface FmoEventsPlugin {
  connect(params: { addressId: string; url: string; apiUrl: string }): Promise<void>
  disconnect(params: { addressId: string }): Promise<void>
  disconnectAll(): Promise<void>
  setPrimary(params: { addressId: string }): Promise<void>
  refreshServerInfo(params: { addressId: string }): Promise<void>
  getSnapshot(params: { addressId?: string }): Promise<any>
  updateServerName(params: { addressId: string; name: string }): Promise<void>
  addListener(
    event: 'message' | 'status' | 'serverInfo',
    cb: (data: any) => void
  ): Promise<{ remove: () => Promise<void> }>
}

const FmoEvents = registerPlugin<FmoEventsPlugin>('FmoEvents')

/**
 * Android 原生事件服务。底层为 FmoEventsPlugin（Kotlin 侧独立维护 WebSocket 连接池，
 * 在 JS 冻结/后台场景依然保活）。
 */
export class NativeEventsService implements IEventsService {
  private msgListeners = new Set<(addressId: string, data: string) => void>()
  private statusListeners = new Set<(addressId: string, s: EventsStatus) => void>()
  private infoListeners = new Set<(addressId: string, info: ServerInfo) => void>()
  private fallback = new WebEventsService()

  private msgHandle: { remove: () => Promise<void> } | null = null
  private statusHandle: { remove: () => Promise<void> } | null = null
  private infoHandle: { remove: () => Promise<void> } | null = null
  private listenersInstalled = false
  private fallbackListenersInstalled = false
  private nativeUnavailable = false

  private markNativeUnavailable(err: unknown) {
    if (!this.nativeUnavailable) {
      console.warn('[Events] native FmoEvents unavailable, falling back to WebSocket', err)
    }
    this.nativeUnavailable = true
    this.installFallbackListeners()
  }

  private installFallbackListeners() {
    if (this.fallbackListenersInstalled) return
    this.fallbackListenersInstalled = true
    this.fallback.onMessage((addressId, data) => {
      for (const cb of this.msgListeners) {
        try {
          cb(addressId, data)
        } catch (err) {
          console.warn('[Events] fallback msg listener error', err)
        }
      }
    })
    this.fallback.onStatus((addressId, status) => {
      for (const cb of this.statusListeners) {
        try {
          cb(addressId, status)
        } catch (err) {
          console.warn('[Events] fallback status listener error', err)
        }
      }
    })
    this.fallback.onServerInfo((addressId, info) => {
      for (const cb of this.infoListeners) {
        try {
          cb(addressId, info)
        } catch (err) {
          console.warn('[Events] fallback info listener error', err)
        }
      }
    })
  }

  private installListeners() {
    if (this.listenersInstalled) return
    this.listenersInstalled = true
    FmoEvents.addListener('message', (payload: any) => {
      const { addressId, data } = payload || {}
      if (!addressId) return
      for (const cb of this.msgListeners) {
        try {
          cb(addressId, data)
        } catch (err) {
          console.warn('[Events] msg listener error', err)
        }
      }
    })
      .then((h) => {
        this.msgHandle = h
      })
      .catch((err) => this.markNativeUnavailable(err))

    FmoEvents.addListener('status', (payload: any) => {
      const { addressId, status } = payload || {}
      if (!addressId) return
      for (const cb of this.statusListeners) {
        try {
          cb(addressId, status as EventsStatus)
        } catch (err) {
          console.warn('[Events] status listener error', err)
        }
      }
    })
      .then((h) => {
        this.statusHandle = h
      })
      .catch((err) => this.markNativeUnavailable(err))

    FmoEvents.addListener('serverInfo', (payload: any) => {
      const { addressId, uid, name } = payload || {}
      if (!addressId || !uid) return
      for (const cb of this.infoListeners) {
        try {
          cb(addressId, { uid, name: name || '' })
        } catch (err) {
          console.warn('[Events] info listener error', err)
        }
      }
    })
      .then((h) => {
        this.infoHandle = h
      })
      .catch((err) => this.markNativeUnavailable(err))
  }

  async connect(cfg: EventsConnectConfig): Promise<void> {
    this.installListeners()
    if (this.nativeUnavailable) {
      await this.fallback.connect(cfg)
      return
    }
    try {
      await FmoEvents.connect({
        addressId: cfg.addressId,
        url: cfg.url,
        apiUrl: cfg.apiUrl
      })
    } catch (err) {
      this.markNativeUnavailable(err)
      await this.fallback.connect(cfg)
    }
  }

  async disconnect(addressId: string): Promise<void> {
    if (this.nativeUnavailable) {
      await this.fallback.disconnect(addressId)
      return
    }
    try {
      await FmoEvents.disconnect({ addressId })
    } catch (err) {
      console.warn(`[Events] disconnect(${addressId}) failed`, err)
      this.markNativeUnavailable(err)
      await this.fallback.disconnect(addressId)
    }
  }

  async disconnectAll(): Promise<void> {
    if (this.nativeUnavailable) {
      await this.fallback.disconnectAll()
      return
    }
    try {
      await FmoEvents.disconnectAll()
    } catch (err) {
      console.warn('[Events] disconnectAll failed', err)
      this.markNativeUnavailable(err)
      await this.fallback.disconnectAll()
    }
  }

  async setPrimary(addressId: string): Promise<void> {
    if (this.nativeUnavailable) {
      await this.fallback.setPrimary(addressId)
      return
    }
    try {
      await FmoEvents.setPrimary({ addressId: addressId || '' })
    } catch (err) {
      this.markNativeUnavailable(err)
      await this.fallback.setPrimary(addressId)
    }
  }

  async refreshServerInfo(addressId: string): Promise<void> {
    if (this.nativeUnavailable) {
      await this.fallback.refreshServerInfo(addressId)
      return
    }
    try {
      await FmoEvents.refreshServerInfo({ addressId })
    } catch (err) {
      this.markNativeUnavailable(err)
      await this.fallback.refreshServerInfo(addressId)
    }
  }

  async getSnapshot(addressId?: string): Promise<EventsSnapshot> {
    if (this.nativeUnavailable) {
      return this.fallback.getSnapshot(addressId)
    }
    try {
      const payload = addressId ? { addressId } : {}
      const snapshot: any = await FmoEvents.getSnapshot(payload)
      const list = (snapshot && snapshot.connections) || []
      return { connections: list }
    } catch (err) {
      console.warn('[Events] getSnapshot failed', err)
      this.markNativeUnavailable(err)
      return { connections: [] }
    }
  }

  async updateServerName(addressId: string, name: string): Promise<void> {
    if (!addressId || !name) return
    if (this.nativeUnavailable) {
      await this.fallback.updateServerName(addressId, name)
      return
    }
    try {
      await FmoEvents.updateServerName({ addressId, name })
    } catch (err) {
      this.markNativeUnavailable(err)
      await this.fallback.updateServerName(addressId, name)
    }
  }

  onMessage(cb: (addressId: string, data: string) => void) {
    this.installListeners()
    this.msgListeners.add(cb)
    return () => this.msgListeners.delete(cb)
  }
  onStatus(cb: (addressId: string, status: EventsStatus) => void) {
    this.installListeners()
    this.statusListeners.add(cb)
    return () => this.statusListeners.delete(cb)
  }
  onServerInfo(cb: (addressId: string, info: ServerInfo) => void) {
    this.installListeners()
    this.infoListeners.add(cb)
    return () => this.infoListeners.delete(cb)
  }
}
