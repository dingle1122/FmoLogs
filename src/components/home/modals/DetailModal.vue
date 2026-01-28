<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal modal-detail">
      <div class="modal-header">
        <h3>详细信息</h3>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>
      <div class="modal-body">
        <div v-for="(value, key) in filteredRowData" :key="key" class="detail-item">
          <span class="detail-label">{{ ColumnNames[key] || key }}：</span>
          <span class="detail-value">
            <template v-if="key === 'timestamp'">
              {{ formatTimestamp(value) }}
            </template>
            <template v-else-if="key === 'freqHz'">
              {{ formatFreqHz(value) }}
            </template>
            <template v-else-if="key === 'relayName'">
              <div class="relay-cell">
                <div>{{ value }}</div>
                <div v-if="rowData && rowData['relayAdmin']" class="relay-admin">
                  （{{ rowData['relayAdmin'] }}）
                </div>
              </div>
            </template>
            <template v-else>
              {{ value }}
            </template>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ColumnNames, formatTimestamp, formatFreqHz } from '../constants'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  rowData: {
    type: Object,
    default: null
  }
})

defineEmits(['close'])

const filteredRowData = computed(() => {
  if (!props.rowData) return {}

  const filtered = {}
  Object.keys(props.rowData).forEach((key) => {
    if (key !== 'logId' && key !== 'relayAdmin' && key !== 'dailyIndex') {
      filtered[key] = props.rowData[key]
    }
  })

  return filtered
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-card);
  border-radius: 8px;
  width: 650px;
  max-width: 90%;
  box-shadow: 0 4px 20px var(--shadow-modal);
}

.modal-detail {
  max-width: 600px;
  max-height: 80vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
}

.modal-header h3 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-tertiary);
  line-height: 1;
}

.close-btn:hover {
  color: var(--text-secondary);
}

.modal-body {
  padding: 1.5rem;
  height: 450px;
  overflow-y: auto;
}

.detail-item {
  display: flex;
  margin-bottom: 0.8rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid var(--border-light);
}

.detail-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.detail-label {
  flex: 0 0 120px;
  font-weight: 500;
  color: var(--text-secondary);
}

.detail-value {
  flex: 1;
  color: var(--text-primary);
  word-break: break-all;
}

.relay-cell {
  text-align: left;
}

.relay-admin {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}
</style>
