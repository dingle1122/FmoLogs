package com.fmologs.plugin.backgroundaudio

import android.app.Activity
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import android.view.View
import android.view.ViewGroup
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

/**
 * Tauri 后台音频播放插件
 * 在 Android 上通过前台服务 + WakeLock 保持音频播放
 * 同时周期性撤销 WebView 暂停，防止息屏/切后台后 JS/WebAudio 被冻结
 */
@TauriPlugin
class BackgroundAudioPlugin(private val activity: Activity) : Plugin(activity) {

    private var webView: WebView? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var keepAliveRunnable: Runnable? = null

    override fun load(webView: WebView) {
        this.webView = webView
    }

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

    /**
     * Activity onPause 时启动周期性保活
     * WryActivity.onPause() → native pause() 会冻结 WebView，
     * 单次 onResume() 可能被系统重入暂停覆盖，需要周期性对抗
     */
    override fun onPause() {
        if (AudioPlaybackService.running()) {
            startKeepAlive()
        }
    }

    /**
     * Activity 回到前台时停止保活，恢复正常生命周期
     */
    override fun onResume() {
        stopKeepAlive()
    }

    /**
     * Activity onStop 时同样确保保活运行
     * WryActivity.onStop() → native stop() 可能进一步冻结 WebView
     */
    override fun onStop() {
        if (AudioPlaybackService.running()) {
            startKeepAlive()
        }
    }

    override fun onDestroy() {
        stopKeepAlive()
        webView = null
    }

    /**
     * 启动周期性保活：每 500ms 调用 webView.onResume() + resumeTimers()
     * 持续对抗 WryActivity native pause()/stop() 对 WebView 的冻结
     */
    private fun startKeepAlive() {
        if (keepAliveRunnable != null) return // 已在运行

        keepAliveRunnable = object : Runnable {
            override fun run() {
                if (AudioPlaybackService.running()) {
                    keepWebViewActive()
                    mainHandler.postDelayed(this, 500)
                } else {
                    keepAliveRunnable = null
                }
            }
        }
        // 首次立即执行
        mainHandler.post(keepAliveRunnable!!)
    }

    /**
     * 停止周期性保活
     */
    private fun stopKeepAlive() {
        keepAliveRunnable?.let {
            mainHandler.removeCallbacks(it)
            keepAliveRunnable = null
        }
    }

    /**
     * 撤销 WebView 暂停：调用 onResume + resumeTimers
     * 优先使用 load 时保存的 WebView 引用，否则遍历视图树查找
     */
    private fun keepWebViewActive() {
        val wv = webView
        if (wv != null) {
            wv.onResume()
            resumeWebViewTimers()
        } else {
            findAndResumeWebView(activity.findViewById(android.R.id.content))
        }
    }

    private fun findAndResumeWebView(view: View?) {
        if (view == null) return
        if (view is WebView) {
            view.onResume()
            resumeWebViewTimers()
            return
        }
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) {
                findAndResumeWebView(view.getChildAt(i))
            }
        }
    }

    /**
     * 通过反射调用 WebView.resumeTimers()，
     * 恢复所有 WebView 的 JS 定时器（setTimeout/setInterval）
     */
    private fun resumeWebViewTimers() {
        try {
            WebView::class.java.getMethod("resumeTimers").invoke(null)
        } catch (_: Exception) {
            // resumeTimers 不可用时，onResume 已足够恢复 WebView 执行
        }
    }
}
