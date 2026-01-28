<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal modal-callsign-records">
      <div class="modal-header">
        <h3>与 {{ callsign }} 的通联记录</h3>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>
      <div class="modal-body">
        <div v-if="records && records.data.length > 0" class="record-cards-grid">
          <div
            v-for="(record, index) in records.data"
            :key="'record-' + index"
            class="record-card"
            :class="{ 'today-record': isTodayContact(record.timestamp) }"
          >
            <div class="record-row">
              <span class="record-label">日期：</span>
              <span class="record-value">{{ formatTimestamp(record.timestamp) }}</span>
            </div>
            <div class="record-row">
              <span class="record-label">接收方：</span>
              <span class="record-value">{{ record.toCallsign }} / {{ record.toGrid || '-' }}</span>
            </div>
            <div class="record-row">
              <span class="record-label">发送方：</span>
              <span class="record-value"
                >{{ record.fromCallsign }} / {{ record.fromGrid || '-' }}</span
              >
            </div>
            <div class="record-row">
              <span class="record-label">频率：</span>
              <span class="record-value">{{ formatFreqHz(record.freqHz) }} MHz</span>
            </div>
            <div class="record-row">
              <span class="record-label">中继：</span>
              <span class="record-value"
                >{{ record.relayName || '-'
                }}<template v-if="record.relayAdmin">（{{ record.relayAdmin }}）</template></span
              >
            </div>
            <div v-if="record.toComment" class="record-row">
              <span class="record-label">留言：</span>
              <span class="record-value">{{ record.toComment }}</span>
            </div>
          </div>
        </div>
        <div v-else class="empty-hint">暂无记录</div>
      </div>
      <div v-if="records && records.totalPages > 1" class="modal-footer">
        <div class="pagination">
          <button
            :disabled="currentPage === 1"
            class="hidden-on-small"
            @click="$emit('page-change', 1)"
          >
            首页
          </button>
          <button :disabled="currentPage === 1" @click="$emit('page-change', currentPage - 1)">
            上一页
          </button>
          <span class="page-info">第 {{ currentPage }} / {{ records.totalPages }} 页</span>
          <button
            :disabled="currentPage === records.totalPages"
            @click="$emit('page-change', currentPage + 1)"
          >
            下一页
          </button>
          <button
            :disabled="currentPage === records.totalPages"
            class="hidden-on-small"
            @click="$emit('page-change', records.totalPages)"
          >
            末页
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatTimestamp, formatFreqHz, isTodayContact } from '../constants'

defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  callsign: {
    type: String,
    default: ''
  },
  records: {
    type: Object,
    default: null
  },
  currentPage: {
    type: Number,
    default: 1
  }
})

defineEmits(['close', 'page-change'])
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
  box-shadow: 0 4px 20px var(--shadow-modal);
}

.modal-callsign-records {
  width: 90%;
  max-width: 900px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
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
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.modal-footer {
  flex-shrink: 0;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-light);
  background: var(--bg-card);
}

.record-cards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.record-card {
  background: var(--bg-record-card);
  border: 1px solid var(--border-record-card);
  border-radius: 8px;
  padding: 0.75rem;
}

.record-row {
  display: flex;
  margin-bottom: 0.3rem;
  font-size: 0.85rem;
  line-height: 1.4;
}

.record-row:last-child {
  margin-bottom: 0;
}

.record-label {
  color: var(--text-tertiary);
  flex-shrink: 0;
  width: 60px;
}

.record-value {
  color: var(--text-primary);
  flex: 1;
  word-break: break-all;
}

.record-card.today-record {
  background: var(--bg-today-card);
  border-color: var(--border-today-card);
}

.empty-hint {
  text-align: center;
  color: var(--text-tertiary);
  padding: 3rem;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.pagination button {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--border-primary);
  background: var(--bg-container);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-primary);
}

.pagination button:hover:not(:disabled) {
  background: var(--bg-table-hover);
}

.pagination button:disabled {
  color: var(--text-disabled);
  cursor: not-allowed;
}

.page-info {
  margin: 0 1rem;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .record-cards-grid {
    grid-template-columns: 1fr;
  }

  .modal-callsign-records {
    width: 95%;
    max-height: 80vh;
  }

  .modal-body {
    padding: 0.75rem;
    max-height: calc(80vh - 120px);
  }

  .modal-footer {
    padding: 0.5rem;
  }

  .modal-footer .pagination {
    gap: 0.25rem;
  }

  .modal-footer .pagination button {
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
  }

  .modal-footer .page-info {
    font-size: 0.75rem;
    margin: 0 0.25rem;
  }

  .pagination .hidden-on-small {
    display: none;
  }
}
</style>
