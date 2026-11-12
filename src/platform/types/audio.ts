// 音频服务类型

export type AudioStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'playing'
  | 'reconnecting'
  | 'error'
  | 'disconnected'

export interface AudioStartConfig {
  /** WebSocket URL（含协议） */
  url: string
  /** 0-200 */
  volumePercent?: number
  /** 是否静音启动 */
  muted?: boolean
}

/** 连接内的原始单声道 PCM；sampleOffset 仅反映客户端收到的数据。 */
export interface AudioPcmChunk {
  samples: Int16Array
  sampleRate: number
  generation: number
  sampleOffset: number
}
