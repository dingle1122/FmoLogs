<template>
  <div class="logs-view">
    <!-- 状态提示 -->
    <StatusHints
      :sync-message="fmoSyncMessage"
      :loading="loading"
      :error="error"
    >
      <template v-if="importProgress" #loading>
        正在导入数据... {{ importProgress.current }} /
        {{ importProgress.total }}
      </template>
    </StatusHints>

    <!-- 过滤区域 -->
    <QuerySection
      v-model:search-keyword="dataQuery.searchKeyword.value"
      v-model:filter-date="dataQuery.filterDate.value"
      :current-query-type="'all'"
      :from-callsign="selectedFromCallsign"
      :db-loaded="dbLoaded"
      @update:search-keyword="onSearchInput"
      @update:filter-date="onFilterDateChange"
    />

    <!-- 数据表格 -->
    <LogDataTable
      :query-result="dataQuery.queryResult.value"
      :display-columns="displayColumns"
      :db-loaded="dbLoaded"
      @show-detail="$emit('show-detail', $event)"
    />

    <!-- 分页 -->
    <PaginationControl
      :current-page="dataQuery.currentPage.value"
      :total-pages="dataQuery.totalPages.value"
      :total-records="dataQuery.totalRecords.value"
      :disabled="!dbLoaded"
      @page-change="handlePageChange"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'

// 组件
import StatusHints from '../components/common/StatusHints.vue'
import QuerySection from '../components/home/QuerySection.vue'
import LogDataTable from '../components/home/LogDataTable.vue'
import PaginationControl from '../components/home/PaginationControl.vue'

// 常量
import { DEFAULT_COLUMNS } from '../components/home/constants'

const props = defineProps({
  dbLoaded: Boolean,
  selectedFromCallsign: String,
  loading: Boolean,
  error: String,
  importProgress: Object,
  fmoSyncMessage: String,
  dataQuery: Object
})

const emit = defineEmits(['execute-query', 'show-detail'])

// 计算属性
const displayColumns = computed(() => {
  if (props.dataQuery.queryResult.value) {
    return props.dataQuery.queryResult.value.columns
  }
  return DEFAULT_COLUMNS
})

// 防抖定时器
let searchTimer = null

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    props.dataQuery.currentPage.value = 1
    emit('execute-query')
  }, 300)
}

function onFilterDateChange() {
  props.dataQuery.currentPage.value = 1
  emit('execute-query')
}

function handlePageChange(page) {
  props.dataQuery.goToPage(page)
  emit('execute-query')
}

// 初始化时确保查询类型正确
onMounted(() => {
  if (props.dataQuery.currentQueryType.value !== 'all') {
    props.dataQuery.currentQueryType.value = 'all'
  }
  if (props.dbLoaded) {
    emit('execute-query')
  }
})

// 清理定时器
onUnmounted(() => {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
})
</script>

<style scoped>
.logs-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}
</style>
