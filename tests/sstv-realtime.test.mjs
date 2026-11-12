import assert from 'node:assert/strict'
import { Worker } from 'node:worker_threads'
import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'

const output = await build({ entryPoints: ['src/workers/sstvRealtime.worker.ts'], bundle: true, platform: 'browser', format: 'iife', write: false })
const workerCode = `const { parentPort } = require('node:worker_threads');
globalThis.self = { postMessage: (value, options) => parentPort.postMessage(value, options?.transfer) };
parentPort.on('message', (data) => self.onmessage({ data }));\n${output.outputFiles[0].text}`

function recording(lines) {
  const samples = []
  let phase = 0
  function tone(frequency, seconds) {
    for (let i = 0; i < Math.round(seconds * 8000); i++) {
      samples.push(Math.round(Math.sin(phase) * 30000)); phase += 2 * Math.PI * frequency / 8000
    }
  }
  tone(1900, .3); tone(1200, .01); tone(1900, .3); tone(1200, .03)
  for (let bit = 0; bit < 7; bit++) tone((8 >> bit) & 1 ? 1100 : 1300, .03)
  tone(1100, .03); tone(1200, .03)
  for (let row = 0; row < lines; row++) {
    tone(1200, .009); tone(1500, .003); tone(1900, .088)
    tone(row % 2 ? 2300 : 1500, .0045); tone(1900, .0015); tone(1900, .044)
  }
  return Int16Array.from(samples)
}

function send(worker, pcm, generation) {
  for (let offset = 0; offset < pcm.length; offset += 1600) {
    const chunk = pcm.slice(offset, offset + 1600)
    worker.postMessage({ type: 'pcm', samples: chunk.buffer, sampleRate: 8000, generation, sampleOffset: offset }, [chunk.buffer])
  }
}

function waitForResult(worker) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('实时解码超时')), 10000)
    worker.on('error', reject)
    worker.on('message', (message) => {
      if (message.type === 'result') { clearTimeout(timer); resolve(message.result) }
    })
  })
}

const completeWorker = new Worker(workerCode, { eval: true })
let previewCount = 0
completeWorker.on('message', (message) => {
  if (message.type === 'preview') {
    previewCount++
    assert.ok(message.result.decodedRows > 0 && message.result.decodedRows < 240)
  }
})
const completePromise = waitForResult(completeWorker)
const full = recording(240)
const padded = new Int16Array(full.length + 1600); padded.set(full)
send(completeWorker, padded, 1)
const complete = await completePromise
assert.equal(complete.mode, 'robot36')
assert.equal(complete.decodedRows, 240)
assert.ok(previewCount > 0, '接收过程中应显示预览')
await completeWorker.terminate()

const partialWorker = new Worker(workerCode, { eval: true })
const partialPromise = waitForResult(partialWorker)
send(partialWorker, recording(80), 2)
partialWorker.postMessage({ type: 'reset' })
const partial = await partialPromise
assert.ok(partial.decodedRows > 0 && partial.decodedRows < 240)
assert.ok(partial.warnings.some((warning) => warning.includes('中断')))
await partialWorker.terminate()
const stoppedWorker = new Worker(workerCode, { eval: true })
const stoppedResult = waitForResult(stoppedWorker)
send(stoppedWorker, recording(80), 3)
stoppedWorker.postMessage({ type: 'stop' })
const stopped = await stoppedResult
assert.ok(stopped.decodedRows > 0 && stopped.decodedRows < 240)
assert.ok(stopped.warnings.some((warning) => warning.includes('中断')))
await stoppedWorker.terminate()
const midstreamWorker = new Worker(workerCode, { eval: true })
const midstreamResult = waitForResult(midstreamWorker)
send(midstreamWorker, full.subarray(8000 * 10), 4)
midstreamWorker.postMessage({ type: 'stop' })
const midstream = await midstreamResult
assert.equal(midstream.mode, 'robot36')
assert.ok(midstream.decodedRows > 0 && midstream.decodedRows < 240)
assert.ok(midstream.warnings.some((warning) => warning.includes('行同步推测')))
await midstreamWorker.terminate()
const silentWorker = new Worker(workerCode, { eval: true })
const silentResult = waitForResult(silentWorker)
const tail = full.subarray(8000 * 10)
const tailWithSilence = new Int16Array(tail.length + 8000 * 4)
tailWithSilence.set(tail)
send(silentWorker, tailWithSilence, 5)
const silent = await silentResult
assert.equal(silent.mode, 'robot36')
assert.ok(silent.warnings.some((warning) => warning.includes('行同步推测')))
await silentWorker.terminate()
console.log('实时分块解码和断流处理检查通过')

for (const [index, path] of process.argv.slice(2).entries()) {
  const expected = ['pd120', 'pd90', 'robot36'][index]
  const converted = spawnSync('ffmpeg', ['-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '8000', 'pipe:1'], { maxBuffer: 32 * 1024 * 1024 })
  assert.equal(converted.status, 0, converted.stderr.toString())
  const bytes = converted.stdout
  const pcm = new Int16Array(bytes.length / 2)
  for (let i = 0; i < pcm.length; i++) pcm[i] = bytes.readInt16LE(i * 2)
  const worker = new Worker(workerCode, { eval: true })
  const resultPromise = waitForResult(worker)
  send(worker, pcm, index + 10)
  worker.postMessage({ type: 'reset' })
  const result = await resultPromise
  assert.equal(result.mode, expected)
  assert.ok(result.decodedRows > 0)
  console.log(`${expected}: ${result.decodedRows}/${result.height} 行`)
  await worker.terminate()
  const midWorker = new Worker(workerCode, { eval: true })
  const midPromise = waitForResult(midWorker)
  send(midWorker, pcm.subarray(Math.floor(pcm.length / 2)), index + 20)
  midWorker.postMessage({ type: 'stop' })
  const midResult = await midPromise
  assert.equal(midResult.mode, expected)
  assert.ok(midResult.decodedRows > 0 && midResult.decodedRows < midResult.height)
  assert.ok(midResult.warnings.some((warning) => warning.includes('行同步推测')))
  console.log(`${expected} 中途接收: ${midResult.decodedRows}/${midResult.height} 行`)
  await midWorker.terminate()
}
