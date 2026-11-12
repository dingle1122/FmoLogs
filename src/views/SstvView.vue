<template>
  <div class="sstv-view">
    <div class="sstv-content">
      <section class="card">
        <div class="workspace-header">
          <span class="card-title">SSTV</span>
          <div class="actions">
          <button class="btn-secondary" :disabled="busy || liveActive || liveStarting" @click="fileInput?.click()">选择音频</button>
          <button class="btn-secondary" :disabled="busy || liveStarting || liveStopping" @click="toggleLive">{{ liveActive ? '停止监听' : '开始监听' }}</button>
          <input ref="fileInput" class="file-input" type="file" accept=".wav,audio/wav" @change="loadFile" />
          </div>
        </div>
        <div class="result-section">
          <div class="image-wrap"><img v-if="imageUrl" :src="imageUrl" alt="SSTV 解析图像" /><span v-else class="image-placeholder">选择音频或开始监听</span></div>
          <div class="result-bar">
            <div class="result-status" role="status">{{ resultStatus }}</div>
            <div class="result-actions"><button class="btn-secondary" :disabled="!result || busy" @click="clearResult">清空</button><button class="btn-secondary" :disabled="!result || busy" @click="downloadImage">导出 PNG</button></div>
          </div>
          <div v-if="result" class="result-info"><span>{{ modeName }}</span><span>起点 {{ result.startSeconds.toFixed(3) }} 秒</span><span>频移 {{ Math.round(result.frequencyOffsetHz) }} Hz</span></div>
          <p v-for="warning in visibleWarnings" :key="warning" class="setting-hint">{{ warning }}</p>
        </div>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <details class="advanced">
          <summary>高级设置</summary>
          <div v-if="fileName" class="file-info">{{ fileName }} · {{ duration.toFixed(1) }} 秒</div>
          <p v-if="liveActive" class="setting-hint">离开页面后停止监听；后台接收可能受系统限制。</p>
          <div class="setting-row">
            <label class="setting-label" for="sstv-mode">解析模式</label>
            <select id="sstv-mode" v-model="modeId" class="field">
              <option value="auto">自动识别</option><option v-for="mode in SSTV_MODES" :key="mode.id" :value="mode.id">{{ mode.name }}</option>
            </select>
          </div>
          <div class="setting-row">
            <div><label class="setting-label" for="sstv-start">图像起点（秒）</label><div class="setting-hint">留空自动检测，头部缺失时可手动指定</div></div>
            <input id="sstv-start" v-model="startInput" class="field offset" type="number" min="0" step="0.001" placeholder="自动" />
          </div>
          <button v-if="samples.length" class="btn-secondary reparse" :disabled="busy || liveActive || liveStarting" @click="decode">应用设置并重新解析</button>
        </details>
      </section>
      <section class="card">
        <div class="card-header"><span class="card-title">解析历史</span><button v-if="history.length || historyManage" class="btn-secondary" :disabled="historyBusy || busy" @click="toggleHistoryManage">{{ historyManage ? '完成' : '管理' }}</button></div>
        <p v-if="historyError" class="error" role="alert">{{ historyError }}</p>
        <div v-if="historyManage && history.length" class="history-toolbar">
          <label><input type="checkbox" :checked="allHistorySelected" :disabled="historyBusy" @change="toggleAllHistory" /> 全选</label>
          <span>已选 {{ selectedHistoryIds.length }} 项</span>
          <button class="btn-secondary" :disabled="!selectedHistoryIds.length || historyBusy" @click="beginRenameSelected">重命名</button>
          <button class="btn-secondary" :disabled="!selectedHistoryIds.length || historyBusy" @click="downloadSelectedHistory">下载</button>
          <button class="btn-secondary" :disabled="!selectedHistoryIds.length || historyBusy" @click="removeSelectedHistory">删除</button>
        </div>
        <form v-if="renameIds.length" class="rename-form" @submit.prevent="applyRename">
          <label for="history-name">{{ renameIds.length > 1 ? '批量名称' : '名称' }}</label>
          <input id="history-name" v-model="renameValue" class="field rename-input" maxlength="80" required placeholder="输入名称" />
          <span v-if="renameIds.length > 1" class="setting-hint">按时间从早到晚追加编号</span>
          <button class="btn-secondary" :disabled="historyBusy || !renameValue.trim()" type="submit">保存</button>
          <button class="btn-secondary" :disabled="historyBusy" type="button" @click="renameIds = []">取消</button>
        </form>
        <div v-if="!history.length" class="empty history-empty">暂无解析记录</div>
        <div v-else class="history-grid">
          <div v-for="item in history" :key="item.id" class="history-item" :class="{ 'is-selected': item.id !== undefined && selectedHistoryIds.includes(item.id) }">
            <button class="history-preview" :disabled="busy || historyBusy" :aria-pressed="historyManage ? selectedHistoryIds.includes(item.id!) : undefined" :title="`${historyName(item)} · ${item.fileName} · ${formatTime(item.createdAt)}`" @click="historyManage ? toggleHistorySelection(item) : showHistory(item)">
              <span v-if="historyManage" class="selection-indicator" aria-hidden="true">{{ selectedHistoryIds.includes(item.id!) ? '✓' : '' }}</span>
              <img :src="item.preview" :alt="`${SSTV_MODES[item.mode].name} 解析预览`" />
              <span class="history-name">{{ historyName(item) }}</span>
              <span v-if="item.displayName" class="history-detail">{{ SSTV_MODES[item.mode].name }}</span>
              <time class="history-time" :datetime="new Date(item.createdAt).toISOString()">{{ formatHistoryTime(item.createdAt) }}</time>
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { decodeSstv, readPcmWav, SSTV_MODES } from '../core'
import type { DecodedImage, SstvModeId } from '../core'
import { deleteSstvHistories, listSstvHistory, renameSstvHistories, saveSstvHistory } from '../services/sstvHistory'
import { createSstvZip, historyImageName } from '../services/sstvZip'
import type { SstvHistoryEntry } from '../services/sstvHistory'
import { getPlatform } from '../platform'
import { useAudioPlayerStore } from '../stores/audioPlayerStore'
import { useSettingsStore } from '../stores/settingsStore'
import confirmDialog from '../composables/useConfirm'

const modeId = ref<SstvModeId | 'auto'>('auto')
const fileInput = ref<HTMLInputElement | null>(null)
const startInput = ref('')
const fileName = ref('')
const resultFileName = ref('')
const duration = ref(0)
const sampleRate = ref(0)
const samples = shallowRef<Float32Array>(new Float32Array())
const imageUrl = ref('')
const result = shallowRef<DecodedImage | null>(null)
const livePreview = ref(false)
const busy = ref(false)
const audioStore = useAudioPlayerStore()
const settingsStore = useSettingsStore()
const liveActive = ref(false)
const liveStarting = ref(false)
const liveStopping = ref(false)
const liveStatus = ref('')
let liveWorker: Worker | null = null
let unsubscribePcm: (() => Promise<void>) | null = null
let unsubscribeStatus: (() => void) | null = null
let liveGeneration = 0
let ownedAudioStart: Promise<void> | null = null
let stopPromise: Promise<void> | null = null
let mounted = false
const error = ref('')
const historyError = ref('')
const historyBusy = ref(false)
const historyManage = ref(false)
const selectedHistoryIds = ref<number[]>([])
const renameIds = ref<number[]>([])
const renameValue = ref('')
const selectedHistoryId = ref<number | null>(null)
const history = shallowRef<Array<SstvHistoryEntry & { preview: string }>>([])
const modeName = computed(() => result.value ? SSTV_MODES[result.value.mode].name : '')
const allHistorySelected = computed(() => history.value.length > 0 && history.value.every((item) => item.id !== undefined && selectedHistoryIds.value.includes(item.id)))
const resultStatus = computed(() => {
  if (busy.value) return '正在解析音频'
  if (liveActive.value || liveStarting.value || liveStopping.value) {
    const status = liveStatus.value || '正在启动监听'
    return livePreview.value && result.value ? `${status} · 已恢复 ${result.value.decodedRows}/${result.value.height} 行（未保存）` : status
  }
  if (result.value) return `${livePreview.value ? '未保存的预览' : '解析完成'} · 已恢复 ${result.value.decodedRows}/${result.value.height} 行`
  return '等待音频'
})
const visibleWarnings = computed(() => (result.value?.warnings || []).filter((warning) => !livePreview.value || !warning.startsWith('音频不足')))

async function refreshHistory() {
  try {
    const entries = await listSstvHistory()
    if (!mounted) return
    const previous = history.value
    history.value = entries.map((entry) => ({ ...entry, preview: URL.createObjectURL(entry.image) }))
    if (!entries.length) {
      historyManage.value = false
      selectedHistoryIds.value = []
      renameIds.value = []
    }
    if (selectedHistoryId.value !== null) {
      const selected = history.value.find((item) => item.id === selectedHistoryId.value)
      if (selected) imageUrl.value = selected.preview
      else { imageUrl.value = ''; result.value = null; selectedHistoryId.value = null }
    }
    for (const item of previous) URL.revokeObjectURL(item.preview)
    historyError.value = ''
  } catch (err) {
    historyError.value = err instanceof Error ? err.message : '读取历史记录失败'
  }
}

onMounted(() => { mounted = true; refreshHistory() })
onBeforeUnmount(() => {
  mounted = false
  void stopLive()
  for (const item of history.value) URL.revokeObjectURL(item.preview)
})

function stopLive(message = '实时接收已停止'): Promise<void> {
  if (stopPromise) return stopPromise
  liveGeneration++
  liveActive.value = false
  liveStarting.value = false
  liveStopping.value = true
  unsubscribeStatus?.()
  unsubscribeStatus = null
  const worker = liveWorker
  liveWorker = null
  const unsubscribe = unsubscribePcm
  unsubscribePcm = null
  const audioStart = ownedAudioStart
  ownedAudioStart = null
  stopPromise = (async () => {
    const flush = worker ? new Promise<void>((resolve) => {
      const saves: Promise<void>[] = []
      const timer = setTimeout(() => {
        worker.terminate()
        historyError.value = '保存未完成的图像超时'
        resolve()
      }, 15000)
      worker.onmessage = (event) => {
        if (event.data.type === 'result') saves.push(displayAndSave(event.data.result as DecodedImage, 'FMO 实时音频'))
        else if (event.data.type === 'stopped') {
          clearTimeout(timer)
          worker.terminate()
          void Promise.all(saves).then(() => resolve())
        }
      }
      worker.onerror = () => { clearTimeout(timer); worker.terminate(); resolve() }
      worker.postMessage({ type: 'stop' })
    }) : Promise.resolve()
    if (unsubscribe) {
      try { await unsubscribe() } catch (err) { console.warn('[SSTV] 停止音频采集失败', err) }
    }
    if (audioStart) {
      try { await audioStart; await audioStore.stopAudio() }
      catch (err) { console.warn('[SSTV] 关闭音频失败', err) }
    }
    await flush
    liveStatus.value = message
  })().finally(() => { liveStopping.value = false; stopPromise = null })
  return stopPromise
}

async function toggleLive() {
  if (liveActive.value) { await stopLive(); return }
  if (liveStarting.value || liveStopping.value) return
  if (!audioStore.isPlaying && !settingsStore.fmoAddress) { error.value = '请先配置 FMO 地址'; return }
  error.value = ''
  liveStarting.value = true
  const run = ++liveGeneration
  try {
    const worker = new Worker(new URL('../workers/sstvRealtime.worker.ts', import.meta.url), { type: 'module' })
    liveWorker = worker
    let queuedChunks = 0
    let dropping = false
    worker.onmessage = (event) => {
      if (run !== liveGeneration) return
      const message = event.data
      if (message.type === 'ack') queuedChunks = Math.max(0, queuedChunks - 1)
      else if (message.type === 'progress') liveStatus.value = message.inferred ? `正在接收 ${SSTV_MODES[message.mode as SstvModeId].name}（推测）` : `正在接收 ${SSTV_MODES[message.mode as SstvModeId].name} · ${message.progress}%`
      else if (message.type === 'waiting') liveStatus.value = '等待 SSTV 信号'
      else if (message.type === 'notice') liveStatus.value = message.message
      else if (message.type === 'preview') {
        try { displayPreview(message.result as DecodedImage, 'FMO 实时音频'); livePreview.value = true }
        catch (err) { error.value = err instanceof Error ? err.message : '预览失败' }
      }
      else if (message.type === 'result') void displayAndSave(message.result as DecodedImage, 'FMO 实时音频')
    }
    worker.onerror = () => { error.value = '实时解析工作线程异常'; void stopLive('实时接收已停止') }
    unsubscribeStatus = getPlatform().audio.onStatus((status) => {
      if (status === 'reconnecting' || status === 'disconnected' || status === 'error') {
        worker.postMessage({ type: 'reset' })
        liveStatus.value = '音频连接中断，等待重新连接'
      } else if (status === 'connected') liveStatus.value = '等待 SSTV 信号'
    })
    const unsubscribe = await getPlatform().audio.onPcmChunk((chunk) => {
      if (run !== liveGeneration) return
      if (queuedChunks >= 32) {
        if (!dropping) {
          dropping = true
          worker.postMessage({ type: 'reset' })
          liveStatus.value = '解析积压，已丢弃部分音频并重新等待信号'
        }
        return
      }
      dropping = false
      const samples = chunk.samples.slice().buffer
      queuedChunks++
      worker.postMessage({ type: 'pcm', samples, sampleRate: chunk.sampleRate, generation: chunk.generation, sampleOffset: chunk.sampleOffset }, [samples])
    })
    if (run !== liveGeneration) { await unsubscribe(); return }
    unsubscribePcm = unsubscribe
    if (!audioStore.isPlaying) {
      const audioStart = audioStore.startAudio(settingsStore.fmoAddress, settingsStore.protocol, true)
      ownedAudioStart = audioStart
      await audioStart
      if (run !== liveGeneration) return
      if (!audioStore.isPlaying) throw new Error('FMO 音频启动失败')
    }
    liveActive.value = true
    liveStatus.value = '等待 SSTV 信号'
  } catch (err) {
    if (run === liveGeneration) {
      await stopLive('实时接收未启动')
      error.value = err instanceof Error ? err.message : '无法订阅实时音频'
    }
  } finally { if (run === liveGeneration) liveStarting.value = false }
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
}

function formatHistoryTime(timestamp: number) {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function historyName(item: SstvHistoryEntry) {
  return item.displayName || SSTV_MODES[item.mode].name
}

function toggleHistoryManage() {
  historyManage.value = !historyManage.value
  selectedHistoryIds.value = []
  renameIds.value = []
}

function toggleAllHistory() {
  selectedHistoryIds.value = allHistorySelected.value ? [] : history.value.flatMap((item) => item.id === undefined ? [] : [item.id])
}

function toggleHistorySelection(item: SstvHistoryEntry) {
  if (item.id === undefined) return
  selectedHistoryIds.value = selectedHistoryIds.value.includes(item.id)
    ? selectedHistoryIds.value.filter((id) => id !== item.id)
    : [...selectedHistoryIds.value, item.id]
}

function beginRenameSelected() {
  renameIds.value = [...selectedHistoryIds.value]
  const item = history.value.find((entry) => entry.id === renameIds.value[0])
  renameValue.value = renameIds.value.length === 1 && item ? historyName(item) : ''
}

async function applyRename() {
  const name = renameValue.value.trim()
  if (!name || !renameIds.value.length || historyBusy.value) return
  const selected = history.value.filter((item) => item.id !== undefined && renameIds.value.includes(item.id))
    .sort((a, b) => a.createdAt - b.createdAt || (a.id ?? 0) - (b.id ?? 0))
  if (selected.length !== renameIds.value.length) { historyError.value = '部分记录已不存在，请重新选择'; return }
  const width = Math.max(2, String(selected.length).length)
  const updates = selected.map((item, index) => ({ id: item.id!, name: selected.length === 1 ? name : `${name} ${String(index + 1).padStart(width, '0')}` }))
  historyBusy.value = true
  try { await renameSstvHistories(updates); renameIds.value = []; await refreshHistory() }
  catch (err) { historyError.value = err instanceof Error ? err.message : '重命名失败' }
  finally { historyBusy.value = false }
}

async function removeSelectedHistory() {
  const ids = [...selectedHistoryIds.value]
  if (!ids.length || historyBusy.value) return
  if (!await confirmDialog.show(`确定删除选中的 ${ids.length} 条 SSTV 解析记录吗？此操作无法撤销。`)) return
  historyBusy.value = true
  try { await deleteSstvHistories(ids); selectedHistoryIds.value = []; renameIds.value = []; await refreshHistory() }
  catch (err) { historyError.value = err instanceof Error ? err.message : '删除历史记录失败' }
  finally { historyBusy.value = false }
}

async function downloadSelectedHistory() {
  if (historyBusy.value) return
  const selected = history.value.filter((item) => item.id !== undefined && selectedHistoryIds.value.includes(item.id))
  if (!selected.length) return
  historyBusy.value = true
  try {
    const images = selected.map((item) => ({ name: historyImageName(historyName(item), item.createdAt), image: item.image, createdAt: item.createdAt }))
    const blob = images.length === 1 ? images[0].image : await createSstvZip(images)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = images.length === 1 ? `${images[0].name}.png` : 'SSTV-历史.zip'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    historyError.value = ''
  } catch (err) { historyError.value = err instanceof Error ? err.message : '下载失败' }
  finally { historyBusy.value = false }
}

function showHistory(item: SstvHistoryEntry & { preview: string }) {
  livePreview.value = false
  selectedHistoryId.value = item.id ?? null
  imageUrl.value = item.preview
  resultFileName.value = item.fileName
  result.value = {
    width: SSTV_MODES[item.mode].width, height: item.height, pixels: new Uint8ClampedArray(),
    mode: item.mode, detectedMode: null, startSeconds: item.startSeconds,
    frequencyOffsetHz: item.frequencyOffsetHz, decodedRows: item.decodedRows, warnings: item.warnings
  }
}

async function loadFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  livePreview.value = false
  busy.value = true
  selectedHistoryId.value = null
  samples.value = new Float32Array(); fileName.value = ''; duration.value = 0
  error.value = ''; imageUrl.value = ''; result.value = null; startInput.value = ''
  try {
    const wav = readPcmWav(await file.arrayBuffer())
    samples.value = wav.samples; sampleRate.value = wav.sampleRate
    duration.value = wav.samples.length / wav.sampleRate; fileName.value = file.name
    await decode()
  } catch (err) { error.value = err instanceof Error ? err.message : 'WAV 文件读取失败' }
  finally { busy.value = false; input.value = '' }
}

async function decode() {
  selectedHistoryId.value = null
  busy.value = true; error.value = ''; imageUrl.value = ''; result.value = null
  await new Promise((resolve) => setTimeout(resolve, 20))
  try {
    const start = startInput.value.trim() === '' ? undefined : Number(startInput.value)
    const decoded = decodeSstv(samples.value, sampleRate.value, modeId.value, start)
    await displayAndSave(decoded, fileName.value)
  } catch (err) { error.value = err instanceof Error ? err.message : '解析失败' }
  finally { busy.value = false }
}

function displayPreview(decoded: DecodedImage, sourceName: string): HTMLCanvasElement {
  selectedHistoryId.value = null
  const canvas = document.createElement('canvas'); canvas.width = decoded.width; canvas.height = decoded.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建图像画布')
  const image = context.createImageData(decoded.width, decoded.height)
  image.data.set(decoded.pixels); context.putImageData(image, 0, 0)
  imageUrl.value = canvas.toDataURL('image/png'); result.value = decoded; resultFileName.value = sourceName
  return canvas
}

async function displayAndSave(decoded: DecodedImage, sourceName: string) {
  try {
    const canvas = displayPreview(decoded, sourceName)
    livePreview.value = false
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('生成 PNG 失败')), 'image/png'))
      await saveSstvHistory({ createdAt: Date.now(), fileName: sourceName, mode: decoded.mode, image: blob, decodedRows: decoded.decodedRows, height: decoded.height, startSeconds: decoded.startSeconds, frequencyOffsetHz: decoded.frequencyOffsetHz, warnings: decoded.warnings })
      await refreshHistory()
    } catch (err) {
      historyError.value = `解析结果未保存：${err instanceof Error ? err.message : '存储失败'}`
    }
  } catch (err) { error.value = err instanceof Error ? err.message : '解析失败' }
}

function clearResult() {
  livePreview.value = false
  selectedHistoryId.value = null
  imageUrl.value = ''
  result.value = null
  resultFileName.value = ''
}

function downloadImage() {
  const link = document.createElement('a'); link.href = imageUrl.value
  link.download = `${resultFileName.value.replace(/\.wav$/i, '')}-${result.value?.mode ?? 'sstv'}.png`; link.click()
}
</script>

<style scoped>
.sstv-view { height: 100%; overflow-y: auto; padding: 1.5rem; }
.sstv-content { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem; }
.card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 12px; padding: 1rem 1.25rem; }
.card-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: .75rem; }
.card-title { font-weight: 600; font-size: .95rem; color: var(--text-primary); }
.setting-hint, .file-info { margin: .3rem 0 0; color: var(--text-tertiary); font-size: .8rem; line-height: 1.5; }
.file-info { overflow-wrap: anywhere; }
.workspace-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.actions { display: flex; flex-wrap: wrap; gap: .5rem; }
.file-input { display: none; }
.btn-primary, .btn-secondary { padding: .5rem 1rem; font-size: .9rem; border-radius: 4px; cursor: pointer; }
.btn-primary { background: var(--color-primary); color: var(--text-white); border: none; }
.btn-secondary { background: var(--bg-container); color: var(--text-secondary); border: 1px solid var(--border-primary); }
.btn-primary:disabled, .btn-secondary:disabled { opacity: .6; cursor: not-allowed; }
@media (hover: hover) {
  .btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }
  .btn-secondary:hover:not(:disabled) { background: var(--bg-table-hover); }
  .history-item:hover { border-color: var(--component-settings-address-hover-border); }
}
.advanced { margin-top: 1rem; color: var(--text-secondary); font-size: .85rem; }
.advanced summary { cursor: pointer; }
.setting-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: .75rem 0 0; }
.setting-label { color: var(--text-primary); font-size: .875rem; }
.field { width: 130px; padding: .45rem .6rem; color: var(--text-primary); background: var(--bg-container); border: 1px solid var(--border-primary); border-radius: 4px; }
.error { color: var(--color-danger); font-size: .85rem; }
.result-section { margin-top: 1rem; }
.result-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .75rem; margin-top: .75rem; }
.result-status { color: var(--text-secondary); font-size: .85rem; line-height: 1.5; }
.result-actions { display: flex; gap: .5rem; }
.result-info { display: flex; flex-wrap: wrap; gap: .4rem 1rem; margin-top: .5rem; color: var(--text-tertiary); font-size: .8rem; }
.image-wrap { position: relative; width: 100%; margin: 0 auto; background: var(--bg-container); border: 1px solid var(--border-light); border-radius: 4px; overflow: hidden; }
.image-wrap::before { content: ''; display: block; padding-top: 75%; }
.image-wrap img { position: absolute; top: 0; right: 0; bottom: 0; left: 0; display: block; width: 100%; height: 100%; object-fit: contain; }
.image-placeholder { position: absolute; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); font-size: .85rem; }
.empty { padding: 1rem 0; text-align: center; color: var(--text-tertiary); font-size: .85rem; }
.history-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: .75rem; }
.history-toolbar, .rename-form { display: flex; align-items: center; flex-wrap: wrap; gap: .5rem .75rem; margin-bottom: .75rem; color: var(--text-secondary); font-size: .8rem; }
.history-toolbar label { display: inline-flex; align-items: center; gap: .3rem; }
.rename-input { flex: 1 1 160px; min-width: 0; }
.history-item { padding: .5rem; min-width: 0; color: var(--text-primary); background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 8px; }
.history-item.is-selected { border-color: var(--color-primary); }
.history-preview { position: relative; display: block; width: 100%; padding: 0; text-align: left; color: inherit; background: none; border: 0; cursor: pointer; }
.selection-indicator { position: absolute; z-index: 1; top: .35rem; right: .35rem; display: grid; place-items: center; width: 1.25rem; height: 1.25rem; border: 1px solid var(--border-primary); border-radius: 50%; background: var(--bg-card); color: var(--color-primary); font-size: .85rem; }
.history-preview:disabled { opacity: .6; cursor: not-allowed; }
.reparse { margin-top: .75rem; }
.history-item img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: contain; background: var(--bg-container); border-radius: 4px; }
.history-time, .history-detail, .history-name { display: block; margin-top: .4rem; font-size: .75rem; }
.history-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.history-detail { color: var(--text-tertiary); }
@media (max-width: 760px) {
  .sstv-view { padding: 1rem; }
  .card { padding: 1rem; }
  .workspace-header { flex-wrap: wrap; }
  .field { width: 110px; }
  .history-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
