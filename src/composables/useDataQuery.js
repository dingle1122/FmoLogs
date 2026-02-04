import { ref, computed } from 'vue'
import {
  getTop20StatsFromIndexedDB,
  getOldFriendsFromIndexedDB,
  getCallsignRecordsFromIndexedDB,
  getAllRecordsFromIndexedDB,
  getTotalRecordsCountFromIndexedDB,
  getTodayRecordsCountFromIndexedDB,
  getUniqueCallsignCountFromIndexedDB
} from '../services/db'
import { QueryTypes, PAGE_SIZE, OLD_FRIENDS_PAGE_SIZE } from '../components/home/constants'

export function useDataQuery() {
  const loading = ref(false)
  const error = ref(null)
  const queryResult = ref(null)
  const top20Result = ref(null)
  const oldFriendsResult = ref(null)
  const currentPage = ref(1)
  const oldFriendsPage = ref(1)
  const currentQueryType = ref(QueryTypes.ALL)
  const searchKeyword = ref('')
  const oldFriendsSearchKeyword = ref('')
  const filterDate = ref(null)

  // 统计数据
  const totalLogs = ref(0)
  const todayLogs = ref(0)
  const uniqueCallsigns = ref(0)

  // 计算总页数
  const totalPages = computed(() => {
    if (queryResult.value && queryResult.value.totalPages) {
      return queryResult.value.totalPages
    }
    return 0
  })

  // 计算总记录数
  const totalRecords = computed(() => {
    if (queryResult.value) {
      return queryResult.value.total
    }
    return 0
  })

  // 老朋友总页数
  const oldFriendsTotalPages = computed(() => {
    if (oldFriendsResult.value && oldFriendsResult.value.totalPages) {
      return oldFriendsResult.value.totalPages
    }
    return 0
  })

  // 执行查询
  async function executeQuery(selectedFromCallsign, dbLoaded) {
    if (!dbLoaded || !selectedFromCallsign) return

    loading.value = true
    error.value = null

    try {
      const fromCallsign = selectedFromCallsign

      if (currentQueryType.value === QueryTypes.TOP20_SUMMARY) {
        top20Result.value = await getTop20StatsFromIndexedDB(fromCallsign)
        queryResult.value = null
        oldFriendsResult.value = null
      } else if (currentQueryType.value === QueryTypes.OLD_FRIENDS) {
        oldFriendsResult.value = await getOldFriendsFromIndexedDB(
          oldFriendsPage.value,
          OLD_FRIENDS_PAGE_SIZE,
          oldFriendsSearchKeyword.value.trim(),
          fromCallsign
        )
        queryResult.value = null
        top20Result.value = null
      } else if (currentQueryType.value === QueryTypes.ALL) {
        queryResult.value = await getAllRecordsFromIndexedDB(
          currentPage.value,
          PAGE_SIZE,
          searchKeyword.value.trim(),
          fromCallsign,
          filterDate.value
        )
        top20Result.value = null
        oldFriendsResult.value = null
      } else {
        currentPage.value = 1
        queryResult.value = await getAllRecordsFromIndexedDB(1, PAGE_SIZE, '', fromCallsign, null)
        top20Result.value = null
        oldFriendsResult.value = null
      }

      // 更新统计数据
      totalLogs.value = await getTotalRecordsCountFromIndexedDB(fromCallsign)
      todayLogs.value = await getTodayRecordsCountFromIndexedDB(fromCallsign)
      uniqueCallsigns.value = await getUniqueCallsignCountFromIndexedDB(fromCallsign)
    } catch (err) {
      error.value = `查询失败: ${err.message}`
      queryResult.value = null
      top20Result.value = null
      oldFriendsResult.value = null
    }

    loading.value = false
  }

  // 页面跳转
  function goToPage(page) {
    if (!queryResult.value || page < 1 || page > queryResult.value.totalPages) return
    currentPage.value = page
  }

  // 老朋友分页跳转
  function goToOldFriendsPage(page) {
    if (!oldFriendsResult.value || page < 1 || page > oldFriendsResult.value.totalPages) return
    oldFriendsPage.value = page
  }

  // 查询类型变更处理
  function handleQueryTypeChange() {
    searchKeyword.value = ''
    oldFriendsSearchKeyword.value = ''
    filterDate.value = null
    currentPage.value = 1
    oldFriendsPage.value = 1
  }

  // 重置分页
  function resetPagination() {
    currentPage.value = 1
    oldFriendsPage.value = 1
  }

  return {
    loading,
    error,
    queryResult,
    top20Result,
    oldFriendsResult,
    currentPage,
    oldFriendsPage,
    currentQueryType,
    searchKeyword,
    oldFriendsSearchKeyword,
    filterDate,
    totalPages,
    totalRecords,
    oldFriendsTotalPages,
    totalLogs,
    todayLogs,
    uniqueCallsigns,
    executeQuery,
    goToPage,
    goToOldFriendsPage,
    handleQueryTypeChange,
    resetPagination
  }
}

// 通联记录查询 composable
export function useCallsignRecords() {
  const callsignRecords = ref(null)
  const callsignRecordsPage = ref(1)
  const currentCallsign = ref('')
  const showCallsignModal = ref(false)

  async function loadCallsignRecords(selectedFromCallsign) {
    callsignRecords.value = await getCallsignRecordsFromIndexedDB(
      currentCallsign.value,
      callsignRecordsPage.value,
      10,
      selectedFromCallsign
    )
  }

  async function showCallsignRecordsModal(callsign, selectedFromCallsign) {
    currentCallsign.value = callsign
    callsignRecordsPage.value = 1
    await loadCallsignRecords(selectedFromCallsign)
    showCallsignModal.value = true
  }

  async function goToCallsignRecordsPage(page, selectedFromCallsign) {
    if (!callsignRecords.value || page < 1 || page > callsignRecords.value.totalPages) return
    callsignRecordsPage.value = page
    await loadCallsignRecords(selectedFromCallsign)
  }

  function closeCallsignModal() {
    showCallsignModal.value = false
  }

  return {
    callsignRecords,
    callsignRecordsPage,
    currentCallsign,
    showCallsignModal,
    loadCallsignRecords,
    showCallsignRecordsModal,
    goToCallsignRecordsPage,
    closeCallsignModal
  }
}
