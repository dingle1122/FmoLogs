<template>
  <div class="aprs-control">
    <!-- 连接状态 -->
    <div
      class="aprs-status"
      :class="{
        'status-success': statusType === 'success',
        'status-error': statusType === 'error',
        'status-info': statusType === 'info'
      }"
    >
      {{ formatMessage(statusMessage) }}
    </div>

    <!-- 表单 -->
    <div class="aprs-form">
      <!-- 登录呼号 -->
      <div class="form-group callsign-group">
        <label class="form-label">登录呼号</label>
        <div class="callsign-input">
          <input
            v-model="mycallBase"
            type="text"
            placeholder="如 BG5ESN"
            class="form-input callsign-base"
            @input="onMycallChange"
          />
          <span class="callsign-sep">-</span>
          <select v-model="mycallSsid" class="form-input ssid-select" @change="onMycallChange">
            <option v-for="n in 16" :key="n-1" :value="n-1">{{ n-1 }}</option>
          </select>
        </div>
      </div>

      <!-- APRS-IS Passcode -->
      <div class="form-group">
        <label class="form-label">APRS-IS Passcode</label>
        <input
          v-model="passcode"
          type="password"
          placeholder="5位数字"
          class="form-input"
        />
      </div>

      <!-- 设备密钥 -->
      <div class="form-group">
        <label class="form-label">设备密钥</label>
        <input
          v-model="secret"
          type="password"
          placeholder="在设备配置中设置的密钥"
          class="form-input"
        />
      </div>

      <!-- 目标设备呼号 -->
      <div class="form-group callsign-group">
        <label class="form-label">
          目标设备呼号
          <span v-if="!tocallEditable" class="label-hint">(前缀自动同步)</span>
        </label>
        <div class="callsign-input">
          <input
            v-model="tocallBase"
            type="text"
            placeholder="如 BG5ESN"
            class="form-input callsign-base"
            :disabled="!tocallEditable"
          />
          <span class="callsign-sep">-</span>
          <select 
            v-model="tocallSsid" 
            class="form-input ssid-select"
          >
            <option v-for="n in 16" :key="n-1" :value="n-1">{{ n-1 }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 控制按钮 -->
    <div class="aprs-buttons">
      <button
        class="btn-control btn-normal"
        :disabled="!canSend"
        @click="handleSendCommand('NORMAL')"
      >
        普通模式
      </button>
      <button
        class="btn-control btn-standby"
        :disabled="!canSend"
        @click="handleSendCommand('STANDBY')"
      >
        待机模式
      </button>
      <button
        class="btn-control btn-reboot"
        :disabled="!canSend"
        @click="handleSendCommand('REBOOT')"
      >
        软重启
      </button>
    </div>

    <!-- 历史记录 -->
    <div v-if="history.length > 0" class="aprs-history">
      <div class="history-header">
        <span>操作记录</span>
        <button class="btn-text-danger" @click="clearHistory">清空</button>
      </div>
      <div class="history-list">
        <div
          v-for="(item, index) in history"
          :key="index"
          class="history-item"
          :class="{ 'history-success': item.success, 'history-fail': !item.success }"
        >
          <div class="history-status">{{ item.success ? '✅' : '❌' }}</div>
          <div class="history-content">
            <div class="history-message">{{ formatMessage(item.message) }}</div>
            <div class="history-time">{{ formatHistoryTime(item.timestamp) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useAprsControl } from '../../../composables/useAprsControl'

const aprsControl = useAprsControl()

// 解构 composable
const {
  statusMessage,
  statusType,
  history,
  canSend,
  mycall,
  passcode,
  secret,
  tocall,
  initAndConnect,
  disconnectWebSocket,
  sendCommand,
  clearHistory
} = aprsControl

// 拆分呼号为 base 和 ssid
const mycallBase = ref('')
const mycallSsid = ref(0)
const tocallBase = ref('')
const tocallSsid = ref(0)

// 目标呼号前缀是否可编辑（默认不可编辑，控制台输入 window.enableTocallEdit() 开启）
const tocallEditable = ref(false)

// 暴露到全局，允许控制台开启编辑
if (typeof window !== 'undefined') {
  window.enableTocallEdit = () => {
    tocallEditable.value = true
    console.log('目标设备呼号前缀编辑已开启')
    return true
  }
  window.disableTocallEdit = () => {
    tocallEditable.value = false
    console.log('目标设备呼号前缀编辑已关闭')
    return true
  }
}

// 解析呼号字符串为 base 和 ssid
function parseCallsign(callsign) {
  if (!callsign) return { base: '', ssid: 0 }
  const parts = callsign.toUpperCase().split('-')
  const base = parts[0] || ''
  const ssid = parts.length > 1 ? parseInt(parts[1], 10) : 0
  return { base, ssid: isNaN(ssid) || ssid < 0 || ssid > 15 ? 0 : ssid }
}

// 合并 base 和 ssid 到完整呼号
function formatCallsign(base, ssid) {
  if (!base) return ''
  return `${base.toUpperCase()}-${ssid}`
}

// 登录呼号变化时，同步到 tocall（如果不可编辑）
function onMycallChange() {
  mycall.value = formatCallsign(mycallBase.value, mycallSsid.value)
  if (!tocallEditable.value) {
    tocallBase.value = mycallBase.value
    // 注意：不再同步 SSID，允许用户自由选择目标 SSID
    tocall.value = formatCallsign(tocallBase.value, tocallSsid.value)
  }
}

// 监听 tocall 输入变化
watch([tocallBase, tocallSsid], () => {
  tocall.value = formatCallsign(tocallBase.value, tocallSsid.value)
})

// 监听外部 mycall 变化（如从设置中自动填充）
watch(mycall, (newVal) => {
  const parsed = parseCallsign(newVal)
  // 仅在本地值为空或与外部不同时更新
  if (!mycallBase.value || mycallBase.value !== parsed.base) {
    mycallBase.value = parsed.base
    mycallSsid.value = parsed.ssid
    // 同步 tocall（如果不可编辑）
    if (!tocallEditable.value) {
      tocallBase.value = parsed.base
      tocall.value = formatCallsign(tocallBase.value, tocallSsid.value)
    }
  }
})

// 发送指令
function handleSendCommand(action) {
  // 发送前确保呼号格式正确
  mycall.value = formatCallsign(mycallBase.value, mycallSsid.value)
  tocall.value = formatCallsign(tocallBase.value, tocallSsid.value)
  sendCommand(action)
}

// 格式化时间
function formatHistoryTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 将英文模式名称映射为中文
const ACTION_MAP = {
  'NORMAL': '普通模式',
  'STANDBY': '待机模式',
  'REBOOT': '软重启'
}

function formatMessage(message) {
  if (!message) return ''
  return message
    .replace(/\(NORMAL\)/g, '(普通模式)')
    .replace(/\(STANDBY\)/g, '(待机模式)')
    .replace(/\(REBOOT\)/g, '(软重启)')
    .replace(/NORMAL/g, '普通模式')
    .replace(/STANDBY/g, '待机模式')
    .replace(/REBOOT/g, '软重启')
}

// 组件挂载时自动连接
onMounted(() => {
  initAndConnect()
  
  // 从保存的值初始化拆分的呼号
  const parsed = parseCallsign(mycall.value)
  mycallBase.value = parsed.base
  mycallSsid.value = parsed.ssid
  
  const parsedTo = parseCallsign(tocall.value || mycall.value)
  tocallBase.value = parsedTo.base
  tocallSsid.value = parsedTo.ssid
})

// 组件卸载时断开连接
onUnmounted(() => {
  disconnectWebSocket()
})
</script>

<style scoped>
.aprs-control {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  min-height: 0;
}

.aprs-status {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  text-align: center;
}

.aprs-status.status-info {
  background: var(--bg-input);
  color: var(--text-secondary);
}

.aprs-status.status-success {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.aprs-status.status-error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.aprs-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

@media (max-width: 600px) {
  .aprs-form {
    grid-template-columns: 1fr;
  }
}

.aprs-form .form-group {
  margin-bottom: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.label-hint {
  font-size: 0.75rem;
  color: var(--text-muted, #888);
}

/* 呼号输入组 */
.callsign-input {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  width: 100%;
}

.callsign-input .form-input.callsign-base {
  flex: 1;
  min-width: 0;
  width: auto; /* Override width: 100% from .form-input */
}

.callsign-sep {
  color: var(--text-secondary);
  font-weight: 600;
  padding: 0 0.25rem;
  flex-shrink: 0;
}

.callsign-input .form-input.ssid-select {
  width: 65px;
  flex: 0 0 65px;
  text-align: center;
  padding: 0 0.25rem;
  height: 38px; /* Fixed height to match text input */
  line-height: 1.5; /* Vertical centering */
  appearance: none; /* Remove default arrow for custom styling */
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 6px center;
  background-size: 14px;
}

/* 统一 input 样式 - 与 SettingsModal 保持一致 */
.form-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 0.9rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--bg-table-hover, #f5f5f5);
}

.form-input::placeholder {
  color: var(--text-muted, #999);
}

.aprs-buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  padding: 0.5rem 0;
}

.btn-control {
  flex: 1;
  max-width: 140px;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-control:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-normal {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
}

.btn-normal:not(:disabled):hover {
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
}

.btn-standby {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
}

.btn-standby:not(:disabled):hover {
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
}

.btn-reboot {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
}

.btn-reboot:not(:disabled):hover {
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

.aprs-history {
  margin-top: 0.5rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.btn-text-danger {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
}

.btn-text-danger:hover {
  text-decoration: underline;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 100px;
}

.history-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
  background: var(--bg-input);
}

.history-success {
  border-left: 3px solid #22c55e;
}

.history-fail {
  border-left: 3px solid #ef4444;
}

.history-status {
  font-size: 1rem;
}

.history-content {
  flex: 1;
  min-width: 0;
}

.history-message {
  font-size: 0.85rem;
  color: var(--text-primary);
  word-break: break-all;
}

.history-time {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}
</style>
