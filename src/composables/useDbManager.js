import { ref } from 'vue'
import {
  DatabaseManager,
  loadDbFilesFromFileList,
  importDbFilesToIndexedDB,
  getAvailableFromCallsigns,
  clearIndexedDBData,
  getTotalRecordsCountFromIndexedDB,
  getTodayRecordsCountFromIndexedDB,
  getUniqueCallsignCountFromIndexedDB
} from '../services/db'

export function useDbManager() {
  const dbManager = new DatabaseManager()
  const dbLoaded = ref(false)
  const dbCount = ref(0)
  const availableFromCallsigns = ref([])
  const selectedFromCallsign = ref('')
  const importProgress = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // 统计数据
  const totalLogs = ref(0)
  const todayLogs = ref(0)
  const uniqueCallsigns = ref(0)

  async function loadDatabases(dbFiles) {
    dbManager.close()

    importProgress.value = { current: 0, total: 0 }
    const importResult = await importDbFilesToIndexedDB(dbFiles, (progress) => {
      importProgress.value = progress
    })
    importProgress.value = null

    if (importResult.totalRecords === 0 && importResult.callsigns.length === 0) {
      const existingCallsigns = await getAvailableFromCallsigns()
      if (existingCallsigns.length === 0) {
        error.value = '没有成功导入任何数据'
        return false
      }
      availableFromCallsigns.value = existingCallsigns
    } else {
      const allCallsigns = await getAvailableFromCallsigns()
      availableFromCallsigns.value = allCallsigns
    }

    if (
      !selectedFromCallsign.value ||
      !availableFromCallsigns.value.includes(selectedFromCallsign.value)
    ) {
      selectedFromCallsign.value = availableFromCallsigns.value[0]
    }

    await updateStats()

    dbCount.value = dbFiles.length
    dbLoaded.value = true

    return true
  }

  async function updateStats() {
    if (!selectedFromCallsign.value) return
    totalLogs.value = await getTotalRecordsCountFromIndexedDB(selectedFromCallsign.value)
    todayLogs.value = await getTodayRecordsCountFromIndexedDB(selectedFromCallsign.value)
    uniqueCallsigns.value = await getUniqueCallsignCountFromIndexedDB(selectedFromCallsign.value)
  }

  async function tryRestoreDirectory() {
    try {
      const callsigns = await getAvailableFromCallsigns()
      if (callsigns.length > 0) {
        availableFromCallsigns.value = callsigns
        selectedFromCallsign.value = callsigns[0]
        await updateStats()
        dbLoaded.value = true
        dbCount.value = callsigns.length
        return true
      }
    } catch {
      loading.value = false
    }
    return false
  }

  async function selectFiles(files) {
    if (!files || files.length === 0) return false

    loading.value = true
    error.value = null

    try {
      const dbFiles = await loadDbFilesFromFileList(files)
      if (dbFiles.length === 0) {
        error.value = '所选文件中没有有效的 .db 文件'
        loading.value = false
        return false
      }

      const success = await loadDatabases(dbFiles)
      loading.value = false
      return success
    } catch (err) {
      error.value = `加载失败: ${err.message}`
      loading.value = false
      return false
    }
  }

  async function clearAllData() {
    await clearIndexedDBData()
    dbManager.close()
    dbLoaded.value = false
    dbCount.value = 0
    totalLogs.value = 0
    todayLogs.value = 0
    uniqueCallsigns.value = 0
    availableFromCallsigns.value = []
    selectedFromCallsign.value = ''
  }

  function close() {
    dbManager.close()
  }

  return {
    dbManager,
    dbLoaded,
    dbCount,
    availableFromCallsigns,
    selectedFromCallsign,
    importProgress,
    loading,
    error,
    totalLogs,
    todayLogs,
    uniqueCallsigns,
    loadDatabases,
    updateStats,
    tryRestoreDirectory,
    selectFiles,
    clearAllData,
    close
  }
}
