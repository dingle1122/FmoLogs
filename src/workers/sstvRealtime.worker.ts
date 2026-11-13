import { decodeSstv, detectSstvHeader, detectSstvLineSync } from '../core/sstv/imageDecoder'
import { SSTV_MODES } from '../core/sstv/sstvModes'
import type { SstvModeId } from '../core/sstv/sstvTypes'

interface IncomingChunk {
  type: 'pcm'
  samples: ArrayBuffer
  sampleRate: number
  generation: number
  sampleOffset: number
}
interface Session {
  mode: SstvModeId
  chunks: Float32Array[]
  length: number
  target: number
  lastProgress: number
  lastPreviewLength: number
  previewLineSamples: number
  inferredStart?: number
  inferredOffset?: number
  quietSamples: number
}

let search: Float32Array = new Float32Array(0)
let pendingScan = 0
let session: Session | null = null
let generation: number | null = null
let expectedOffset: number | null = null
let sampleRate = 0
let idleTimer: ReturnType<typeof setTimeout> | null = null

function join(chunks: Float32Array[], length: number): Float32Array {
  const output = new Float32Array(length)
  let position = 0
  for (const chunk of chunks) { output.set(chunk, position); position += chunk.length }
  return output
}

function finish(interrupted: boolean): Float32Array {
  const current = session
  if (!current) return new Float32Array(0)
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = null
  session = null
  const audio = join(current.chunks, current.length)
  const remainder = interrupted ? new Float32Array(0) : audio.slice(Math.min(audio.length, current.target))
  try {
    const result = decodeSstv(audio, sampleRate, current.mode, current.inferredStart, current.inferredOffset)
    if (current.inferredStart !== undefined) result.warnings.push('未接收到图像头部，模式由行同步推测；缺失的顶部行数未知')
    if (interrupted) result.warnings.push('音频流中断，图像可能不完整')
    self.postMessage({ type: 'result', result }, { transfer: [result.pixels.buffer] })
  } catch (err) {
    self.postMessage({ type: 'notice', message: err instanceof Error ? err.message : '实时图像解析失败' })
  }
  return remainder
}

function scheduleIdleFinish() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    if (!session) return
    const interrupted = session.length < session.target - sampleRate * 0.2
    finish(interrupted)
    self.postMessage({ type: 'waiting' })
  }, 3000)
}

function reset(interrupted: boolean) {
  if (interrupted && session) finish(true)
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = null
  search = new Float32Array(0)
  pendingScan = 0
  session = null
  generation = null
  expectedOffset = null
  sampleRate = 0
}

function process(samples: Float32Array) {
  if (!samples.length) return
  if (session) {
    session.chunks.push(samples)
    session.length += samples.length
    let energy = 0
    for (const sample of samples) energy += sample * sample
    session.quietSamples = energy / samples.length < 0.000025 ? session.quietSamples + samples.length : 0
    const progress = Math.min(100, Math.round(session.length / session.target * 100))
    if (progress !== session.lastProgress) {
      session.lastProgress = progress
      self.postMessage({ type: 'progress', mode: session.mode, progress, inferred: session.inferredStart !== undefined })
    }
    if (session.quietSamples >= sampleRate * 3) {
      finish(true)
      search = new Float32Array(0)
      pendingScan = 0
      self.postMessage({ type: 'waiting' })
    } else if (session.length >= session.target) {
      const remainder = finish(false)
      search = new Float32Array(0)
      pendingScan = 0
      self.postMessage({ type: 'waiting' })
      process(remainder)
    } else {
      // Decode at completed line boundaries. This follows the SSTV signal
      // instead of polling on a wall-clock interval.
      if (session.length - session.lastPreviewLength >= session.previewLineSamples) {
        session.lastPreviewLength = session.length
        try {
          const preview = decodeSstv(join(session.chunks, session.length), sampleRate, session.mode, session.inferredStart, session.inferredOffset)
          if (session.inferredStart !== undefined) preview.warnings.push('未接收到图像头部，模式由行同步推测；缺失的顶部行数未知')
          self.postMessage({ type: 'preview', result: preview }, { transfer: [preview.pixels.buffer] })
        } catch {
          // A complete image line may not have arrived yet.
        }
      }
      scheduleIdleFinish()
    }
    return
  }
  const combined = join([search, samples], search.length + samples.length)
  const limit = Math.ceil(sampleRate * 6)
  search = combined.length > limit ? combined.slice(combined.length - limit) : combined
  pendingScan += samples.length
  if (search.length < sampleRate * 1.05 || pendingScan < sampleRate * 0.2) return
  pendingScan = 0
  const header = detectSstvHeader(search, sampleRate)
  const inferred = header?.mode ? null : detectSstvLineSync(search, sampleRate)
  const modeId = header?.mode ?? inferred?.mode
  if (!modeId) return
  const start = header?.mode ? header.start : inferred!.start
  const mode = SSTV_MODES[modeId]
  const lineCount = mode.id.startsWith('robot') ? mode.height : mode.height / 2
  const target = Math.ceil((start + lineCount * mode.lineDurationMs / 1000 + 0.05) * sampleRate)
  session = { mode: mode.id, chunks: [search], length: search.length, target, lastProgress: -1, lastPreviewLength: 0, previewLineSamples: Math.max(1, Math.ceil(sampleRate * mode.lineDurationMs / 1000)), inferredStart: inferred?.start, inferredOffset: inferred?.offset, quietSamples: 0 }
  search = new Float32Array(0)
  self.postMessage({ type: 'started', mode: mode.id })
  self.postMessage({ type: 'progress', mode: mode.id, progress: Math.min(100, Math.round(session.length / target * 100)), inferred: !!inferred })
  if (session.length >= target) { const remainder = finish(false); self.postMessage({ type: 'waiting' }); process(remainder) }
  else scheduleIdleFinish()
}

self.onmessage = (event: MessageEvent<IncomingChunk | { type: 'reset' } | { type: 'stop' }>) => {
  const message = event.data
  if (message.type === 'stop') { reset(true); self.postMessage({ type: 'stopped' }); return }
  if (message.type === 'reset') { reset(true); self.postMessage({ type: 'waiting' }); return }
  try {
    if (!message.sampleRate || message.samples.byteLength % 2) { reset(true); return }
    const generationChanged = generation !== null && generation !== message.generation
    const rateChanged = sampleRate !== 0 && sampleRate !== message.sampleRate
    const offsetGap = expectedOffset !== null && expectedOffset !== message.sampleOffset
    if (generationChanged || rateChanged || offsetGap) {
      reset(true)
      // Offset gaps are expected when the UI drops queued chunks to keep the
      // worker real-time.  Re-sync silently; only a new connection or sample
      // rate is worth showing as a user-facing interruption.
      if (generationChanged || rateChanged) {
        self.postMessage({ type: 'notice', message: '音频连接已变化，重新等待 SSTV 信号' })
      }
    }
    generation = message.generation
    sampleRate = message.sampleRate
    const pcm = new Int16Array(message.samples)
    expectedOffset = message.sampleOffset + pcm.length
    const float = new Float32Array(pcm.length)
    for (let i = 0; i < pcm.length; i++) float[i] = pcm[i] / 32768
    process(float)
  } finally {
    self.postMessage({ type: 'ack' })
  }
}
