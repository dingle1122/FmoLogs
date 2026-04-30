import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './stores'
import { getPlatform } from './platform'
import './style.css'

// 提前实例化平台单例，保证后续模块以统一入口访问能力
getPlatform()

const app = createApp(App)

app.use(pinia)
app.use(router)

app.mount('#app')
