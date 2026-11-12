import { modeByVisCode } from './sstvModes'
import type { AudioChunk, AudioGap, SstvDecodeResult, SstvMode } from './sstvTypes'

/**
 * 增量解码会话的第一版边界：目前负责采集连续 PCM、记录缺口并保留模式状态。
 * 图像行解调将在同步检测稳定后加入，避免把播放链路和协议逻辑耦合在一起。
 */
export class SstvDecoder {
  private mode: SstvMode | null = null
  private state: SstvDecodeResult['state'] = 'searching'
  private missingRanges: AudioGap[] = []
  private lastSequence: number | undefined
  private sampleCount = 0
  private warnings: string[] = []

  push(chunk: AudioChunk): void {
    if (chunk.sampleRate <= 0 || chunk.samples.length === 0) return
    if (this.lastSequence !== undefined && chunk.sequence !== undefined && chunk.sequence > this.lastSequence + 1) {
      this.missingRanges.push({
        startSample: this.sampleCount,
        endSample: this.sampleCount + (chunk.sequence - this.lastSequence - 1) * chunk.samples.length,
        reason: 'sequence'
      })
      this.warnings.push('检测到音频块缺失，图像可能不完整')
    }
    if (chunk.droppedBefore) {
      this.missingRanges.push({
        startSample: this.sampleCount,
        endSample: this.sampleCount + chunk.droppedBefore,
        reason: 'buffer-overrun'
      })
    }
    this.lastSequence = chunk.sequence
    this.sampleCount += chunk.samples.length
  }

  setModeByVisCode(visCode: number): boolean {
    const mode = modeByVisCode(visCode)
    if (!mode) return false
    this.mode = mode
    this.state = 'vis-detected'
    return true
  }

  finish(): SstvDecodeResult {
    const partial = this.sampleCount > 0 && !this.mode
    return {
      state: partial ? 'partial' : this.state,
      mode: this.mode?.id ?? null,
      image: null,
      complete: false,
      truncated: this.missingRanges.length > 0,
      confidence: this.mode ? 0.5 : 0,
      frequencyOffsetHz: null,
      missingRanges: [...this.missingRanges],
      badLines: [],
      warnings: [...new Set(this.warnings)]
    }
  }

  reset(): void {
    this.mode = null
    this.state = 'searching'
    this.missingRanges = []
    this.lastSequence = undefined
    this.sampleCount = 0
    this.warnings = []
  }
}
