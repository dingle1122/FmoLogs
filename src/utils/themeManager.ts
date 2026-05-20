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

export const THEME_SAMPLE_CSS = `/* FmoLogs 主题示例
   这是“当前默认主题”的基线模板。
   原样上传不会改变界面颜色；需要自定义时，取消对应变量的注释并修改值。

   建议优先改：
   1. 快速套色：主色、成功色、警告色、危险色、当前项高亮。
   2. 页面和文字：页面底色、卡片底色、正文文字、边框。
   3. 组件细节：只在某个区域需要独立微调时再改。

   不建议直接写组件 class 选择器。优先改 CSS 变量，后续升级更稳定。
*/

:root {
  /* 快速套色。默认主题没有启用这些 quick 变量，下面是当前实际 fallback 值。 */
  /* --theme-quick-primary: #4caf50; */
  /* --theme-quick-primary-hover: #3d8b40; */
  /* --theme-quick-success: #67c23a; */
  /* --theme-quick-warning: #d46b08; */
  /* --theme-quick-danger: #f56c6c; */
  /* --theme-quick-highlight-accent: #4caf50; */
  /* --theme-quick-surface-hover: #f5f7fa; */

  /* 页面和容器底色 */
  /* --theme-surface-page: #ffffff; */
  /* --theme-surface-container: #ffffff; */
  /* --theme-surface-header: #ffffff; */
  /* --theme-surface-card: #ffffff; */
  /* --theme-surface-input: #ffffff; */
  /* --theme-surface-hover: #f5f7fa; */

  /* 文字和边框 */
  /* --theme-text-primary: #333333; */
  /* --theme-text-secondary: #606266; */
  /* --theme-text-muted: #909399; */
  /* --theme-border-default: #dcdfe6; */
  /* --theme-border-subtle: #ebeef5; */

  /* 全局主色和状态色 */
  /* --theme-accent-primary: #4caf50; */
  /* --theme-accent-primary-hover: #3d8b40; */
  /* --theme-success: #67c23a; */
  /* --theme-warning: #d46b08; */
  /* --theme-danger: #f56c6c; */

  /* 当前项 / 选中态 / 今日通联 */
  /* --theme-current-highlight-accent: #4caf50; */
  /* --theme-current-highlight-bg: color-mix(in srgb, var(--theme-current-highlight-accent) 12%, var(--theme-surface-card)); */
  /* --theme-current-highlight-bg-alt: color-mix(in srgb, var(--theme-current-highlight-accent) 7%, var(--theme-surface-container)); */
  /* --theme-current-highlight-bg-strong: color-mix(in srgb, var(--theme-current-highlight-accent) 18%, var(--theme-surface-card)); */
  /* --theme-current-highlight-border: color-mix(in srgb, var(--theme-current-highlight-accent) 30%, var(--theme-border-default)); */

  /* 常用组件微调 */
  /* --component-header-title-hover: var(--theme-current-highlight-accent); */
  /* --component-header-station-bg: var(--theme-current-highlight-bg); */
  /* --component-header-station-text: var(--theme-current-highlight-accent); */
  /* --component-button-hover-bg: color-mix(in srgb, var(--theme-accent-primary) 12%, var(--theme-surface-container)); */
  /* --component-button-hover-border: var(--theme-accent-primary); */
  /* --component-button-hover-text: var(--theme-accent-primary); */
  /* --component-logs-table-header-bg: #f5f7fa; */
  /* --component-logs-table-header-text: var(--theme-text-secondary); */
  /* --component-station-item-hover-border: var(--theme-current-highlight-border); */
  /* --component-station-item-active-bg: var(--theme-current-highlight-bg); */
  /* --component-station-item-active-border: var(--theme-current-highlight-accent); */
  /* --component-station-item-active-text: var(--theme-current-highlight-accent); */
  /* --component-filter-chip-active-bg: var(--theme-current-highlight-accent); */
}

@media (prefers-color-scheme: dark) {
  :root {
    /* 深色模式默认值。需要单独适配深色时再取消注释。 */
    /* --theme-surface-page: #1a1a1a; */
    /* --theme-surface-container: #242424; */
    /* --theme-surface-header: #2c2c2c; */
    /* --theme-surface-card: #2c2c2c; */
    /* --theme-surface-input: #3a3a3a; */
    /* --theme-surface-hover: #2a2a2a; */

    /* --theme-text-primary: #e8e8e8; */
    /* --theme-text-secondary: #b8b8b8; */
    /* --theme-text-muted: #909399; */
    /* --theme-border-default: #404040; */
    /* --theme-border-subtle: #363636; */

    /* --theme-current-highlight-bg: #1f3a1f; */
    /* --theme-current-highlight-bg-alt: #1a241a; */
    /* --theme-current-highlight-bg-strong: #1e2e1e; */
    /* --theme-current-highlight-border: #2d5a2d; */
  }
}
`

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

export function downloadThemeCss(themeName: string, cssText: string) {
  if (typeof document === 'undefined') return
  const blob = new Blob([cssText], { type: 'text/css;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = buildThemeFileName(themeName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
