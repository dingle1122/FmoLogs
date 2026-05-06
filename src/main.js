import { Capacitor } from '@capacitor/core'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './stores'
import { getPlatform } from './platform'
import { applySafeAreaInsets } from './platform/native-capacitor/SystemUiService.native'
import './style.css'

//  Android 原生平台：env(safe-area-inset-*) 在许多厂商 ROM 上返回 0px，
// 需要通过原生 WindowInsets API 动态获取真实值并写入 CSS 变量。
// 降级值：状态栏约 36px，导航栏约 48px（在 WebView CSS 坐标中 1dp ≈ 1px）。
if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
  applySafeAreaInsets()
}

// 提前实例化平台单例，保证后续模块以统一入口访问能力
getPlatform()

const app = createApp(App)

app.use(pinia)
app.use(router)

app.mount('#app')
