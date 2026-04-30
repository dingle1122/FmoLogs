import type {
  IEventsService,
  EventsConnectConfig
} from '../interfaces/IEventsService'
import type {
  EventsSnapshot,
  EventsStatus,
  ServerInfo
} from '../types/speaking'

/**
 * Android 原生事件服务。
 * PR-0 骨架阶段占位；PR-3 填充：包装 FmoEvents 插件（connect/disconnect/addListener/getSnapshot）。
 */
export class NativeEventsService implements IEventsService {
  private msgListeners = new Set<(addressId: string, data: string) => void>()
  private statusListeners = new Set<(addressId: string, s: EventsStatus) => void>()
  private infoListeners = new Set<(addressId: string, info: ServerInfo) => void>()

  async connect(_cfg: EventsConnectConfig): Promise<void> {
    throw new Error('NativeEventsService 尚未实现（将在 PR-3 完成）')
  }
  async disconnect(_addressId: string): Promise<void> {
    /* no-op */
  }
  async disconnectAll(): Promise<void> {
    /* no-op */
  }
  async setPrimary(_addressId: string): Promise<void> {
    /* no-op */
  }
  async refreshServerInfo(_addressId: string): Promise<void> {
    /* no-op */
  }
  async getSnapshot(_addressId?: string): Promise<EventsSnapshot> {
    return { connections: [] }
  }
  async updateServerName(_addressId: string, _name: string): Promise<void> {
    /* no-op */
  }
  onMessage(cb: (addressId: string, data: string) => void) {
    this.msgListeners.add(cb)
    return () => this.msgListeners.delete(cb)
  }
  onStatus(cb: (addressId: string, status: EventsStatus) => void) {
    this.statusListeners.add(cb)
    return () => this.statusListeners.delete(cb)
  }
  onServerInfo(cb: (addressId: string, info: ServerInfo) => void) {
    this.infoListeners.add(cb)
    return () => this.infoListeners.delete(cb)
  }
}
