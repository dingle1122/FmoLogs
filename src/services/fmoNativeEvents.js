import { registerPlugin } from '@capacitor/core'

/**
 * FmoEvents: 原生 WebSocket 事件订阅桥接
 * - connect({ addressId, url }): 建立一条连接
 * - disconnect({ addressId }): 关闭指定连接
 * - disconnectAll(): 关闭全部
 * 事件：
 * - 'message' -> { addressId, data }（data 为 JSON 字符串）
 * - 'status'  -> { addressId, status }（connected/reconnecting/disconnected）
 */
export const FmoEvents = registerPlugin('FmoEvents')
