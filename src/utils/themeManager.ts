import { exportFile } from './exportFile'

const ACTIVE_THEME_STYLE_ID = 'fmo-custom-theme-style'

export interface CustomThemePreset {
  id: string
  name: string
  css: string
  createdAt: number
  updatedAt: number
}

export interface ThemeActionResult {
  success: boolean
  message: string
}

export const DEFAULT_THEME_ID = 'default'

function ensureThemeStyleElement(): HTMLStyleElement | null {
  if (typeof document === 'undefined') return null

  let styleEl = document.getElementById(ACTIVE_THEME_STYLE_ID) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = ACTIVE_THEME_STYLE_ID
    styleEl.setAttribute('data-theme-style', 'custom')
    document.head.appendChild(styleEl)
  }
  return styleEl
}

export function applyThemeCss(cssText: string) {
  const styleEl = ensureThemeStyleElement()
  if (!styleEl) return
  styleEl.textContent = cssText
}

export function clearAppliedThemeCss() {
  if (typeof document === 'undefined') return
  const styleEl = document.getElementById(ACTIVE_THEME_STYLE_ID)
  if (styleEl) {
    styleEl.remove()
  }
}

export function normalizeThemeCss(cssText: string) {
  return cssText.replace(/^\uFEFF/, '').trim()
}

export function fileNameToThemeName(fileName: string) {
  return fileName.replace(/\.css$/i, '').replace(/[-_]+/g, ' ').trim() || '自定义主题'
}

export function buildThemeFileName(themeName: string) {
  return `${themeName.trim().replace(/\s+/g, '-').toLowerCase() || 'custom-theme'}.css`
}

export async function downloadThemeCss(themeName: string, cssText: string) {
  return await exportFile(buildThemeFileName(themeName), cssText, 'text/css;charset=utf-8')
}
