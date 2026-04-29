import { registerPlugin } from '@capacitor/core'

/**
 * FmoEvents: 原生 WebSocket 事件订阅桥接
 * - connect({ addressId, url, apiUrl }): 建立一条连接，apiUrl 用于原生轮询 station:getCurrent
 * - disconnect({ addressId }): 关闭指定连接
 * - disconnectAll(): 关闭全部
 * - refreshServerInfo({ addressId }): 立即触发一次服务器信息查询（电台切换后用）
 * 事件：
 * - 'message'     -> { addressId, data }（data 为 JSON 字符串）
 * - 'status'      -> { addressId, status }（connected/reconnecting/disconnected）
 * - 'serverInfo'  -> { addressId, uid, name }（原生轮询 getCurrent 成功后推送）
 */
export const FmoEvents = registerPlugin('FmoEvents')
