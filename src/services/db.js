import initSqlJs from 'sql.js'

let SQL = null

// 初始化sql.js
async function initSQL() {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: () => '/sql-wasm.wasm'
    })
  }
  return SQL
}

// IndexedDB存储目录句柄
const DB_NAME = 'FmoLogsStorage'
const STORE_NAME = 'dirHandles'

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

// 保存目录句柄到本地
export async function saveDirHandle(dirHandle) {
  const db = await openIndexedDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(dirHandle, 'currentDir')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// 从本地获取目录句柄
export async function getSavedDirHandle() {
  try {
    const db = await openIndexedDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get('currentDir')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
  } catch {
    return null
  }
}

// 清除保存的目录句柄
export async function clearDirHandle() {
  const db = await openIndexedDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete('currentDir')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// 从目录句柄加载数据库文件
export async function loadDbFilesFromHandle(dirHandle) {
  const dbFiles = []
  const permission = await dirHandle.queryPermission({ mode: 'read' })

  if (permission !== 'granted') {
    const newPermission = await dirHandle.requestPermission({ mode: 'read' })
    if (newPermission !== 'granted') {
      throw new Error('需要目录访问权限')
    }
  }

  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.db')) {
      const file = await entry.getFile()
      const arrayBuffer = await file.arrayBuffer()
      dbFiles.push({
        name: entry.name,
        data: new Uint8Array(arrayBuffer)
      })
    }
  }

  return dbFiles
}

// 请求目录访问权限并扫描.db文件
export async function scanDirectory() {
  try {
    const dirHandle = await window.showDirectoryPicker()
    await saveDirHandle(dirHandle)
    return await loadDbFilesFromHandle(dirHandle)
  } catch (err) {
    if (err.name === 'AbortError') {
      return null // 用户取消
    }
    throw err
  }
}

// 查询类型定义
export const QueryTypes = {
  ALL: 'all',
  TO_CALLSIGN: 'toCallsign',
  RELAY_NAME: 'relayName',
  TO_GRID: 'toGrid'
}

// 查询语句
const QUERIES = {
  [QueryTypes.ALL]: 'SELECT * FROM qso_logs ORDER BY timestamp DESC',
  [QueryTypes.TO_CALLSIGN]:
    'SELECT toCallsign, COUNT(*) as count FROM qso_logs GROUP BY toCallsign ORDER BY count DESC',
  [QueryTypes.RELAY_NAME]:
    'SELECT relayName, relayAdmin, COUNT(*) as count FROM qso_logs GROUP BY relayName, relayAdmin ORDER BY count DESC',
  [QueryTypes.TO_GRID]:
    'SELECT toGrid, COUNT(*) as count FROM qso_logs GROUP BY toGrid ORDER BY count DESC'
}

// 查询类型名称映射
export const QueryTypeNames = {
  [QueryTypes.ALL]: '查看所有',
  [QueryTypes.TO_CALLSIGN]: '接收方呼号',
  [QueryTypes.RELAY_NAME]: '中继名称',
  [QueryTypes.TO_GRID]: '接收网格'
}

// 表头中文映射
export const ColumnNames = {
  timestamp: '日期',
  freqHz: '频率(MHz)',
  fromCallsign: '发送方呼号',
  fromGrid: '发送网格',
  toCallsign: '接收方呼号',
  toGrid: '接收网格',
  toComment: '留言',
  mode: '模式',
  relayName: '中继',
  count: '计数'
}

// 格式化频率（Hz转MHz，除以10000）
export function formatFreqHz(freqHz) {
  if (!freqHz) return ''
  return (freqHz / 10000).toFixed(4)
}

// 格式化时间戳
export function formatTimestamp(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// 数据库管理类
export class DatabaseManager {
  constructor() {
    this.databases = []
    this.totalLogs = 0
  }

  // 加载数据库文件
  async loadDatabases(dbFiles) {
    await initSQL()
    this.databases = []
    this.totalLogs = 0

    for (const file of dbFiles) {
      try {
        const db = new SQL.Database(file.data)
        this.databases.push({
          name: file.name,
          db: db
        })
      } catch (err) {
        console.error(`加载数据库 ${file.name} 失败:`, err)
      }
    }

    // 计算总日志数
    this.totalLogs = this.getTotalLogCount()

    return this.databases.length
  }

  // 获取总日志数
  getTotalLogCount() {
    let total = 0
    for (const { db } of this.databases) {
      try {
        const result = db.exec('SELECT COUNT(*) as count FROM qso_logs')
        if (result.length > 0 && result[0].values.length > 0) {
          total += result[0].values[0][0]
        }
      } catch (err) {
        console.error('获取日志数失败:', err)
      }
    }
    return total
  }

  // 执行查询
  query(queryType, page = 1, pageSize = 20, searchKeyword = '') {
    let sql = QUERIES[queryType]
    if (!sql) {
      throw new Error(`未知的查询类型: ${queryType}`)
    }

    // 如果有搜索关键字，修改SQL添加WHERE条件
    if (searchKeyword && queryType === QueryTypes.ALL) {
      sql = `SELECT * FROM qso_logs WHERE toCallsign LIKE '%${searchKeyword}%' ORDER BY timestamp DESC`
    }

    const allResults = []

    for (const { db } of this.databases) {
      try {
        const result = db.exec(sql)
        if (result.length > 0) {
          const columns = result[0].columns
          const values = result[0].values

          for (const row of values) {
            const rowObj = {}
            columns.forEach((col, index) => {
              rowObj[col] = row[index]
            })
            allResults.push(rowObj)
          }
        }
      } catch (err) {
        console.error('查询失败:', err)
      }
    }

    // 对于分组查询，需要合并结果
    if (queryType !== QueryTypes.ALL) {
      return this.mergeGroupedResults(allResults, queryType)
    }

    // 对于"查看所有"查询，按日期降序排序后分页
    allResults.sort((a, b) => b.timestamp - a.timestamp)

    const total = allResults.length
    const totalPages = Math.ceil(total / pageSize)
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const data = allResults.slice(start, end)

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
      columns: [
        'timestamp',
        'freqHz',
        'fromCallsign',
        'fromGrid',
        'toCallsign',
        'toGrid',
        'toComment',
        'mode',
        'relayName'
      ]
    }
  }

  // 合并分组查询结果
  mergeGroupedResults(results, queryType) {
    const merged = new Map()

    let keyFields = []
    if (queryType === QueryTypes.TO_CALLSIGN) {
      keyFields = ['toCallsign']
    } else if (queryType === QueryTypes.RELAY_NAME) {
      keyFields = ['relayName', 'relayAdmin']
    } else if (queryType === QueryTypes.TO_GRID) {
      keyFields = ['toGrid']
    }

    for (const row of results) {
      const key = keyFields.map((f) => row[f] || '').join('|')
      if (merged.has(key)) {
        merged.get(key).count += row.count
      } else {
        merged.set(key, { ...row })
      }
    }

    const data = Array.from(merged.values()).sort((a, b) => b.count - a.count)

    // 对于中继名称查询，只返回relayName列（relayAdmin用于合并显示）
    let displayColumns = keyFields
    if (queryType === QueryTypes.RELAY_NAME) {
      displayColumns = ['relayName']
    }

    return {
      data,
      total: data.length,
      columns: [...displayColumns, 'count']
    }
  }

  // 关闭所有数据库
  close() {
    for (const { db } of this.databases) {
      db.close()
    }
    this.databases = []
  }
}
