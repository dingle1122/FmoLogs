<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header settings-header">
        <div class="modal-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'general' }"
            @click="activeTab = 'general'"
          >
            常规设置
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'links' }"
            @click="activeTab = 'links'"
          >
            友情链接
          </button>
        </div>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>
      <div class="modal-body">
        <!-- 常规设置 -->
        <div v-if="activeTab === 'general'" class="tab-content">
          <div class="setting-item">
            <span class="setting-label">日志文件</span>
            <div class="setting-actions">
              <button class="btn-primary" @click="$emit('select-files')">导入FMO日志</button>
              <button class="btn-secondary" :disabled="!dbLoaded" @click="$emit('export-data')">
                导出数据文件
              </button>
            </div>
          </div>
          <div v-if="dbLoaded" class="setting-info">
            已加载 {{ availableFromCallsigns.length }} 个呼号日志
          </div>

          <div v-if="availableFromCallsigns.length > 0" class="setting-item">
            <span class="setting-label">发送方呼号</span>
            <div class="setting-actions">
              <select
                :value="selectedFromCallsign"
                class="setting-select"
                @change="$emit('update:selectedFromCallsign', $event.target.value)"
              >
                <option
                  v-for="callsign in availableFromCallsigns"
                  :key="callsign"
                  :value="callsign"
                >
                  {{ callsign }}
                </option>
              </select>
            </div>
          </div>

          <!-- FMO同步设置 -->
          <div class="setting-group">
            <div class="setting-item">
              <span class="setting-label">FMO地址</span>
              <div class="setting-input-group">
                <select
                  :value="protocol"
                  class="protocol-select"
                  @change="$emit('update:protocol', $event.target.value)"
                >
                  <option value="ws">ws://</option>
                  <option value="wss">wss://</option>
                </select>
                <input
                  :value="fmoAddress"
                  type="text"
                  :placeholder="isMobileDevice ? '输入设备IP' : '输入设备IP或域名(fmo.local)'"
                  class="setting-input-flex"
                  @input="$emit('update:fmoAddress', $event.target.value)"
                />
              </div>
            </div>
            <div v-if="!isMobileDevice" class="setting-note">
              支持mDNS服务，可直接输入 <code>fmo.local</code> 连接设备
            </div>
            <div class="setting-item-save">
              <button class="btn-save" @click="$emit('save-fmo-address')">保存</button>
            </div>
            <div class="setting-item-buttons">
              <button
                class="btn-secondary"
                :disabled="!fmoAddress || syncing"
                @click="$emit('sync-today')"
              >
                {{ syncing ? '正在同步...' : '同步今日通联' }}
              </button>
              <button
                class="btn-secondary"
                :disabled="!fmoAddress || syncing"
                @click="$emit('backup-logs')"
              >
                备份FMO日志
              </button>
            </div>
            <div v-if="syncStatus" class="sync-status">
              {{ syncStatus }}
            </div>
          </div>

          <div v-if="dbLoaded" class="setting-item setting-item-danger">
            <span class="setting-label">数据管理</span>
            <div class="setting-actions">
              <button class="btn-danger" @click="$emit('clear-all-data')">清空所有数据</button>
            </div>
          </div>
        </div>

        <!-- 友情链接 -->
        <div v-else-if="activeTab === 'links'" class="tab-content">
          <div class="links-section">
            <div class="links-card-grid">
              <a
                href="https://map.srv.ink/"
                target="_blank"
                rel="noopener noreferrer"
                class="link-card"
              >
                <div class="link-icon">&#128506;&#65039;</div>
                <div class="link-info">
                  <div class="link-name">FMO 地图</div>
                  <div class="link-url">map.srv.ink</div>
                </div>
                <div class="link-arrow">&rarr;</div>
              </a>
              <a
                :href="remoteControlUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="link-card"
                :class="{ disabled: !fmoAddress }"
              >
                <div class="link-icon">&#128251;</div>
                <div class="link-info">
                  <div class="link-name">FMO远程控制</div>
                  <div class="link-url">{{ fmoAddress || '未设置地址' }}</div>
                </div>
                <div class="link-arrow">&rarr;</div>
              </a>
              <a
                href="https://bg5esn.com/docs/fmo-user-shares/"
                target="_blank"
                rel="noopener noreferrer"
                class="link-card"
              >
                <div class="link-icon">&#128214;</div>
                <div class="link-info">
                  <div class="link-name">FMO实践分享</div>
                  <div class="link-url">bg5esn.com</div>
                </div>
                <div class="link-arrow">&rarr;</div>
              </a>
              <a
                href="https://bg5esn.com/"
                target="_blank"
                rel="noopener noreferrer"
                class="link-card"
              >
                <div class="link-icon">&#9875;</div>
                <div class="link-info">
                  <div class="link-name">大船地下室</div>
                  <div class="link-url">bg5esn.com</div>
                </div>
                <div class="link-arrow">&rarr;</div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { normalizeHost } from '../../../utils/urlUtils'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  dbLoaded: {
    type: Boolean,
    default: false
  },
  fmoAddress: {
    type: String,
    default: ''
  },
  protocol: {
    type: String,
    default: 'ws'
  },
  availableFromCallsigns: {
    type: Array,
    default: () => []
  },
  selectedFromCallsign: {
    type: String,
    default: ''
  },
  syncing: {
    type: Boolean,
    default: false
  },
  syncStatus: {
    type: String,
    default: ''
  }
})

defineEmits([
  'close',
  'select-files',
  'export-data',
  'save-fmo-address',
  'sync-today',
  'backup-logs',
  'clear-all-data',
  'update:selectedFromCallsign',
  'update:protocol',
  'update:fmoAddress'
])

const activeTab = ref('general')

const isMobileDevice = computed(() => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
})

const remoteControlUrl = computed(() => {
  if (!props.fmoAddress) return '#'
  const host = normalizeHost(props.fmoAddress)
  return `http://${host}/remote.html`
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

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem !important;
  border-bottom: 1px solid var(--border-light);
}

.modal-tabs {
  display: flex;
  gap: 0.25rem;
}

.tab-btn {
  padding: 0.4rem 0.8rem;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 1rem;
  transition: all 0.2s;
  position: relative;
}

.tab-btn:hover {
  background: var(--bg-table-hover);
  color: var(--color-primary);
}

.tab-btn.active {
  color: var(--color-primary);
  font-weight: 600;
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -0.5rem;
  left: 0.8rem;
  right: 0.8rem;
  height: 2px;
  background: var(--color-primary);
  border-radius: 2px;
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

.tab-content {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.setting-label {
  font-weight: 500;
}

.setting-actions {
  display: flex;
  gap: 0.5rem;
}

.setting-info {
  margin-top: 1rem;
  color: var(--color-success);
  font-size: 0.9rem;
}

.setting-select {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 0.9rem;
  background: var(--bg-input);
  color: var(--text-primary);
  cursor: pointer;
  min-width: 150px;
}

.setting-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.setting-group {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-light);
}

.setting-group .setting-item {
  margin-bottom: 1rem;
}

.setting-input-group {
  display: flex;
  gap: 0.5rem;
  flex: 1;
}

.protocol-select {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 0.9rem;
  background: var(--bg-input);
  color: var(--text-primary);
  cursor: pointer;
  min-width: 85px;
}

.protocol-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.setting-input-flex {
  flex: 1;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 0.9rem;
  min-width: 0;
  width: 98%;
  background: var(--bg-input);
  color: var(--text-primary);
}

.setting-input-flex:focus {
  outline: none;
  border-color: var(--color-primary);
}

.setting-note {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background-color: #f0f9ff;
  border: 1px solid #b3d8ff;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #606266;
}

.setting-note code {
  background-color: #e6f7ff;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: monospace;
  color: #409eff;
  border: 1px solid #d9ecff;
}

.setting-item-save {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
  margin-bottom: 1.5rem;
}

.btn-save {
  width: 100%;
  padding: 0.6rem;
  font-size: 1rem;
  background: var(--color-primary);
  color: var(--text-white);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px var(--shadow-primary);
}

.btn-save:hover {
  background: var(--color-primary-hover);
  box-shadow: 0 4px 8px var(--shadow-primary-hover);
  transform: translateY(-1px);
}

.setting-group .setting-item-buttons {
  display: flex;
  flex-direction: row;
  gap: 0.8rem;
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.setting-item-buttons .btn-secondary {
  width: 100%;
}

.sync-status {
  margin-top: 0.8rem;
  font-size: 0.85rem;
  color: var(--color-primary);
  text-align: center;
}

.setting-item-danger {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-light);
}

.btn-primary {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  background: var(--color-primary);
  color: var(--text-white);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-secondary {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  background: var(--bg-container);
  color: var(--text-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  cursor: pointer;
}

.btn-secondary:hover {
  background: var(--bg-table-hover);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  background: var(--color-danger);
  color: var(--text-white);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-danger:hover {
  background: var(--color-danger-hover);
}

/* 友情链接样式 */
.links-section {
  padding: 0.5rem 0;
}

.links-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.link-card {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-secondary);
  border-radius: 12px;
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.link-card:hover {
  transform: translateY(-4px);
  border-color: var(--color-primary);
  box-shadow: 0 8px 16px var(--shadow-card);
  background: var(--bg-table-hover);
}

.link-card.disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

.link-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-input);
  border-radius: 10px;
  font-size: 1.4rem;
  margin-right: 1rem;
  flex-shrink: 0;
  border: 1px solid var(--border-light);
}

.link-info {
  flex: 1;
  min-width: 0;
}

.link-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1rem;
  margin-bottom: 0.2rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.link-url {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  font-family: monospace;
}

.link-arrow {
  font-size: 1.2rem;
  color: var(--text-disabled);
  transition: all 0.3s;
  margin-left: 0.5rem;
  opacity: 0.3;
}

.link-card:hover .link-arrow {
  color: var(--color-primary);
  transform: translateX(3px);
  opacity: 1;
}
</style>
