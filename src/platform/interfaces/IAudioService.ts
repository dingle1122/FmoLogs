import type { AudioStartConfig, AudioStatus } from '../types/audio'

export interface IAudioService {
  start(cfg: AudioStartConfig): Promise<void>
  stop(): Promise<void>
  setVolume(percent: number): Promise<void>
  setMuted(muted: boolean): Promise<void>
  /**
   * 订阅状态变化。返回取消订阅的函数。
   */
  onStatus(cb: (status: AudioStatus) => void): () => void
}
