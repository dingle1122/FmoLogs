import initSqlJs from 'sql.js'

let SQL = null

// 初始化sql.js（使用CDN加载wasm文件）
async function initSQL() {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: () => 'https://cdn.lzyike.cn/npm/sql.js@1.13.0/dist/sql-wasm.wasm'
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
  await initSQL() // 确保SQL已经初始化

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
      const uint8Array = new Uint8Array(arrayBuffer)

      try {
        // 尝试打开数据库以验证其有效性
        const db = new SQL.Database(uint8Array)

        // 尝试执行一个简单的查询来确认这是有效的SQLite数据库
        db.exec('SELECT 1')

        // 验证数据库是否包含预期的表（例如 qso_logs 表）
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table';")
        const hasQsoLogsTable = tables.some((table) =>
          table.values.some((row) => row.includes('qso_logs'))
        )

        if (hasQsoLogsTable) {
          dbFiles.push({
            name: entry.name,
            data: uint8Array
          })
        }

        // 关闭临时数据库连接
        db.close()
      } catch (err) {
        console.warn(`跳过无效的数据库文件: ${entry.name}`, err)
      }
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

// 检测是否支持目录选择API
export function supportsDirectoryPicker() {
  return 'showDirectoryPicker' in window
}

// 从File对象列表加载数据库
export async function loadDbFilesFromFileList(files) {
  const dbFiles = []
  await initSQL() // 确保SQL已经初始化

  for (const file of files) {
    if (file.name.endsWith('.db')) {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      try {
        // 尝试打开数据库以验证其有效性
        const db = new SQL.Database(uint8Array)

        // 尝试执行一个简单的查询来确认这是有效的SQLite数据库
        db.exec('SELECT 1')

        // 验证数据库是否包含预期的表（例如 qso_logs 表）
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table';")
        const hasQsoLogsTable = tables.some((table) =>
          table.values.some((row) => row.includes('qso_logs'))
        )

        if (hasQsoLogsTable) {
          dbFiles.push({
            name: file.name,
            data: uint8Array
          })
        }

        // 关闭临时数据库连接
        db.close()
      } catch (err) {
        console.warn(`跳过无效的数据库文件: ${file.name}`, err)
      }
    }
  }
  return dbFiles
}

// 查询类型定义
export const QueryTypes = {
  ALL: 'all',
  TOP20_SUMMARY: 'top20Summary',
  OLD_FRIENDS: 'oldFriends',
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
    'SELECT toGrid, COUNT(*) as count FROM qso_logs GROUP BY toGrid ORDER BY count DESC',
  [QueryTypes.OLD_FRIENDS]:
    'SELECT toCallsign, COUNT(*) as count, MAX(timestamp) as latestTime, MIN(timestamp) as firstTime, toGrid FROM qso_logs GROUP BY toCallsign ORDER BY count DESC'
}

// 查询类型名称映射
export const QueryTypeNames = {
  [QueryTypes.ALL]: '查看所有',
  [QueryTypes.TOP20_SUMMARY]: '通联排名',
  [QueryTypes.OLD_FRIENDS]: '老朋友'
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

  // 获取不重复呼号数量
  getUniqueCallsignCount() {
    const allCallsigns = new Set()
    for (const { db } of this.databases) {
      try {
        const result = db.exec('SELECT DISTINCT toCallsign FROM qso_logs')
        if (result.length > 0) {
          for (const row of result[0].values) {
            if (row[0]) {
              allCallsigns.add(row[0])
            }
          }
        }
      } catch (err) {
        console.error('获取呼号数失败:', err)
      }
    }
    return allCallsigns.size
  }

  // 执行查询
  query(queryType, page = 1, pageSize = 20, searchKeyword = '') {
    // TOP20汇总查询特殊处理
    if (queryType === QueryTypes.TOP20_SUMMARY) {
      return this.queryTop20Summary()
    }

    // 老朋友查询特殊处理
    if (queryType === QueryTypes.OLD_FRIENDS) {
      return this.queryOldFriends(page, pageSize, searchKeyword)
    }

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

  // TOP20汇总查询
  queryTop20Summary() {
    const toCallsignResults = []
    const relayNameResults = []
    const toGridResults = []

    for (const { db } of this.databases) {
      try {
        // 接收方呼号
        const callsignResult = db.exec(QUERIES[QueryTypes.TO_CALLSIGN])
        if (callsignResult.length > 0) {
          for (const row of callsignResult[0].values) {
            toCallsignResults.push({ toCallsign: row[0], count: row[1] })
          }
        }

        // 中继名称
        const relayResult = db.exec(QUERIES[QueryTypes.RELAY_NAME])
        if (relayResult.length > 0) {
          for (const row of relayResult[0].values) {
            relayNameResults.push({ relayName: row[0], relayAdmin: row[1], count: row[2] })
          }
        }

        // 接收网格
        const gridResult = db.exec(QUERIES[QueryTypes.TO_GRID])
        if (gridResult.length > 0) {
          for (const row of gridResult[0].values) {
            toGridResults.push({ toGrid: row[0], count: row[1] })
          }
        }
      } catch (err) {
        console.error('查询失败:', err)
      }
    }

    // 合并并排序
    const mergeAndSort = (results, keyField) => {
      const merged = new Map()
      for (const row of results) {
        const key = row[keyField] || ''
        if (merged.has(key)) {
          merged.get(key).count += row.count
        } else {
          merged.set(key, { ...row })
        }
      }
      return Array.from(merged.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
    }

    // 中继名称特殊合并
    const mergeRelayResults = (results) => {
      const merged = new Map()
      for (const row of results) {
        const key = `${row.relayName || ''}|${row.relayAdmin || ''}`
        if (merged.has(key)) {
          merged.get(key).count += row.count
        } else {
          merged.set(key, { ...row })
        }
      }
      return Array.from(merged.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
    }

    return {
      toCallsign: mergeAndSort(toCallsignResults, 'toCallsign'),
      relayName: mergeRelayResults(relayNameResults),
      toGrid: mergeAndSort(toGridResults, 'toGrid')
    }
  }

  // 老朋友查询
  queryOldFriends(page = 1, pageSize = 20, searchKeyword = '') {
    let sql = QUERIES[QueryTypes.OLD_FRIENDS]

    // 如果有搜索关键字，修改SQL添加WHERE条件
    if (searchKeyword) {
      sql = `SELECT toCallsign, COUNT(*) as count, MAX(timestamp) as latestTime, MIN(timestamp) as firstTime, toGrid FROM qso_logs WHERE toCallsign LIKE '%${searchKeyword}%' GROUP BY toCallsign ORDER BY count DESC`
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

    // 合并来自多个数据库的结果（按toCallsign合并）
    const merged = new Map()
    for (const row of allResults) {
      const key = row.toCallsign || ''
      if (merged.has(key)) {
        const existing = merged.get(key)
        existing.count += row.count
        // 取最早的首次通联时间
        if (row.firstTime < existing.firstTime) {
          existing.firstTime = row.firstTime
        }
        // 取最晚的最新通联时间
        if (row.latestTime > existing.latestTime) {
          existing.latestTime = row.latestTime
          existing.toGrid = row.toGrid // 使用最新通联的toGrid
        }
      } else {
        merged.set(key, { ...row })
      }
    }

    // 按通联次数降序排序
    const sortedResults = Array.from(merged.values()).sort((a, b) => b.count - a.count)

    const total = sortedResults.length
    const totalPages = Math.ceil(total / pageSize)
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const data = sortedResults.slice(start, end)

    return {
      data,
      total,
      page,
      pageSize,
      totalPages
    }
  }

  // 按呼号查询通联记录
  queryByCallsign(callsign, page = 1, pageSize = 10) {
    const sql = `SELECT * FROM qso_logs WHERE toCallsign = '${callsign}' ORDER BY timestamp DESC`

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

    // 按时间倒序排序
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
        'toCallsign',
        'toGrid',
        'freqHz',
        'fromCallsign',
        'fromGrid',
        'toComment',
        'mode',
        'relayName'
      ]
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
