import type { SstvModeId } from '../core/sstv/sstvTypes'

export interface SstvHistoryEntry {
  id?: number
  createdAt: number
  fileName: string
  displayName?: string
  mode: SstvModeId
  image: Blob
  decodedRows: number
  height: number
  startSeconds: number
  frequencyOffsetHz: number
  warnings: string[]
}

const DATABASE = 'fmologs-sstv-history'
const STORE = 'images'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('无法打开 SSTV 历史记录'))
    request.onblocked = () => reject(new Error('SSTV 历史记录被其他页面占用'))
  })
}

export async function listSstvHistory(): Promise<SstvHistoryEntry[]> {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).getAll()
      request.onsuccess = () => resolve((request.result as SstvHistoryEntry[]).sort((a, b) => b.createdAt - a.createdAt || (b.id ?? 0) - (a.id ?? 0)))
      request.onerror = () => reject(request.error ?? new Error('读取历史记录失败'))
    })
  } finally { db.close() }
}

export async function saveSstvHistory(entry: SstvHistoryEntry): Promise<number> {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const request = tx.objectStore(STORE).add(entry)
      tx.oncomplete = () => resolve(request.result as number)
      tx.onerror = () => reject(tx.error ?? new Error('保存历史记录失败'))
      tx.onabort = () => reject(tx.error ?? new Error('保存历史记录已中止'))
    })
  } finally { db.close() }
}

export async function deleteSstvHistory(id: number): Promise<void> {
  return deleteSstvHistories([id])
}

export async function deleteSstvHistories(ids: number[]): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      for (const id of ids) store.delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('删除历史记录失败'))
      tx.onabort = () => reject(tx.error ?? new Error('删除历史记录已中止'))
    })
  } finally { db.close() }
}

export async function renameSstvHistories(entries: Array<{ id: number; name: string }>): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      for (const { id, name } of entries) {
        const request = store.get(id)
        request.onsuccess = () => {
          if (!request.result) { tx.abort(); return }
          store.put({ ...request.result, displayName: name })
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('重命名历史记录失败'))
      tx.onabort = () => reject(tx.error ?? new Error('记录不存在或重命名已中止'))
    })
  } finally { db.close() }
}

export async function clearSstvHistory(): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('清空历史记录失败'))
      tx.onabort = () => reject(tx.error ?? new Error('清空历史记录已中止'))
    })
  } finally { db.close() }
}
