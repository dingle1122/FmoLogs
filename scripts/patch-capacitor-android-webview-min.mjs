import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bridgePath = resolve(
  rootDir,
  'node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/Bridge.java'
)

let source = readFileSync(bridgePath, 'utf8')
const next = source
  .replace('public static final int DEFAULT_ANDROID_WEBVIEW_VERSION = 60;', 'public static final int DEFAULT_ANDROID_WEBVIEW_VERSION = 51;')
  .replace('public static final int MINIMUM_ANDROID_WEBVIEW_VERSION = 55;', 'public static final int MINIMUM_ANDROID_WEBVIEW_VERSION = 51;')

if (next !== source) {
  writeFileSync(bridgePath, next)
  console.log('Patched Capacitor Android WebView minimum version to 51.')
}
