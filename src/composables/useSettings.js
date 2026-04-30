/**
 * 向后兼容薄层：对外仍叫 useSettings()。
 *
 * 新实现已全部迁移到 Pinia store（src/stores/settingsStore.ts），
 * 底层 KV 存储统一由 platform.storage 提供，地址/用户信息仍走 IndexedDB（db.js）。
 *
 * 本层仅做字段适配：state/getters 通过 storeToRefs 提取保持响应性，
 * actions 直接代理到 store，原有调用点 `const settings = useSettings()` 零修改。
 */

import { storeToRefs } from 'pinia'
import { useSettingsStore } from '../stores/settingsStore'

export function useSettings() {
  const store = useSettingsStore()
  const refs = storeToRefs(store)

  return {
    // ========== 响应式 state / getters ==========
    fmoAddress: refs.fmoAddress,
    protocol: refs.protocol,
    todayContactedCallsigns: refs.todayContactedCallsigns,
    remoteControlUrl: refs.remoteControlUrl,
    addressList: refs.addressList,
    activeAddressId: refs.activeAddressId,
    activeAddress: refs.activeAddress,
    contactCounts: refs.contactCounts,
    selectedAddressIds: refs.selectedAddressIds,
    multiSelectMode: refs.multiSelectMode,
    audioVolume: refs.audioVolume,
    audioPlaying: refs.audioPlaying,
    // 非响应式只读常量（直接返回原值，不走 storeToRefs）
    isHttps: store.isHttps,
    isMobileDevice: store.isMobileDevice,

    // ========== actions ==========
    initFmoAddress: store.initFmoAddress,
    validateAndSaveFmoAddress: store.validateAndSaveFmoAddress,
    backupLogs: store.backupLogs,
    loadTodayContactedCallsigns: store.loadTodayContactedCallsigns,
    loadContactCounts: store.loadContactCounts,
    addFmoAddress: store.addFmoAddress,
    updateFmoAddress: store.updateFmoAddress,
    deleteFmoAddress: store.deleteFmoAddress,
    selectFmoAddress: store.selectFmoAddress,
    clearAllAddresses: store.clearAllAddresses,
    refreshUserInfo: store.refreshUserInfo,
    validateConnection: store.validateConnection,
    toggleAddressSelection: store.toggleAddressSelection,
    setMultiSelectMode: store.setMultiSelectMode,
    setActiveAddressId: store.setActiveAddressId,
    setAudioVolume: store.setAudioVolume,
    setAudioPlaying: store.setAudioPlaying
  }
}
