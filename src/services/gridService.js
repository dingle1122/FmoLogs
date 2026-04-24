const GRID_DB_NAME = 'FmoGridCache'
const GRID_STORE_NAME = 'gridCache'
const GRID_DB_VERSION = 1
const API_BASE_URL = 'https://grid.lzyike.cn'

let dbInstance = null
let dbPromise = null

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
export function normalizeGrid(grid) {
  if (!grid) return ''
  return grid.trim().toUpperCase()
}

/**
 * 验证 Grid 格式是否符合 Maidenhead 规范
 * @param {string} grid
 * @returns {{valid: boolean, grid?: string, error?: string}}
 */
export function validateGrid(grid) {
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
 * Grid 转地址（优先本地缓存，否则请求远程 API）
 *
 * @param {string} grid - Maidenhead 网格编码
 * @param {Object} options
 * @param {boolean} [options.skipCache=false] - 是否跳过本地缓存强制请求远程
 * @returns {Promise<{retcode: number, retmsg: string, data: Object, fromCache?: boolean}>}
 *
 * @example
 * const result = await gridToAddress('PM00AA')
 * // {
 * //   retcode: 0,
 * //   retmsg: 'success',
 * //   data: { grid: 'PM00AA', country: '中国', province: '北京市', city: '北京市', district: '朝阳区', township: '望京街道' },
 * //   fromCache: false
 * // }
 */
export async function gridToAddress(grid, options = {}) {
  const { skipCache = false } = options

  // 本地格式校验
  const validation = validateGrid(grid)
  if (!validation.valid) {
    throw new Error(`grid 格式错误: ${validation.error}`)
  }

  const normalizedGrid = validation.grid

  // 1. 优先读取本地缓存
  if (!skipCache) {
    try {
      const cached = await getCachedGridAddress(normalizedGrid)
      if (cached) {
        return {
          retcode: 0,
          retmsg: 'success (from cache)',
          data: cached,
          fromCache: true
        }
      }
    } catch (err) {
      console.warn('[gridService] 读取本地缓存失败:', err)
    }
  }

  // 2. 请求远程 API
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

  // 3. 写入本地缓存（失败不影响返回结果）
  try {
    await saveGridAddress(normalizedGrid, result.data)
  } catch (err) {
    console.warn('[gridService] 保存本地缓存失败:', err)
  }

  return {
    ...result,
    fromCache: false
  }
}

/**
 * 清空所有 Grid 缓存数据
 */
export async function clearGridCache() {
  return new Promise((resolve, reject) => {
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
}
