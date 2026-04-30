import type { IAudioService } from '../interfaces/IAudioService'
import type { AudioStartConfig, AudioStatus } from '../types/audio'

/**
 * Android 原生音频服务。
 * PR-0 骨架阶段占位；PR-4 填充：包装 FmoAudio 插件 + mapNativeStatus。
 */
export class NativeAudioService implements IAudioService {
  private statusListeners = new Set<(s: AudioStatus) => void>()

  async start(_cfg: AudioStartConfig): Promise<void> {
    throw new Error('NativeAudioService 尚未实现（将在 PR-4 完成）')
  }
  async stop(): Promise<void> {
    /* no-op */
  }
  async setVolume(_percent: number): Promise<void> {
    /* no-op */
  }
  async setMuted(_muted: boolean): Promise<void> {
    /* no-op */
  }
  onStatus(cb: (s: AudioStatus) => void) {
    this.statusListeners.add(cb)
    return () => this.statusListeners.delete(cb)
  }
}
