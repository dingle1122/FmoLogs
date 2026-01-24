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

// 保存FMO地址
export async function saveFmoAddress(address) {
  const db = await openIndexedDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(address, 'fmoAddress')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// 获取FMO地址
export async function getFmoAddress() {
  try {
    const db = await openIndexedDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get('fmoAddress')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || '')
    })
  } catch {
    return ''
  }
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

// ==================== IndexedDB 日志存储功能 ====================

const LOGS_DB_NAME = 'FmoLogsData'
const META_STORE_NAME = 'meta'

let logsDbInstance = null

// 将时间戳转换为UTC日期字符串（用于去重）
function timestampToUTCDate(timestamp) {
  const date = new Date(timestamp * 1000)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 获取现有数据库版本
function getCurrentDbVersion() {
  return new Promise((resolve) => {
    const request = indexedDB.open(LOGS_DB_NAME)
    request.onsuccess = () => {
      const version = request.result.version
      request.result.close()
      resolve(version)
    }
    request.onerror = () => resolve(0)
  })
}

// 打开或升级日志数据库
async function openLogsDatabase(newCallsigns = []) {
  // 如果已有连接且不需要新增存储，直接返回
  if (logsDbInstance && newCallsigns.length === 0) {
    // 检查所有需要的存储是否都存在
    const allExist = newCallsigns.every((callsign) =>
      logsDbInstance.objectStoreNames.contains(`logs_from_${callsign}`)
    )
    if (allExist || newCallsigns.length === 0) {
      return logsDbInstance
    }
  }

  // 关闭现有连接
  if (logsDbInstance) {
    logsDbInstance.close()
    logsDbInstance = null
  }

  // 获取当前版本
  const currentVersion = await getCurrentDbVersion()

  // 检查是否需要创建新的对象存储
  let needsUpgrade = false
  if (newCallsigns.length > 0) {
    const checkRequest = indexedDB.open(LOGS_DB_NAME)
    await new Promise((resolve) => {
      checkRequest.onsuccess = () => {
        const db = checkRequest.result
        for (const callsign of newCallsigns) {
          if (!db.objectStoreNames.contains(`logs_from_${callsign}`)) {
            needsUpgrade = true
            break
          }
        }
        if (!db.objectStoreNames.contains(META_STORE_NAME)) {
          needsUpgrade = true
        }
        db.close()
        resolve()
      }
      checkRequest.onerror = () => {
        needsUpgrade = true
        resolve()
      }
    })
  }

  // 确定要使用的版本
  const version = needsUpgrade ? currentVersion + 1 : Math.max(currentVersion, 1)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOGS_DB_NAME, version)

    request.onerror = () => reject(request.error)

    request.onsuccess = () => {
      logsDbInstance = request.result
      resolve(logsDbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      // 创建元数据存储
      if (!db.objectStoreNames.contains(META_STORE_NAME)) {
        db.createObjectStore(META_STORE_NAME)
      }

      // 为每个新的fromCallsign创建对象存储
      for (const callsign of newCallsigns) {
        const storeName = `logs_from_${callsign}`
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, {
            keyPath: 'dedupKey'
          })
          // 创建索引
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('toCallsign', 'toCallsign', { unique: false })
          store.createIndex('toGrid', 'toGrid', { unique: false })
          store.createIndex('relayName', 'relayName', { unique: false })
          store.createIndex('utcDate', 'utcDate', { unique: false })
        }
      }
    }
  })
}

// 将db文件数据导入到IndexedDB
export async function importDbFilesToIndexedDB(dbFiles, onProgress = null) {
  await initSQL()

  // 第一步：扫描所有文件，收集所有fromCallsign
  const allCallsigns = new Set()
  const allRecords = []

  for (const file of dbFiles) {
    try {
      const db = new SQL.Database(file.data)
      const result = db.exec('SELECT * FROM qso_logs')

      if (result.length > 0) {
        const columns = result[0].columns
        const values = result[0].values

        for (const row of values) {
          const record = {}
          columns.forEach((col, index) => {
            record[col] = row[index]
          })
          allRecords.push(record)
          if (record.fromCallsign) {
            allCallsigns.add(record.fromCallsign)
          }
        }
      }
      db.close()
    } catch (err) {
      console.error(`读取数据库文件 ${file.name} 失败:`, err)
    }
  }

  if (allCallsigns.size === 0) {
    return { totalRecords: 0, callsigns: [] }
  }

  // 第二步：打开/升级IndexedDB，确保所有需要的存储都存在
  const callsignArray = Array.from(allCallsigns)
  await openLogsDatabase(callsignArray)

  // 第三步：按fromCallsign分组并写入数据（带去重）
  const recordsByCallsign = new Map()
  for (const callsign of callsignArray) {
    recordsByCallsign.set(callsign, [])
  }
  for (const record of allRecords) {
    if (record.fromCallsign && recordsByCallsign.has(record.fromCallsign)) {
      recordsByCallsign.get(record.fromCallsign).push(record)
    }
  }

  let totalImported = 0
  let processed = 0
  const totalToProcess = allRecords.length

  for (const [callsign, records] of recordsByCallsign) {
    const storeName = `logs_from_${callsign}`
    const imported = await writeRecordsToStore(storeName, records)
    totalImported += imported

    processed += records.length
    if (onProgress) {
      onProgress({
        current: processed,
        total: totalToProcess,
        callsign,
        imported
      })
    }
  }

  // 保存fromCallsign列表到元数据
  await saveCallsignList(callsignArray)

  return {
    totalRecords: totalImported,
    callsigns: callsignArray
  }
}

// 将记录写入指定存储（基于UTC日期+toCallsign去重，重复时覆盖）
async function writeRecordsToStore(storeName, records) {
  const db = await openLogsDatabase()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)

    let imported = 0
    let pending = records.length

    if (pending === 0) {
      resolve(0)
      return
    }

    for (const record of records) {
      // 使用UTC日期 + toCallsign作为去重键
      const utcDate = timestampToUTCDate(record.timestamp)
      const dedupKey = `${utcDate}_${record.toCallsign || ''}`

      // 使用put方法，存在则覆盖，不存在则创建
      const putRequest = store.put({
        dedupKey,
        utcDate,
        timestamp: record.timestamp,
        freqHz: record.freqHz,
        fromCallsign: record.fromCallsign,
        fromGrid: record.fromGrid,
        toCallsign: record.toCallsign,
        toGrid: record.toGrid,
        toComment: record.toComment,
        mode: record.mode,
        relayName: record.relayName,
        relayAdmin: record.relayAdmin
      })

      putRequest.onsuccess = () => {
        imported++
        pending--
        if (pending === 0) resolve(imported)
      }

      putRequest.onerror = () => {
        pending--
        if (pending === 0) resolve(imported)
      }
    }

    tx.onerror = () => reject(tx.error)
  })
}

// 保存fromCallsign列表到元数据
// 保存fromCallsign列表到元数据（合并现有列表）
async function saveCallsignList(newCallsigns) {
  const db = await openLogsDatabase()

  // 先获取现有列表
  const existingList = await new Promise((resolve) => {
    const tx = db.transaction(META_STORE_NAME, 'readonly')
    const store = tx.objectStore(META_STORE_NAME)
    const request = store.get('callsignList')
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => resolve([])
  })

  // 合并并去重
  const mergedSet = new Set([...existingList, ...newCallsigns])
  const mergedList = Array.from(mergedSet).sort()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE_NAME, 'readwrite')
    const store = tx.objectStore(META_STORE_NAME)
    const request = store.put(mergedList, 'callsignList')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// 获取所有可用的fromCallsign列表
export async function getAvailableFromCallsigns() {
  try {
    const db = await openLogsDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE_NAME, 'readonly')
      const store = tx.objectStore(META_STORE_NAME)
      const request = store.get('callsignList')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || [])
    })
  } catch {
    return []
  }
}

// 从指定fromCallsign的存储中获取数据
// 系统内部字段（不对外展示）
const SYSTEM_FIELDS = ['dedupKey', 'utcDate']

// 过滤掉系统内部字段
function filterSystemFields(record) {
  const filtered = {}
  for (const key of Object.keys(record)) {
    if (!SYSTEM_FIELDS.includes(key)) {
      filtered[key] = record[key]
    }
  }
  return filtered
}

export async function getDataFromIndexedDB(fromCallsign) {
  const db = await openLogsDatabase()
  const storeName = `logs_from_${fromCallsign}`

  if (!db.objectStoreNames.contains(storeName)) {
    return []
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.getAll()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const results = (request.result || []).map(filterSystemFields)
      resolve(results)
    }
  })
}

// 从所有存储获取数据（向后兼容）
export async function getConsolidatedDataFromIndexedDB() {
  const callsigns = await getAvailableFromCallsigns()
  const allData = []

  for (const callsign of callsigns) {
    const data = await getDataFromIndexedDB(callsign)
    allData.push(...data)
  }

  return allData
}

// 获取TOP20统计数据
export async function getTop20StatsFromIndexedDB(fromCallsign = null) {
  let allRecords = []

  if (fromCallsign) {
    allRecords = await getDataFromIndexedDB(fromCallsign)
  } else {
    allRecords = await getConsolidatedDataFromIndexedDB()
  }

  // 接收方呼号统计
  const toCallsignMap = new Map()
  for (const record of allRecords) {
    const key = record.toCallsign || ''
    toCallsignMap.set(key, (toCallsignMap.get(key) || 0) + 1)
  }
  const toCallsign = Array.from(toCallsignMap.entries())
    .map(([toCallsign, count]) => ({ toCallsign, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  // 接收网格统计
  const toGridMap = new Map()
  for (const record of allRecords) {
    const key = record.toGrid || ''
    toGridMap.set(key, (toGridMap.get(key) || 0) + 1)
  }
  const toGrid = Array.from(toGridMap.entries())
    .map(([toGrid, count]) => ({ toGrid, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  // 中继名称统计
  const relayMap = new Map()
  for (const record of allRecords) {
    const key = `${record.relayName || ''}|${record.relayAdmin || ''}`
    if (!relayMap.has(key)) {
      relayMap.set(key, {
        relayName: record.relayName,
        relayAdmin: record.relayAdmin,
        count: 0
      })
    }
    relayMap.get(key).count++
  }
  const relayName = Array.from(relayMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  return { toCallsign, toGrid, relayName }
}

// 获取老朋友统计数据
export async function getOldFriendsFromIndexedDB(
  page = 1,
  pageSize = 20,
  searchKeyword = '',
  fromCallsign = null
) {
  let allRecords = []

  if (fromCallsign) {
    allRecords = await getDataFromIndexedDB(fromCallsign)
  } else {
    allRecords = await getConsolidatedDataFromIndexedDB()
  }

  // 按toCallsign分组统计
  const friendsMap = new Map()
  for (const record of allRecords) {
    const key = record.toCallsign || ''

    // 搜索过滤
    if (searchKeyword && !key.toLowerCase().includes(searchKeyword.toLowerCase())) {
      continue
    }

    if (!friendsMap.has(key)) {
      friendsMap.set(key, {
        toCallsign: key,
        toGrid: record.toGrid,
        count: 0,
        firstTime: record.timestamp,
        latestTime: record.timestamp
      })
    }

    const friend = friendsMap.get(key)
    friend.count++
    if (record.timestamp < friend.firstTime) {
      friend.firstTime = record.timestamp
    }
    if (record.timestamp > friend.latestTime) {
      friend.latestTime = record.timestamp
      friend.toGrid = record.toGrid
    }
  }

  // 排序
  const sortedFriends = Array.from(friendsMap.values()).sort((a, b) => b.count - a.count)

  // 分页
  const total = sortedFriends.length
  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize
  const data = sortedFriends.slice(start, start + pageSize)

  return { data, total, page, pageSize, totalPages }
}

// 获取特定呼号的通联记录
export async function getCallsignRecordsFromIndexedDB(
  callsign,
  page = 1,
  pageSize = 10,
  fromCallsign = null
) {
  let allRecords = []

  if (fromCallsign) {
    allRecords = await getDataFromIndexedDB(fromCallsign)
  } else {
    allRecords = await getConsolidatedDataFromIndexedDB()
  }

  // 筛选指定呼号的记录
  const filtered = allRecords.filter((r) => r.toCallsign === callsign)

  // 按时间倒序排序
  filtered.sort((a, b) => b.timestamp - a.timestamp)

  // 分页
  const total = filtered.length
  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize
  const data = filtered.slice(start, start + pageSize)

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

// 获取所有记录
export async function getAllRecordsFromIndexedDB(
  page = 1,
  pageSize = 10,
  searchKeyword = '',
  fromCallsign = null
) {
  let allRecords = []

  if (fromCallsign) {
    allRecords = await getDataFromIndexedDB(fromCallsign)
  } else {
    allRecords = await getConsolidatedDataFromIndexedDB()
  }

  // 搜索过滤
  let filtered = allRecords
  if (searchKeyword) {
    filtered = allRecords.filter((r) =>
      (r.toCallsign || '').toLowerCase().includes(searchKeyword.toLowerCase())
    )
  }

  // 按时间倒序排序
  filtered.sort((a, b) => b.timestamp - a.timestamp)

  // 分页
  const total = filtered.length
  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize
  const data = filtered.slice(start, start + pageSize)

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

// 清空IndexedDB中的日志数据
export async function clearIndexedDBData() {
  return new Promise((resolve, reject) => {
    // 关闭现有连接
    if (logsDbInstance) {
      logsDbInstance.close()
      logsDbInstance = null
    }

    // 删除整个数据库
    const deleteRequest = indexedDB.deleteDatabase(LOGS_DB_NAME)
    deleteRequest.onerror = () => reject(deleteRequest.error)
    deleteRequest.onsuccess = () => resolve()
    deleteRequest.onblocked = () => {
      console.warn('IndexedDB删除被阻塞，可能有其他连接')
      resolve()
    }
  })
}

// 获取IndexedDB中的总记录数
export async function getTotalRecordsCountFromIndexedDB(fromCallsign = null) {
  if (fromCallsign) {
    const data = await getDataFromIndexedDB(fromCallsign)
    return data.length
  }

  const callsigns = await getAvailableFromCallsigns()
  let total = 0

  for (const callsign of callsigns) {
    const db = await openLogsDatabase()
    const storeName = `logs_from_${callsign}`

    if (db.objectStoreNames.contains(storeName)) {
      const count = await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const request = store.count()
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
      })
      total += count
    }
  }

  return total
}

// 获取不重复呼号数量
export async function getUniqueCallsignCountFromIndexedDB(fromCallsign = null) {
  let allRecords = []

  if (fromCallsign) {
    allRecords = await getDataFromIndexedDB(fromCallsign)
  } else {
    allRecords = await getConsolidatedDataFromIndexedDB()
  }

  const uniqueCallsigns = new Set()
  for (const record of allRecords) {
    if (record.toCallsign) {
      uniqueCallsigns.add(record.toCallsign)
    }
  }

  return uniqueCallsigns.size
}

// 保存单个QSO记录到IndexedDB
export async function saveSingleQsoToIndexedDB(record) {
  if (!record.fromCallsign) return

  // 确保存储空间存在
  await openLogsDatabase([record.fromCallsign])

  const storeName = `logs_from_${record.fromCallsign}`
  await writeRecordsToStore(storeName, [record])

  // 更新已知的fromCallsign列表
  const currentCallsigns = await getAvailableFromCallsigns()
  if (!currentCallsigns.includes(record.fromCallsign)) {
    const newList = [...currentCallsigns, record.fromCallsign]
    await saveCallsignList(newList)
  }
}
