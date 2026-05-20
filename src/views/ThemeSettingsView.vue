<template>
  <div class="theme-settings-view">
    <div class="theme-settings-content">
      <div class="theme-page-header">
        <div>
          <h1 class="theme-page-title">主题设置</h1>
          <p class="theme-page-subtitle">
            上传主题后可以随时切换，也可以先下载示例改一改再上传。主色建议只用于按钮、强调和选中态，日志正文等内容请保持黑白中性色。
          </p>
        </div>
      </div>

      <div class="theme-toolbar">
        <button class="btn-add" @click="triggerThemeUpload">
          <span class="text-desktop">+ 上传主题</span>
          <span class="text-mobile">上传</span>
        </button>
        <button class="btn-secondary" @click="toggleThemeExample">
          {{ showThemeExample ? '隐藏示例' : '查看示例' }}
        </button>
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
          <span class="theme-example-caption">下载后改一改，再上传就能用。</span>
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
                <template v-if="theme.builtin">
                  <h3 class="theme-card-title">{{ theme.name }}</h3>
                </template>
                <template v-else>
                  <div class="theme-name-editor">
                    <h3
                      class="theme-card-title"
                      :class="{ 'theme-card-title-editing': editingThemeId === theme.id }"
                      :contenteditable="editingThemeId === theme.id"
                      :data-theme-rename-id="theme.id"
                      spellcheck="false"
                      @input="handleThemeNameInput(theme.id, $event)"
                      @keydown.enter.prevent="handleRenameTheme(theme.id)"
                    >
                      {{ editingThemeId === theme.id ? themeNameDrafts[theme.id] : theme.name }}
                    </h3>
                    <button
                      class="theme-inline-icon"
                      type="button"
                      :title="editingThemeId === theme.id ? '保存名称' : '重命名'"
                      @click="
                        editingThemeId === theme.id
                          ? handleRenameTheme(theme.id)
                          : startRenameTheme(theme)
                      "
                    >
                      <svg
                        v-if="editingThemeId === theme.id"
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path
                          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                        />
                      </svg>
                    </button>
                  </div>
                </template>
                <span v-if="theme.id === activeThemeId" class="theme-badge theme-badge-active"
                  >当前使用</span
                >
              </div>
              <div v-if="!theme.builtin" class="theme-card-time">
                更新于 {{ formatThemeTime(theme.updatedAt) }}
              </div>
            </div>

            <iframe
              class="theme-preview"
              :srcdoc="buildThemePreviewSrcdoc(theme)"
              title="主题预览"
              tabindex="-1"
              aria-hidden="true"
            ></iframe>
          </div>

          <div class="theme-card-actions">
            <button
              class="btn-secondary"
              :disabled="theme.id === activeThemeId"
              @click="handleActivateTheme(theme.id)"
            >
              {{ theme.id === activeThemeId ? '已启用' : '启用' }}
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
import { ref, reactive, onUnmounted, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import confirmDialog from '../composables/useConfirm'
import { useSettingsStore } from '../stores/settingsStore'
import themeBaseCss from '../styles/colors.css?raw'
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
const themeNameDrafts = reactive({})
const editingThemeId = ref('')
let sampleCopiedTimer = null

const THEME_PREVIEW_MARKUP = `
  <div class="preview-shell">
    <div class="preview-header">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <div class="preview-body">
      <div class="preview-sidebar">
        <span class="active"></span>
        <span></span>
        <span></span>
      </div>
      <div class="preview-panel">
        <div class="preview-title"></div>
        <div class="preview-row strong"></div>
        <div class="preview-row"></div>
        <div class="preview-controls">
          <span class="preview-input"></span>
          <span class="preview-button"></span>
        </div>
      </div>
    </div>
  </div>
`

const THEME_PREVIEW_CSS = `
  html,
  body {
    margin: 0;
    width: 100%;
    min-height: 100%;
    background: var(--bg-page);
  }

  * {
    box-sizing: border-box;
  }

  .preview-shell {
    overflow: hidden;
    width: 100%;
    min-height: 100vh;
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    background: var(--bg-page);
  }

  .preview-header {
    display: flex;
    align-items: center;
    gap: 0.28rem;
    height: 1.55rem;
    padding: 0 0.55rem;
    background: var(--bg-header);
    border-bottom: 1px solid var(--border-light);
  }

  .preview-header span {
    width: 0.36rem;
    height: 0.36rem;
    border-radius: 50%;
    background: var(--text-tertiary);
    opacity: 0.55;
  }

  .preview-body {
    display: grid;
    grid-template-columns: 3.4rem minmax(0, 1fr);
    gap: 0.55rem;
    padding: 0.55rem;
    min-height: 6.25rem;
  }

  .preview-sidebar {
    display: flex;
    flex-direction: column;
    gap: 0.38rem;
    padding: 0.45rem;
    border: 1px solid var(--border-secondary);
    border-radius: 6px;
    background: var(--bg-container);
  }

  .preview-sidebar span {
    height: 0.5rem;
    border-radius: 999px;
    background: var(--text-tertiary);
    opacity: 0.38;
  }

  .preview-sidebar span.active {
    background: var(--color-today-accent);
    opacity: 1;
  }

  .preview-panel {
    padding: 0.55rem;
    border: 1px solid var(--border-secondary);
    border-radius: 6px;
    background: var(--bg-card);
  }

  .preview-title {
    width: 42%;
    height: 0.6rem;
    margin-bottom: 0.55rem;
    border-radius: 999px;
    background: var(--text-primary);
    opacity: 0.82;
  }

  .preview-row {
    height: 0.48rem;
    margin-bottom: 0.38rem;
    border-radius: 999px;
    background: var(--text-secondary);
    opacity: 0.32;
  }

  .preview-row.strong {
    width: 82%;
    background: var(--bg-table-hover);
    border: 1px solid var(--border-secondary);
    opacity: 1;
  }

  .preview-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 2.8rem;
    gap: 0.45rem;
    margin-top: 0.6rem;
  }

  .preview-input,
  .preview-button {
    height: 1.25rem;
    border-radius: 4px;
  }

  .preview-input {
    border: 1px solid var(--border-primary);
    background: var(--bg-input);
  }

  .preview-button {
    background: var(--color-primary);
    box-shadow: inset 0 -1px 0 var(--color-primary-hover);
  }
`

function escapeStyleForSrcdoc(cssText = '') {
  return cssText.replace(/<\/style/gi, '<\\/style')
}

function buildThemePreviewSrcdoc(theme) {
  const customThemeCss = theme.builtin ? '' : theme.css

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>${escapeStyleForSrcdoc(themeBaseCss)}</style>
    <style>${escapeStyleForSrcdoc(customThemeCss)}</style>
    <style>${THEME_PREVIEW_CSS}</style>
  </head>
  <body>${THEME_PREVIEW_MARKUP}</body>
</html>`
}

watch(
  themeList,
  (themes) => {
    const themeIds = new Set(themes.map((theme) => theme.id))
    themes.forEach((theme) => {
      if (!theme.builtin) {
        themeNameDrafts[theme.id] = themeNameDrafts[theme.id] || theme.name
      }
    })

    Object.keys(themeNameDrafts).forEach((themeId) => {
      if (!themeIds.has(themeId)) {
        delete themeNameDrafts[themeId]
      }
    })
  },
  { immediate: true }
)

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

async function startRenameTheme(theme) {
  themeNameDrafts[theme.id] = theme.name
  editingThemeId.value = theme.id

  await nextTick()
  const title = document.querySelector(`[data-theme-rename-id="${theme.id}"]`)
  if (title instanceof HTMLElement) {
    title.focus()
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(title)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
}

function handleThemeNameInput(themeId, event) {
  themeNameDrafts[themeId] = event.target?.textContent || ''
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

async function handleRenameTheme(themeId) {
  const nextName = themeNameDrafts[themeId] || ''
  const result = await settingsStore.renameCustomTheme(themeId, nextName)
  showThemeStatus(result.message, result.success ? 'success' : 'error')
  if (result.success) {
    editingThemeId.value = ''
    const currentTheme = themeList.value.find((theme) => theme.id === themeId)
    if (currentTheme && !currentTheme.builtin) {
      themeNameDrafts[themeId] = currentTheme.name
    }
  }
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
      const themeName = fileNameToThemeName(file.name)
      const result = await settingsStore.importCustomTheme(themeName, cssText)
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
  min-width: 0;
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
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin-bottom: 1rem;
  gap: 0.5rem;
}

.theme-toolbar > button {
  width: 100%;
}

.theme-toolbar > button,
.theme-card-actions > button {
  min-height: 36px;
}

.theme-card-actions > button {
  flex: 0 0 auto;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  min-width: 0;
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

.theme-card-main,
.theme-title-wrap {
  min-width: 0;
}

.theme-name-editor {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  max-width: 100%;
  flex: 1 1 auto;
}

.theme-inline-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  line-height: 1;
  flex: 0 0 auto;
  transition:
    color 0.2s ease,
    opacity 0.2s ease,
    transform 0.2s ease;
}

.theme-card-title {
  margin: 0;
  font-size: 1rem;
  color: var(--text-primary);
  overflow-wrap: anywhere;
  min-width: 0;
  flex: 1 1 auto;
}

.theme-card-title-editing {
  outline: none;
  border-bottom: 1px dashed var(--color-primary);
}

.theme-card-time {
  color: var(--text-tertiary);
  font-size: 0.78rem;
  white-space: nowrap;
}

.theme-preview {
  margin-top: 0.85rem;
  width: 100%;
  height: 7.4rem;
  display: block;
  border: none;
  border-radius: 8px;
  background: var(--bg-page);
  pointer-events: none;
}

.theme-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.45rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
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
.btn-text-danger,
.btn-icon {
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

.btn-icon {
  width: 36px;
  padding: 0;
  background: var(--color-transparent);
  color: var(--text-secondary);
  border: 1px solid var(--border-primary);
  flex: 0 0 36px;
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

  .btn-icon:hover {
    color: var(--text-primary);
    border-color: var(--border-secondary);
    background: var(--bg-table-hover);
  }

  .theme-inline-icon:hover {
    color: var(--text-primary);
    transform: translateY(-1px);
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
.btn-icon:disabled,
.btn-primary:disabled,
.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.theme-inline-icon:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.hidden-input {
  display: none;
}

.text-mobile {
  display: none;
}

@media (max-width: 768px) {
  .theme-settings-view {
    padding: 0.875rem;
  }

  .theme-page-header,
  .theme-card-top {
    flex-direction: column;
  }

  .theme-toolbar,
  .theme-card-actions {
    width: 100%;
  }

  .theme-toolbar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
  }

  .theme-toolbar .btn-secondary,
  .theme-toolbar .btn-add,
  .theme-toolbar .btn-ghost,
  .theme-card-actions .btn-secondary,
  .theme-card-actions .btn-ghost,
  .theme-card-actions .btn-ghost-danger {
    flex: 1;
  }

  .theme-card-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
  }

  .theme-card-actions .btn-secondary,
  .theme-card-actions .btn-ghost,
  .theme-card-actions .btn-ghost-danger {
    width: 100%;
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

@media (max-width: 520px) {
  .theme-settings-view {
    padding: 0.75rem;
  }

  .theme-toolbar,
  .theme-card-actions {
    grid-template-columns: 1fr;
  }

  .theme-example-panel,
  .theme-card {
    padding: 0.875rem;
  }

  .theme-card-time {
    white-space: normal;
  }
}
</style>
