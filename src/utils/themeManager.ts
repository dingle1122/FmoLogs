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
   使用建议：
   1. 最省事的方式：先改“快速套色”这几项，大多数界面会自动跟着变化。
   2. 再改 --theme-* 这一层，它决定整套主题的整体气质。
      例如页面背景、文字颜色、边框颜色、主色、成功色、危险色。
   3. 如果你只想微调某个区域，再修改 --component-* 这一层。
      例如顶部导航、筛选区、信道列表、主题页、远控页。
   4. 不建议直接修改组件 class 选择器。
      优先改变量，后续升级版本时更稳定，也更容易继续沿用你的主题。

   推荐上手顺序：
   1. 先改“快速套色”
   2. 再改页面底色、文字色
   3. 最后按需要微调某个具体模块
*/

:root {
  /* 快速套色
     如果你不想一个个填颜色，先改这一组。
     大多数按钮、当前选中、hover、高亮卡片都会自动跟着变化。 */
  --theme-quick-primary: #c46a2d;
  --theme-quick-primary-hover: #a55520;
  --theme-quick-success: #3d8b5a;
  --theme-quick-warning: #b57918;
  --theme-quick-danger: #c55353;
  --theme-quick-highlight-accent: #8b5a2b;
  --theme-quick-highlight-bg: #f3e4d4;
  --theme-quick-highlight-bg-alt: #faf1e7;
  --theme-quick-highlight-bg-strong: #ead4bd;
  --theme-quick-highlight-border: #d6b796;
  --theme-quick-highlight-border-soft: #e6ceb4;
  --theme-quick-highlight-muted: #b59c88;
  --theme-quick-surface-hover: #f7ead8;
  --theme-quick-surface-accent-soft: #f8ebe2;

  /* 页面和容器底色
     这组变量决定整个应用“底子”的感觉。
     如果你想做浅色、米色、粉色、深色主题，通常先从这里开始改。 */
  --theme-surface-page: #f6efe6;
  --theme-surface-container: #fffaf3;
  --theme-surface-header: #fff7ee;
  --theme-surface-card: #fffdf8;
  --theme-surface-input: #fffaf4;
  --theme-surface-hover: #f7ead8;

  /* 文字颜色
     primary: 主要文字
     secondary: 次要说明
     muted: 更弱的辅助信息 */
  --theme-text-primary: #34261b;
  --theme-text-secondary: #715643;
  --theme-text-muted: #9c7f69;

  /* 边框颜色
     default: 输入框、按钮等常规边框
     subtle: 卡片、容器等更轻的分隔线 */
  --theme-border-default: #e4cfba;
  --theme-border-subtle: #efe1d2;

  /* 全局主色和状态色
     accent-primary: 主操作按钮、可点击强调项
     success: 成功、已连接、正常状态
     warning: 提醒
     danger: 删除、失败、危险操作 */
  --theme-accent-primary: #c46a2d;
  --theme-accent-primary-hover: #a55520;
  --theme-success: #3d8b5a;
  --theme-success-accent: #3d8b5a;
  --theme-warning: #b57918;
  --theme-danger: #c55353;

  /* 当前项 / 选中态 / 今日通联 高亮色
     这是最推荐优先改的一组。
     如果你发现“今日已通联”、“当前页面”、“当前信道”、“选中日期”
     这些地方颜色不符合你的主题，优先改这里。 */
  --theme-current-highlight-bg: #f3e4d4;
  --theme-current-highlight-bg-alt: #faf1e7;
  --theme-current-highlight-bg-strong: #ead4bd;
  --theme-current-highlight-border-soft: #e6ceb4;
  --theme-current-highlight-border: #d6b796;
  --theme-current-highlight-accent: #8b5a2b;
  --theme-current-highlight-muted: #b59c88;

  /* 发言条
     影响正在发言的提示条，以及相关 hover 状态。 */
  --component-speaking-bar-bg: #efe3d0;
  --component-speaking-bar-border: #d6b796;
  --component-speaking-bar-text-accent: #8b5a2b;
  --component-speaking-bar-hover-bg: #f3e4d4;

  /* 顶部标题和页面导航
     影响顶部标题 hover、当前信道标签、顶部导航、底部导航。 */
  --component-header-title-hover: #b82b4e;
  --component-header-station-bg: #f3e4d4;
  --component-header-station-text: #b82b4e;
  --component-header-station-hover-bg: #ead4bd;
  --component-header-station-hover-border: #f29cb0;
  --component-header-nav-hover-text: #b82b4e;
  --component-header-nav-active-text: #b82b4e;
  --component-header-nav-active-indicator: #b82b4e;
  --component-header-action-hover-text: #b82b4e;
  --component-mobile-nav-active-text: #b82b4e;

  /* 通联日志表格表头
     影响通联日志页面表头的背景色、文字色、上边框。 */
  --component-logs-table-header-bg: #f7efe7;
  --component-logs-table-header-text: #7a5633;
  --component-logs-table-header-border: #d6b796;

  /* 通联日志序号列
     影响序号列的默认底色、今日高亮、以及前三名的底色。 */
  --component-logs-index-bg: #f8f1e8;
  --component-logs-index-today-bg: #ead4bd;
  --component-logs-index-today-neutral-bg: #f3e4d4;
  --component-logs-index-rank-1-bg: #fff4d9;
  --component-logs-index-rank-2-bg: #eef2f7;
  --component-logs-index-rank-3-bg: #f3e1d4;

  /* 通联记录弹框卡片
     如果你想单独调整通联记录弹框里的卡片背景、说明文字、选中描边，改这里。 */
  --component-record-card-bg: #fffdf8;
  --component-record-card-border: #efe1d2;
  --component-record-card-label-text: #9c7f69;
  --component-record-card-value-text: #34261b;
  --component-record-card-address-text: #9c7f69;
  --component-record-card-count-text: #9c7f69;
  --component-record-card-today-bg: #f3e4d4;
  --component-record-card-today-border: #d6b796;
  --component-record-card-highlight-outline: #c46a2d;

  /* 发言历史弹框
     未通联星标默认保持项目原始中性灰，不跟随高亮主色自动变化。 */
  --component-speaking-history-uncontacted-text: #dddddd;

  /* “更多”页面、分页按钮、快捷页面导航
     如果你希望“更多”页的图标底色、箭头、分页按钮、
     快捷导航弹窗高亮更符合主题，可以改这里。 */
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

  /* 信道列表和信道控制
     影响信道名称 hover、主信道标签、搜索框 focus、
     列表项 hover、当前选中的信道卡片。 */
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

  /* 设置页
     影响滑块、地址卡片、状态点、用户标签、复选框、多选模式等。 */
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

  /* 消息页
     影响消息卡片 hover/选中、发件人强调、加载更多、按钮、表单 focus。 */
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

  /* 远程控制
     影响连接状态点、添加服务器按钮、输入框 focus、控制按钮、主按钮。 */
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

  /* 自动定位
     影响刷新按钮、开关、间隔滑块、立即上报按钮、成功状态文字。 */
  --component-location-refresh-text: #b82b4e;
  --component-location-refresh-border: #e05275;
  --component-location-refresh-hover-bg: #e05275;
  --component-location-toggle-checked-bg: #388e5b;
  --component-location-slider-thumb: #e05275;
  --component-location-slider-value: #b82b4e;
  --component-location-primary-button-bg: #e05275;
  --component-location-primary-button-hover-bg: #c43b5c;
  --component-location-status-success-text: #388e5b;

  /* 筛选区和搜索框
     影响筛选面板、输入框、筛选按钮、快速筛选按钮。 */
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

  /* 日期选择器
     影响日期弹层、翻月按钮、统计数字、日期 hover、选中日期、小徽章。 */
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

  /* 老朋友未通联卡片
     影响“老朋友”里今天还没有通联过的卡片背景和边框。 */
  --component-old-friend-card-bg: #fff6ed;
  --component-old-friend-card-border: #f2d5b1;

  /* 可选：成功态面板和徽标
     如果你不想动全局 success，只想单独调成功提示、成功背景层级，可以改这里。 */
  --component-status-success-bg-soft: rgba(61, 139, 90, 0.08);
  --component-status-success-bg-active: rgba(61, 139, 90, 0.15);
  --component-status-success-text: #3d8b5a;
}

  @media (prefers-color-scheme: dark) {
  :root {
    /* 深色模式
       如果你希望浅色和深色使用不同配色，就改这里。
       不需要单独适配深色的话，也可以整段删掉。 */

    /* Quick tuning */
    --theme-quick-primary: #f29a57;
    --theme-quick-primary-hover: #ffb27a;
    --theme-quick-success: #61c487;
    --theme-quick-warning: #f0b04d;
    --theme-quick-danger: #ef7e7e;
    --theme-quick-highlight-accent: #f0b27b;
    --theme-quick-highlight-bg: #2f251f;
    --theme-quick-highlight-bg-alt: #281f1a;
    --theme-quick-highlight-bg-strong: #3a2c23;
    --theme-quick-highlight-border: #6b4e37;
    --theme-quick-highlight-border-soft: #5a4536;
    --theme-quick-highlight-muted: #9f846c;
    --theme-quick-surface-hover: #3a2c23;
    --theme-quick-surface-accent-soft: #31201f;

    /* 页面和容器底色 */
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
    --component-header-station-bg: #2f251f;
    --component-header-station-text: #ff8fa9;
    --component-header-station-hover-bg: #3a2c23;
    --component-header-station-hover-border: #803f4d;
    --component-header-nav-hover-text: #ff8fa9;
    --component-header-nav-active-text: #ff8fa9;
    --component-header-nav-active-indicator: #ff8fa9;
    --component-header-action-hover-text: #ff8fa9;
    --component-mobile-nav-active-text: #ff8fa9;

    /* Logs table header */
    --component-logs-table-header-bg: #241417;
    --component-logs-table-header-text: #d8b4bf;
    --component-logs-table-header-border: #5a4536;

    /* Logs index column */
    --component-logs-index-bg: #221a16;
    --component-logs-index-today-bg: #3a2c23;
    --component-logs-index-today-neutral-bg: #2f251f;
    --component-logs-index-rank-1-bg: #3a2f16;
    --component-logs-index-rank-2-bg: #252932;
    --component-logs-index-rank-3-bg: #36261f;

    /* Callsign record cards */
    --component-record-card-bg: #2a211c;
    --component-record-card-border: #3c2f27;
    --component-record-card-label-text: #a88e77;
    --component-record-card-value-text: #f2e6da;
    --component-record-card-address-text: #a88e77;
    --component-record-card-count-text: #a88e77;
    --component-record-card-today-bg: #2f251f;
    --component-record-card-today-border: #6b4e37;
    --component-record-card-highlight-outline: #f29a57;

    /* Speaking history */
    --component-speaking-history-uncontacted-text: #5a4536;

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

    /* 老朋友未通联卡片 */
    --component-old-friend-card-bg: #2d2621;
    --component-old-friend-card-border: #5a4a3e;

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
