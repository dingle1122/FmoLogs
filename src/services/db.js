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

// 保存FMO地址列表（新格式）
export async function saveFmoAddresses(storage) {
  const db = await openIndexedDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(JSON.stringify(storage), 'fmoAddress')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// 获取FMO地址列表（支持旧格式迁移）
export async function getFmoAddresses() {
  try {
    const db = await openIndexedDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get('fmoAddress')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const result = request.result
        if (!result) {
          // 无数据，返回空结构
          resolve({ addresses: [], activeId: null })
          return
        }

        // 尝试解析JSON
        try {
          const parsed = JSON.parse(result)
          // 验证是否为新格式
          if (parsed && Array.isArray(parsed.addresses)) {
            resolve(parsed)
            return
          }
        } catch {
          // 不是JSON，继续处理旧格式
        }

        // 旧格式字符串，需要迁移
        if (typeof result === 'string' && result.length > 0) {
          const migrated = migrateOldFmoAddress(result)
          resolve(migrated)
          return
        }

        resolve({ addresses: [], activeId: null })
      }
    })
  } catch {
    return { addresses: [], activeId: null }
  }
}

// 生成简单唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 11)
}

// 迁移旧格式地址到新格式
function migrateOldFmoAddress(oldAddress) {
  let protocol = 'ws'
  let host = oldAddress

  if (oldAddress.startsWith('wss://')) {
    protocol = 'wss'
    host = oldAddress.replace(/^wss:\/\//, '')
  } else if (oldAddress.startsWith('ws://')) {
    protocol = 'ws'
    host = oldAddress.replace(/^ws:\/\//, '')
  }

  const id = generateId()
  return {
    addresses: [
      {
        id,
        name: host,
        host,
        protocol
      }
    ],
    activeId: id
  }
}

// 保存FMO地址（保留兼容，内部转换为新格式）
export async function saveFmoAddress(address) {
  // 如果传入空地址，清空activeId但保留地址列表
  if (!address) {
    const current = await getFmoAddresses()
    current.activeId = null
    await saveFmoAddresses(current)
    return
  }

  // 获取当前存储
  const current = await getFmoAddresses()

  // 解析地址
  let protocol = 'ws'
  let host = address
  if (address.startsWith('wss://')) {
    protocol = 'wss'
    host = address.replace(/^wss:\/\//, '')
  } else if (address.startsWith('ws://')) {
    protocol = 'ws'
    host = address.replace(/^ws:\/\//, '')
  }

  // 查找是否已存在相同地址
  const existing = current.addresses.find((a) => a.host === host && a.protocol === protocol)

  if (existing) {
    // 已存在，设为选中
    current.activeId = existing.id
  } else {
    // 不存在，添加新地址
    const id = generateId()
    current.addresses.push({
      id,
      name: host,
      host,
      protocol
    })
    current.activeId = id
  }

  await saveFmoAddresses(current)
}

// 获取FMO地址（兼容旧接口，返回当前选中地址的完整URL）
export async function getFmoAddress() {
  try {
    const storage = await getFmoAddresses()
    if (!storage.activeId || storage.addresses.length === 0) {
      return ''
    }

    const active = storage.addresses.find((a) => a.id === storage.activeId)
    if (!active) {
      return ''
    }

    return `${active.protocol}://${active.host}`
  } catch {
    return ''
  }
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

// 表头中文映射
export const ColumnNames = {
  dailyIndex: '序号',
  timestamp: '日期',
  freqHz: '频率(MHz)',
  fromCallsign: '您的呼号',
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

// ==================== IndexedDB 日志存储功能 ====================

const LOGS_DB_NAME = 'FmoLogsData'
const META_STORE_NAME = 'meta'

let logsDbInstance = null
let logsDbPromise = null

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
  // 如果已经有一个打开过程在进行，或者已经打开了，先等待它
  if (logsDbPromise) {
    try {
      const db = await logsDbPromise
      // 检查当前已打开的实例是否满足所有需要的 newCallsigns
      const allExist = newCallsigns.every((callsign) =>
        db.objectStoreNames.contains(`logs_from_${callsign}`)
      )
      if (allExist) {
        return db
      }
      // 如果不满足，需要关闭并重新打开（升级）
    } catch {
      // 如果之前的打开失败了，清除 promise 重新尝试
      logsDbPromise = null
    }
  }

  // 开启新的打开过程
  logsDbPromise = (async () => {
    // 关闭现有连接
    if (logsDbInstance) {
      try {
        logsDbInstance.close()
      } catch {
        // 忽略关闭错误
      }
      logsDbInstance = null
    }

    // 获取当前版本
    const currentVersion = await getCurrentDbVersion()

    // 检查是否需要创建新的对象存储
    let needsUpgrade = false
    const checkRequest = indexedDB.open(LOGS_DB_NAME)
    await new Promise((resolve) => {
      checkRequest.onsuccess = () => {
        const db = checkRequest.result
        // 检查 meta 存储
        if (!db.objectStoreNames.contains(META_STORE_NAME)) {
          needsUpgrade = true
        }
        // 检查 callsign 存储
        if (!needsUpgrade && newCallsigns.length > 0) {
          for (const callsign of newCallsigns) {
            if (!db.objectStoreNames.contains(`logs_from_${callsign}`)) {
              needsUpgrade = true
              break
            }
          }
        }
        db.close()
        resolve()
      }
      checkRequest.onerror = () => {
        needsUpgrade = true
        resolve()
      }
    })

    // 确定要使用的版本
    const version = needsUpgrade ? currentVersion + 1 : Math.max(currentVersion, 1)

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(LOGS_DB_NAME, version)

      request.onerror = () => {
        logsDbPromise = null // 错误时允许下次重试
        reject(request.error)
      }

      request.onsuccess = () => {
        logsDbInstance = request.result
        // 处理连接断开的情况
        logsDbInstance.onversionchange = () => {
          logsDbInstance.close()
          logsDbInstance = null
          logsDbPromise = null
        }
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
  })()

  return logsDbPromise
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
  // 从存储名称中提取呼号 (logs_from_CALLSIGN)
  const fromCallsign = storeName.replace('logs_from_', '')
  // 确保存储空间存在
  const db = await openLogsDatabase([fromCallsign])

  return new Promise((resolve, reject) => {
    // 再次检查 store 是否真的存在，避免并发导致的问题
    if (!db.objectStoreNames.contains(storeName)) {
      reject(new Error(`Object store ${storeName} not found`))
      return
    }

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

// 获取TOP20统计数据
export async function getTop20StatsFromIndexedDB(fromCallsign = null) {
  if (!fromCallsign) {
    return { toCallsign: [], toGrid: [], relayName: [] }
  }

  const allRecords = await getDataFromIndexedDB(fromCallsign)

  // 接收方呼号统计
  const toCallsignMap = new Map()
  for (const record of allRecords) {
    const key = record.toCallsign || ''
    toCallsignMap.set(key, (toCallsignMap.get(key) || 0) + 1)
  }
  const toCallsign = Array.from(toCallsignMap.entries())
    .map(([toCallsign, count]) => ({ toCallsign, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 100)

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
  if (!fromCallsign) {
    return { data: [], total: 0, page, pageSize, totalPages: 0 }
  }

  const allRecords = await getDataFromIndexedDB(fromCallsign)

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
  if (!fromCallsign) {
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
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

  const allRecords = await getDataFromIndexedDB(fromCallsign)

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

// 计算每日通联序号（根据UTC日期分组，按时间顺序编号，从1开始）
function calculateDailyIndex(records) {
  // 按UTC日期分组
  const groupedByDate = new Map()
  for (const record of records) {
    const utcDate = timestampToUTCDate(record.timestamp)
    if (!groupedByDate.has(utcDate)) {
      groupedByDate.set(utcDate, [])
    }
    groupedByDate.get(utcDate).push(record)
  }

  // 在每个日期组内按时间戳升序排序，并分配序号
  for (const [, dayRecords] of groupedByDate) {
    dayRecords.sort((a, b) => a.timestamp - b.timestamp)
    dayRecords.forEach((record, index) => {
      record.dailyIndex = index + 1
    })
  }

  return records
}

// 获取所有记录
export async function getAllRecordsFromIndexedDB(
  page = 1,
  pageSize = 10,
  searchKeyword = '',
  fromCallsign = null,
  filterDate = null // 新增：UTC日期筛选，格式 'YYYY-MM-DD'
) {
  if (!fromCallsign) {
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      columns: [
        'timestamp',
        'dailyIndex',
        'toCallsign',
        'fromCallsign',
        'freqHz',
        'toComment',
        'mode',
        'relayName'
      ]
    }
  }

  let allRecords

  // 如果有日期筛选，使用索引查询
  if (filterDate) {
    const db = await openLogsDatabase()
    const storeName = `logs_from_${fromCallsign}`

    if (!db.objectStoreNames.contains(storeName)) {
      allRecords = []
    } else {
      allRecords = await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const index = store.index('utcDate')
        const request = index.getAll(IDBKeyRange.only(filterDate))

        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const results = (request.result || []).map(filterSystemFields)
          resolve(results)
        }
      })
    }
  } else {
    allRecords = await getDataFromIndexedDB(fromCallsign)
  }

  // 计算每日序号（在过滤前计算，确保序号基于完整数据）
  calculateDailyIndex(allRecords)

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
      'dailyIndex',
      'toCallsign',
      'fromCallsign',
      'freqHz',
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
    // 清除 promise 缓存，确保下次重新打开
    logsDbPromise = null

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
  if (!fromCallsign) return 0

  const data = await getDataFromIndexedDB(fromCallsign)
  return data.length
}

// 获取今日通联数（UTC时间）
export async function getTodayRecordsCountFromIndexedDB(fromCallsign = null) {
  if (!fromCallsign) return 0

  const now = new Date()
  const utcDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`

  const db = await openLogsDatabase()
  const storeName = `logs_from_${fromCallsign}`

  if (db.objectStoreNames.contains(storeName)) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const index = store.index('utcDate')
      const request = index.count(IDBKeyRange.only(utcDate))
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  return 0
}

// 获取不重复呼号数量
export async function getUniqueCallsignCountFromIndexedDB(fromCallsign = null) {
  if (!fromCallsign) return 0

  const allRecords = await getDataFromIndexedDB(fromCallsign)
  const uniqueCallsigns = new Set()
  for (const record of allRecords) {
    if (record.toCallsign) {
      uniqueCallsigns.add(record.toCallsign)
    }
  }

  return uniqueCallsigns.size
}

// 获取每日通联统计（用于日历显示）
// 返回格式: { '2024-01-15': 5, '2024-01-16': 3, ... }
export async function getDailyContactStatsFromIndexedDB(fromCallsign = null) {
  if (!fromCallsign) return {}

  const db = await openLogsDatabase()
  const storeName = `logs_from_${fromCallsign}`

  if (!db.objectStoreNames.contains(storeName)) {
    return {}
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const records = request.result || []
      const dailyStats = {}

      for (const record of records) {
        const utcDate = record.utcDate
        if (utcDate) {
          dailyStats[utcDate] = (dailyStats[utcDate] || 0) + 1
        }
      }

      resolve(dailyStats)
    }
  })
}

// 获取指定月份的每日通联统计（按需查询）
// year: 年份，month: 月份(1-12)
// 返回格式: { dailyStats: { '2024-01-15': 5 }, monthTotal: 100, yearTotal: 1200 }
export async function getMonthlyContactStatsFromIndexedDB(fromCallsign, year, month) {
  if (!fromCallsign) return { dailyStats: {}, monthTotal: 0, yearTotal: 0 }

  const db = await openLogsDatabase()
  const storeName = `logs_from_${fromCallsign}`

  if (!db.objectStoreNames.contains(storeName)) {
    return { dailyStats: {}, monthTotal: 0, yearTotal: 0 }
  }

  const yearPrefix = `${year}-`
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const index = store.index('utcDate')

    // 使用游标遍历该年的所有数据
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`
    const range = IDBKeyRange.bound(yearStart, yearEnd)

    const dailyStats = {}
    let monthTotal = 0
    let yearTotal = 0

    const request = index.openCursor(range)

    request.onerror = () => reject(request.error)
    request.onsuccess = (event) => {
      const cursor = event.target.result
      if (cursor) {
        const utcDate = cursor.value.utcDate
        if (utcDate && utcDate.startsWith(yearPrefix)) {
          yearTotal++
          if (utcDate.startsWith(monthPrefix)) {
            monthTotal++
            dailyStats[utcDate] = (dailyStats[utcDate] || 0) + 1
          }
        }
        cursor.continue()
      } else {
        resolve({ dailyStats, monthTotal, yearTotal })
      }
    }
  })
}

// 检查QSO记录是否已存在
export async function isQsoExistsInIndexedDB(fromCallsign, timestamp, toCallsign) {
  if (!fromCallsign) return false

  const db = await openLogsDatabase()
  const storeName = `logs_from_${fromCallsign}`

  if (!db.objectStoreNames.contains(storeName)) {
    return false
  }

  const utcDate = timestampToUTCDate(timestamp)
  const dedupKey = `${utcDate}_${toCallsign || ''}`

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.get(dedupKey)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(!!request.result)
  })
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

// 导出IndexedDB数据到SQLite数据库文件
export async function exportDataToDbFile(fromCallsign) {
  if (!fromCallsign) {
    throw new Error('必须指定呼号才能导出')
  }

  await initSQL()

  // 获取指定呼号的数据
  const allRecords = await getDataFromIndexedDB(fromCallsign)

  if (allRecords.length === 0) {
    throw new Error('没有数据可导出')
  }

  // 创建新的SQLite数据库
  const db = new SQL.Database()

  // 创建qso_logs表（导出时包含logId主键）
  db.run(
    'CREATE TABLE qso_logs (logId INTEGER PRIMARY KEY,timestamp INTEGER,freqHz INTEGER,fromCallsign TEXT,fromGrid TEXT,toCallsign TEXT,toGrid TEXT,toComment TEXT,mode TEXT,relayName TEXT,relayAdmin TEXT)'
  )

  // 插入数据（logId自动递增）
  const insertStmt = db.prepare(`
    INSERT INTO qso_logs (
      timestamp, freqHz, fromCallsign, fromGrid, toCallsign, 
      toGrid, toComment, mode, relayName, relayAdmin
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const record of allRecords) {
    insertStmt.run([
      record.timestamp || null,
      record.freqHz || null,
      record.fromCallsign || null,
      record.fromGrid || null,
      record.toCallsign || null,
      record.toGrid || null,
      record.toComment || null,
      record.mode || null,
      record.relayName || null,
      record.relayAdmin || null
    ])
  }
  insertStmt.free()

  // 导出为Uint8Array
  const data = db.export()
  db.close()

  // 生成文件名：呼号-fmo-logs-秒时间戳.db
  const timestamp = Math.floor(Date.now() / 1000)
  const filename = `${fromCallsign}-fmo-logs-${timestamp}.db`

  return {
    data,
    filename
  }
}
