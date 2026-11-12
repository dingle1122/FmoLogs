export interface WavAudio {
  samples: Float32Array
  sampleRate: number
  channels: number
  bitsPerSample: number
}

function readAscii(view: DataView, offset: number, length: number): string {
  let value = ''
  for (let i = 0; i < length; i++) value += String.fromCharCode(view.getUint8(offset + i))
  return value
}

/** 读取未压缩 PCM WAV，支持 8/16/24/32-bit 和多声道输入。 */
export function readPcmWav(buffer: ArrayBuffer): WavAudio {
  const view = new DataView(buffer)
  if (readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE') {
    throw new Error('不是有效的 WAV 文件')
  }

  let format = 0
  let channels = 0
  let sampleRate = 0
  let bitsPerSample = 0
  let dataOffset = -1
  let dataSize = 0

  for (let offset = 12; offset + 8 <= view.byteLength;) {
    const id = readAscii(view, offset, 4)
    const size = view.getUint32(offset + 4, true)
    const body = offset + 8
    if (id === 'fmt ') {
      format = view.getUint16(body, true)
      channels = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
      bitsPerSample = view.getUint16(body + 14, true)
    } else if (id === 'data') {
      dataOffset = body
      dataSize = Math.min(size, view.byteLength - body)
      break
    }
    offset = body + size + (size & 1)
  }

  if (format !== 1) throw new Error('仅支持未压缩 PCM WAV')
  if (!channels || !sampleRate || ![8, 16, 24, 32].includes(bitsPerSample) || dataOffset < 0) {
    throw new Error('WAV 音频参数不完整')
  }

  const bytesPerSample = bitsPerSample / 8
  const frameSize = bytesPerSample * channels
  const frames = Math.floor(dataSize / frameSize)
  const samples = new Float32Array(frames)
  for (let frame = 0; frame < frames; frame++) {
    let sum = 0
    for (let channel = 0; channel < channels; channel++) {
      const offset = dataOffset + frame * frameSize + channel * bytesPerSample
      if (bitsPerSample === 8) {
        sum += (view.getUint8(offset) - 128) / 128
      } else if (bitsPerSample === 16) {
        sum += view.getInt16(offset, true) / 32768
      } else if (bitsPerSample === 24) {
        const value = view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16)
        sum += (value & 0x800000 ? value - 0x1000000 : value) / 8388608
      } else {
        sum += view.getInt32(offset, true) / 2147483648
      }
    }
    samples[frame] = sum / channels
  }
  return { samples, sampleRate, channels, bitsPerSample }
}

export function resampleLinear(samples: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return samples.slice()
  const outputLength = Math.max(1, Math.round(samples.length * outputRate / inputRate))
  const output = new Float32Array(outputLength)
  const ratio = inputRate / outputRate
  for (let i = 0; i < output.length; i++) {
    const position = i * ratio
    const left = Math.min(samples.length - 1, Math.floor(position))
    const right = Math.min(samples.length - 1, left + 1)
    const fraction = position - left
    output[i] = samples[left] + (samples[right] - samples[left]) * fraction
  }
  return output
}
