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
            :class="{ active: activeTab === 'remoteControl' }"
            @click="activeTab = 'remoteControl'"
          >
            远程控制
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'links' }"
            @click="activeTab = 'links'"
          >
            友情链接
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'about' }"
            @click="activeTab = 'about'"
          >
            关于
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
            <span class="setting-label">您的呼号</span>
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

          <!-- FMO地址管理 -->
          <div class="setting-group">
            <div class="setting-item">
              <span class="setting-label">FMO地址</span>
              <div class="setting-actions">
                <button
                  v-if="addressList.length > 0"
                  class="btn-text-danger"
                  @click="handleClearAllAddresses"
                >
                  清除全部
                </button>
                <button class="btn-add" @click="showAddForm">+ 添加地址</button>
              </div>
            </div>

            <!-- 地址列表 -->
            <div v-if="addressList.length > 0" class="address-list">
              <div
                v-for="addr in addressList"
                :key="addr.id"
                class="address-card"
                :class="{
                  active: addr.id === activeAddressId,
                  connecting: connectingId === addr.id
                }"
                @click="handleSelectAddress(addr.id)"
              >
                <div class="address-status">
                  <span v-if="connectingId === addr.id" class="status-connecting"></span>
                  <span v-else-if="addr.id === activeAddressId" class="status-active"></span>
                  <span v-else class="status-inactive"></span>
                </div>
                <div class="address-info">
                  <div class="address-name">{{ addr.name }}</div>
                  <div class="address-url">{{ addr.protocol }}://{{ addr.host }}</div>
                  <div
                    v-if="addr.id === activeAddressId && addr.userInfo"
                    class="address-user-info"
                  >
                    <span v-if="addr.userInfo.callsign" class="user-callsign">{{
                      addr.userInfo.callsign
                    }}</span>
                    <span v-if="addr.userInfo.uid" class="user-uid">UID: {{ addr.userInfo.uid }}</span>
                  </div>
                </div>
                <div class="address-actions" @click.stop>
                  <button
                    v-if="addr.id === activeAddressId"
                    class="btn-icon"
                    :class="{ 'btn-icon-loading': refreshingId === addr.id }"
                    title="刷新用户信息"
                    :disabled="refreshingId === addr.id"
                    @click="handleRefreshUserInfo(addr.id)"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path
                        d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
                      />
                    </svg>
                  </button>
                  <button class="btn-icon" title="编辑" @click="editAddress(addr)">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path
                        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                      />
                    </svg>
                  </button>
                  <button
                    class="btn-icon btn-icon-danger"
                    title="删除"
                    @click="handleDeleteAddress(addr.id)"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path
                        d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- 无地址时的提示 -->
            <div v-else class="no-address">
              <p>暂无FMO地址，点击上方"添加地址"按钮添加</p>
            </div>

            <!-- 操作按钮 -->
            <div v-if="addressList.length > 0" class="setting-item-buttons">
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
                href="http://180.76.54.163/"
                target="_blank"
                rel="noopener noreferrer"
                class="link-card"
              >
                <div class="link-icon">
                  <svg
                    width="44"
                    height="44"
                    viewBox="0 0 44 44"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect width="44" height="44" rx="10" fill="#ff9800" />
                    <text
                      x="22"
                      y="30"
                      font-size="24"
                      font-weight="bold"
                      fill="white"
                      text-anchor="middle"
                      font-family="Arial, sans-serif"
                    >
                      F
                    </text>
                  </svg>
                </div>
                <div class="link-info">
                  <div class="link-name">FMO CONTROLLER</div>
                  <div class="link-url">180.76.54.163</div>
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

        <!-- 关于 -->
        <div v-else-if="activeTab === 'about'" class="tab-content">
          <div class="about-section">
            <div class="about-header">
              <div class="about-left">
                <img src="/vite.svg" alt="FmoLogs" class="about-logo" />
                <div class="about-title">FmoLogs</div>
                <div class="about-version">{{ appVersion }}</div>
              </div>
              <div class="about-description">
                <p>
                  本地化、离线优先的 FMO
                  日志管理工具，支持本地导入日志文件、远程同步通联记录、数据查询与统计分析。
                </p>
                <p>所有数据存储在浏览器 IndexedDB 中，无需服务器，保障隐私安全。</p>
                <p class="about-links-text">
                  <a
                    href="https://github.com/dingle1122/FmoLogs"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-link"
                  >
                    GitHub 仓库
                  </a>
                  ·
                  <a
                    href="https://github.com/dingle1122/FmoLogs/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-link"
                  >
                    问题反馈
                  </a>
                </p>
              </div>
            </div>

            <div class="about-thanks">
              <div class="thanks-title">特别感谢</div>
              <div class="thanks-list">
                <div v-for="person in thanksList" :key="person.name" class="thanks-item">
                  <strong>{{ person.name }}</strong> - {{ person.contribution }}
                </div>
              </div>
            </div>

            <div class="about-footer">由 BH5HSJ 后视镜 贡献</div>
            <div class="about-footer">开源项目 · 欢迎贡献</div>
          </div>
        </div>

        <!-- 远程控制 -->
        <div v-else-if="activeTab === 'remoteControl'" class="tab-content">
          <AprsRemoteControl 
            :active-address-id="activeAddressId"
            :address-list="addressList"
          />
        </div>
      </div>
    </div>

    <!-- 地址编辑弹框 -->
    <div v-if="showAddressDialog" class="dialog-overlay" @click.self="cancelAddressDialog">
      <div class="dialog">
        <div class="dialog-header">
          <span class="dialog-title">{{ editingId ? '编辑地址' : '添加地址' }}</span>
          <button class="close-btn" @click="cancelAddressDialog">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label class="form-label">名称（可选）</label>
            <input
              v-model="formData.name"
              type="text"
              placeholder="如：家里的FMO"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label class="form-label">地址</label>
            <div class="form-row">
              <select v-model="formData.protocol" class="protocol-select">
                <option value="ws">ws://</option>
                <option value="wss">wss://</option>
              </select>
              <input
                v-model="formData.host"
                type="text"
                :placeholder="isMobileDevice ? '输入设备IP' : '输入设备IP或域名(fmo.local)'"
                class="form-input-flex"
              />
            </div>
          </div>
          <div v-if="!isMobileDevice" class="form-hint">
            支持mDNS服务，可直接输入 <code>fmo.local</code> 连接设备
          </div>
          <div v-if="formError" class="form-error">
            {{ formError }}
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn-secondary" :disabled="formValidating" @click="cancelAddressDialog">
            取消
          </button>
          <button class="btn-primary" :disabled="formValidating" @click="submitAddressForm">
            {{ formValidating ? '验证中...' : '确定' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { normalizeHost } from '../../../utils/urlUtils'
import { useAprsControl } from '../../../composables/useAprsControl'
import AprsRemoteControl from './AprsRemoteControl.vue'
import confirmDialog from '../../../composables/useConfirm'
import packageInfo from '../../../../package.json'

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
  addressList: {
    type: Array,
    default: () => []
  },
  activeAddressId: {
    type: String,
    default: null
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

const emit = defineEmits([
  'close',
  'select-files',
  'export-data',
  'sync-today',
  'backup-logs',
  'clear-all-data',
  'update:selectedFromCallsign',
  'add-address',
  'update-address',
  'delete-address',
  'select-address',
  'clear-all-addresses',
  'refresh-user-info'
])

const activeTab = ref('general')
const connectingId = ref(null)
const refreshingId = ref(null)

// 地址编辑弹框状态
const showAddressDialog = ref(false)
const editingId = ref(null)
const formData = ref({
  name: '',
  host: '',
  protocol: 'ws'
})
const formValidating = ref(false)
const formError = ref('')

const isMobileDevice = computed(() => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
})

// APRS 远程控制 - 仅用于自动填充呼号
const aprsControl = useAprsControl()

// 监听地址变化，自动填充呼号(仅在登录呼号为空时)
watch(
  [() => props.activeAddressId, () => props.addressList],
  ([newId, addressList]) => {
    if (!newId || !addressList?.length) return
    const activeAddr = addressList.find(a => a.id === newId)
    if (activeAddr?.userInfo?.callsign) {
      // 只有当当前呼号为空时才自动填充
      if (!aprsControl.mycall.value) {
        aprsControl.updateCallsign(activeAddr.userInfo.callsign)
      }
    }
  },
  { immediate: true, deep: true }
)


const remoteControlUrl = computed(() => {
  if (!props.fmoAddress) return '#'
  const host = normalizeHost(props.fmoAddress)
  return `http://${host}/remote.html`
})

const appVersion = computed(() => {
  return `v${packageInfo.version}`
})

// 感谢名单
const thanksList = [
  { name: 'BG5ESN', contribution: '提供完美的FMO硬件平台' },
  { name: 'BG9JYT', contribution: '提供甘肃集群服务器，并提供被控支持' },
  { name: 'BG2LRU、BD6JDU、BI3SQP等各位友台', contribution: '提供宝贵的想法和建议' }
]

// 切换到远程控制标签时初始化
function initAprsControl() {
  aprsControl.init()
}

// 验证WebSocket连接
async function validateConnection(host, proto) {
  const wsUrl = `${proto}://${normalizeHost(host)}/ws`

  return new Promise((resolve) => {
    let socket
    try {
      socket = new WebSocket(wsUrl)
    } catch {
      resolve(false)
      return
    }

    const timeout = setTimeout(() => {
      socket.close()
      resolve(false)
    }, 5000)

    socket.onopen = () => {
      clearTimeout(timeout)
      socket.close()
      resolve(true)
    }

    socket.onerror = () => {
      clearTimeout(timeout)
      socket.close()
      resolve(false)
    }

    socket.onclose = () => {
      clearTimeout(timeout)
      resolve(false)
    }
  })
}

function showAddForm() {
  editingId.value = null
  formData.value = {
    name: '',
    host: isMobileDevice.value ? '' : 'fmo.local',
    protocol: 'ws'
  }
  formError.value = ''
  showAddressDialog.value = true
}

function editAddress(addr) {
  editingId.value = addr.id
  formData.value = {
    name: addr.name,
    host: addr.host,
    protocol: addr.protocol
  }
  formError.value = ''
  showAddressDialog.value = true
}

function cancelAddressDialog() {
  showAddressDialog.value = false
  editingId.value = null
  formData.value = { name: '', host: '', protocol: 'ws' }
  formError.value = ''
}

async function submitAddressForm() {
  const { name, host, protocol } = formData.value

  if (!host.trim()) {
    formError.value = '请输入地址'
    return
  }

  formError.value = ''
  formValidating.value = true

  // 验证连接
  const isConnected = await validateConnection(host.trim(), protocol)

  formValidating.value = false

  if (!isConnected) {
    formError.value = '连接失败，请检查地址'
    return
  }

  // 连接成功，保存地址
  if (editingId.value) {
    emit('update-address', {
      id: editingId.value,
      name: name.trim() || host.trim(),
      host: host.trim(),
      protocol
    })
  } else {
    emit('add-address', {
      name: name.trim() || host.trim(),
      host: host.trim(),
      protocol
    })
  }

  // 关闭弹框并清空数据
  cancelAddressDialog()
}

function handleSelectAddress(id) {
  if (id === props.activeAddressId || connectingId.value) return

  connectingId.value = id
  emit('select-address', id)

  // 超时后清除连接状态（由父组件处理结果）
  setTimeout(() => {
    connectingId.value = null
  }, 6000)
}

async function handleDeleteAddress(id) {
  const confirmed = await confirmDialog.show('确定要删除这个地址吗？')
  if (confirmed) {
    emit('delete-address', id)
  }
}

async function handleClearAllAddresses() {
  const confirmed = await confirmDialog.show('确定要清除全部FMO地址吗？')
  if (confirmed) {
    emit('clear-all-addresses')
  }
}

async function handleRefreshUserInfo(id) {
  refreshingId.value = id
  emit('refresh-user-info', id)
}

// 暴露方法供父组件调用
function clearConnecting() {
  connectingId.value = null
}

function clearRefreshing() {
  refreshingId.value = null
}

defineExpose({ clearConnecting, clearRefreshing })
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
  width: 720px;
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

.btn-add {
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
  background: var(--bg-container);
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add:hover {
  background: var(--color-primary);
  color: var(--text-white);
}

/* 地址列表 */
.address-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.address-card {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.address-card:hover {
  border-color: var(--color-primary);
  background: var(--bg-table-hover);
}

.address-card.active {
  border-color: var(--color-primary);
  background: rgba(64, 158, 255, 0.08);
}

.address-card.connecting {
  opacity: 0.7;
  cursor: wait;
}

.address-status {
  margin-right: 0.75rem;
}

.status-active,
.status-inactive,
.status-connecting {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-active {
  background: var(--color-success);
  box-shadow: 0 0 6px var(--color-success);
}

.status-inactive {
  background: var(--border-primary);
}

.status-connecting {
  background: var(--color-primary);
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}

.address-info {
  flex: 1;
  min-width: 0;
}

.address-name {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.95rem;
  margin-bottom: 0.15rem;
}

.address-url {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.address-user-info {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
  flex-wrap: wrap;
}

.user-callsign,
.user-uid {
  font-size: 0.75rem;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-weight: 500;
}

.user-callsign {
  background: rgba(64, 158, 255, 0.15);
  color: var(--color-primary);
}

.user-uid {
  background: rgba(103, 194, 58, 0.15);
  color: var(--color-success);
}

.address-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
  margin-left: 0.5rem;
}

.btn-icon {
  padding: 0.35rem;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-tertiary);
  transition: all 0.2s;
  flex-shrink: 0;
}

.btn-icon:hover {
  background: var(--bg-table-hover);
  color: var(--color-primary);
}

.btn-icon-danger:hover {
  color: var(--color-danger);
}

.btn-icon:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-icon-loading svg {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.no-address {
  text-align: center;
  padding: 2rem;
  color: var(--text-tertiary);
  font-size: 0.9rem;
}

.setting-note {
  margin-top: 0.5rem;
  margin-bottom: 1rem;
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

.setting-item-buttons {
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

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.btn-text-danger {
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
  background: none;
  color: var(--color-danger);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-text-danger:hover {
  color: var(--color-danger-hover);
  text-decoration: underline;
}

/* 地址编辑弹框 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}

.dialog {
  background: var(--bg-card);
  border-radius: 8px;
  width: 420px;
  max-width: 90%;
  box-shadow: 0 4px 20px var(--shadow-modal);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-light);
}

.dialog-title {
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.dialog-body {
  padding: 1.25rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group:last-of-type {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.form-row {
  display: flex;
  gap: 0.5rem;
}

.form-input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 0.9rem;
  background: var(--bg-input);
  color: var(--text-primary);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-input-flex {
  flex: 1;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 0.9rem;
  background: var(--bg-input);
  color: var(--text-primary);
}

.form-input-flex:focus {
  outline: none;
  border-color: var(--color-primary);
}

.protocol-select {
  padding: 0.6rem 0.5rem;
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

.form-hint {
  margin-top: 0.75rem;
  padding: 0.6rem;
  background-color: #f0f9ff;
  border: 1px solid #b3d8ff;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #606266;
}

.form-hint code {
  background-color: #e6f7ff;
  padding: 0.15rem 0.35rem;
  border-radius: 3px;
  font-family: monospace;
  color: #409eff;
  border: 1px solid #d9ecff;
}

.form-error {
  margin-top: 0.75rem;
  padding: 0.6rem;
  background-color: #fef0f0;
  border: 1px solid #fde2e2;
  border-radius: 4px;
  font-size: 0.85rem;
  color: var(--color-danger);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border-light);
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

/* 关于页面样式 */
.about-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1.5rem;
  min-height: 100%;
}

.about-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 1.25rem;
  width: 100%;
  max-width: 500px;
}

.about-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
}

.about-logo {
  width: 64px;
  height: 64px;
}

.about-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
}

.about-version {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-family: monospace;
  background: var(--bg-input);
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
}

.about-description {
  flex: 1;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.6;
  text-align: left;
}

.about-description p {
  margin: 0 0 0.6rem 0;
}

.about-description p:last-child {
  margin-bottom: 0;
}

.about-links-text {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-light);
}

.inline-link {
  color: var(--color-primary);
  text-decoration: none;
  transition: all 0.2s;
  font-weight: 500;
}

.inline-link:hover {
  color: var(--color-primary-hover);
  text-decoration: underline;
}

.about-thanks {
  width: 100%;
  max-width: 500px;
  margin-bottom: 1.25rem;
}

.thanks-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.6rem;
  text-align: center;
}

.thanks-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.thanks-item {
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--text-secondary);
  margin-bottom: 0.3rem;
}

.thanks-item:last-child {
  margin-bottom: 0;
}

.about-footer {
  text-align: center;
  font-size: 0.8rem;
  color: var(--text-tertiary);
  margin-top: auto;
  padding-top: 0.75rem;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .address-card {
    padding: 0.6rem 0.75rem;
  }

  .address-info {
    flex: 1;
    min-width: 0;
    margin-right: 0.25rem;
  }

  .address-url {
    font-size: 0.75rem;
  }

  .address-actions {
    margin-left: 0.25rem;
    gap: 0.15rem;
  }

  .btn-icon {
    padding: 0.3rem;
  }

  .btn-icon svg {
    width: 14px;
    height: 14px;
  }

  .address-name {
    font-size: 0.9rem;
  }

  .user-callsign,
  .user-uid {
    font-size: 0.7rem;
    padding: 0.05rem 0.3rem;
  }
}

/* ========== APRS 远程控制样式 ========== */
.aprs-control {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

.aprs-server-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex: 1;
}

.aprs-server-row .form-input-flex {
  flex: 1;
}

.btn-sm {
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
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

.aprs-buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  padding: 0.5rem 0;
}

.btn-control {
  flex: 1;
  max-width: 140px;
  padding: 0.75rem 1.5rem;
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
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.history-list {
  max-height: 150px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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

