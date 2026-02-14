<template>
  <div class="old-friends-view">
    <!-- 状态提示 -->
    <StatusHints
      :sync-message="fmoSyncMessage"
      :loading="loading"
      :error="error"
    />

    <!-- 过滤区域 -->
    <QuerySection
      v-model:old-friends-search-keyword="dataQuery.oldFriendsSearchKeyword.value"
      :current-query-type="'oldFriends'"
      :from-callsign="selectedFromCallsign"
      :db-loaded="dbLoaded"
      @update:old-friends-search-keyword="onOldFriendsSearchInput"
    />

    <!-- 老朋友卡片视图 -->
    <OldFriendsList
      :old-friends-result="dataQuery.oldFriendsResult.value"
      :db-loaded="dbLoaded"
      @show-records="$emit('show-callsign-records', $event)"
    />

    <!-- 分页 -->
    <PaginationControl
      v-if="dataQuery.oldFriendsResult.value"
      :current-page="dataQuery.oldFriendsPage.value"
      :total-pages="dataQuery.oldFriendsTotalPages.value"
      :total-records="dataQuery.oldFriendsResult.value?.total"
      :disabled="!dbLoaded"
      @page-change="handleOldFriendsPageChange"
    />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'

// 组件
import StatusHints from '../components/common/StatusHints.vue'
import QuerySection from '../components/home/QuerySection.vue'
import OldFriendsList from '../components/home/OldFriendsList.vue'
import PaginationControl from '../components/home/PaginationControl.vue'

const props = defineProps({
  dbLoaded: Boolean,
  selectedFromCallsign: String,
  loading: Boolean,
  error: String,
  fmoSyncMessage: String,
  dataQuery: Object
})

const emit = defineEmits(['execute-query', 'show-callsign-records'])

// 防抖定时器
let oldFriendsSearchTimer = null

function onOldFriendsSearchInput() {
  if (oldFriendsSearchTimer) clearTimeout(oldFriendsSearchTimer)
  oldFriendsSearchTimer = setTimeout(() => {
    props.dataQuery.oldFriendsPage.value = 1
    emit('execute-query')
  }, 300)
}

function handleOldFriendsPageChange(page) {
  props.dataQuery.goToOldFriendsPage(page)
  emit('execute-query')
}

// 初始化时确保查询类型正确并执行查询
onMounted(() => {
  if (props.dataQuery.currentQueryType.value !== 'oldFriends') {
    props.dataQuery.currentQueryType.value = 'oldFriends'
  }
  if (props.dbLoaded) {
    emit('execute-query')
  }
})

// 清理定时器
onUnmounted(() => {
  if (oldFriendsSearchTimer) {
    clearTimeout(oldFriendsSearchTimer)
    oldFriendsSearchTimer = null
  }
})
</script>

<style scoped>
.old-friends-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}
</style>
