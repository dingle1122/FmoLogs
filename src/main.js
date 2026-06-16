import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './stores'
import { useLocationStore } from './stores/locationStore'
import { getPlatform } from './platform'
import { applySafeAreaInsets } from './platform/native-capacitor/SystemUiService.native'
import { applyViewportCssVars } from './utils/viewport'
import { checkAndroidUpdateDaily, installDownloadedAndroidUpdate } from './services/updateService'
import './style.css'

// 兼容旧版 Android Chrome：浏览器栏显隐时，100vh/100dvh 不稳定。
// 统一写入 --app-height / --vh，供布局和弹框复用真实可视高度。
applyViewportCssVars()

// Android 原生平台：由原生插件按系统版本决定是否写入安全区。
// Android 7 等非 edge-to-edge 系统不额外预留上下安全区。
if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
  applySafeAreaInsets()
}

// 提前实例化平台单例，保证后续模块以统一入口访问能力
getPlatform()

const app = createApp(App)

app.use(pinia)
app.use(router)

// 深度链接：点击定位上报通知直接打开自动定位页面
if (Capacitor.isNativePlatform()) {
  CapacitorApp.addListener('appUrlOpen', (data) => {
    try {
      const url = new URL(data.url)
      if (url.host === 'location-report') {
        router.push('/location-report')
      } else if (url.host === 'update-install') {
        installDownloadedAndroidUpdate()
      }
    } catch {
      /* ignore invalid URL */
    }
  })
}

app.mount('#app')

// 冷启动自动恢复定位上报（如果之前已开启）
const locationStore = useLocationStore()
locationStore.init()
checkAndroidUpdateDaily()
