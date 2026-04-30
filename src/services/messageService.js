/**
 * 向后兼容薄层：对外仍叫 getMessageService() / validateCallsign() / validateSSID()。
 *
 * 新实现已全部迁移到 Pinia store（src/stores/messageStore.ts）。
 * 本文件只做 facade：所有方法调用、所有响应式字段均转发到 store，
 * 保证 MainLayout.vue / MessageView.vue 原 `messageService.messageList.value`
 * `messageService.connect(...)` 等调用方式零修改。
 */

import { useMessageStore } from '../stores/messageStore'

let facade = null

function buildFacade() {
  const store = useMessageStore()
  return {
    // ========== 响应式字段（直接引用 store 的 ref，.value 访问保持不变） ==========
    get connected() {
      return store.connected
    },
    get busy() {
      return store.busy
    },
    get messageList() {
      return store.messageList
    },
    get hasMore() {
      return store.hasMore
    },
    get nextAnchorId() {
      return store.nextAnchorId
    },
    // ========== 方法 ==========
    connect: (...args) => store.connect(...args),
    disconnect: () => store.disconnect(),
    handleNewMessageSummary: (data) => store.handleNewMessageSummary(data),
    subscribe: (event, cb) => store.subscribe(event, cb),
    getList: (...args) => store.getList(...args),
    getDetail: (...args) => store.getDetail(...args),
    setRead: (...args) => store.setRead(...args),
    send: (...args) => store.send(...args),
    deleteItem: (...args) => store.deleteItem(...args),
    deleteAll: (...args) => store.deleteAll(...args),
    isBusy: () => store.isBusy(),
    isConnected: () => store.isConnected()
  }
}

/**
 * 获取消息服务单例（facade）
 */
export function getMessageService() {
  if (!facade) facade = buildFacade()
  return facade
}

/**
 * 呼号验证规则
 */
export function validateCallsign(callsign) {
  const pattern = /^[A-Z0-9]{1,15}$/
  return pattern.test(callsign)
}

/**
 * SSID 验证
 */
export function validateSSID(ssid) {
  const num = parseInt(ssid, 10)
  return !isNaN(num) && num >= 1 && num <= 15
}
