/**
 * 向后兼容薄层：对外仍叫 useSpeakingStatus()。
 *
 * 新实现已全部迁移到 Pinia store（src/stores/speakingStore.ts），
 * 底层 WebSocket/原生桥接统一由 platform.events 提供。
 *
 * 本层仅做字段适配：state/computed 通过 storeToRefs 提取保持响应性，
 * 原有 `speakingStatus.xxx.value` 的访问方式无需修改。
 */

import { storeToRefs } from 'pinia'
import { useSpeakingStatusStore } from '../stores/speakingStore'
import { formatTimeAgo } from '../components/home/constants'

export function useSpeakingStatus() {
  const store = useSpeakingStatusStore()
  const refs = storeToRefs(store)

  return {
    // ========== 响应式（ref / computed） ==========
    currentSpeaker: refs.currentSpeaker,
    currentSpeakerGrid: refs.currentSpeakerGrid,
    currentSpeakerAddress: refs.currentSpeakerAddress,
    isHostSpeaking: refs.isHostSpeaking,
    speakingHistory: refs.speakingHistory,
    allSpeakingHistories: refs.allSpeakingHistories,
    allCurrentSpeakers: refs.allCurrentSpeakers,
    primaryAddressId: refs.primaryAddressId,
    primaryServerInfo: refs.primaryServerInfo,
    primaryConnected: refs.primaryConnected,
    eventsConnected: refs.eventsConnected,

    // ========== actions ==========
    connectEventWs: store.connectEventWs,
    disconnectEventWs: store.disconnectEventWs,
    connectMultipleEventWs: store.connectMultipleEventWs,
    disconnectAllEventWs: store.disconnectAllEventWs,
    getSpeakingHistoryFor: store.getSpeakingHistoryFor,
    isAddressConnected: store.isAddressConnected,
    getServerInfo: store.getServerInfo,
    updateServerInfo: store.updateServerInfo,
    setOnMessageCallback: store.setOnMessageCallback,
    clearSpeakingHistory: store.clearSpeakingHistory,

    // ========== 兜底导出 ==========
    formatTimeAgo
  }
}
