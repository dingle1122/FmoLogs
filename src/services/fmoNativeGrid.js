import { registerPlugin } from '@capacitor/core'

/**
 * FmoGrid: 原生 Maidenhead 网格→地址解析插件桥接
 *
 * 方法：
 * - gridToAddress({ grid }) → Promise<{ grid, country, province, city, district, township }>
 *   三级缓存：内存 LRU → SQLite 持久化 → 远程 API；数据跟随应用安装期长期保存。
 * - clearCache() → Promise<void>
 *   清空内存与 SQLite 缓存。
 *
 * 仅在 Android 原生环境可用，Web 端仍走 gridService.js 内部的 IndexedDB + 内存实现。
 */
export const FmoGrid = registerPlugin('FmoGrid')
