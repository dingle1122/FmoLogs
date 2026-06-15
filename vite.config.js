import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import legacy from '@vitejs/plugin-legacy'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    legacy({
      targets: ['Chrome >= 55'],
      modernPolyfills: true,
      renderLegacyChunks: true
    })
  ],
  esbuild: {
    target: 'chrome55'
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'chrome55'
    }
  },
  build: {
    // 兼容旧版 Android System WebView，避免保留过新的 JS/CSS 语法。
    cssTarget: ['chrome55', 'safari12'],
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('/sql.js/')) {
            return 'vendor-sql'
          }

          if (id.includes('/@capacitor/') || id.includes('/@anuradev/')) {
            return 'vendor-native'
          }

          if (id.includes('/vue/') || id.includes('/vue-router/') || id.includes('/pinia/')) {
            return 'vendor-vue'
          }

          return 'vendor'
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0'
  }
})
