/**
 * 向后兼容薄层：对外仍叫 useFmoSync(options)。
 *
 * 新实现已全部迁移到 Pinia store（src/stores/syncStore.ts），
 * 纯同步算法在 src/core/sync/syncEngine.ts。
 *
 * 本层职责：
 * - 把 options（onSyncComplete / getSpeakingHistory / getXxx getter）注入 store
 * - 通过 storeToRefs 暴露响应式 state，保持 MainLayout.vue 原 `fmoSync.xxx.value` 用法
 * - 在组件卸载时调用 store.teardown 清理 timer / 活跃 client
 */

import { onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useSyncStore } from '../stores/syncStore'

export function useFmoSync(options = {}) {
  const store = useSyncStore()
  store.reset()
  store.setContext(options)

  const refs = storeToRefs(store)

  onUnmounted(() => {
    store.teardown()
  })

  return {
    // 响应式 state
    syncing: refs.syncing,
    syncStatus: refs.syncStatus,
    autoSyncMessage: refs.autoSyncMessage,
    syncFailedRecords: refs.syncFailedRecords,
    multiSyncProgress: refs.multiSyncProgress,
    // actions
    syncToday: store.syncToday,
    syncIncremental: store.syncIncremental,
    syncFull: store.syncFull,
    syncMultiple: store.syncMultiple,
    startAutoSyncTask: store.startAutoSyncTask,
    stopAutoSyncTask: store.stopAutoSyncTask,
    showAutoSyncMessage: store.showAutoSyncMessage
  }
}
