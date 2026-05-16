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

export const THEME_SAMPLE_CSS = `/* FmoLogs custom theme example
   Recommended order:
   1. Override semantic theme tokens (--theme-*)
   2. Override component tokens (--component-*) for per-module tuning
   3. Avoid editing component class selectors directly unless necessary
*/

:root {
  /* Page and surface colors */
  --theme-surface-page: #f6efe6;
  --theme-surface-container: #fffaf3;
  --theme-surface-header: #fff7ee;
  --theme-surface-card: #fffdf8;
  --theme-surface-input: #fffaf4;
  --theme-surface-hover: #f7ead8;

  /* Text colors */
  --theme-text-primary: #34261b;
  --theme-text-secondary: #715643;
  --theme-text-muted: #9c7f69;

  /* Border colors */
  --theme-border-default: #e4cfba;
  --theme-border-subtle: #efe1d2;

  /* Brand and status colors */
  --theme-accent-primary: #c46a2d;
  --theme-accent-primary-hover: #a55520;
  --theme-success: #3d8b5a;
  --theme-success-accent: #3d8b5a;
  --theme-warning: #b57918;
  --theme-danger: #c55353;

  /* Current/selected/today highlight colors
     If you want the app's "current", "selected", and "today" areas to match your theme,
     override this group first. */
  --theme-current-highlight-bg: #f3e4d4;
  --theme-current-highlight-bg-alt: #faf1e7;
  --theme-current-highlight-bg-strong: #ead4bd;
  --theme-current-highlight-border-soft: #e6ceb4;
  --theme-current-highlight-border: #d6b796;
  --theme-current-highlight-accent: #8b5a2b;
  --theme-current-highlight-muted: #b59c88;

  /* Speaking bar */
  --component-speaking-bar-bg: #efe3d0;
  --component-speaking-bar-border: #d6b796;
  --component-speaking-bar-text-accent: #8b5a2b;
  --component-speaking-bar-hover-bg: #f3e4d4;

  /* Header and navigation */
  --component-header-title-hover: #b82b4e;
  --component-header-station-text: #b82b4e;
  --component-header-station-hover-border: #f29cb0;
  --component-header-nav-hover-text: #b82b4e;
  --component-header-nav-active-text: #b82b4e;
  --component-header-nav-active-indicator: #b82b4e;
  --component-header-action-hover-text: #b82b4e;
  --component-mobile-nav-active-text: #b82b4e;

  /* More page and page navigation */
  --component-more-icon-bg: rgba(224, 82, 117, 0.12);
  --component-more-icon-text: #b82b4e;
  --component-more-item-hover-border: #f29cb0;
  --component-more-item-hover-bg: #fff5f7;
  --component-more-arrow-hover-text: #b82b4e;

  --component-page-nav-button-hover-border: #f29cb0;
  --component-page-nav-button-hover-text: #b82b4e;
  --component-page-nav-button-hover-bg: #fff5f7;
  --component-page-nav-input-focus-border: #b82b4e;

  --component-quick-nav-item-hover-border: #f29cb0;
  --component-quick-nav-item-active-bg: rgba(224, 82, 117, 0.1);
  --component-quick-nav-item-active-text: #b82b4e;
  --component-quick-nav-item-active-border: #e05275;
  --component-quick-nav-item-active-icon: #b82b4e;

  /* Station list and station control */
  --component-station-name-hover-text: #b82b4e;
  --component-station-primary-badge-bg: rgba(224, 82, 117, 0.12);
  --component-station-primary-badge-text: #b82b4e;
  --component-station-search-focus-border: #e05275;
  --component-station-refresh-hover-text: #b82b4e;
  --component-station-item-hover-border: #f29cb0;
  --component-station-item-active-bg: #e05275;
  --component-station-item-active-border: #e05275;
  --component-station-item-active-text: #ffffff;
  --component-station-item-active-pin-bg: rgba(255, 255, 255, 0.35);
  --component-station-item-active-pin-text: #ffffff;

  /* Settings */
  --component-settings-slider-thumb: #e05275;
  --component-settings-info-text: #388e5b;
  --component-settings-focus-border: #e05275;
  --component-settings-add-button-text: #b82b4e;
  --component-settings-add-button-border: #e05275;
  --component-settings-add-button-hover-bg: #e05275;
  --component-settings-address-hover-border: #f29cb0;
  --component-settings-address-hover-bg: #fff5f7;
  --component-settings-address-active-border: #e05275;
  --component-settings-address-active-bg: rgba(224, 82, 117, 0.08);
  --component-settings-status-active-bg: #388e5b;
  --component-settings-status-active-shadow: #388e5b;
  --component-settings-status-connecting-bg: #e05275;
  --component-settings-user-callsign-bg: rgba(224, 82, 117, 0.15);
  --component-settings-user-callsign-text: #b82b4e;
  --component-settings-user-uid-bg: rgba(56, 142, 91, 0.12);
  --component-settings-user-uid-text: #388e5b;
  --component-settings-icon-hover-text: #b82b4e;
  --component-settings-sync-status-text: #b82b4e;
  --component-settings-toggle-checked-bg: #e05275;
  --component-settings-toggle-focus-ring: rgba(224, 82, 117, 0.2);
  --component-settings-checkbox-checked-border: #e05275;
  --component-settings-checkbox-checked-fill: #e05275;
  --component-settings-primary-badge-bg: #e05275;
  --component-settings-primary-badge-text: #ffffff;
  --component-settings-server-id-bg: rgba(56, 142, 91, 0.12);
  --component-settings-server-id-text: #388e5b;

  /* Message view */
  --component-message-accent-text: #b82b4e;
  --component-message-hover-text: #b82b4e;
  --component-message-hover-bg: #fff5f7;
  --component-message-spinner-top: #e05275;
  --component-message-item-hover-border: #f29cb0;
  --component-message-item-active-border: #e05275;
  --component-message-item-active-bg: #fff0f3;
  --component-message-load-more-hover-border: #e05275;
  --component-message-load-more-hover-text: #b82b4e;
  --component-message-primary-button-bg: #e05275;
  --component-message-primary-button-border: #e05275;
  --component-message-primary-button-hover-bg: #c43b5c;
  --component-message-primary-button-hover-border: #c43b5c;
  --component-message-secondary-button-hover-border: #e05275;
  --component-message-secondary-button-hover-text: #b82b4e;
  --component-message-text-button-hover-text: #b82b4e;
  --component-message-text-button-hover-bg: #fff5f7;
  --component-message-form-focus-border: #e05275;
  --component-message-success-bg: rgba(56, 142, 91, 0.08);
  --component-message-success-text: #388e5b;

  /* APRS remote control */
  --component-remote-connected-bg: #388e5b;
  --component-remote-connected-shadow: #388e5b;
  --component-remote-connecting-bg: #e05275;
  --component-remote-add-button-text: #b82b4e;
  --component-remote-add-button-border: #e05275;
  --component-remote-add-button-hover-bg: #e05275;
  --component-remote-icon-hover-text: #b82b4e;
  --component-remote-select-focus-border: #e05275;
  --component-remote-checkbox-accent: #e05275;
  --component-remote-password-hover-text: #b82b4e;
  --component-remote-input-focus-border: #e05275;
  --component-remote-control-hover-border: #f29cb0;
  --component-remote-control-hover-text: #b82b4e;
  --component-remote-primary-button-bg: #e05275;
  --component-remote-primary-button-hover-bg: #c43b5c;

  /* Location report */
  --component-location-refresh-text: #b82b4e;
  --component-location-refresh-border: #e05275;
  --component-location-refresh-hover-bg: #e05275;
  --component-location-toggle-checked-bg: #388e5b;
  --component-location-slider-thumb: #e05275;
  --component-location-slider-value: #b82b4e;
  --component-location-primary-button-bg: #e05275;
  --component-location-primary-button-hover-bg: #c43b5c;
  --component-location-status-success-text: #388e5b;

  /* Filter panel and search controls */
  --component-filter-panel-bg: #fff8f0;
  --component-filter-panel-border: #efe1d2;
  --component-filter-control-bg: #fffdf8;
  --component-filter-control-border: #e4cfba;
  --component-filter-control-hover-border: #8b5a2b;
  --component-filter-chip-bg: #fffaf3;
  --component-filter-chip-text: #715643;
  --component-filter-chip-hover-bg: #f3e4d4;
  --component-filter-chip-hover-text: #8b5a2b;
  --component-filter-chip-active-bg: #8b5a2b;
  --component-filter-chip-active-text: #ffffff;

  /* Date picker */
  --component-date-picker-clear-hover-text: #d95353;
  --component-date-picker-nav-hover-bg: #fff5f7;
  --component-date-picker-nav-hover-border: #f29cb0;
  --component-date-picker-stats-text: #b82b4e;
  --component-date-picker-day-hover-bg: #fff5f7;
  --component-date-picker-day-has-data-hover-bg: rgba(56, 142, 91, 0.08);
  --component-date-picker-day-selected-bg: #b82b4e;
  --component-date-picker-day-selected-border: #e05275;
  --component-date-picker-badge-bg: #b82b4e;
  --component-date-picker-badge-text: #ffffff;

  /* Optional: if you want selected badges/cards to be tuned separately */
  --component-status-success-bg-soft: rgba(61, 139, 90, 0.08);
  --component-status-success-bg-active: rgba(61, 139, 90, 0.15);
  --component-status-success-text: #3d8b5a;
}

@media (prefers-color-scheme: dark) {
  :root {
    /* Page and surface colors */
    --theme-surface-page: #1a1512;
    --theme-surface-container: #221c18;
    --theme-surface-header: #2a211c;
    --theme-surface-card: #2a211c;
    --theme-surface-input: #342923;
    --theme-surface-hover: #3a2c23;

    /* Text colors */
    --theme-text-primary: #f2e6da;
    --theme-text-secondary: #ceb7a2;
    --theme-text-muted: #a88e77;

    /* Border colors */
    --theme-border-default: #4d3b2f;
    --theme-border-subtle: #3c2f27;

    /* Brand and status colors */
    --theme-accent-primary: #f29a57;
    --theme-accent-primary-hover: #ffb27a;
    --theme-success: #61c487;
    --theme-success-accent: #61c487;
    --theme-warning: #f0b04d;
    --theme-danger: #ef7e7e;

    /* Current/selected/today highlight colors */
    --theme-current-highlight-bg: #2f251f;
    --theme-current-highlight-bg-alt: #281f1a;
    --theme-current-highlight-bg-strong: #3a2c23;
    --theme-current-highlight-border-soft: #5a4536;
    --theme-current-highlight-border: #6b4e37;
    --theme-current-highlight-accent: #f0b27b;
    --theme-current-highlight-muted: #9f846c;

    /* Speaking bar */
    --component-speaking-bar-bg: #2f251f;
    --component-speaking-bar-border: #6b4e37;
    --component-speaking-bar-text-accent: #f0b27b;
    --component-speaking-bar-hover-bg: #3a2c23;

    /* Header and navigation */
    --component-header-title-hover: #ff8fa9;
    --component-header-station-text: #ff8fa9;
    --component-header-station-hover-border: #803f4d;
    --component-header-nav-hover-text: #ff8fa9;
    --component-header-nav-active-text: #ff8fa9;
    --component-header-nav-active-indicator: #ff8fa9;
    --component-header-action-hover-text: #ff8fa9;
    --component-mobile-nav-active-text: #ff8fa9;

    /* More page and page navigation */
    --component-more-icon-bg: rgba(255, 107, 144, 0.18);
    --component-more-icon-text: #ff8fa9;
    --component-more-item-hover-border: #803f4d;
    --component-more-item-hover-bg: #241417;
    --component-more-arrow-hover-text: #ff8fa9;

    --component-page-nav-button-hover-border: #803f4d;
    --component-page-nav-button-hover-text: #ff8fa9;
    --component-page-nav-button-hover-bg: #241417;
    --component-page-nav-input-focus-border: #ff8fa9;

    --component-quick-nav-item-hover-border: #803f4d;
    --component-quick-nav-item-active-bg: rgba(255, 107, 144, 0.16);
    --component-quick-nav-item-active-text: #ff8fa9;
    --component-quick-nav-item-active-border: #ff6b90;
    --component-quick-nav-item-active-icon: #ff8fa9;

    /* Station list and station control */
    --component-station-name-hover-text: #ff8fa9;
    --component-station-primary-badge-bg: rgba(255, 107, 144, 0.18);
    --component-station-primary-badge-text: #ff8fa9;
    --component-station-search-focus-border: #ff6b90;
    --component-station-refresh-hover-text: #ff8fa9;
    --component-station-item-hover-border: #803f4d;
    --component-station-item-active-bg: #ff6b90;
    --component-station-item-active-border: #ff6b90;
    --component-station-item-active-text: #121212;
    --component-station-item-active-pin-bg: rgba(18, 18, 18, 0.26);
    --component-station-item-active-pin-text: #121212;

    /* Settings */
    --component-settings-slider-thumb: #ff6b90;
    --component-settings-info-text: #52c480;
    --component-settings-focus-border: #ff6b90;
    --component-settings-add-button-text: #ff8fa9;
    --component-settings-add-button-border: #ff6b90;
    --component-settings-add-button-hover-bg: #ff6b90;
    --component-settings-address-hover-border: #803f4d;
    --component-settings-address-hover-bg: #241417;
    --component-settings-address-active-border: #ff6b90;
    --component-settings-address-active-bg: rgba(255, 107, 144, 0.14);
    --component-settings-status-active-bg: #52c480;
    --component-settings-status-active-shadow: #52c480;
    --component-settings-status-connecting-bg: #ff6b90;
    --component-settings-user-callsign-bg: rgba(255, 107, 144, 0.18);
    --component-settings-user-callsign-text: #ff8fa9;
    --component-settings-user-uid-bg: rgba(82, 196, 128, 0.16);
    --component-settings-user-uid-text: #52c480;
    --component-settings-icon-hover-text: #ff8fa9;
    --component-settings-sync-status-text: #ff8fa9;
    --component-settings-toggle-checked-bg: #ff6b90;
    --component-settings-toggle-focus-ring: rgba(255, 107, 144, 0.24);
    --component-settings-checkbox-checked-border: #ff6b90;
    --component-settings-checkbox-checked-fill: #ff6b90;
    --component-settings-primary-badge-bg: #ff6b90;
    --component-settings-primary-badge-text: #121212;
    --component-settings-server-id-bg: rgba(82, 196, 128, 0.16);
    --component-settings-server-id-text: #52c480;

    /* Message view */
    --component-message-accent-text: #ff8fa9;
    --component-message-hover-text: #ff8fa9;
    --component-message-hover-bg: #241417;
    --component-message-spinner-top: #ff6b90;
    --component-message-item-hover-border: #803f4d;
    --component-message-item-active-border: #ff6b90;
    --component-message-item-active-bg: #2d191d;
    --component-message-load-more-hover-border: #ff6b90;
    --component-message-load-more-hover-text: #ff8fa9;
    --component-message-primary-button-bg: #ff6b90;
    --component-message-primary-button-border: #ff6b90;
    --component-message-primary-button-hover-bg: #ff94af;
    --component-message-primary-button-hover-border: #ff94af;
    --component-message-secondary-button-hover-border: #ff6b90;
    --component-message-secondary-button-hover-text: #ff8fa9;
    --component-message-text-button-hover-text: #ff8fa9;
    --component-message-text-button-hover-bg: #241417;
    --component-message-form-focus-border: #ff6b90;
    --component-message-success-bg: rgba(82, 196, 128, 0.12);
    --component-message-success-text: #52c480;

    /* APRS remote control */
    --component-remote-connected-bg: #52c480;
    --component-remote-connected-shadow: #52c480;
    --component-remote-connecting-bg: #ff6b90;
    --component-remote-add-button-text: #ff8fa9;
    --component-remote-add-button-border: #ff6b90;
    --component-remote-add-button-hover-bg: #ff6b90;
    --component-remote-icon-hover-text: #ff8fa9;
    --component-remote-select-focus-border: #ff6b90;
    --component-remote-checkbox-accent: #ff6b90;
    --component-remote-password-hover-text: #ff8fa9;
    --component-remote-input-focus-border: #ff6b90;
    --component-remote-control-hover-border: #803f4d;
    --component-remote-control-hover-text: #ff8fa9;
    --component-remote-primary-button-bg: #ff6b90;
    --component-remote-primary-button-hover-bg: #ff94af;

    /* Location report */
    --component-location-refresh-text: #ff8fa9;
    --component-location-refresh-border: #ff6b90;
    --component-location-refresh-hover-bg: #ff6b90;
    --component-location-toggle-checked-bg: #52c480;
    --component-location-slider-thumb: #ff6b90;
    --component-location-slider-value: #ff8fa9;
    --component-location-primary-button-bg: #ff6b90;
    --component-location-primary-button-hover-bg: #ff94af;
    --component-location-status-success-text: #52c480;

    /* Filter panel and search controls */
    --component-filter-panel-bg: #241c18;
    --component-filter-panel-border: #3c2f27;
    --component-filter-control-bg: #342923;
    --component-filter-control-border: #4d3b2f;
    --component-filter-control-hover-border: #f0b27b;
    --component-filter-chip-bg: #2a211c;
    --component-filter-chip-hover-bg: #3a2c23;
    --component-filter-chip-text: #ceb7a2;
    --component-filter-chip-hover-text: #f0b27b;
    --component-filter-chip-active-bg: #f0b27b;
    --component-filter-chip-active-text: #1a1512;

    /* Date picker */
    --component-date-picker-clear-hover-text: #ff6b6b;
    --component-date-picker-nav-hover-bg: #241417;
    --component-date-picker-nav-hover-border: #803f4d;
    --component-date-picker-stats-text: #ff8fa9;
    --component-date-picker-day-hover-bg: #241417;
    --component-date-picker-day-has-data-hover-bg: rgba(82, 196, 128, 0.12);
    --component-date-picker-day-selected-bg: #ff8fa9;
    --component-date-picker-day-selected-border: #ff6b90;
    --component-date-picker-badge-bg: #ff8fa9;
    --component-date-picker-badge-text: #121212;

    /* Optional selected badge/card tuning */
    --component-status-success-bg-soft: rgba(97, 196, 135, 0.12);
    --component-status-success-bg-active: rgba(97, 196, 135, 0.22);
    --component-status-success-text: #61c487;
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
