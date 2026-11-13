<template>
  <div class="sstv-view">
    <div class="sstv-layout">
      <main class="sstv-main">
        <section class="card">
          <div class="workspace-header">
            <span class="card-title">SSTV</span>
            <div class="actions">
              <button class="btn-secondary" :disabled="busy || liveActive || liveStarting" @click="fileInput?.click()">选择音频</button>
              <button class="btn-secondary" :disabled="busy || liveStarting || liveStopping" @click="toggleLive">{{ liveActive ? '停止监听' : '开始监听' }}</button>
              <button class="btn-secondary mobile-history-button" @click="openMobileHistory">
                解析历史
                <span class="mobile-history-count">{{ history.length }}</span>
              </button>
              <input ref="fileInput" class="file-input" type="file" accept=".wav,audio/wav" @change="loadFile" />
            </div>
          </div>
          <div ref="resultSection" class="result-section">
            <div class="image-wrap">
              <img v-if="imageUrl" :src="imageUrl" alt="SSTV 解析图像" />
              <span v-else class="image-placeholder">选择音频或开始监听</span>
              <span v-if="currentHistory" class="active-history-label">
                历史记录
                <strong>{{ historyName(currentHistory) }}</strong>
              </span>
            </div>
            <div class="result-bar">
              <div class="result-status" role="status">{{ resultStatus }}</div>
              <div class="result-actions">
                <button v-if="currentHistory" class="btn-secondary" :disabled="historyBusy" @click="renameHistory(currentHistory)">重命名</button>
                <button v-if="currentHistory" class="btn-secondary" :disabled="historyBusy" @click="removeHistory(currentHistory)">删除</button>
                <button class="btn-secondary" :disabled="!result || busy" @click="clearResult">清空</button>
                <button class="btn-secondary" :disabled="!result || busy || exportBusy" @click="downloadImage">导出 PNG</button>
              </div>
            </div>
            <form
              v-if="!selectedHistoryIds.length && currentHistory && renameIds.length === 1 && renameIds[0] === currentHistory.id"
              class="rename-form result-rename"
              @submit.prevent="applyRename"
            >
              <label for="current-history-name">名称</label>
              <input id="current-history-name" v-model="renameValue" class="field rename-input" maxlength="80" required />
              <button class="btn-secondary" :disabled="historyBusy || !renameValue.trim()">保存</button>
              <button class="btn-secondary" type="button" @click="renameIds = []">取消</button>
            </form>
            <div v-if="result" class="result-info">
              <span>{{ modeName }}</span>
            </div>
          </div>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <details class="advanced">
            <summary>高级设置</summary>
            <div v-if="fileName" class="file-info">{{ fileName }} · {{ duration.toFixed(1) }} 秒</div>
            <p v-if="liveActive" class="setting-hint">离开页面后停止监听；后台接收可能受系统限制。</p>
            <div v-if="result" class="diagnostics">
              <div class="diagnostics-title">解析诊断</div>
              <div class="diagnostics-grid">
                <span>模式</span><strong>{{ modeName }}</strong>
                <span>图像尺寸</span><strong>{{ result.width }} × {{ result.height }}</strong>
                <span>恢复行数</span><strong>{{ result.decodedRows }}/{{ result.height }}</strong>
                <span>图像起点</span><strong>{{ result.startSeconds.toFixed(3) }} 秒</strong>
                <span>频率偏移</span><strong>{{ Math.round(result.frequencyOffsetHz) }} Hz</strong>
                <span>音频采样率</span><strong>{{ sampleRate ? `${sampleRate} Hz` : '未知' }}</strong>
              </div>
              <div v-if="visibleWarnings.length" class="diagnostics-warnings">
                <div class="diagnostics-title">解析提示</div>
                <p class="setting-hint diagnostics-summary" :title="visibleWarnings.join('；')">{{ visibleWarnings.join('；') }}</p>
              </div>
            </div>
            <div class="setting-row">
              <label class="setting-label" for="sstv-mode">解析模式</label>
              <select id="sstv-mode" v-model="modeId" class="field">
                <option value="auto">自动识别</option>
                <option v-for="mode in SSTV_MODES" :key="mode.id" :value="mode.id">{{ mode.name }}</option>
              </select>
            </div>
            <div class="setting-row">
              <div>
                <label class="setting-label" for="sstv-start">图像起点（秒）</label>
                <div class="setting-hint">留空自动检测，头部缺失时可手动指定</div>
              </div>
              <input id="sstv-start" v-model="startInput" class="field offset" type="number" min="0" step="0.001" placeholder="自动" />
            </div>
            <button v-if="samples.length" class="btn-secondary reparse" :disabled="busy || liveActive || liveStarting" @click="decode">
              应用设置并重新解析
            </button>
          </details>
        </section>
      </main>

      <aside class="history-sidebar" aria-label="解析历史">
        <SstvHistoryPanel
          :history="history"
          :busy="busy"
          :history-busy="historyBusy"
          :history-error="historyError"
          :manage="historyManage"
          :selected-ids="selectedHistoryIds"
          :selected-history-id="selectedHistoryId"
          :all-selected="allHistorySelected"
          :rename-ids="renameIds"
          :rename-value="renameValue"
          variant="sidebar"
          @select="handleHistoryClick"
          @manage="enterHistorySelection"
          @toggle-all="toggleAllHistory"
          @rename-selected="beginRenameSelected"
          @download-selected="downloadSelectedHistory"
          @delete-selected="removeSelectedHistory"
          @cancel-selection="clearHistorySelection"
          @clear-all="clearAllHistory"
          @apply-rename="applyRename"
          @cancel-rename="renameIds = []"
          @update:rename-value="renameValue = $event"
        />
      </aside>
    </div>

    <Teleport to="body">
      <Transition name="mobile-history">
        <div v-if="showMobileHistory" class="mobile-history-overlay" @click.self="closeMobileHistory">
          <section
            ref="mobileHistorySheet"
            class="mobile-history-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="解析历史"
          >
            <SstvHistoryPanel
              :history="history"
              :busy="busy"
              :history-busy="historyBusy"
              :history-error="historyError"
              :manage="historyManage"
              :selected-ids="selectedHistoryIds"
              :selected-history-id="selectedHistoryId"
              :all-selected="allHistorySelected"
              :rename-ids="renameIds"
              :rename-value="renameValue"
              variant="sheet"
              closeable
              @select="handleHistoryClick"
              @manage="enterHistorySelection"
              @toggle-all="toggleAllHistory"
              @rename-selected="beginRenameSelected"
              @download-selected="downloadSelectedHistory"
              @delete-selected="removeSelectedHistory"
              @cancel-selection="clearHistorySelection"
              @clear-all="clearAllHistory"
              @apply-rename="applyRename"
              @cancel-rename="renameIds = []"
              @update:rename-value="renameValue = $event"
              @close="closeMobileHistory"
            />
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { decodeSstv, readPcmWav, SSTV_MODES } from '../core'
import type { DecodedImage, SstvModeId } from '../core'
import { deleteSstvHistories, listSstvHistory, renameSstvHistories, saveSstvHistory } from '../services/sstvHistory'
import { createSstvZip, historyImageName, safeImageName } from '../services/sstvZip'
import type { SstvHistoryEntry } from '../services/sstvHistory'
import SstvHistoryPanel from '../components/sstv/SstvHistoryPanel.vue'
import { getPlatform } from '../platform'
import { useAudioPlayerStore } from '../stores/audioPlayerStore'
import { useSettingsStore } from '../stores/settingsStore'
import confirmDialog from '../composables/useConfirm'
import { useModalBackHandler, registerModal } from '../composables/useModalBackHandler'
import { exportFile } from '../utils/exportFile'

const modeId = ref<SstvModeId | 'auto'>('auto')
const fileInput = ref<HTMLInputElement | null>(null)
const resultSection = ref<HTMLElement | null>(null)
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
const exportBusy = ref(false)
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
const showMobileHistory = ref(false)
const mobileHistorySheet = ref<HTMLElement | null>(null)
const history = shallowRef<Array<SstvHistoryEntry & { preview: string }>>([])
const currentHistory = computed(() => history.value.find((item) => item.id === selectedHistoryId.value) ?? null)
const modeName = computed(() => result.value ? SSTV_MODES[result.value.mode].name : '')
const allHistorySelected = computed(() => history.value.length > 0 && history.value.every((item) => item.id !== undefined && selectedHistoryIds.value.includes(item.id)))
const resultStatus = computed(() => {
  if (busy.value) return '正在解析音频'
  if (liveActive.value || liveStarting.value || liveStopping.value) {
    return liveStatus.value || '正在启动监听'
  }
  if (result.value) return livePreview.value ? '未保存的预览' : '解析完成'
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

onMounted(() => {
  mounted = true
  window.addEventListener('keydown', handleGlobalKeydown)
  refreshHistory()
})
onBeforeUnmount(() => {
  mounted = false
  window.removeEventListener('keydown', handleGlobalKeydown)
  _unregisterMobileHistory()
  void stopLive()
  for (const item of history.value) URL.revokeObjectURL(item.preview)
})

useModalBackHandler([showMobileHistory])
const _unregisterMobileHistory = registerModal(
  () => showMobileHistory.value,
  () => closeMobileHistory(),
  50
)

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
      else if (message.type === 'started') {
        livePreview.value = true
        selectedHistoryId.value = null
        imageUrl.value = ''
        result.value = null
        resultFileName.value = 'FMO 实时音频'
      }
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

function toggleAllHistory() {
  selectedHistoryIds.value = allHistorySelected.value ? [] : history.value.flatMap((item) => item.id === undefined ? [] : [item.id])
  if (!selectedHistoryIds.value.length) renameIds.value = []
}

function toggleHistorySelection(item: SstvHistoryEntry) {
  if (item.id === undefined) return
  selectedHistoryIds.value = selectedHistoryIds.value.includes(item.id)
    ? selectedHistoryIds.value.filter((id) => id !== item.id)
    : [...selectedHistoryIds.value, item.id]
  if (!selectedHistoryIds.value.length) renameIds.value = []
}

function enterHistorySelection() {
  historyManage.value = true
  renameIds.value = []
}

function handleHistoryClick(item: SstvHistoryEntry & { preview: string }) {
  if (historyManage.value) toggleHistorySelection(item)
  else {
    const openedFromMobile = showMobileHistory.value
    showHistory(item)
    if (openedFromMobile) {
      closeMobileHistory()
      void nextTick(() => resultSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }
}

function clearHistorySelection() {
  selectedHistoryIds.value = []
  historyManage.value = false
  renameIds.value = []
}

async function openMobileHistory() {
  showMobileHistory.value = true
  await nextTick()
  mobileHistorySheet.value?.querySelector<HTMLButtonElement>('.mobile-close-button')?.focus()
}

function closeMobileHistory() {
  showMobileHistory.value = false
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showMobileHistory.value) {
    event.preventDefault()
    closeMobileHistory()
  }
}

function renameHistory(item: SstvHistoryEntry) {
  if (item.id === undefined) return
  renameIds.value = [item.id]
  renameValue.value = historyName(item)
}

async function removeHistory(item: SstvHistoryEntry) {
  if (item.id !== undefined) await removeHistoryIds([item.id])
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
  await removeHistoryIds([...selectedHistoryIds.value])
}

async function clearAllHistory() {
  if (historyBusy.value || !history.value.length) return
  if (!await confirmDialog.show(`确定清空全部 ${history.value.length} 条 SSTV 解析记录吗？此操作无法撤销。`)) return
  historyBusy.value = true
  try {
    await deleteSstvHistories(history.value.flatMap((item) => item.id === undefined ? [] : [item.id]))
    clearHistorySelection()
    await refreshHistory()
  } catch (err) {
    historyError.value = err instanceof Error ? err.message : '清空历史失败'
  } finally {
    historyBusy.value = false
  }
}

async function removeHistoryIds(ids: number[]) {
  if (!ids.length || historyBusy.value) return
  if (!await confirmDialog.show(`确定删除选中的 ${ids.length} 条 SSTV 解析记录吗？此操作无法撤销。`)) return
  historyBusy.value = true
  try { await deleteSstvHistories(ids); selectedHistoryIds.value = []; renameIds.value = []; historyManage.value = false; await refreshHistory() }
  catch (err) { historyError.value = err instanceof Error ? err.message : '删除历史记录失败' }
  finally { historyBusy.value = false }
}

async function downloadSelectedHistory() {
  const selected = history.value.filter((item) => item.id !== undefined && selectedHistoryIds.value.includes(item.id))
  await downloadHistoryItems(selected)
}

async function downloadHistoryItems(selected: SstvHistoryEntry[]) {
  if (historyBusy.value) return
  if (!selected.length) return
  historyBusy.value = true
  try {
    const images = selected.map((item) => ({ name: historyImageName(historyName(item), item.createdAt), image: item.image, createdAt: item.createdAt }))
    const blob = images.length === 1 ? images[0].image : await createSstvZip(images)
    const filename = images.length === 1 ? `${images[0].name}.png` : 'SSTV-历史.zip'
    const saved = await exportFile(filename, blob, images.length === 1 ? 'image/png' : 'application/zip')
    historyError.value = ''
    if (saved.platform !== 'web') await confirmDialog.show({ message: `文件已保存至 ${saved.displayPath}`, confirmText: '知道了', showCancel: false })
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

async function downloadImage() {
  if (!imageUrl.value || exportBusy.value) return
  exportBusy.value = true
  try {
    const response = await fetch(imageUrl.value)
    if (!response.ok) throw new Error('读取图片失败')
    const filename = `${safeImageName(resultFileName.value.replace(/\.wav$/i, ''))}-${result.value?.mode ?? 'sstv'}.png`
    const saved = await exportFile(filename, await response.blob(), 'image/png')
    error.value = ''
    if (saved.platform !== 'web') await confirmDialog.show({ message: `文件已保存至 ${saved.displayPath}`, confirmText: '知道了', showCancel: false })
  } catch (err) { error.value = err instanceof Error ? err.message : '导出图片失败' }
  finally { exportBusy.value = false }
}
</script>

<style scoped>
.sstv-view {
  height: 100%;
  padding: 1.5rem;
  overflow-y: auto;
}

.sstv-layout {
  display: block;
  max-width: 1180px;
  margin: 0 auto;
}

.card {
  padding: 1rem 1.25rem;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
}

.card-title {
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: 600;
}

.setting-hint,
.file-info {
  margin: 0.3rem 0 0;
  color: var(--text-tertiary);
  font-size: 0.8rem;
  line-height: 1.5;
}

.file-info {
  overflow-wrap: anywhere;
}

.workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.actions,
.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.file-input {
  display: none;
}

.btn-primary,
.btn-secondary {
  min-height: 2.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  border-radius: 4px;
  cursor: pointer;
}

.btn-primary {
  color: var(--text-white);
  background: var(--color-primary);
  border: 0;
}

.btn-secondary {
  color: var(--text-secondary);
  background: var(--bg-container);
  border: 1px solid var(--border-primary);
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.mobile-history-button {
  display: none;
  align-items: center;
  gap: 0.4rem;
}

.mobile-history-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.2rem;
  padding: 0 0.3rem;
  color: var(--color-primary);
  font-size: 0.7rem;
  line-height: 1;
  background: color-mix(in srgb, var(--color-primary) 11%, transparent);
  border-radius: 999px;
}

.advanced {
  margin-top: 1rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.advanced summary {
  cursor: pointer;
}

.diagnostics {
  margin-top: 0.75rem;
  padding: 0.75rem;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-container) 72%, transparent);
  border: 1px solid var(--border-light);
  border-radius: 6px;
}

.diagnostics-title {
  margin-bottom: 0.45rem;
  color: var(--text-primary);
  font-size: 0.8rem;
  font-weight: 600;
}

.diagnostics-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.35rem 1rem;
  font-size: 0.8rem;
}

.diagnostics-grid strong {
  color: var(--text-primary);
  font-weight: 500;
}

.diagnostics-warnings {
  margin-top: 0.75rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--border-light);
}

.diagnostics-summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0 0;
}

.setting-label {
  color: var(--text-primary);
  font-size: 0.875rem;
}

.field {
  width: 130px;
  padding: 0.45rem 0.6rem;
  color: var(--text-primary);
  background: var(--bg-container);
  border: 1px solid var(--border-primary);
  border-radius: 4px;
}

.error {
  color: var(--color-danger);
  font-size: 0.85rem;
}

.result-section {
  margin-top: 1rem;
}

.result-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.result-status {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
  font-size: 0.85rem;
  line-height: 1.5;
}

.result-rename {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  margin-top: 0.75rem;
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.rename-input {
  flex: 1 1 160px;
  min-width: 0;
}

.result-info {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
  margin-top: 0.5rem;
  color: var(--text-tertiary);
  font-size: 0.8rem;
}

.image-wrap {
  position: relative;
  width: 100%;
  margin: 0 auto;
  overflow: hidden;
  background: var(--bg-container);
  border: 1px solid var(--border-light);
  border-radius: 6px;
}

.image-wrap::before {
  display: block;
  padding-top: 75%;
  content: '';
}

.image-wrap img {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.image-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.active-history-label {
  position: absolute;
  top: 0.65rem;
  left: 0.65rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  max-width: calc(100% - 1.3rem);
  padding: 0.35rem 0.55rem;
  color: var(--text-secondary);
  font-size: 0.68rem;
  background: color-mix(in srgb, var(--bg-card) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--border-light) 80%, transparent);
  border-radius: 5px;
  backdrop-filter: blur(8px);
}

.active-history-label strong {
  overflow: hidden;
  color: var(--text-primary);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reparse {
  margin-top: 0.75rem;
}

.history-sidebar {
  display: none;
  min-width: 0;
}

.mobile-history-overlay {
  position: fixed;
  z-index: 1050;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  box-sizing: border-box;
  padding-top: calc(0.5rem + var(--safe-inset-top, env(safe-area-inset-top, 0px)));
  background: rgb(0 0 0 / 42%);
}

.mobile-history-sheet {
  width: 100%;
  height: calc(100dvh - var(--safe-inset-top, env(safe-area-inset-top, 0px)) - 0.5rem);
  overflow: hidden;
  background: var(--bg-card);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -8px 30px rgb(0 0 0 / 18%);
}

.mobile-history-enter-active,
.mobile-history-leave-active {
  transition: opacity 0.2s ease;
}

.mobile-history-enter-active .mobile-history-sheet,
.mobile-history-leave-active .mobile-history-sheet {
  transition: transform 0.24s cubic-bezier(0.2, 0.75, 0.25, 1);
}

.mobile-history-enter-from,
.mobile-history-leave-to {
  opacity: 0;
}

.mobile-history-enter-from .mobile-history-sheet,
.mobile-history-leave-to .mobile-history-sheet {
  transform: translateY(100%);
}

@media (hover: hover) {
  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-table-hover);
  }
}

@media (min-width: 960px) {
  .sstv-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 350px;
    gap: 1rem;
    align-items: start;
  }

  .history-sidebar {
    position: sticky;
    top: 0;
    display: block;
    height: calc(100dvh - 9rem);
    min-height: 30rem;
    max-height: 52rem;
  }
}

@media (max-width: 959px) {
  .mobile-history-button {
    display: inline-flex;
  }
}

@media (max-width: 760px) {
  .sstv-view {
    padding: 0.75rem;
  }

  .card {
    padding: 0.85rem;
  }

  .workspace-header {
    flex-wrap: wrap;
  }

  .actions {
    width: 100%;
  }

  .actions .btn-secondary {
    flex: 1 1 auto;
    padding-inline: 0.7rem;
  }

  .field {
    width: 110px;
  }

  .setting-row {
    align-items: flex-start;
  }

  .result-actions {
    width: 100%;
  }

  .result-actions .btn-secondary {
    flex: 1 1 auto;
  }
}

@media (min-width: 600px) and (max-width: 959px) {
  .mobile-history-overlay {
    padding-right: 1rem;
    padding-bottom: 1rem;
    padding-left: 1rem;
  }

  .mobile-history-sheet {
    max-width: 640px;
    height: min(88dvh, 820px);
    border-radius: 16px;
  }
}
</style>
