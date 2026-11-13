import { SSTV_MODES, modeByVisCode } from './sstvModes'
import type { SstvModeId } from './sstvTypes'

export interface DecodedImage {
  width: number
  height: number
  pixels: Uint8ClampedArray
  mode: SstvModeId
  detectedMode: SstvModeId | null
  startSeconds: number
  frequencyOffsetHz: number
  decodedRows: number
  warnings: string[]
}

// Positive zero-crossing intervals preserve the original sample clock and avoid
// the aliasing caused by downsampling without a low-pass filter.
function frequencyTrace(samples: Float32Array, rate: number): Float32Array {
  const trace = new Float32Array(samples.length)
  let previous = -1
  let previousFrequency = 0
  for (let i = 1; i < samples.length; i++) {
    if (samples[i - 1] <= 0 && samples[i] > 0) {
      const crossing = i - samples[i] / (samples[i] - samples[i - 1])
      if (previous >= 0) {
        const frequency = rate / (crossing - previous)
        const from = Math.max(0, Math.ceil(previous))
        const to = Math.min(samples.length, Math.ceil(crossing))
        trace.fill(frequency, from, to)
        previousFrequency = frequency
      }
      previous = crossing
    }
  }
  if (previous >= 0) trace.fill(previousFrequency, Math.ceil(previous))
  // A short median filter removes isolated zero-crossing spikes from clipped
  // or noisy FM audio without blurring real SSTV tone transitions.
  for (let i = 1; i + 1 < trace.length; i++) {
    const a = trace[i - 1]; const b = trace[i]; const c = trace[i + 1]
    if (a > 0 && b > 0 && c > 0) {
      trace[i] = a + b + c - Math.min(a, b, c) - Math.max(a, b, c)
    }
  }
  return trace
}

// Remove a quiet tail left by squelch or transmitter release. It cannot carry
// valid SSTV pixels and otherwise may become colored garbage at the bottom.
function trimQuietTail(samples: Float32Array, rate: number): Float32Array {
  const window = Math.max(1, Math.round(rate * 0.02))
  const quietLimit = Math.max(window * 4, Math.round(rate * 0.08))
  let quiet = 0
  for (let end = samples.length; end > 0; end -= window) {
    const start = Math.max(0, end - window)
    let energy = 0
    for (let i = start; i < end; i++) energy += samples[i] * samples[i]
    if (energy / (end - start) < 0.000025) quiet += end - start
    else break
  }
  if (quiet < quietLimit) return samples
  return samples.slice(0, Math.max(1, samples.length - quiet))
}

function average(trace: Float32Array, rate: number, seconds: number, width = 0.008): number {
  const start = Math.max(0, Math.floor((seconds - width / 2) * rate))
  const end = Math.min(trace.length, Math.ceil((seconds + width / 2) * rate))
  if (end <= start) return 0
  let sum = 0
  for (let i = start; i < end; i++) sum += trace[i]
  return sum / (end - start)
}

function findHeader(trace: Float32Array, rate: number): { start: number; mode: SstvModeId | null; offset: number } | null {
  const end = Math.min(trace.length / rate - 0.92, 30)
  for (let t = 0; t < end; t += 0.005) {
    const leader = [0.08, 0.18, 0.26, 0.37, 0.47, 0.57].map((v) => average(trace, rate, t + v))
    const offset = leader.reduce((a, b) => a + b, 0) / leader.length - 1900
    if (Math.abs(offset) > 180 || leader.some((f) => Math.abs(f - 1900 - offset) > 75)) continue
    if (Math.abs(average(trace, rate, t + 0.305, 0.004) - 1200 - offset) > 100) continue
    if (Math.abs(average(trace, rate, t + 0.625, 0.012) - 1200 - offset) > 100) continue
    let code = 0
    let ones = 0
    let valid = true
    for (let bit = 0; bit < 8; bit++) {
      const f = average(trace, rate, t + 0.655 + bit * 0.03, 0.015) - offset
      if (Math.abs(f - 1100) < 90) { ones++; if (bit < 7) code |= 1 << bit }
      else if (Math.abs(f - 1300) >= 90) valid = false
    }
    if (!valid || ones % 2 !== 0 || Math.abs(average(trace, rate, t + 0.895, 0.015) - 1200 - offset) > 100) continue
    return { start: t + 0.91, mode: modeByVisCode(code)?.id ?? null, offset }
  }
  return null
}

/** 检测完整 VIS，供实时接收器在短音频窗口中寻找图像。 */
export function detectSstvHeader(samples: Float32Array, rate: number) {
  if (rate < 6000 || samples.length < rate * 0.92) return null
  return findHeader(frequencyTrace(samples, rate), rate)
}

/** Infer a mode only from several consecutive, consistently spaced sync pulses. */
export function detectSstvLineSync(samples: Float32Array, rate: number): { mode: SstvModeId; start: number; offset: number } | null {
  if (rate < 6000 || samples.length < rate * 2) return null
  const trace = frequencyTrace(samples, rate)
  const pulses: Array<{ start: number; duration: number; frequency: number }> = []
  let begin = -1
  let sum = 0
  let count = 0
  const step = 0.002
  for (let t = step; t < samples.length / rate; t += step) {
    const frequency = average(trace, rate, t, 0.0015)
    if (frequency >= 1100 && frequency <= 1300) {
      if (begin < 0) { begin = t; sum = 0; count = 0 }
      sum += frequency; count++
    } else if (begin >= 0) {
      const duration = t - begin
      if (duration >= 0.006 && duration <= 0.023) pulses.push({ start: begin - step / 2, duration, frequency: sum / count })
      begin = -1
    }
  }
  const candidates: Array<{ mode: SstvModeId; start: number; offset: number; error: number }> = []
  for (const mode of Object.values(SSTV_MODES)) {
    const expected = mode.lineDurationMs / 1000
    const sync = mode.syncDurationMs / 1000
    for (let i = 0; i + 3 < pulses.length; i++) {
      const group = pulses.slice(i, i + 4)
      if (group.some((pulse) => Math.abs(pulse.duration - sync) > 0.004)) continue
      const distances = group.slice(1).map((pulse, index) => pulse.start - group[index].start)
      if (distances.some((distance) => Math.abs(distance - expected) > 0.004)) continue
      const offset = group.reduce((sum, pulse) => sum + pulse.frequency - 1200, 0) / group.length
      if (group.some((pulse) => Math.abs(pulse.frequency - 1200 - offset) > 40)) continue
      const error = distances.reduce((sum, distance) => sum + Math.abs(distance - expected), 0)
      candidates.push({ mode: mode.id, start: group[0].start, offset, error })
    }
  }
  candidates.sort((a, b) => a.error - b.error)
  if (!candidates.length) return null
  const best = candidates[0]
  if (candidates.some((candidate) => candidate.mode !== best.mode && candidate.error < best.error + 0.003)) return null
  return best
}

function channel(trace: Float32Array, rate: number, start: number, duration: number, width: number, offset: number): Float32Array {
  const values = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    const pixelStart = (start + duration * x / width) * rate
    const pixelEnd = (start + duration * (x + 1) / width) * rate
    let sum = 0
    let weight = 0
    for (let i = Math.max(0, Math.floor(pixelStart)); i < Math.min(trace.length, Math.ceil(pixelEnd)); i++) {
      const overlap = Math.max(0, Math.min(i + 1, pixelEnd) - Math.max(i, pixelStart))
      sum += trace[i] * overlap
      weight += overlap
    }
    const f = (weight ? sum / weight : 1500) - offset
    values[x] = Math.max(0, Math.min(255, (f - 1500) * 255 / 800))
  }
  return values
}

function writeRow(pixels: Uint8ClampedArray, width: number, row: number, y: Float32Array, cr: Float32Array, cb: Float32Array): void {
  for (let x = 0; x < width; x++) {
    const i = (row * width + x) * 4
    const r = cr[x] - 128
    const b = cb[x] - 128
    pixels[i] = y[x] + 1.402 * r
    pixels[i + 1] = y[x] - 0.714136 * r - 0.344136 * b
    pixels[i + 2] = y[x] + 1.772 * b
    pixels[i + 3] = 255
  }
}

function alignSync(trace: Float32Array, rate: number, expected: number, duration: number, offset: number): number | null {
  let best = expected
  let bestScore = Infinity
  const end = expected + duration
  for (let candidate = end - 0.012; candidate <= end + 0.012; candidate += 0.0005) {
    const before = average(trace, rate, candidate - 0.002, 0.002) - offset
    const after = average(trace, rate, candidate + 0.001, 0.0015) - offset
    const score = Math.abs(before - 1200) + Math.abs(after - 1500) + Math.abs(candidate - end) * 1000
    if (score < bestScore) { bestScore = score; best = candidate - duration }
  }
  return bestScore < 180 ? best : null
}

/** 用多行同步拟合采样时钟，避免逐行量化误差造成水平抖动。 */
function lineClock(trace: Float32Array, rate: number, start: number, duration: number, sync: number, count: number, offset: number): { starts: number[]; uncertain: boolean } {
  const observations: Array<{ row: number; time: number }> = []
  const starts: number[] = []
  let expected = start
  for (let row = 0; row < count && expected < trace.length / rate; row++) {
    const matched = alignSync(trace, rate, expected, sync, offset)
    const time = matched ?? expected
    starts.push(time)
    if (matched !== null) observations.push({ row, time })
    expected = time + duration
  }
  if (observations.length < 3) return { starts, uncertain: true }

  const fit = (points: typeof observations) => {
    const meanRow = points.reduce((sum, p) => sum + p.row, 0) / points.length
    const meanTime = points.reduce((sum, p) => sum + p.time, 0) / points.length
    const denominator = points.reduce((sum, p) => sum + (p.row - meanRow) ** 2, 0)
    const slope = points.reduce((sum, p) => sum + (p.row - meanRow) * (p.time - meanTime), 0) / denominator
    return { slope, intercept: meanTime - slope * meanRow }
  }
  let model = fit(observations)
  let inliers = observations.filter((p) => Math.abs(p.time - (model.intercept + p.row * model.slope)) <= 0.002)
  if (inliers.length < Math.max(3, observations.length * 0.8) || Math.abs(model.slope / duration - 1) > 0.01) {
    return { starts, uncertain: true }
  }
  model = fit(inliers)
  inliers = inliers.filter((p) => Math.abs(p.time - (model.intercept + p.row * model.slope)) <= 0.0015)
  if (inliers.length < Math.max(3, observations.length * 0.7)) return { starts, uncertain: true }
  model = fit(inliers)
  return {
    starts: starts.map((_, row) => model.intercept + row * model.slope),
    uncertain: observations.length < starts.length * 0.8
  }
}

export function decodeSstv(samples: Float32Array, rate: number, selectedMode: SstvModeId | 'auto', manualStart?: number, estimatedOffset?: number): DecodedImage {
  if (!samples.length || rate < 6000) throw new Error('音频为空或采样率过低')
  const audio = trimQuietTail(samples, rate)
  const trace = frequencyTrace(audio, rate)
  const header = findHeader(trace, rate)
  const inferred = header ? null : detectSstvLineSync(samples, rate)
  const modeId = selectedMode === 'auto' ? (header?.mode ?? inferred?.mode) : selectedMode
  if (!modeId) throw new Error('未识别到受支持的 VIS 模式，请手动选择模式及图像起点')
  const mode = SSTV_MODES[modeId]
  const start = manualStart ?? header?.start ?? inferred?.start
  if (start === undefined || !Number.isFinite(start) || start < 0) throw new Error('未检测到完整头部，请手动填写图像起点')
  const offset = header?.offset ?? estimatedOffset ?? inferred?.offset ?? 0
  const pixels = new Uint8ClampedArray(mode.width * mode.height * 4)
  const warnings: string[] = []
  let rows = 0
  if (selectedMode !== 'auto' && header?.mode && header.mode !== selectedMode) warnings.push(`VIS 识别为 ${SSTV_MODES[header.mode].name}，与手选模式不一致`)
  if (!header && inferred) warnings.push('未检测到完整 VIS，模式和图像起点由连续行同步推测；缺失的顶部行数未知')
  else if (!header && estimatedOffset === undefined) warnings.push('未检测到完整头部，频率偏移无法自动校准')
  if (modeId === 'robot36') {
    const line = 0.15
    const ys: Float32Array[] = []
    const chroma: Float32Array[] = []
    const clock = lineClock(trace, rate, start, line, 0.009, mode.height, offset)
    const firstSeparator = average(trace, rate, (clock.starts[0] ?? start) + 0.10225, 0.003) - offset
    const startsWithCb = Math.abs(firstSeparator - 2300) < Math.abs(firstSeparator - 1500)
    if (clock.uncertain) warnings.push('部分行同步不可靠，图像可能出现错位')
    for (let row = 0; row < mode.height; row++) {
      const t = clock.starts[row]
      if (t === undefined) break
      if (t + line > audio.length / rate + 0.002) break
      ys.push(channel(trace, rate, t + 0.012, 0.088, mode.width, offset))
      chroma.push(channel(trace, rate, t + 0.106, 0.044, mode.width, offset))
      rows++
    }
    for (let row = 0; row < rows; row++) {
      const even = row - (row + (startsWithCb ? 1 : 0)) % 2
      const neutral = new Float32Array(mode.width).fill(128)
      writeRow(pixels, mode.width, row, ys[row], chroma[even] ?? chroma[even + 2] ?? neutral, chroma[even + 1] ?? neutral)
    }
  } else if (modeId === 'robot72') {
    const line = mode.lineDurationMs / 1000
    const clock = lineClock(trace, rate, start, line, 0.009, mode.height, offset)
    if (clock.uncertain) warnings.push('部分行同步不可靠，图像可能出现错位')
    for (let row = 0; row < mode.height; row++) {
      const t = clock.starts[row]
      if (t === undefined || t + line > audio.length / rate + 0.002) break
      const y = channel(trace, rate, t + 0.012, 0.138, mode.width, offset)
      const cr = channel(trace, rate, t + 0.156, 0.069, mode.width, offset)
      const cb = channel(trace, rate, t + 0.231, 0.069, mode.width, offset)
      writeRow(pixels, mode.width, row, y, cr, cb)
      rows++
    }
  } else {
    const scan = (mode.lineDurationMs / 1000 - 0.02208) / 4
    const line = 0.02208 + scan * 4
    const clock = lineClock(trace, rate, start, line, 0.020, mode.height / 2, offset)
    if (clock.uncertain) warnings.push('部分行同步不可靠，图像可能出现错位')
    for (let row = 0; row < mode.height; row += 2) {
      const t = clock.starts[row / 2]
      if (t === undefined) break
      if (t + line > audio.length / rate + 0.002) break
      const base = t + 0.02208
      const y0 = channel(trace, rate, base, scan, mode.width, offset)
      const cr = channel(trace, rate, base + scan, scan, mode.width, offset)
      const cb = channel(trace, rate, base + scan * 2, scan, mode.width, offset)
      const y1 = channel(trace, rate, base + scan * 3, scan, mode.width, offset)
      writeRow(pixels, mode.width, row, y0, cr, cb)
      writeRow(pixels, mode.width, row + 1, y1, cr, cb)
      rows += 2
    }
  }
  if (rows === 0) throw new Error('图像起点之后没有足够的音频，无法恢复完整行')
  if (rows < mode.height) warnings.push(`音频不足，已恢复 ${rows}/${mode.height} 行`)
  return { width: mode.width, height: mode.height, pixels, mode: modeId, detectedMode: header?.mode ?? null, startSeconds: start, frequencyOffsetHz: offset, decodedRows: rows, warnings }
}
