export type SstvModeId = 'pd50' | 'pd90' | 'pd120' | 'pd160' | 'pd180' | 'pd240' | 'pd290' | 'robot36' | 'robot72'

export interface AudioChunk {
  samples: Int16Array | Float32Array
  sampleRate: number
  sequence?: number
  receivedAt?: number
  droppedBefore?: number
}

export interface AudioGap {
  startSample: number
  endSample: number
  reason: 'sequence' | 'buffer-overrun' | 'reconnect' | 'unknown'
}

export interface SstvMode {
  id: SstvModeId
  name: string
  visCode: number
  width: number
  height: number
  lineDurationMs: number
  syncDurationMs: number
  nominalDurationSec: number
}

export type SstvDecoderState =
  | 'idle'
  | 'searching'
  | 'vis-detected'
  | 'decoding'
  | 'complete'
  | 'partial'
  | 'error'

export interface SstvDecodeResult {
  state: SstvDecoderState
  mode: SstvModeId | null
  image: ImageData | null
  complete: boolean
  truncated: boolean
  confidence: number
  frequencyOffsetHz: number | null
  missingRanges: AudioGap[]
  badLines: number[]
  warnings: string[]
}
