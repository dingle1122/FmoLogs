import { Capacitor } from '@capacitor/core'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './stores'
import { getPlatform } from './platform'
import './style.css'

// Android 原生平台：env(safe-area-inset-top) 在许多厂商 ROM 上返回 0px，
// 需要手动设置 CSS 变量以确保 header 不被系统状态栏遮挡。
// 24px 是 Android 标准状态栏高度（在 WebView CSS 坐标中 1dp ≈ 1px）。
if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
  document.documentElement.style.setProperty('--safe-inset-top', '36px')
}

// 提前实例化平台单例，保证后续模块以统一入口访问能力
getPlatform()

const app = createApp(App)

app.use(pinia)
app.use(router)

app.mount('#app')
