import type { IGridService } from '../interfaces/IGridService'
import type { GridAddress } from '../types/grid'
import { registerPlugin } from '@capacitor/core'
import { WebGridService } from '../web/GridService.web'

/**
 * Android 原生 Grid 插件。
 * 原生侧统一走「内存 LRU → SQLite 持久化 → 远程 API」三级缓存。
 */
interface FmoGridPlugin {
  gridToAddress(opts: { grid: string }): Promise<GridAddress>
  clearCache(): Promise<void>
}

const FmoGrid = registerPlugin<FmoGridPlugin>('FmoGrid')

export class NativeGridService implements IGridService {
  private fallback = new WebGridService()
  private nativeUnavailable = false

  private markNativeUnavailable(err: unknown) {
    if (!this.nativeUnavailable) {
      console.warn('[Grid] native FmoGrid unavailable, falling back to fetch', err)
    }
    this.nativeUnavailable = true
  }

  async gridToAddress(grid: string): Promise<GridAddress | null> {
    if (this.nativeUnavailable) return this.fallback.gridToAddress(grid)
    try {
      const result = await FmoGrid.gridToAddress({ grid })
      return result ?? null
    } catch (err) {
      this.markNativeUnavailable(err)
      return this.fallback.gridToAddress(grid)
    }
  }

  async clearCache(): Promise<void> {
    if (this.nativeUnavailable) {
      await this.fallback.clearCache()
      return
    }
    try {
      await FmoGrid.clearCache()
    } catch (err) {
      this.markNativeUnavailable(err)
      await this.fallback.clearCache()
    }
  }
}
