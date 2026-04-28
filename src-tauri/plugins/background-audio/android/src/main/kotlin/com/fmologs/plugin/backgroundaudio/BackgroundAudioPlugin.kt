package com.fmologs.plugin.backgroundaudio

import android.app.Activity
import android.content.Intent
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

/**
 * Tauri 后台音频播放插件
 * 在 Android 上通过前台服务 + WakeLock 保持音频播放
 */
@TauriPlugin
class BackgroundAudioPlugin(private val activity: Activity) : Plugin(activity) {

    @Command
    fun start(invoke: Invoke) {
        try {
            val intent = Intent(activity, AudioPlaybackService::class.java)
            activity.startForegroundService(intent)
            invoke.resolve()
        } catch (e: Exception) {
            invoke.reject("启动后台音频服务失败: ${e.message}")
        }
    }

    @Command
    fun stop(invoke: Invoke) {
        try {
            val intent = Intent(activity, AudioPlaybackService::class.java)
            activity.stopService(intent)
            invoke.resolve()
        } catch (e: Exception) {
            invoke.reject("停止后台音频服务失败: ${e.message}")
        }
    }
}
