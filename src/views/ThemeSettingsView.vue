<template>
  <div class="theme-settings-view">
    <div class="theme-settings-content">
      <div class="theme-page-header">
        <div>
          <h1 class="theme-page-title">主题设置</h1>
          <p class="theme-page-subtitle">上传主题后可以随时切换，也可以先下载示例改一改再上传。</p>
        </div>
        <div class="theme-header-actions">
          <button class="btn-secondary" @click="toggleThemeExample">
            {{ showThemeExample ? '隐藏示例' : '看示例' }}
          </button>
          <button class="btn-add" @click="triggerThemeUpload">
            <span class="text-desktop">+ 上传主题</span>
            <span class="text-mobile">上传</span>
          </button>
        </div>
      </div>

      <div class="theme-toolbar">
        <button class="btn-ghost" @click="downloadSampleTheme">下载示例</button>
        <button class="btn-ghost" @click="copySampleTheme">
          {{ sampleCopied ? '已复制' : '复制示例' }}
        </button>
        <button
          class="btn-ghost"
          :disabled="activeThemeId === DEFAULT_THEME_ID"
          @click="handleActivateTheme(DEFAULT_THEME_ID)"
        >
          恢复默认主题
        </button>
      </div>

      <div v-if="themeStatusMessage" class="theme-status" :class="themeStatusType">
        {{ themeStatusMessage }}
      </div>

      <div v-if="showThemeExample" class="theme-example-panel">
        <div class="theme-example-header">
          <span class="theme-example-title">示例主题</span>
          <span class="theme-example-caption">下载后改一改，再上传就能用</span>
        </div>
        <pre class="theme-example-code"><code>{{ THEME_SAMPLE_CSS }}</code></pre>
      </div>

      <div class="theme-list">
        <article
          v-for="theme in themeList"
          :key="theme.id"
          class="theme-card"
          :class="{ active: theme.id === activeThemeId, builtin: theme.builtin }"
        >
          <div class="theme-card-main">
            <div class="theme-card-top">
              <div class="theme-title-wrap">
                <h3 class="theme-card-title">{{ theme.name }}</h3>
                <span v-if="theme.builtin" class="theme-badge theme-badge-default">内置</span>
                <span v-else class="theme-badge theme-badge-custom">自定义</span>
                <span v-if="theme.id === activeThemeId" class="theme-badge theme-badge-active"
                  >当前使用</span
                >
              </div>
              <div v-if="!theme.builtin" class="theme-card-time">
                更新于 {{ formatThemeTime(theme.updatedAt) }}
              </div>
            </div>

            <p class="theme-card-desc">
              {{
                theme.builtin ? '使用默认主题。' : '这是你上传的自定义主题。'
              }}
            </p>
          </div>

          <div class="theme-card-actions">
            <button
              class="btn-secondary"
              :disabled="theme.id === activeThemeId"
              @click="handleActivateTheme(theme.id)"
            >
              {{ theme.id === activeThemeId ? '已启用' : '启用主题' }}
            </button>
            <button
              v-if="!theme.builtin"
              class="btn-ghost"
              @click="downloadTheme(theme.name, theme.css)"
            >
              下载
            </button>
            <button
              v-if="!theme.builtin"
              class="btn-ghost btn-ghost-danger"
              @click="handleDeleteTheme(theme.id, theme.name)"
            >
              删除
            </button>
          </div>
        </article>
      </div>

      <input
        ref="themeUploadInput"
        type="file"
        accept=".css,text/css"
        multiple
        class="hidden-input"
        @change="handleThemeFilesSelected"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import confirmDialog from '../composables/useConfirm'
import { useSettingsStore } from '../stores/settingsStore'
import {
  DEFAULT_THEME_ID,
  THEME_SAMPLE_CSS,
  downloadThemeCss,
  fileNameToThemeName
} from '../utils/themeManager'

const settingsStore = useSettingsStore()
const { themeList, activeThemeId } = storeToRefs(settingsStore)

const themeUploadInput = ref(null)
const showThemeExample = ref(false)
const themeStatusMessage = ref('')
const themeStatusType = ref('info')
const sampleCopied = ref(false)
let sampleCopiedTimer = null

function showThemeStatus(message, type = 'info') {
  themeStatusMessage.value = message
  themeStatusType.value = type
}

function clearThemeStatus() {
  themeStatusMessage.value = ''
}

function toggleThemeExample() {
  showThemeExample.value = !showThemeExample.value
}

function triggerThemeUpload() {
  clearThemeStatus()
  themeUploadInput.value?.click()
}

function formatThemeTime(timestamp) {
  if (!timestamp) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp))
}

async function handleActivateTheme(themeId) {
  const result = await settingsStore.setActiveTheme(themeId)
  showThemeStatus(result.message, result.success ? 'success' : 'error')
}

async function handleDeleteTheme(themeId, themeName) {
  const confirmed = await confirmDialog.show(`确定要删除主题“${themeName}”吗？`)
  if (!confirmed) return

  const result = await settingsStore.deleteCustomTheme(themeId)
  showThemeStatus(result.message, result.success ? 'success' : 'error')
}

async function handleThemeFilesSelected(event) {
  const input = event.target
  const files = Array.from(input.files || [])
  if (!files.length) return

  clearThemeStatus()
  const results = []

  for (const file of files) {
    try {
      const cssText = await file.text()
      const result = await settingsStore.importCustomTheme(fileNameToThemeName(file.name), cssText)
      results.push(result)
    } catch {
      results.push({
        success: false,
        message: `读取 ${file.name} 失败`
      })
    }
  }

  const failed = results.filter((item) => !item.success)
  const succeeded = results.filter((item) => item.success)

  if (failed.length === 0) {
    showThemeStatus(
      succeeded.length === 1
        ? succeeded[0].message
        : `已成功导入并启用 ${succeeded.length} 个主题，当前为最后导入的主题`,
      'success'
    )
  } else {
    showThemeStatus(
      `${succeeded.length ? `成功 ${succeeded.length} 个，` : ''}失败 ${failed.length} 个：${failed[0].message}`,
      'error'
    )
  }

  input.value = ''
}

function downloadSampleTheme() {
  downloadThemeCss('fmo-theme-example', THEME_SAMPLE_CSS)
  showThemeStatus('示例已下载', 'success')
}

async function copySampleTheme() {
  try {
    await navigator.clipboard.writeText(THEME_SAMPLE_CSS)
    sampleCopied.value = true
    showThemeStatus('示例已复制到剪贴板', 'success')
    if (sampleCopiedTimer) clearTimeout(sampleCopiedTimer)
    sampleCopiedTimer = window.setTimeout(() => {
      sampleCopied.value = false
    }, 1600)
  } catch {
    showThemeStatus('复制失败，请手动复制示例内容', 'error')
  }
}

function downloadTheme(name, css) {
  downloadThemeCss(name, css)
}

onUnmounted(() => {
  if (sampleCopiedTimer) {
    clearTimeout(sampleCopiedTimer)
  }
})
</script>

<style scoped>
.theme-settings-view {
  height: 100%;
  overflow-y: auto;
  padding: 1.5rem;
}

.theme-settings-content {
  max-width: 920px;
  margin: 0 auto;
}

.theme-page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 0.25rem;
}

.theme-page-title {
  margin: 0;
  font-size: 1.5rem;
  color: var(--text-primary);
}

.theme-page-subtitle {
  margin: 0.6rem 0 0;
  color: var(--text-secondary);
  font-size: 0.92rem;
  line-height: 1.65;
}

.theme-header-actions,
.theme-toolbar,
.theme-card-actions,
.theme-title-wrap,
.theme-example-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.theme-toolbar {
  margin-bottom: 1rem;
  gap: 0.5rem;
}

.theme-header-actions > button,
.theme-toolbar > button,
.theme-card-actions > button {
  min-height: 36px;
}

.theme-card-actions > button {
  flex: 1;
}

.theme-status {
  margin-bottom: 1rem;
  padding: 0.75rem 0.9rem;
  border-radius: 8px;
  font-size: 0.88rem;
  border: 1px solid var(--border-light);
}

.theme-status.success {
  background: var(--status-success-bg-soft);
  border-color: var(--status-success-border);
  color: var(--status-success-text);
}

.theme-status.error {
  background: var(--status-danger-bg-soft);
  border-color: var(--status-danger-border);
  color: var(--status-danger-text);
}

.theme-status.info {
  background: var(--status-primary-bg-soft);
  border-color: var(--status-primary-border);
  color: var(--status-primary-text);
}

.theme-example-panel {
  margin-bottom: 1rem;
  padding: 1rem;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-card);
}

.theme-example-title {
  font-weight: 600;
  color: var(--text-primary);
}

.theme-example-caption {
  color: var(--text-tertiary);
  font-size: 0.82rem;
}

.theme-example-code {
  margin: 0.9rem 0 0;
  padding: 1rem;
  max-height: 320px;
  overflow: auto;
  border-radius: 8px;
  border: 1px solid var(--border-secondary);
  background: var(--bg-container);
  color: var(--text-primary);
  font-size: 0.8rem;
  line-height: 1.6;
}

.theme-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.theme-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-radius: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  transition:
    border-color 0.2s,
    background 0.2s,
    transform 0.2s;
}

@media (hover: hover) {
  .theme-card:hover {
    transform: translateY(-1px);
    border-color: var(--border-primary);
    background: var(--bg-table-hover);
  }
}

.theme-card.active {
  border-color: var(--color-primary);
  background: var(--bg-card);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.theme-card.builtin {
  background: var(--bg-card);
}

.theme-card-top {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: flex-start;
}

.theme-card-title {
  margin: 0;
  font-size: 1rem;
  color: var(--text-primary);
}

.theme-card-time {
  color: var(--text-tertiary);
  font-size: 0.78rem;
  white-space: nowrap;
}

.theme-card-desc {
  margin: 0.55rem 0 0;
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 0.88rem;
}

.theme-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.45rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
}

.theme-badge-default {
  background: var(--status-neutral-bg);
  color: var(--status-neutral-text);
  border: 1px solid var(--status-neutral-border);
}

.theme-badge-custom {
  background: var(--status-warning-bg);
  color: var(--status-warning-text-deep);
  border: 1px solid var(--status-warning-border);
}

.theme-badge-active {
  background: var(--status-success-bg);
  color: var(--status-success-text);
  border: 1px solid var(--status-success-border);
}

.btn-add,
.btn-primary,
.btn-secondary,
.btn-danger,
.btn-ghost,
.btn-text-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1;
  box-sizing: border-box;
}

.btn-add {
  padding: 0 0.9rem;
  font-size: 0.85rem;
  background: var(--bg-container);
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.btn-primary {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  background: var(--color-primary);
  color: var(--text-white);
  border: none;
}

.btn-secondary {
  padding: 0 0.9rem;
  font-size: 0.85rem;
  background: var(--bg-container);
  color: var(--text-secondary);
  border: 1px solid var(--border-primary);
}

.btn-danger {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  background: var(--color-danger);
  color: var(--text-white);
  border: none;
}

.btn-ghost {
  padding: 0 0.9rem;
  font-size: 0.85rem;
  background: var(--color-transparent);
  color: var(--text-secondary);
  border: 1px solid var(--border-primary);
  letter-spacing: 0.02em;
}

.btn-text-danger {
  padding: 0 0.8rem;
  font-size: 0.85rem;
  background: none;
  color: var(--color-danger);
  border: none;
}

.btn-ghost-danger {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

@media (hover: hover) {
  .btn-add:hover {
    background: var(--color-primary);
    color: var(--text-white);
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
  }

  .btn-secondary:hover {
    background: var(--bg-table-hover);
    border-color: var(--border-secondary);
  }

  .btn-danger:hover {
    background: var(--color-danger-hover);
  }

  .btn-ghost:hover {
    color: var(--text-primary);
    border-color: var(--border-secondary);
    background: var(--bg-table-hover);
  }

  .btn-ghost-danger:hover {
    color: var(--color-danger-hover);
    border-color: var(--color-danger-hover);
    background: var(--bg-error-light);
  }

  .btn-text-danger:hover {
    color: var(--color-danger-hover);
    text-decoration: underline;
  }
}

.btn-secondary:disabled,
.btn-ghost:disabled,
.btn-primary:disabled,
.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hidden-input {
  display: none;
}

.text-mobile {
  display: none;
}

@media (max-width: 768px) {
  .theme-settings-view {
    padding: 1rem;
  }

  .theme-page-header,
  .theme-card-top {
    flex-direction: column;
  }

  .theme-header-actions,
  .theme-toolbar,
  .theme-card-actions {
    width: 100%;
  }

  .theme-toolbar .btn-ghost,
  .theme-header-actions .btn-secondary,
  .theme-header-actions .btn-add,
  .theme-card-actions .btn-secondary,
  .theme-card-actions .btn-ghost,
  .theme-card-actions .btn-ghost-danger {
    flex: 1;
  }

  .theme-list {
    grid-template-columns: 1fr;
  }

  .text-desktop {
    display: none;
  }

  .text-mobile {
    display: inline;
  }
}
</style>
