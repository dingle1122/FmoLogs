use tauri::plugin::{Builder, TauriPlugin};
use tauri::Runtime;

/// 初始化后台音频播放插件
/// 在 Android 上通过前台服务 + WakeLock 防止息屏后音频停止
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("background-audio").build()
}
