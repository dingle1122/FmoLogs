/**
 * 向后兼容薄层：对外仍叫 useAudioPlayer()。
 *
 * 新实现已全部迁移到 Pinia store（src/stores/audioPlayerStore.ts），
 * 底层音频/后台保活统一由 platform.audio + platform.background 提供。
 *
 * 本层仅做字段适配：state 通过 storeToRefs 提取保持响应性，
 * 原有 `const { isPlaying, toggleAudio, ... } = useAudioPlayer()` 调用方式无需修改。
 */

import { storeToRefs } from 'pinia'
import { useAudioPlayerStore } from '../stores/audioPlayerStore'

export function useAudioPlayer() {
  const store = useAudioPlayerStore()
  const refs = storeToRefs(store)

  return {
    // ========== 响应式 state ==========
    isPlaying: refs.isPlaying,
    isMuted: refs.isMuted,
    hostMuted: refs.hostMuted,
    audioStatus: refs.audioStatus,

    // ========== actions ==========
    toggleAudio: store.toggleAudio,
    stopAudio: store.stopAudio,
    muteAudio: store.muteAudio,
    unmuteAudio: store.unmuteAudio,
    setVolume: store.setVolume,
    resumeAudio: store.resumeAudio,
    updateSpeakerInfo: store.updateSpeakerInfo,
    setHostMuted: store.setHostMuted
  }
}
