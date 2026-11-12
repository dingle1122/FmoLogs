import assert from 'node:assert/strict'
import { build } from 'esbuild'

let statusListener = () => {}
let startConfig
let muted = false
globalThis.__testPlatform = {
  capabilities: { hasNativeAudio: true },
  background: { async enable() {}, async disable() {} },
  audio: {
    onStatus(cb) { statusListener = cb; return () => {} },
    onMuteChanged() { return () => {} },
    async stop() { statusListener('disconnected') },
    async start(config) {
      startConfig = config
      muted = config.muted
      statusListener('disconnected')
      statusListener('connecting')
    },
    async setMuted(value) { muted = value },
    async setVolume() {}, async resume() {}
  }
}

const compiled = await build({
  stdin: { contents: `import { createPinia, setActivePinia } from 'pinia'; import { useAudioPlayerStore } from './src/stores/audioPlayerStore'; setActivePinia(createPinia()); export { useAudioPlayerStore };`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'mock-platform', setup(build) {
    build.onResolve({ filter: /^\.\.\/platform$/ }, () => ({ path: 'platform', namespace: 'test' }))
    build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const getPlatform = () => globalThis.__testPlatform', loader: 'js' }))
  } }]
})
const { useAudioPlayerStore } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`).catch((error) => { throw new Error(error.message) })
globalThis.document = { addEventListener() {} }
const store = useAudioPlayerStore()
await store.startAudio('example.test', 'ws', true)
assert.equal(startConfig.muted, true)
assert.equal(muted, true)
assert.equal(store.isMuted, true)
assert.equal(store.isPlaying, true)
await store.unmuteAudio()
assert.equal(muted, false)
assert.equal(store.isMuted, false)
await store.stopAudio()
assert.equal(store.isPlaying, false)
console.log('静音启动及状态同步检查通过')
