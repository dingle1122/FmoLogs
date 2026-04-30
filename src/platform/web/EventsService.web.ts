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
 * Web/Tauri 桌面端事件服务。
 * PR-0 骨架阶段仅占位；PR-3 会把 composables/useSpeakingStatus.js 中 Web 分支
 * （多 addressId 连接管理、重连、primary 轮询 station:getCurrent）完整搬入本文件。
 */
export class WebEventsService implements IEventsService {
  private msgListeners = new Set<(addressId: string, data: string) => void>()
  private statusListeners = new Set<(addressId: string, s: EventsStatus) => void>()
  private infoListeners = new Set<(addressId: string, info: ServerInfo) => void>()

  async connect(_cfg: EventsConnectConfig): Promise<void> {
    throw new Error('WebEventsService 尚未实现（将在 PR-3 完成）')
  }

  async disconnect(_addressId: string): Promise<void> {
    /* no-op in skeleton */
  }

  async disconnectAll(): Promise<void> {
    /* no-op in skeleton */
  }

  async setPrimary(_addressId: string): Promise<void> {
    /* no-op in skeleton */
  }

  async refreshServerInfo(_addressId: string): Promise<void> {
    /* no-op in skeleton */
  }

  async getSnapshot(_addressId?: string): Promise<EventsSnapshot> {
    return { connections: [] }
  }

  async updateServerName(_addressId: string, _name: string): Promise<void> {
    /* Web 无需缓存 */
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
