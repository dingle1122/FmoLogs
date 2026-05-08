/**
 * 定位服务抽象。
 * - Android：Capacitor 原生 GPS + 前台服务通知
 * - Web / Tauri 桌面：空操作（路由已条件屏蔽，仅满足接口契约）
 */
/** 权限检查结果 */
export interface PermissionCheckResult {
  /** 定位权限是否已授予 */
  granted: boolean
  /** 通知权限是否已授予（Android 13+，其他平台始终 true） */
  notificationGranted: boolean
  /** 后台定位权限是否已授予（Android 10+，其他平台始终 true） */
  backgroundGranted: boolean
  /** 是否需要展示权限说明理由（用户之前拒绝过但未勾选"不再询问"） */
  needRationale: boolean
}

/**
 * 定位服务抽象接口。
 * Web 端所有方法返回 null/false；Android 端桥接到 FmoLocation 原生插件。
 */
export interface ILocationService {
  /** 仅检查权限，不弹出系统对话框 */
  checkPermission(): Promise<PermissionCheckResult>

  /** 请求定位权限（弹出系统对话框） */
  requestPermission(): Promise<boolean>
  /** 单独请求后台定位权限（Android 10+） */
  requestBackgroundPermission(): Promise<boolean>
  /** 获取当前GPS坐标 */
  getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null>
  /** 开启持续定位更新（秒级间隔，用于实时显示） */
  startWatching(intervalSeconds: number): Promise<void>
  /** 停止持续定位 */
  stopWatching(): Promise<void>
  /** 开启前台定位服务（常驻通知，支持后台持续定位） */
  startForegroundService(title: string, text: string, intervalMinutes: number): Promise<void>
  /** 停止前台定位服务 */
  stopForegroundService(): Promise<void>
  /** 定位更新回调注册 */
  onLocation(callback: (pos: { latitude: number; longitude: number }) => void): void
}
