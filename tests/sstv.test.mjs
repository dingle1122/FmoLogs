import assert from 'node:assert/strict'
import { build } from 'esbuild'

const compiled = await build({
  entryPoints: ['src/core/sstv/imageDecoder.ts'], bundle: true, platform: 'node', format: 'esm', write: false
})
const { decodeSstv, detectSstvLineSync } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`)
const rate = 8000
const samples = []
let phase = 0
function tone(frequency, seconds) {
  for (let i = 0, count = Math.round(seconds * rate); i < count; i++) {
    samples.push(Math.sin(phase))
    phase += 2 * Math.PI * frequency / rate
  }
}

// Robot 36 VIS, including even parity.
tone(1900, 0.3); tone(1200, 0.01); tone(1900, 0.3); tone(1200, 0.03)
for (let bit = 0; bit < 7; bit++) tone((8 >> bit) & 1 ? 1100 : 1300, 0.03)
tone(1100, 0.03); tone(1200, 0.03)
for (let row = 0; row < 240; row++) {
  tone(1200, 0.009); tone(1500, 0.003); tone(1900, 0.088)
  tone(row % 2 ? 2300 : 1500, 0.0045); tone(1900, 0.0015); tone(1900, 0.044)
}

const audio = Float32Array.from(samples)
const full = decodeSstv(audio, rate, 'auto')
assert.equal(full.mode, 'robot36')
assert.equal(full.decodedRows, 240)
for (const row of [10, 100, 220]) {
  const pixel = (row * full.width + 160) * 4
  for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(full.pixels[pixel + channel] - 128) < 25)
}
const partial = decodeSstv(audio.subarray(0, Math.floor(audio.length * 0.6)), rate, 'auto')
assert.ok(partial.decodedRows > 0 && partial.decodedRows < 240)
assert.ok(partial.warnings.some((warning) => warning.includes('音频不足')))
assert.throws(() => decodeSstv(audio, rate, 'robot36', 100), /音频/)
assert.equal(detectSstvLineSync(audio.subarray(rate * 10, rate * 13), rate)?.mode, 'robot36')
assert.equal(detectSstvLineSync(new Float32Array(rate * 6), rate), null)
const continuousTone = Float32Array.from({ length: rate * 6 }, (_, i) => Math.sin(2 * Math.PI * 1200 * i / rate))
assert.equal(detectSstvLineSync(continuousTone, rate), null)
console.log('SSTV 合成音频、尾部截断和无效起点检查通过')

for (const [mode, vis, scan, pd] of [
  ['pd50', 93, .09152, true], ['pd90', 99, .17024, true],
  ['pd120', 95, .1216, true], ['pd160', 98, .195584, true],
  ['pd180', 96, .18304, true], ['pd240', 97, .24448, true],
  ['pd290', 94, .2288, true], ['robot72', 12, .138, false]
]) {
  samples.length = 0; phase = 0
  tone(1900, .3); tone(1200, .01); tone(1900, .3); tone(1200, .03)
  let ones = 0
  for (let bit = 0; bit < 7; bit++) {
    const set = (vis >> bit) & 1
    ones += set; tone(set ? 1100 : 1300, .03)
  }
  tone(ones % 2 ? 1100 : 1300, .03); tone(1200, .03)
  for (let row = 0; row < 8; row++) {
    if (pd) {
      tone(1200, .020); tone(1500, .00208)
      for (let channel = 0; channel < 4; channel++) tone(1900, scan)
    } else {
      tone(1200, .009); tone(1500, .003); tone(1900, scan)
      tone(1500, .0045); tone(1900, .0015); tone(1900, .069)
      tone(2300, .0045); tone(1900, .0015); tone(1900, .069)
    }
  }
  const result = decodeSstv(Float32Array.from(samples), rate, 'auto')
  assert.equal(result.mode, mode)
  assert.ok(result.decodedRows >= (pd ? 14 : 7), `${mode}: ${result.decodedRows} 行`)
  const pixel = (2 * result.width + Math.floor(result.width / 2)) * 4
  for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(result.pixels[pixel + channel] - 128) < 25, `${mode} 色彩异常`)
}
console.log('PD 系列和 Robot 72 合成音频检查通过')
