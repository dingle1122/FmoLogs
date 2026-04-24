const GRID_DB_NAME = 'FmoGridCache'
const GRID_STORE_NAME = 'gridCache'
const GRID_DB_VERSION = 1
const API_BASE_URL = 'https://grid.lzyike.cn'

let dbInstance = null
let dbPromise = null

// 内存缓存，减少对 IndexedDB 的频繁读取
const memoryCache = new Map()

// 内存缓存 TTL：30 分钟
const MEMORY_CACHE_TTL = 30 * 60 * 1000
// 清理间隔：5 分钟
const MEMORY_CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000

/**
 * 清理内存缓存中过期的数据
 */
function cleanupMemoryCache() {
  const now = Date.now()
  for (const [key, entry] of memoryCache.entries()) {
    if (now - entry.timestamp > MEMORY_CACHE_TTL) {
      memoryCache.delete(key)
    }
  }
}

// 启动定时清理
setInterval(cleanupMemoryCache, MEMORY_CACHE_CLEANUP_INTERVAL)

// ========== 并发控制与频率限制 ==========

/**
 * Grid 级别并发锁
 * key: normalizedGrid, value: Promise（锁释放时 resolve）
 */
const gridLocks = new Map()

/**
 * 获取指定 grid 的独占锁
 * @param {string} grid
 * @returns {Promise<Function>} 返回释放锁的函数
 */
async function acquireGridLock(grid) {
  while (gridLocks.has(grid)) {
    await gridLocks.get(grid)
  }
  let release
  const promise = new Promise((resolve) => {
    release = resolve
  })
  gridLocks.set(grid, promise)
  return () => {
    gridLocks.delete(grid)
    release()
  }
}

/**
 * API 频率限制器（2次/秒）
 */
const rateLimiter = {
  promise: Promise.resolve(),
  lastTime: 0,
  minInterval: 600, // 1000ms / 2 = 500ms

  async acquire() {
    let resolveNext
    const newPromise = new Promise((resolve) => {
      resolveNext = resolve
    })
    const prevPromise = this.promise
    this.promise = newPromise

    await prevPromise

    const now = Date.now()
    const wait = Math.max(0, this.lastTime + this.minInterval - now)
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait))
    }
    this.lastTime = Date.now()
    resolveNext()
  }
}

/**
 * 打开或初始化 Grid 缓存数据库
 */
function openGridDatabase() {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(GRID_DB_NAME, GRID_DB_VERSION)

    request.onerror = () => {
      dbPromise = null
      reject(request.error)
    }

    request.onsuccess = () => {
      dbInstance = request.result
      dbInstance.onversionchange = () => {
        dbInstance.close()
        dbInstance = null
        dbPromise = null
      }
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(GRID_STORE_NAME)) {
        db.createObjectStore(GRID_STORE_NAME, { keyPath: 'grid' })
      }
    }
  })

  return dbPromise
}

/**
 * 从本地缓存获取 Grid 地址信息
 * @param {string} grid - Maidenhead 网格编码
 * @returns {Promise<Object|null>} 缓存数据或 null
 */
async function getCachedGridAddress(grid) {
  const normalizedGrid = normalizeGrid(grid)
  const db = await openGridDatabase()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(GRID_STORE_NAME, 'readonly')
    const store = tx.objectStore(GRID_STORE_NAME)
    const request = store.get(normalizedGrid)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const result = request.result
      if (result && result.data) {
        resolve(result.data)
      } else {
        resolve(null)
      }
    }
  })
}

/**
 * 将 Grid 地址信息保存到本地缓存
 * @param {string} grid - Maidenhead 网格编码
 * @param {Object} data - API 返回的 data 字段
 */
async function saveGridAddress(grid, data) {
  const normalizedGrid = normalizeGrid(grid)
  const db = await openGridDatabase()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(GRID_STORE_NAME, 'readwrite')
    const store = tx.objectStore(GRID_STORE_NAME)
    const request = store.put({
      grid: normalizedGrid,
      data,
      cachedAt: Date.now()
    })

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * 标准化 Grid 编码（去空白、转大写）
 * @param {string} grid
 * @returns {string}
 */
function normalizeGrid(grid) {
  if (!grid) return ''
  return grid.trim().toUpperCase()
}

/**
 * 验证 Grid 格式是否符合 Maidenhead 规范
 * @param {string} grid
 * @returns {{valid: boolean, grid?: string, error?: string}}
 */
function validateGrid(grid) {
  if (!grid) {
    return { valid: false, error: '缺少 grid 参数' }
  }

  const normalized = normalizeGrid(grid)

  if (normalized.length < 4 || normalized.length > 8 || normalized.length % 2 !== 0) {
    return { valid: false, error: 'grid 长度必须在 4-8 字符之间且为偶数长度' }
  }

  // Field: 1-2位，A-R
  const fieldPart = normalized.substring(0, 2)
  if (!/^[A-R]{2}$/.test(fieldPart)) {
    return { valid: false, error: 'grid 前两位必须是 A-R 之间的字母' }
  }

  // Square: 3-4位，0-9
  const squarePart = normalized.substring(2, 4)
  if (!/^[0-9]{2}$/.test(squarePart)) {
    return { valid: false, error: 'grid 第3-4位必须是数字' }
  }

  // Subsquare (可选): 5-6位，A-X
  if (normalized.length >= 6) {
    const subSquarePart = normalized.substring(4, 6)
    if (!/^[A-X]{2}$/.test(subSquarePart)) {
      return { valid: false, error: 'grid 第5-6位必须是 A-X 之间的字母' }
    }
  }

  // Extended square (可选): 7-8位，0-9
  if (normalized.length >= 8) {
    const extSquarePart = normalized.substring(6, 8)
    if (!/^[0-9]{2}$/.test(extSquarePart)) {
      return { valid: false, error: 'grid 第7-8位必须是数字' }
    }
  }

  return { valid: true, grid: normalized }
}

/**
 * Grid 转地址（内存缓存 → IndexedDB → 远程 API）
 *
 * @param {string} grid - Maidenhead 网格编码
 * @returns {Promise<Object>} 地址数据对象
 *
 * @example
 * const data = await gridToAddress('PM00AA')
 * // { grid: 'PM00AA', country: '中国', province: '北京市', city: '北京市', district: '朝阳区', township: '望京街道' }
 */
export async function gridToAddress(grid) {
  // 本地格式校验
  const validation = validateGrid(grid)
  if (!validation.valid) {
    throw new Error(`grid 格式错误: ${validation.error}`)
  }

  const normalizedGrid = validation.grid

  // 1. 优先读取内存缓存（无锁快速路径）
  const memEntry = memoryCache.get(normalizedGrid)
  if (memEntry) {
    return memEntry.data
  }

  // 2. 获取该 grid 的并发锁
  const release = await acquireGridLock(normalizedGrid)

  try {
    // 3. 获取锁后再次检查内存缓存（双重检查，防止等锁期间其他请求已写入）
    const memEntry = memoryCache.get(normalizedGrid)
    if (memEntry) {
      return memEntry.data
    }

    // 4. 再检查 IndexedDB
    try {
      const cached = await getCachedGridAddress(normalizedGrid)
      if (cached) {
        memoryCache.set(normalizedGrid, { data: cached, timestamp: Date.now() })
        return cached
      }
    } catch (err) {
      console.warn('[gridService] 读取本地缓存失败:', err)
    }

    // 5. 频率限制（2次/秒）
    await rateLimiter.acquire()

    // 6. 请求远程 API
    let response
    try {
      response = await fetch(`${API_BASE_URL}/api/grid2addr/${encodeURIComponent(normalizedGrid)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      })
    } catch (err) {
      throw new Error(`grid 转换失败: 网络请求异常 (${err.message})`)
    }

    // 处理限流
    if (response.status === 429) {
      throw new Error('请求过于频繁，请稍后再试')
    }

    // 处理非 2xx 响应
    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`
      try {
        const errorData = await response.json()
        if (errorData.retmsg) errorMsg = errorData.retmsg
      } catch {
        // 忽略 JSON 解析失败，使用默认错误信息
      }
      throw new Error(`调用 grid2addr API 失败: ${errorMsg}`)
    }

    const result = await response.json()

    if (result.retcode !== 0 || !result.data) {
      throw new Error(result.retmsg || 'grid 转换失败')
    }

    // 7. 写入内存缓存和本地缓存（失败不影响返回结果）
    memoryCache.set(normalizedGrid, { data: result.data, timestamp: Date.now() })
    try {
      await saveGridAddress(normalizedGrid, result.data)
    } catch (err) {
      console.warn('[gridService] 保存本地缓存失败:', err)
    }

    return result.data
  } finally {
    // 8. 释放锁
    release()
  }
}

/**
 * 清空所有 Grid 缓存数据（先 IndexedDB，后内存缓存）
 */
export async function clearGridCache() {
  // 1. 先清理 IndexedDB
  await new Promise((resolve, reject) => {
    if (dbInstance) {
      try {
        dbInstance.close()
      } catch {
        // ignore
      }
      dbInstance = null
    }
    dbPromise = null

    const request = indexedDB.deleteDatabase(GRID_DB_NAME)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
    request.onblocked = () => {
      console.warn('[gridService] 删除 Grid 缓存数据库被阻塞')
      resolve()
    }
  })

  // 2. 再清理内存缓存
  memoryCache.clear()
}
