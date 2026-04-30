import type { IAudioService } from '../interfaces/IAudioService'
import type { AudioStartConfig, AudioStatus } from '../types/audio'

/**
 * Web/Tauri 桌面端音频服务。
 * PR-0 骨架阶段仅占位；PR-4 会把 composables/useAudioPlayer.js 中 WebAudio 路径
 * （AudioStreamPlayer 封装、percentToGain、WakeLock 等）完整搬入本文件。
 */
export class WebAudioService implements IAudioService {
  private statusListeners = new Set<(s: AudioStatus) => void>()

  async start(_cfg: AudioStartConfig): Promise<void> {
    throw new Error('WebAudioService 尚未实现（将在 PR-4 完成）')
  }

  async stop(): Promise<void> {
    /* no-op in skeleton */
  }

  async setVolume(_percent: number): Promise<void> {
    /* no-op in skeleton */
  }

  async setMuted(_muted: boolean): Promise<void> {
    /* no-op in skeleton */
  }

  onStatus(cb: (s: AudioStatus) => void): () => void {
    this.statusListeners.add(cb)
    return () => this.statusListeners.delete(cb)
  }
}
