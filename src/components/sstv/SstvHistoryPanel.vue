<template>
  <section class="history-panel" :class="`history-panel--${variant}`">
    <header class="history-header" :class="{ 'is-managing': manage }">
      <div class="history-heading">
        <div class="history-heading-copy">
          <div class="history-title-row">
            <h2>{{ manage ? '选择记录' : '解析历史' }}</h2>
            <span class="history-count">{{ manage ? `${selectedIds.length}/${history.length}` : history.length }}</span>
          </div>
          <p v-if="!manage && history.length" class="history-subtitle">最新记录优先</p>
        </div>
      </div>

      <div class="history-heading-actions">
        <template v-if="manage">
          <button
            v-if="history.length"
            type="button"
            class="text-button"
            :disabled="historyBusy"
            @click="$emit('toggle-all')"
          >
            {{ allSelected ? '取消全选' : '全选' }}
          </button>
        </template>
        <template v-else-if="history.length">
          <button type="button" class="text-button" @click="$emit('manage')">管理</button>
          <button
            type="button"
            class="text-button clear-history-button"
            :disabled="historyBusy"
            @click="$emit('clear-all')"
          >
            清空全部
          </button>
        </template>
        <button
          v-if="manage"
          type="button"
          class="icon-button"
          :class="{ 'mobile-close-button': closeable }"
          aria-label="退出管理"
          @click="$emit('cancel-selection')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <button
          v-else-if="closeable"
          type="button"
          class="icon-button mobile-close-button"
          aria-label="关闭解析历史"
          @click="$emit('close')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </header>

    <div v-if="manage" class="selection-actions">
      <button type="button" :disabled="historyBusy || !selectedIds.length" @click="$emit('rename-selected')">重命名</button>
      <button type="button" :disabled="historyBusy || !selectedIds.length" @click="$emit('download-selected')">下载</button>
      <button type="button" class="danger-action" :disabled="historyBusy || !selectedIds.length" @click="$emit('delete-selected')">删除</button>
    </div>

    <p v-if="historyError" class="history-error" role="alert">{{ historyError }}</p>

    <form v-if="renameIds.length" class="rename-form" @submit.prevent="$emit('apply-rename')">
      <label for="history-panel-name">{{ renameIds.length > 1 ? '批量名称' : '记录名称' }}</label>
      <input
        id="history-panel-name"
        class="history-name-input"
        :value="renameValue"
        maxlength="80"
        required
        placeholder="输入名称"
        @input="$emit('update:renameValue', ($event.target as HTMLInputElement).value)"
      />
      <span v-if="renameIds.length > 1" class="rename-hint">按时间从早到晚追加编号</span>
      <div class="rename-actions">
        <button type="button" class="text-button" :disabled="historyBusy" @click="$emit('cancel-rename')">取消</button>
        <button type="submit" class="primary-button" :disabled="historyBusy || !renameValue.trim()">保存</button>
      </div>
    </form>

    <div class="history-scroll">
      <div v-if="!history.length" class="history-empty">
        <span class="history-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m7 15 3-3 2 2 2.5-2.5L18 15" />
            <circle cx="8" cy="9" r="1" />
          </svg>
        </span>
        <strong>暂无解析记录</strong>
        <span>完成一次解析后会显示在这里</span>
      </div>

      <section v-for="group in groupedHistory" :key="group.key" class="history-group">
        <h3>{{ group.label }}</h3>
        <button
          v-for="item in group.items"
          :key="item.id"
          type="button"
          class="history-row"
          :class="{
            'is-active': !manage && item.id === selectedHistoryId,
            'is-selected': item.id !== undefined && selectedIds.includes(item.id)
          }"
          :disabled="busy || historyBusy"
          :aria-pressed="manage ? item.id !== undefined && selectedIds.includes(item.id) : item.id === selectedHistoryId"
          @click="$emit('select', item)"
        >
          <span class="history-thumbnail">
            <img :src="item.preview" :alt="`${SSTV_MODES[item.mode].name} 解析预览`" loading="lazy" draggable="false" />
          </span>
          <span class="history-row-copy">
            <span class="history-row-title">{{ historyName(item) }}</span>
            <span class="history-row-meta">
              <span>{{ SSTV_MODES[item.mode].name }}</span>
              <span class="meta-separator">·</span>
              <time :datetime="new Date(item.createdAt).toISOString()">{{ formatItemTime(item.createdAt) }}</time>
            </span>
            <span class="history-row-file">{{ item.fileName }}</span>
          </span>
          <span v-if="manage" class="selection-mark" :class="{ checked: item.id !== undefined && selectedIds.includes(item.id) }" aria-hidden="true">
            <svg viewBox="0 0 16 16"><path d="m3.5 8 3 3 6-6" /></svg>
          </span>
          <span v-else-if="item.id === selectedHistoryId" class="active-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
          </span>
        </button>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SSTV_MODES } from '../../core'
import type { SstvHistoryEntry } from '../../services/sstvHistory'

type HistoryItem = SstvHistoryEntry & { preview: string }
type HistoryGroup = { key: string; label: string; items: HistoryItem[] }

const props = defineProps<{
  history: HistoryItem[]
  busy: boolean
  historyBusy: boolean
  historyError: string
  manage: boolean
  selectedIds: number[]
  selectedHistoryId: number | null
  allSelected: boolean
  renameIds: number[]
  renameValue: string
  variant: 'sidebar' | 'sheet'
  closeable?: boolean
}>()

defineEmits<{
  select: [item: HistoryItem]
  manage: []
  'toggle-all': []
  'rename-selected': []
  'download-selected': []
  'delete-selected': []
  'cancel-selection': []
  'clear-all': []
  'apply-rename': []
  'cancel-rename': []
  'update:renameValue': [value: string]
  close: []
}>()

const groupedHistory = computed<HistoryGroup[]>(() => {
  const groups: HistoryGroup[] = []
  for (const item of props.history) {
    const key = localDateKey(item.createdAt)
    let group = groups[groups.length - 1]
    if (!group || group.key !== key) {
      group = { key, label: formatGroupLabel(item.createdAt), items: [] }
      groups.push(group)
    }
    group.items.push(item)
  }
  return groups
})

function localDateKey(timestamp: number) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function formatGroupLabel(timestamp: number) {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (localDateKey(timestamp) === localDateKey(today.getTime())) return '今天'
  if (localDateKey(timestamp) === localDateKey(yesterday.getTime())) return '昨天'
  if (date.getFullYear() === today.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function formatItemTime(timestamp: number) {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function historyName(item: SstvHistoryEntry) {
  return item.displayName || SSTV_MODES[item.mode].name
}
</script>

<style scoped>
.history-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  color: var(--text-primary);
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
}

.history-panel--sheet {
  border: 0;
  border-radius: 0;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex: 0 0 auto;
  min-height: 4.25rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border-light);
}

.history-header.is-managing {
  border-bottom-color: transparent;
}

.history-heading,
.history-heading-actions,
.history-title-row,
.history-heading-copy {
  min-width: 0;
}

.history-heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.history-heading-copy {
  flex: 1;
}

.history-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.history-title-row h2 {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.35;
}

.history-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.45rem;
  height: 1.25rem;
  padding: 0 0.4rem;
  color: var(--text-secondary);
  font-size: 0.72rem;
  line-height: 1;
  background: var(--bg-container);
  border-radius: 999px;
}

.history-subtitle {
  margin: 0.1rem 0 0;
  color: var(--text-tertiary);
  font-size: 0.7rem;
}

.history-heading-actions {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex: 0 0 auto;
}

.icon-button {
  display: inline-grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  color: var(--text-secondary);
  background: transparent;
  border: 0;
  border-radius: 7px;
  cursor: pointer;
}

.icon-button svg {
  width: 1.15rem;
  height: 1.15rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.icon-button:hover {
  color: var(--text-primary);
  background: var(--bg-table-hover);
}

.text-button,
.primary-button {
  min-height: 2.5rem;
  padding: 0.45rem 0.7rem;
  border-radius: 6px;
  cursor: pointer;
}

.text-button {
  color: var(--color-primary);
  background: transparent;
  border: 0;
}

.text-button:hover:not(:disabled) {
  background: var(--bg-table-hover);
}

.clear-history-button {
  color: var(--color-danger);
}

.primary-button {
  color: var(--text-white);
  background: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.text-button:disabled,
.primary-button:disabled,
.selection-actions button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.history-error {
  flex: 0 0 auto;
  margin: 0;
  padding: 0.65rem 1rem;
  color: var(--color-danger);
  font-size: 0.78rem;
  background: color-mix(in srgb, var(--color-danger) 7%, transparent);
}

.rename-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.45rem 0.75rem;
  flex: 0 0 auto;
  padding: 0.8rem 1rem;
  background: var(--bg-container);
  border-bottom: 1px solid var(--border-light);
}

.rename-form label {
  grid-column: 1 / -1;
  color: var(--text-secondary);
  font-size: 0.78rem;
}

.history-name-input {
  width: 100%;
  min-width: 0;
  height: 2.5rem;
  padding: 0.5rem 0.65rem;
  color: var(--text-primary);
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
}

.history-name-input:focus {
  outline: 2px solid color-mix(in srgb, var(--color-primary) 35%, transparent);
  outline-offset: 1px;
  border-color: var(--color-primary);
}

.rename-hint {
  grid-column: 1 / -1;
  color: var(--text-tertiary);
  font-size: 0.7rem;
}

.rename-actions {
  display: flex;
  gap: 0.35rem;
}

.history-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0.65rem;
  overscroll-behavior: contain;
}

.history-group + .history-group {
  margin-top: 0.65rem;
}

.history-group h3 {
  margin: 0;
  padding: 0.45rem 0.45rem 0.35rem;
  color: var(--text-tertiary);
  font-size: 0.7rem;
  font-weight: 500;
}

.history-row {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  min-height: 4.65rem;
  padding: 0.4rem;
  color: var(--text-primary);
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
}

.history-row + .history-row {
  margin-top: 0.2rem;
}

.history-row:hover:not(:disabled) {
  background: var(--bg-table-hover);
}

.history-row.is-active,
.history-row.is-selected {
  background: color-mix(in srgb, var(--color-primary) 8%, var(--bg-card));
  border-color: color-mix(in srgb, var(--color-primary) 38%, transparent);
}

.history-row:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.history-row:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.history-thumbnail {
  display: block;
  width: 5.5rem;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--bg-container);
  border-radius: 5px;
}

.history-thumbnail img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.history-row-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  align-self: stretch;
  justify-content: center;
}

.history-row-title,
.history-row-file {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-row-title {
  font-size: 0.82rem;
  font-weight: 600;
}

.history-row-meta {
  margin-top: 0.12rem;
  color: var(--text-secondary);
  font-size: 0.7rem;
}

.meta-separator {
  padding: 0 0.18rem;
  color: var(--text-tertiary);
}

.history-row-file {
  margin-top: 0.12rem;
  color: var(--text-tertiary);
  font-size: 0.68rem;
}

.selection-mark {
  display: grid;
  place-items: center;
  width: 1.35rem;
  height: 1.35rem;
  color: var(--text-white);
  border: 1.5px solid var(--text-secondary);
  border-radius: 50%;
}

.selection-mark.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.selection-mark svg {
  width: 0.85rem;
  height: 0.85rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
}

.selection-mark.checked svg {
  opacity: 1;
}

.active-mark {
  color: var(--color-primary);
}

.active-mark svg {
  width: 1.1rem;
  height: 1.1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.selection-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.2rem;
  flex: 0 0 auto;
  padding: 0.55rem 0.75rem;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-light);
}

.selection-actions button {
  min-height: 2.5rem;
  padding: 0.4rem 0.6rem;
  color: var(--color-primary);
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}

.selection-actions button:hover:not(:disabled) {
  background: var(--bg-table-hover);
}

.selection-actions .danger-action,
.danger-action {
  color: var(--color-danger);
}

.history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 14rem;
  padding: 2rem 1rem;
  color: var(--text-tertiary);
  text-align: center;
}

.history-empty-icon {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  margin-bottom: 0.75rem;
  background: var(--bg-container);
  border-radius: 50%;
}

.history-empty-icon svg {
  width: 1.4rem;
  height: 1.4rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.history-empty strong {
  margin-bottom: 0.2rem;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.history-empty > span:last-child {
  font-size: 0.72rem;
}

@media (max-width: 420px) {
  .history-header {
    padding-inline: 0.75rem;
  }

  .history-scroll {
    padding: 0.5rem;
  }

  .history-row {
    grid-template-columns: 5rem minmax(0, 1fr) auto;
    gap: 0.6rem;
  }

  .history-thumbnail {
    width: 5rem;
  }

  .history-subtitle {
    display: none;
  }

  .selection-actions {
    padding-inline: 0.5rem;
  }

  .selection-actions button {
    padding-inline: 0.45rem;
  }
}
</style>
