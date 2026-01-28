<template>
  <div class="result-section">
    <table class="data-table">
      <thead>
        <tr>
          <th v-for="col in displayColumns" :key="col" :class="'col-' + col">
            {{ ColumnNames[col] || col }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!dbLoaded" class="empty-row">
          <td :colspan="displayColumns.length" class="empty-cell">
            请点击右上角设置图标选择日志目录
          </td>
        </tr>
        <tr v-else-if="queryResult && queryResult.data.length === 0" class="empty-row">
          <td :colspan="displayColumns.length" class="empty-cell">暂无数据</td>
        </tr>
        <template v-else-if="queryResult">
          <tr
            v-for="(row, index) in queryResult.data"
            :key="index"
            :class="{ 'row-today': isTodayContact(row.timestamp) }"
            @click="$emit('show-detail', row)"
          >
            <td v-for="col in queryResult.columns" :key="col" :class="'col-' + col">
              <template v-if="col === 'timestamp'">
                <div class="timestamp-div">
                  <div>{{ formatDatePart(formatTimestamp(row[col])) }}</div>
                  <div>{{ formatTimePart(formatTimestamp(row[col])) }}</div>
                </div>
              </template>
              <template v-else-if="col === 'dailyIndex'">
                <div class="daily-index-cell">
                  <span
                    class="daily-index"
                    :class="{
                      'rank-1': row.dailyIndex === 1,
                      'rank-2': row.dailyIndex === 2,
                      'rank-3': row.dailyIndex === 3
                    }"
                    >{{ row.dailyIndex }}</span
                  >
                </div>
              </template>
              <template v-else-if="col === 'freqHz'">
                {{ formatFreqHz(row[col]) }}
              </template>
              <template v-else-if="col === 'relayName'">
                <div class="relay-cell">
                  <div>{{ row.relayName }}</div>
                  <div class="relay-admin">（{{ row.relayAdmin }}）</div>
                </div>
              </template>
              <template v-else-if="col === 'toCallsign'">
                <div class="callsign-with-grid">
                  <div class="callsign-main">{{ row.toCallsign }}</div>
                  <div v-if="row.toGrid" class="callsign-grid">{{ row.toGrid }}</div>
                </div>
              </template>
              <template v-else-if="col === 'fromCallsign'">
                <div class="callsign-with-grid">
                  <div>{{ row.fromCallsign }}</div>
                  <div v-if="row.fromGrid" class="callsign-grid">{{ row.fromGrid }}</div>
                </div>
              </template>
              <template v-else>
                {{ row[col] }}
              </template>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ColumnNames, formatTimestamp, formatFreqHz, isTodayContact } from './constants'

defineProps({
  queryResult: {
    type: Object,
    default: null
  },
  displayColumns: {
    type: Array,
    required: true
  },
  dbLoaded: {
    type: Boolean,
    default: false
  }
})

defineEmits(['show-detail'])

function formatDatePart(dateTimeStr) {
  if (!dateTimeStr) return ''
  return dateTimeStr.split(' ')[0]
}

function formatTimePart(dateTimeStr) {
  if (!dateTimeStr) return ''
  return dateTimeStr.split(' ')[1]
}
</script>

<style scoped>
.result-section {
  margin-top: 1rem;
  flex: 1;
  overflow: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  table-layout: fixed;
}

.data-table th,
.data-table td {
  border: 1px solid var(--border-table);
  padding: 0.5rem;
  text-align: left;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.data-table th {
  background: var(--bg-table-header);
  font-weight: bold;
  position: sticky;
  top: 0;
  z-index: 1;
  text-align: center;
}

/* 列宽设置 */
.col-timestamp {
  width: 120px;
  text-align: center;
  vertical-align: middle;
  line-height: 1.2;
}
.col-dailyIndex {
  width: 60px;
  text-align: center;
  vertical-align: middle;
}
.col-freqHz {
  width: 95px;
}
.col-fromCallsign {
  width: 100px;
}
.col-fromGrid {
  width: 100px;
}
.col-toCallsign {
  width: 140px;
}
.col-toGrid {
  width: 100px;
}
.col-toComment {
  width: auto;
}
.col-mode {
  width: 80px;
}
.col-relayName {
  width: 130px;
  text-align: center;
  vertical-align: middle;
}
.col-count {
  width: 60px;
}

.timestamp-div {
  display: block;
  white-space: nowrap;
  text-align: center;
}

.relay-cell {
  text-align: center;
}

.relay-admin {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.callsign-with-grid {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.callsign-main {
  font-weight: bold;
  font-size: 1.1rem;
}

.callsign-grid {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: normal;
}

.daily-index {
  display: inline-block;
  font-size: 1.1rem;
  font-weight: bold;
  color: var(--text-secondary);
  background: var(--bg-disabled);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  min-width: 1.8rem;
  text-align: center;
}

.daily-index.rank-1 {
  color: var(--text-white);
  background: linear-gradient(135deg, #f7c247, #e6a23c);
}

.daily-index.rank-2 {
  color: var(--text-white);
  background: linear-gradient(135deg, #a8b0ba, #909399);
}

.daily-index.rank-3 {
  color: var(--text-white);
  background: linear-gradient(135deg, #cd8c52, #b87333);
}

.daily-index-cell {
  display: flex;
  justify-content: center;
  align-items: center;
}

.data-table tbody tr.row-today {
  background-color: var(--bg-today-row);
}

.data-table tbody tr.row-today td {
  border-color: var(--border-today-row);
}

.data-table tbody tr:hover:not(.empty-row) {
  background: var(--bg-table-hover);
  cursor: pointer;
}

.data-table tbody tr {
  line-height: 1.6;
}

.empty-row .empty-cell {
  text-align: center;
  color: var(--text-tertiary);
  padding: 3rem;
}

@media (max-width: 768px) {
  .data-table {
    font-size: 0.8rem;
  }

  .data-table th,
  .data-table td {
    padding: 0.4rem;
  }

  .col-freqHz,
  .col-fromCallsign,
  .col-toComment,
  .col-mode,
  .col-relayName {
    display: none;
  }
}

@media (max-width: 480px) {
  .col-freqHz,
  .col-fromCallsign,
  .col-toComment,
  .col-mode,
  .col-relayName {
    display: none;
  }

  .col-timestamp,
  .col-toCallsign {
    display: table-cell;
  }

  .col-timestamp {
    width: 90px;
  }
}
</style>
