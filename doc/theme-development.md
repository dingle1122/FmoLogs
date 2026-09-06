# FmoLogs 主题开发指南

本指南面向第三方主题作者，只需 FmoLogs 应用和文本编辑器，无需获取项目源码、安装 Node.js 或编译应用。示例以默认主题为基础；本文提供完整入门示例、默认变量参考、仪表盘选择器和发布步骤，可以离线阅读和使用。

默认值参考对应 FmoLogs 1.2.21（2026-09-06）。应用升级可能增加变量或调整页面结构；分发主题时请注明实际测试的应用版本。颜色变量适合日常定制，页面 class 属于更易变化的高级接口。

## 1. 从示例开始

1. 在「主题设置」点击「查看示例」，在展开内容中复制或下载示例，保存为 UTF-8 的 `默认主题示例.css`；也可以直接使用下面的完整代码。开发文档在同一区域下载。
2. 修改需要的颜色，上传文件。导入成功会立即启用；上传多个文件时，最后成功导入的主题生效。
3. 用相同名称重新导入会覆盖该主题的 CSS 并启用，保留主题 ID 和创建时间；不同名称会新建主题。
4. 切换系统浅色、深色，检查实际页面。需要撤回时点击「恢复默认」。

页面中的展示、复制和下载提供同一份示例。直接导入保持默认外观；只覆盖需要修改的变量，其余样式由应用补齐。不必复制整份默认变量表，否则容易固定默认值并阻止后续版本的样式改进。

### 可直接保存和上传的完整起步示例

把以下代码保存为 `我的主题.css`，编码选 UTF-8，文件类型选“所有文件”，避免实际保存成 `.css.txt`。代码不需要 `<style>` 标签，也不需要另行下载样式依赖。所有引用的变量都由应用提供。

```css
:root {
  --brand-primary: #4caf50;
  --brand-primary-hover: #3d8b40;
  --brand-primary-soft: #81c784;
  --brand-primary-strong: #2e7d32;

  /* 默认高亮与组件映射。保留 var() 可继续跟随应用的模式切换。 */
  --theme-current-highlight-accent: var(--theme-success-accent);
  --component-record-card-bg: var(--theme-surface-subtle);
  --component-record-card-border: var(--theme-border-subtle);
}

/* 卡片背景的默认浅色/深色配对；需要时同时修改两处。 */
:root {
  --theme-surface-card: #ffffff;
}
@media (prefers-color-scheme: dark) {
  :root {
    --theme-surface-card: #2c2c2c;
  }
}
```

这些数值与默认主题相同，上传后没有明显变化是正常的。先修改一个主色数值并用相同文件名重新上传，即可验证修改生效。品牌色不控制所有状态；导航高亮、发言提示和仪表盘卡片的独立入口见后文。

### 按目标选择入口

| 想修改的内容 | 从哪里开始 |
| --- | --- |
| 按钮主色 | `--brand-primary`，同时检查 hover、soft、strong 三个值 |
| 导航选中、今日记录 | `--theme-current-highlight-accent` 及其背景、边框变量 |
| 页面、文字和普通卡片 | 第 3 节的浅色/深色默认值表 |
| 发言条、呼号记录、表头 | 附录中 `--component-*` 完整映射 |
| 仪表盘卡片、顶部渐变 | 第 5 节的局部变量和选择器 |
| 某个变量的默认值或 var() 来源 | 文末完整变量参考，搜索完整名称 |

## 2. 主题如何生效

应用先提供默认样式，再把所选主题作为内联 CSS 加载。只需提供希望覆盖的部分。一次只能启用一个自定义主题，主题之间不会叠加；恢复默认或删除当前主题会移除自定义样式。

导入后的 CSS 保存在本机，启动后自动恢复所选主题。修改原文件不会立即改变应用，必须重新上传；更新远程链接内容也需要重新导入。主题列表改名只修改显示名称，不会修改 CSS 内的注释。

主题中的 `:root` 表示应用文档的根元素，`--名字: 值` 声明颜色变量，`var(--名字)` 引用应用提供的变量。无需自己定义本文列出的每个变量。

## 3. 变量分层与选择方法

| 层级 | 示例 | 使用建议 |
| --- | --- | --- |
| 基础色板 | `--brand-primary`、`--surface-green-050`、`--alpha-primary-10`、`--dark-900` | 全套配色时使用；基础色名不代表只有对应颜色的组件会使用它 |
| 快捷入口 | `--theme-quick-primary`、`--theme-quick-highlight-accent` | 通过 `var()` 回退链参与语义变量计算 |
| 全局语义 | `--theme-surface-card`、`--theme-text-primary`、`--theme-border-default` | 按背景、文字、边框用途调整 |
| 组件变量 | `--component-record-card-bg`、`--component-speaking-bar-border` | 只调整实际引用它的组件或区域 |
| 兼容别名 | `--bg-card`、`--color-primary`、`--border-light` | 现有组件仍在使用；优先修改它指向的语义变量 |
| 页面局部 | `--dashboard-card-bg-soft` | 在对应页面元素上声明，不是根级主题入口 |

常用映射：

| 页面用途 | 建议入口 |
| --- | --- |
| 页面、容器、页头、卡片、输入框背景 | `--theme-surface-page` / `-container` / `-header` / `-card` / `-input` |
| 条纹、悬停、弱背景 | `--theme-surface-striped` / `-hover` / `-subtle` |
| 主文字、次文字、辅助文字、禁用文字 | `--theme-text-primary` / `-secondary` / `-muted` / `-disabled` |
| 默认、次级、浅、强边框 | `--theme-border-default` / `-subtle` / `-muted` / `-strong` |
| 按钮主色 | `--theme-accent-primary`，默认取 `--theme-quick-primary` 或 `--brand-primary` |
| 导航和今日记录高亮 | `--theme-current-highlight-accent`、`-bg`、`-bg-alt`、`-bg-strong`、`-border`、`-border-soft`、`-muted` |
| 发言条 | `--component-speaking-bar-bg`、`-border`、`-text-accent`、`-hover-bg` |
| 呼号记录卡片 | `--component-record-card-bg`、`-border`、`-today-bg`、`-today-border` |
| 日志表头 | `--component-logs-table-header-bg`、`-text`、`-border` |

表中的省略后缀需接在同一完整前缀后，例如 `--theme-text-secondary`。文末完整参考给出了每个变量的全名、默认表达式以及混色和深色覆盖，不需要查阅源码。表达式中引用的底层变量也包含在参考表中。

### 主色与高亮不是同一个入口

以下是常用颜色的最终默认值，可直接用于浅色/深色配对，不用手动展开引用链：

| 完整变量名 | 浅色 | 深色 |
| --- | --- | --- |
| `--theme-surface-page` | `#ffffff` | `#1a1a1a` |
| `--theme-surface-container` | `#ffffff` | `#242424` |
| `--theme-surface-header` | `#ffffff` | `#2c2c2c` |
| `--theme-surface-card` | `#ffffff` | `#2c2c2c` |
| `--theme-surface-input` | `#ffffff` | `#3a3a3a` |
| `--theme-surface-subtle` | `#f5f7fa` | `#363636` |
| `--theme-surface-striped` | `#f8f9fb` | `#2a2a2a` |
| `--theme-text-primary` | `#333333` | `#e8e8e8` |
| `--theme-text-secondary` | `#606266` | `#b8b8b8` |
| `--theme-text-muted` | `#909399` | `#909399` |
| `--theme-text-disabled` | `#c0c4cc` | `#666666` |
| `--theme-border-default` | `#dcdfe6` | `#404040` |
| `--theme-border-subtle` | `#ebeef5` | `#363636` |
| `--theme-border-muted` | `#eeeeee` | `#333333` |
| `--theme-border-strong` | `#dddddd` | `#404040` |
| `--theme-accent-primary` | `#4caf50` | `#4caf50` |
| `--theme-accent-primary-hover` | `#3d8b40` | `#81c784` |

默认主色和高亮的关系如下：

`--theme-accent-primary` 默认来自品牌主色，而 `--theme-current-highlight-accent` 默认来自成功强调色。只改 `--brand-primary`，导航或今日记录可能仍保持原来的绿色。成功、警告、危险色也各有自己的入口。

部分背景和阴影直接引用 `--alpha-primary-*`，不会由主色自动推导。如果想统一这部分配色，应配套修改半透明色，或覆盖相应的 `--component-status-primary-*` 变量。不要把成功、警告和危险状态全部改成相同颜色。

## 4. 深色模式和自动混色

当前应用用 `@media (prefers-color-scheme: dark)` 跟随系统，没有供主题使用的 `.dark` 或 `[data-theme="dark"]` 开关。

基础 CSS 的顺序是根变量、`@supports (color: color-mix(...))`、深色媒体查询。支持混色时，强调背景和当前高亮的一部分颜色会自动计算；不支持时使用色板回退值。深色规则又显式覆盖若干语义变量。

因此，快捷变量并非在所有状态都生效。例如默认深色的 `--theme-accent-primary-hover` 直接引用 `--theme-accent-primary-soft`，高亮背景也重新引用深色成功面板变量。若要精确控制两种模式，可参考第 1 节完整示例中的卡片背景段，直接声明对应语义变量，并在主题自己的深色媒体查询中配对。

不要只在主题 `:root` 中覆盖浅色的 `--theme-surface-card`，却不提供深色值：自定义主题同优先级的后置声明会覆盖应用的深色默认值。未修改的变量则可以继续沿用应用默认值。

需要 `color-mix()` 时先提供兼容的颜色回退，再在 `@supports` 中增强。单纯把不支持的函数存入自定义变量，不等于给最终背景提供了可靠回退。示例的仪表盘注释段展示了当前默认实现：先引用半透明色回退，再按支持情况使用混色。

## 5. 仪表盘专用覆盖

### 卡片为什么仍然是灰色

仪表盘在 `.dashboard-view` 元素上声明了卡片背景，支持混色时又用文字颜色与透明色混合生成灰色背景。因此只修改全局 `--theme-surface-card` 不能让所有仪表盘卡片跟随主题。

| 局部变量 | 当前作用 |
| --- | --- |
| `--dashboard-card-bg-soft` | 台站信息、事件、今日通联、发言历史等卡片背景 |
| `--dashboard-card-bg-subtle` | 空状态背景 |
| `--dashboard-card-bg-hover` | 事件、通联、历史卡片的普通悬停背景 |
| `--dashboard-action-bg` | 部分操作按钮背景 |
| `--dashboard-self-speaking-bg` | 自己发言时顶部卡片的渐变端点 |
| `--dashboard-speaking-shadow` | 发言状态相关阴影色 |

在 `.dashboard-view.dashboard-view` 上覆盖这些变量。重复 class 用于匹配应用组件样式中 class 加属性选择器的优先级；仅用 `.dashboard-view` 可能无法覆盖。在 `:root` 上声明同名变量也不能压过页面自身的声明。

以下代码可直接追加到主题文件，数值和计算方式保持默认。定制时应同时考虑不支持混色时的回退规则和支持混色时的增强规则。

```css
.dashboard-view.dashboard-view {
  --dashboard-card-bg-soft: var(--alpha-neutral-12);
  --dashboard-card-bg-subtle: var(--alpha-neutral-12);
  --dashboard-card-bg-hover: var(--alpha-black-10);
  --dashboard-action-bg: var(--bg-card);
  --dashboard-self-speaking-bg: var(--alpha-success-08);
  --dashboard-speaking-shadow: var(--alpha-success-25);
}
@supports (color: color-mix(in srgb, red 50%, transparent)) {
  .dashboard-view.dashboard-view {
    --dashboard-card-bg-soft: color-mix(in srgb, var(--text-primary) 5%, transparent);
    --dashboard-card-bg-subtle: color-mix(in srgb, var(--text-primary) 3%, transparent);
    --dashboard-card-bg-hover: color-mix(in srgb, var(--text-primary) 7%, transparent);
    --dashboard-action-bg: color-mix(in srgb, var(--bg-card) 88%, transparent);
    --dashboard-self-speaking-bg: color-mix(in srgb, var(--color-speaking) 10%, transparent);
    --dashboard-speaking-shadow: color-mix(in srgb, var(--color-speaking) 32%, transparent);
  }
}
```

| 完整选择器 | 目标与状态 |
| --- | --- |
| `.dashboard-view .station-info-card` | 台站信息卡片 |
| `.dashboard-view .event-chip` | 事件卡片 |
| `.dashboard-view .contact-row` | 今日通联卡片 |
| `.dashboard-view .history-row` | 发言历史卡片 |
| `.dashboard-view .history-row.active` | 正在发言的历史卡片，默认使用成功色背景和左侧状态条 |
| `.dashboard-view .empty-state` | 无数据占位卡片 |
| `.dashboard-view .dashboard-hero` | 顶部卡片的基础样式；状态规则见下文 |

默认列表卡片结构不同：`.station-info-card` 使用 `--border-light` 边框，`.event-chip` 没有常规边框，`.history-row` 有表示发言状态的左边框，而 `.contact-row` 将左边框移除了。示例保持这些默认行为。二次开发时应先确认目标元素是否存在边框，避免增加边框后改变尺寸，或覆盖历史卡片的发言状态条。

### 顶部卡片的三种渐变

以下是当前顶部卡片的背景规则，可作为自定义渐变的起点：

```css
/* 无人发言：轻柔待机渐变。 */
.dashboard-view .dashboard-hero {
  background: linear-gradient(135deg, var(--bg-card), var(--bg-table-stripe));
}

/* 收到发言：发言色向普通卡片色过渡。 */
.dashboard-view .dashboard-hero.active {
  background: linear-gradient(135deg, var(--bg-speaking-bar), var(--bg-card));
}

/* 自己发言且没有 active：从右侧向普通卡片色过渡。 */
.dashboard-view .dashboard-hero.self-speaking:not(.active) {
  background: linear-gradient(270deg, var(--dashboard-self-speaking-bg), var(--bg-card));
}
```

不要把三个选择器合并成 `background: 某个颜色`，这会清除渐变图层。待机不宜使用和发言同样强烈的颜色。历史卡片的 `.history-row.active` 还有独立背景和悬停规则，应保留其状态辨识度。

### 选择器的维护边界

优先用语义或组件变量。需要页面选择器时，加 `.dashboard-view` 等页面前缀，避免影响其他页面。不要复制构建生成的 `data-v-*` 属性，也不要全局写 `.active`、`.card` 或 `button` 来改变某个局部区域。检查开发者工具中的计算样式和匹配规则后再决定优先级，不必默认使用 `!important`。

CSS 自定义变量中的 `var()` 引用在声明所在元素计算。只在某个子元素改底层变量，不一定会重新计算从根元素继承的别名；页面级覆盖时应修改该页面实际消费的变量，或在同一元素重新声明映射。

## 6. 导入、分发和预览的实际行为

### 颜色变量以外的样式

文末 591 项是全局颜色与效果变量参考，并不代表应用的全部 CSS 属性。字体、字号、行高、圆角、间距、边框宽度和动画主要写在具体元素规则中，目前没有统一的 `--theme-font-size` 或 `--theme-radius` 入口。自行声明这些不存在的名称不会产生效果。

| 类型 | 默认行为与定制方式 |
| --- | --- |
| 字体 | 根元素使用 `'MixedFont', 'SourceHanSansSC', system-ui, sans-serif`；MixedFont 为数字和英文字母使用 Intel One Mono，SourceHanSansSC 这个内部名称实际加载的是 MiSans 字体文件。可通过 `:root { font-family: ...; }` 修改继承字体，但有些元素单独声明字体，需要局部覆盖 |
| 字号与行高 | 根行高为 `1.5`、字重为 `400`；具体呼号、标题、时间等另有字号和字重，不存在一个同时控制全部文本的主题变量 |
| 卡片圆角 | 仪表盘顶部卡片默认 `10px`，台站信息、事件、通联、历史小卡片默认 `6px`，空状态卡片默认 `8px`；需用对应页面选择器修改 |
| 阴影 | 有的变量只提供颜色，如 `--theme-shadow-focus-primary`；有的提供整条阴影，如 `--component-modal-shadow`。颜色应放入 `box-shadow` 的颜色位置，完整值可直接用于 `box-shadow`，不能混用 |
| 图标与图片 | 通用 SVG 图标使用 `currentColor`，通常随所在元素的文字颜色变化；作为图片加载的星标、标志等资源不会自动随主色重新着色 |
| 透明度与边框 | 元素可能另有 `opacity`、透明背景或透明边框；最终颜色不只取决于变量值。调整颜色前要检查是否存在这类叠加规则 |
| 悬停、焦点与状态 | `:hover`、`:focus-visible`、`:disabled`、`.active` 等规则可能重新覆盖基础样式；需要分别检查，悬停还可能仅在支持鼠标悬停的设备启用 |
| 滚动条 | 默认公共样式隐藏滚动条；滚动能力仍由容器的 overflow 等属性控制，并无专用滚动条主题颜色入口 |

下面演示默认圆角的写法，追加到主题不会改变这些卡片的默认圆角；需要时再改数值：

```css
.dashboard-view .dashboard-hero { border-radius: 10px; }
.dashboard-view .station-info-card,
.dashboard-view .event-chip,
.dashboard-view .contact-row,
.dashboard-view .history-row { border-radius: 6px; }
.dashboard-view .empty-state { border-radius: 8px; }
```

修改尺寸、字体或间距后，需要重新检查小屏换行和按钮触摸区域；颜色主题可以完全不修改这些属性。

日期筛选入口默认与呼号查询框一样，鼠标悬停时不改变背景和边框。它的普通背景与边框仍使用 `--component-filter-control-bg` 和 `--component-filter-control-border`；筛选标签的悬停变量不再影响日期入口。日历内部的日期格、月份切换和清除按钮仍保留各自的悬停效果。

若主题确实需要日期入口悬停变色，可以主动添加下方规则；这属于可选定制，不是默认主题样式：

```css
@media (hover: hover) {
  .query-section .date-picker-trigger:hover {
    background: var(--theme-current-highlight-bg);
    border-color: var(--theme-current-highlight-border);
  }
}
```

### 运行时变量：用于布局和数据，不是配色入口

下面这些变量不在颜色附录中，但同样存在于实际界面。应用会根据窗口尺寸、安全区、文字宽度或操作进度写入它们；主题通常应保留这些计算结果。

| 完整变量名 | 位置 / 用途 | 默认或赋值方式 |
| --- | --- | --- |
| `--app-height` | 应用和页面可用高度 | CSS 回退 `100vh`，运行时更新为像素高度 |
| `--app-width` | 应用视口宽度记录 | CSS 回退 `100vw`，运行时更新为像素宽度 |
| `--vh` | 弹窗等按视口比例计算高度 | CSS 回退 `1vh`，运行时更新为视口高度的 1% |
| `--safe-inset-top` | 页顶、提示消息避让状态栏 | 回退 `0px`，支持时取系统安全区或原生测量值 |
| `--safe-inset-right` | 内容右侧安全区 | 回退 `0px`，支持时取系统安全区或原生测量值 |
| `--safe-inset-bottom` | 底部导航等避让手势区域 | 回退 `0px`，支持时取系统安全区或原生测量值 |
| `--safe-inset-left` | 内容左侧安全区 | 回退 `0px`，支持时取系统安全区或原生测量值 |
| `--marquee-duration` | 滚动文字的动画周期 | 组件根据内容与速度计算，单位为秒 |
| `--marquee-distance` | 滚动文字移动距离 | 组件测量计算，单位为像素 |
| `--marquee-gap` | 滚动文字原文与副本之间的间距 | 组件传入的像素值 |
| `--backup-progress` | 设置页备份按钮的进度填充宽度 | 组件实时写入百分比，消费处回退 `0%`；它不控制进度颜色 |

固定覆盖安全区可能让按钮被系统栏挡住，覆盖备份进度则可能使显示与实际进度不符。这些变量列出是为了说明边界，不应作为普通颜色主题的必填项目。

### 文件与链接导入

- 文件上传要求 `.css` 后缀；文件名去掉后缀，连字符和下划线转为空格后作为默认名称。可在主题列表重命名。
- 链接支持 HTTP/HTTPS，通过 `fetch(..., { cache: 'no-store' })` 获取文本。链接可以不以 `.css` 结尾，名称可手动填写。
- 跨域服务器需要允许应用来源读取响应；HTTPS 页面还可能阻止 HTTP 混合内容。链接能在浏览器直接打开，不代表应用能跨域获取。
- 导入保存的是 CSS 文本快照，不会订阅 URL 或自动跟随 CDN 更新。发布新版本后，用户需用相同主题名称重新导入。
- 主题只做名称非空、内容非空和长度检查；会去掉开头 BOM 并 trim。当前上限检查是 JavaScript 字符串长度 `200 * 1024`，提示称为 200KB，并非严格按 UTF-8 字节数测量。
- 应用不进行完整 CSS 语法校验或隔离；请分发可信、经过验证的样式。文件不应包含 HTML、`<style>` 标签或 JavaScript。
- 注入的是内联样式，资源相对路径按应用文档 URL 解析，不是按导入 CSS 的原始 URL。图片、字体需要使用可访问的绝对地址；独立主题尽量减少外部依赖。
- 列表缩略图使用 iframe 中的简化结构和基础变量，只能查看大致配色，没有真实仪表盘、业务数据或 scoped 页面样式。必须进入实际页面检查局部覆盖。

## 7. 验证与排查

发布前建议完成以下检查：

1. 浅色和深色下检查文字、输入框、按钮、边框、弹窗和禁用状态。
2. 仪表盘分别检查无人发言、收到发言、自己发言，以及空列表和有数据的卡片。
3. 桌面检查悬停和键盘焦点；手机检查窄屏、触摸交互及长呼号、长地址换行。
4. 查看日志页今日高亮、呼号记录卡片、导航选中状态是否仍容易识别。
5. 测试同名更新、切换主题、重启恢复、恢复默认、删除当前主题。
6. 若使用新 CSS 特性，在目标 Android WebView 上验证回退；不要只看桌面预览。

| 现象 | 优先检查 |
| --- | --- |
| 主色变了，导航没变 | 当前高亮入口是否也修改 |
| 仪表盘仍是灰色 | 局部变量的声明位置与 scoped 优先级 |
| 夜间仍是浅色背景 | 自定义主题是否遗漏深色配对值 |
| 顶部渐变消失 | 是否被后面的 `background` 简写覆盖 |
| 更新 CDN 后没有变化 | 是否以同名重新导入文本快照 |
| 缩略图正常，真实页面不对 | 是否仅覆盖预览使用的全局变量 |

无需构建项目即可验证主题：在应用中上传，依次检查以上页面和状态。若使用浏览器开发者工具，可在“元素 → 计算样式”中搜索变量名或 `background`，确认哪个规则生效；临时修改只用于调试，最终需要写回 CSS 文件并重新导入。

## 8. 第三方发布与维护

发布包建议包含 `主题名称.css` 和一份使用说明，注明主题版本、测试过的 FmoLogs 版本、浅色/深色支持情况、导入方法以及有无外部字体或图片。用户只需要上传 CSS 文件；Markdown 文档不应作为主题导入。

首次分发可直接发送 CSS 文件。使用链接分发时，让 URL 返回 CSS 正文而非下载介绍页或登录页，并设置合适的跨域响应头；静态公开资源可使用 `Access-Control-Allow-Origin: *`。在真实应用中试一次链接导入，再交付给用户。

更新时保留主题名称，提醒用户同名重新导入。主题不能添加业务功能；自行声明一个应用未使用的变量不会产生效果。如果没有合适的入口，可用页面范围内的 CSS 选择器调整，并记录其适用版本，或向维护者请求增加变量。

本指南可随主题包一起分发，后面的默认参考也包含在应用下载的同一份文档中。


## 附录：完整默认变量参考

此表为上述适用版本的默认值快照，共 591 个已声明的全局变量。每行的“对应位置 / 用途”说明它影响的区域、状态和颜色属性。通用变量可能被多个页面共用，组件变量也可能经兼容别名被引用。表格用于查阅，不建议整表复制到主题中。

读取顺序：先使用“基础声明”；浏览器支持 `color-mix()` 时应用“混色覆盖”；系统深色模式再应用“深色覆盖”。“沿用”表示本阶段没有重新声明，之前的表达式继续有效，但它引用的其他变量仍可能随模式改变。主题中的后置自定义声明会参与正常 CSS 优先级竞争。

`var(--a, b)` 表示优先使用 `--a`，未定义时取 `b`。下表使用完整名称，所有基础色值和兼容别名均已包含。例：默认浅色 `--bg-card` → `--theme-surface-card` → `--color-white` → `#ffffff`；深色则通过 `--dark-680` 得到 `#2c2c2c`。

### 快捷入口（默认不声明）

这些可选入口被 `var()` 引用，未设置时使用表中的回退值。它们不是额外必须填写的变量；其影响以实际引用链为准，深色覆盖可能绕过某些快捷入口。

- `--theme-quick-surface-hover`：列表、控件悬停时的通用背景的快捷入口。
- `--theme-quick-surface-accent-soft`：主色浅背景，供按钮悬停和选中区域使用的快捷入口。
- `--theme-quick-surface-success-soft`：成功提示的浅背景的快捷入口。
- `--theme-quick-surface-warning-soft`：警告提示的浅背景的快捷入口。
- `--theme-quick-surface-danger-soft`：错误提示的浅背景的快捷入口。
- `--theme-quick-primary`：按钮、链接、输入焦点等主要交互强调色的快捷入口。
- `--theme-quick-primary-hover`：主要交互元素悬停时的强调色的快捷入口。
- `--theme-quick-success`：成功、在线和发言的基础语义色的快捷入口。
- `--theme-quick-warning`：警告和排名金色的基础语义色的快捷入口。
- `--theme-quick-danger`：错误、危险操作的基础语义色的快捷入口。
- `--theme-quick-highlight-accent`：导航选中、今日记录等当前高亮的强调文字与指示色的快捷入口。
- `--theme-quick-highlight-bg`：今日卡片、台站选中项等高亮背景的快捷入口。
- `--theme-quick-highlight-bg-alt`：今日表格行等较轻的高亮背景的快捷入口。
- `--theme-quick-highlight-bg-strong`：今日序号、选中标签等较强的高亮背景的快捷入口。
- `--theme-quick-highlight-border-soft`：今日记录行等较轻的高亮边框的快捷入口。
- `--theme-quick-highlight-border`：今日记录行等较轻的高亮边框的快捷入口。
- `--theme-quick-highlight-muted`：当前高亮区域的弱化文字色的快捷入口。

### 全局背景、文字与边框

| 完整变量名 | 对应位置 / 用途 | 基础声明 | 混色覆盖 | 深色覆盖 |
| --- | --- | --- | --- | --- |
| `--theme-surface-page` | 整个页面最底层背景 | `var(--color-white)` | 沿用 | `var(--dark-900)` |
| `--theme-surface-container` | 内容容器背景 | `var(--color-white)` | 沿用 | `var(--dark-750)` |
| `--theme-surface-header` | 页头背景 | `var(--color-white)` | 沿用 | `var(--dark-680)` |
| `--theme-surface-card` | 普通卡片背景；仪表盘小卡片另有局部变量 | `var(--color-white)` | 沿用 | `var(--dark-680)` |
| `--theme-surface-input` | 输入框、选择框背景 | `var(--color-white)` | 沿用 | `var(--dark-600)` |
| `--theme-surface-subtle` | 次级内容区、日志表头和普通记录卡片的默认背景 | `var(--neutral-040)` | 沿用 | `var(--dark-640)` |
| `--theme-surface-hover` | 列表、控件悬停时的通用背景 | `var( --theme-quick-surface-hover, var(--neutral-040) )` | 沿用 | `var(--dark-700)` |
| `--theme-surface-striped` | 表格交替行背景，也参与顶部卡片的待机渐变 | `var(--neutral-030)` | 沿用 | `var(--dark-700)` |
| `--theme-surface-disabled` | 禁用控件背景 | `var(--neutral-050)` | 沿用 | `var(--dark-500)` |
| `--theme-surface-accent-soft` | 主色浅背景，供按钮悬停和选中区域使用 | `var(--theme-quick-surface-accent-soft, var(--surface-green-050))` | `var( --theme-quick-surface-accent-soft, color-mix(in srgb, var(--theme-accent-primary) 12%, var(--theme-surface-container)) )` | `var(--dark-830)` |
| `--theme-surface-success-soft` | 成功提示的浅背景 | `var(--theme-quick-surface-success-soft, var(--surface-green-100))` | `var( --theme-quick-surface-success-soft, color-mix(in srgb, var(--theme-success) 12%, var(--theme-surface-container)) )` | `var(--dark-800)` |
| `--theme-surface-warning-soft` | 警告提示的浅背景 | `var(--theme-quick-surface-warning-soft, var(--surface-orange-050))` | `var( --theme-quick-surface-warning-soft, color-mix(in srgb, var(--theme-warning) 12%, var(--theme-surface-container)) )` | `var(--dark-610)` |
| `--theme-surface-danger-soft` | 错误提示的浅背景 | `var(--theme-quick-surface-danger-soft, var(--surface-red-050))` | `var( --theme-quick-surface-danger-soft, color-mix(in srgb, var(--theme-danger) 12%, var(--theme-surface-container)) )` | `var(--dark-620)` |
| `--theme-surface-hint-soft` | HTTPS 等提示区域的浅背景 | `var(--surface-orange-050)` | 沿用 | `var(--dark-610)` |
| `--theme-text-primary` | 正文、标题、呼号等主要文字 | `var(--neutral-900)` | 沿用 | `var(--dark-text-primary)` |
| `--theme-text-secondary` | 标签、次要内容文字 | `var(--neutral-700)` | 沿用 | `var(--neutral-300)` |
| `--theme-text-muted` | 时间、地址、说明等辅助文字 | `var(--neutral-500)` | 沿用 | `var(--neutral-500)` |
| `--theme-text-disabled` | 不可操作或禁用内容的文字 | `var(--neutral-250)` | 沿用 | `var(--neutral-600)` |
| `--theme-text-inverse` | 主色按钮、徽标等有色背景上的反色文字 | `var(--color-white)` | 沿用 | 沿用 |
| `--theme-border-default` | 输入控件和普通区域的默认边框 | `var(--neutral-200)` | 沿用 | `var(--dark-500)` |
| `--theme-border-subtle` | 卡片、面板之间较轻的边框 | `var(--neutral-100)` | 沿用 | `var(--dark-640)` |
| `--theme-border-muted` | 页头分隔线、台站信息卡等浅边框 | `var(--neutral-075)` | 沿用 | `var(--neutral-900)` |
| `--theme-border-strong` | 表格等需要明显分隔的边框 | `var(--neutral-175)` | 沿用 | `var(--dark-500)` |
| `--theme-text-shadow-subtle` | 正文微弱文字阴影的完整值，包含尺寸和颜色 | `0 0 0.3px var(--alpha-black-30)` | 沿用 | 沿用 |

### 全局强调、状态及其他语义

| 完整变量名 | 对应位置 / 用途 | 基础声明 | 混色覆盖 | 深色覆盖 |
| --- | --- | --- | --- | --- |
| `--theme-accent-primary` | 按钮、链接、输入焦点等主要交互强调色 | `var(--theme-quick-primary, var(--brand-primary))` | 沿用 | 沿用 |
| `--theme-accent-primary-hover` | 主要交互元素悬停时的强调色 | `var(--theme-quick-primary-hover, var(--brand-primary-hover))` | 沿用 | `var(--theme-accent-primary-soft)` |
| `--theme-accent-primary-soft` | 柔和主色，也作为默认深色模式的主色悬停色 | `var(--brand-primary-soft)` | 沿用 | 沿用 |
| `--theme-accent-primary-strong` | 深主色，供强调控制按钮等使用 | `var(--brand-primary-strong)` | 沿用 | 沿用 |
| `--theme-accent-secondary` | 第二强调色，例如计数徽标 | `var(--brand-indigo)` | 沿用 | 沿用 |
| `--theme-success` | 成功、在线和发言的基础语义色 | `var(--theme-quick-success, var(--brand-success))` | 沿用 | 沿用 |
| `--theme-success-strong` | 成功、在线和发言的强强调色 | `var(--brand-success-strong)` | 沿用 | 沿用 |
| `--theme-success-emerald` | 成功、在线和发言的翠绿强调色 | `var(--brand-success-emerald)` | 沿用 | 沿用 |
| `--theme-success-soft` | 成功、在线和发言的柔和强调色 | `var(--brand-success-soft)` | 沿用 | 沿用 |
| `--theme-success-accent` | 成功、在线和发言的强调色（默认当前高亮来源） | `var(--theme-quick-success, var(--brand-success-accent))` | 沿用 | 沿用 |
| `--theme-warning` | 警告和排名金色的基础语义色 | `var(--theme-quick-warning, var(--brand-warning))` | 沿用 | 沿用 |
| `--theme-warning-soft` | 警告和排名金色的柔和强调色 | `var(--brand-warning-soft)` | 沿用 | 沿用 |
| `--theme-warning-gold` | 警告和排名金色的金色强调色 | `var(--brand-warning-gold)` | 沿用 | 沿用 |
| `--theme-warning-deep` | 警告和排名金色的深强调色 | `var(--brand-warning-deep)` | 沿用 | 沿用 |
| `--theme-warning-muted` | 警告和排名金色的弱化色 | `var(--brand-warning-muted)` | 沿用 | 沿用 |
| `--theme-warning-bright` | 警告和排名金色的亮强调色 | `var(--brand-warning-bright)` | 沿用 | 沿用 |
| `--theme-bronze` | 排行榜铜牌的基础语义色 | `var(--brand-bronze)` | 沿用 | 沿用 |
| `--theme-bronze-muted` | 排行榜铜牌的弱化色 | `var(--brand-bronze-muted)` | 沿用 | 沿用 |
| `--theme-danger` | 错误、危险操作的基础语义色 | `var(--theme-quick-danger, var(--brand-danger))` | 沿用 | 沿用 |
| `--theme-danger-hover` | 错误、危险操作的悬停色 | `var(--brand-danger-hover)` | 沿用 | `var(--theme-danger-soft)` |
| `--theme-danger-strong` | 错误、危险操作的强强调色 | `var(--brand-danger-strong)` | 沿用 | 沿用 |
| `--theme-danger-soft` | 错误、危险操作的柔和强调色 | `var(--brand-danger-soft)` | 沿用 | 沿用 |
| `--theme-danger-close` | 错误、危险操作的关闭操作色 | `var(--brand-danger-close)` | 沿用 | 沿用 |
| `--theme-info-panel-bg` | 信息提示区域：背景颜色 | `var(--surface-blue-150)` | 沿用 | 沿用 |
| `--theme-info-panel-bg-strong` | 信息提示区域：较强背景 | `var(--surface-blue-100)` | 沿用 | 沿用 |
| `--theme-info-panel-border` | 信息提示区域：边框颜色 | `var(--border-blue-100)` | 沿用 | 沿用 |
| `--theme-info-panel-border-soft` | 信息提示区域：较轻边框 | `var(--border-blue-050)` | 沿用 | 沿用 |
| `--theme-success-panel-bg` | 成功/发言提示区域：背景颜色 | `var(--surface-green-100)` | 沿用 | `var(--dark-800)` |
| `--theme-success-panel-bg-alt` | 成功/发言提示区域：备用浅背景 | `var(--surface-green-110)` | 沿用 | `var(--dark-850)` |
| `--theme-success-panel-bg-strong` | 成功/发言提示区域：较强背景 | `var(--surface-green-120)` | 沿用 | `var(--dark-820)` |
| `--theme-success-panel-border` | 成功/发言提示区域：边框颜色 | `var(--border-green-100)` | 沿用 | `var(--dark-660)` |
| `--theme-success-panel-border-soft` | 成功/发言提示区域：较轻边框 | `var(--border-green-200)` | 沿用 | `var(--dark-740)` |
| `--theme-success-panel-border-strong` | 成功/发言提示区域：较强边框 | `var(--border-green-300)` | 沿用 | `var(--dark-660)` |
| `--theme-success-panel-border-bright` | 成功/发言提示区域：醒目边框 | `var(--border-green-400)` | 沿用 | `var(--dark-660)` |
| `--theme-current-highlight-accent` | 导航选中、今日记录等当前高亮的强调文字与指示色 | `var( --theme-quick-highlight-accent, var(--theme-success-accent) )` | 沿用 | 沿用 |
| `--theme-current-highlight-bg` | 今日卡片、台站选中项等高亮背景 | `var( --theme-quick-highlight-bg, var(--surface-green-050) )` | `var( --theme-quick-highlight-bg, color-mix(in srgb, var(--theme-current-highlight-accent) 12%, var(--theme-surface-card)) )` | `var(--theme-success-panel-bg)` |
| `--theme-current-highlight-bg-alt` | 今日表格行等较轻的高亮背景 | `var( --theme-quick-highlight-bg-alt, var(--surface-green-110) )` | `var( --theme-quick-highlight-bg-alt, color-mix(in srgb, var(--theme-current-highlight-accent) 7%, var(--theme-surface-container)) )` | `var(--theme-success-panel-bg-alt)` |
| `--theme-current-highlight-bg-strong` | 今日序号、选中标签等较强的高亮背景 | `var( --theme-quick-highlight-bg-strong, var(--surface-green-120) )` | `var( --theme-quick-highlight-bg-strong, color-mix(in srgb, var(--theme-current-highlight-accent) 18%, var(--theme-surface-card)) )` | `var(--theme-success-panel-bg-strong)` |
| `--theme-current-highlight-border-soft` | 今日记录行等较轻的高亮边框 | `var( --theme-quick-highlight-border-soft, var(--border-green-100) )` | `var( --theme-quick-highlight-border-soft, color-mix(in srgb, var(--theme-current-highlight-accent) 18%, var(--theme-border-subtle)) )` | `var(--theme-success-panel-border-soft)` |
| `--theme-current-highlight-border` | 当前高亮卡片、导航等的边框 | `var( --theme-quick-highlight-border, var(--border-green-200) )` | `var( --theme-quick-highlight-border, color-mix(in srgb, var(--theme-current-highlight-accent) 30%, var(--theme-border-default)) )` | `var(--theme-success-panel-border-strong)` |
| `--theme-current-highlight-muted` | 当前高亮区域的弱化文字色 | `var( --theme-quick-highlight-muted, var(--theme-current-highlight-accent) )` | `var( --theme-quick-highlight-muted, color-mix(in srgb, var(--theme-current-highlight-accent) 45%, var(--theme-text-muted)) )` | 沿用 |
| `--theme-warning-panel-bg` | 警告/老朋友提示区域：背景颜色 | `var(--surface-orange-100)` | 沿用 | `var(--dark-610)` |
| `--theme-warning-panel-border` | 警告/老朋友提示区域：边框颜色 | `var(--border-orange-100)` | 沿用 | `var(--dark-660)` |
| `--theme-warning-panel-border-strong` | 警告/老朋友提示区域：较强边框 | `var(--border-orange-200)` | 沿用 | `var(--dark-660)` |
| `--theme-danger-panel-bg` | 错误提示区域：背景颜色 | `var(--surface-red-050)` | 沿用 | 沿用 |
| `--theme-danger-panel-border` | 错误提示区域：边框颜色 | `var(--border-red-100)` | 沿用 | 沿用 |
| `--theme-rank-gold-bg` | 排行榜：金牌颜色 · 背景颜色 | `var(--surface-yellow-050)` | 沿用 | `var(--dark-540)` |
| `--theme-rank-gold-badge-bg` | 排行榜：金牌颜色 · 徽标 · 背景颜色 | `var(--surface-yellow-100)` | 沿用 | 沿用 |
| `--theme-rank-silver-bg` | 排行榜：银牌颜色 · 背景颜色 | `var(--surface-slate-050)` | 沿用 | `var(--dark-580)` |
| `--theme-rank-bronze-bg` | 排行榜：铜牌颜色 · 背景颜色 | `var(--surface-tan-050)` | 沿用 | `var(--dark-560)` |
| `--theme-shadow-card` | 普通卡片阴影的颜色，不含偏移和模糊尺寸 | `var(--alpha-black-10)` | 沿用 | `var(--alpha-black-30)` |
| `--theme-shadow-modal` | 弹窗阴影的颜色，不含偏移和模糊尺寸 | `var(--alpha-black-15)` | 沿用 | `var(--alpha-black-50)` |
| `--theme-shadow-focus-primary` | 主色焦点光晕的颜色 | `var(--alpha-primary-20)` | 沿用 | 沿用 |
| `--theme-shadow-focus-primary-hover` | 主色悬停光晕的颜色 | `var(--alpha-primary-30)` | 沿用 | 沿用 |
| `--theme-overlay-default` | 弹窗背后的遮罩颜色 | `var(--alpha-black-50)` | 沿用 | `var(--alpha-black-70)` |
| `--theme-overlay-soft` | 较轻的弹窗背景遮罩 | `var(--alpha-black-40)` | 沿用 | 沿用 |
| `--theme-tooltip-bg` | 悬浮提示框背景 | `var(--neutral-900)` | 沿用 | `var(--neutral-800)` |
| `--theme-texture-edge-fade` | 装饰纹理边缘的淡出颜色 | `var(--alpha-black-25)` | 沿用 | `var(--alpha-white-15)` |
| `--theme-texture-stripe` | 装饰条纹颜色 | `var(--alpha-black-06)` | 沿用 | `var(--alpha-white-06)` |
| `--theme-texture-mask-solid` | 纹理遮罩实心部分的颜色 | `var(--color-black)` | 沿用 | 沿用 |
| `--theme-app-edge-shadow` | 应用边缘阴影颜色 | `var(--alpha-black-10)` | 沿用 | `var(--alpha-white-15)` |
| `--theme-tap-highlight` | 触摸点击时浏览器高亮颜色 | `var(--color-transparent)` | 沿用 | 沿用 |
| `--theme-glass-highlight` | 玻璃效果的浅色高光 | `var(--alpha-white-30)` | 沿用 | 沿用 |
| `--theme-glass-highlight-strong` | 玻璃效果的较强高光 | `var(--alpha-white-35)` | 沿用 | 沿用 |

### 组件变量

| 完整变量名 | 对应位置 / 用途 | 基础声明 | 混色覆盖 | 深色覆盖 |
| --- | --- | --- | --- | --- |
| `--component-close-button-border` | 弹窗关闭按钮：边框颜色 | `var(--alpha-danger-close-55)` | 沿用 | 沿用 |
| `--component-close-button-text` | 弹窗关闭按钮：文字颜色 | `var(--alpha-danger-close-70)` | 沿用 | 沿用 |
| `--component-close-button-hover-bg` | 弹窗关闭按钮：悬停时 · 背景颜色 | `var(--alpha-danger-close-12)` | 沿用 | 沿用 |
| `--component-close-button-hover-border` | 弹窗关闭按钮：悬停时 · 边框颜色 | `var(--alpha-danger-close-80)` | 沿用 | 沿用 |
| `--component-close-button-hover-text` | 弹窗关闭按钮：悬停时 · 文字颜色 | `var(--alpha-danger-close-90)` | 沿用 | 沿用 |
| `--component-status-primary-bg` | 通用主色状态提示：背景颜色 | `var(--alpha-primary-10)` | 沿用 | 沿用 |
| `--component-status-primary-bg-soft` | 通用主色状态提示：浅背景 | `var(--alpha-primary-08)` | 沿用 | 沿用 |
| `--component-status-primary-bg-strong` | 通用主色状态提示：较强背景 | `var(--alpha-primary-12)` | 沿用 | 沿用 |
| `--component-status-primary-bg-active` | 通用主色状态提示：激活背景 | `var(--alpha-primary-15)` | 沿用 | 沿用 |
| `--component-status-primary-border` | 通用主色状态提示：边框颜色 | `var(--alpha-primary-30)` | 沿用 | 沿用 |
| `--component-status-primary-shadow` | 通用主色状态提示：阴影颜色 | `var(--alpha-primary-20)` | 沿用 | 沿用 |
| `--component-status-primary-text` | 通用主色状态提示：文字颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-status-success-bg` | 通用成功/在线状态提示：背景颜色 | `var(--alpha-success-15)` | 沿用 | 沿用 |
| `--component-status-success-bg-soft` | 通用成功/在线状态提示：浅背景 | `var(--alpha-success-08)` | 沿用 | 沿用 |
| `--component-status-success-bg-strong` | 通用成功/在线状态提示：较强背景 | `var(--alpha-success-12)` | 沿用 | 沿用 |
| `--component-status-success-bg-active` | 通用成功/在线状态提示：激活背景 | `var(--alpha-success-25)` | 沿用 | 沿用 |
| `--component-status-success-border` | 通用成功/在线状态提示：边框颜色 | `var(--theme-success-panel-border)` | 沿用 | 沿用 |
| `--component-status-success-text` | 通用成功/在线状态提示：文字颜色 | `var(--theme-success)` | 沿用 | 沿用 |
| `--component-status-success-ring` | 通用成功/在线状态提示：外圈光晕颜色 | `var(--alpha-success-15)` | 沿用 | 沿用 |
| `--component-status-warning-bg` | 通用警告状态提示：背景颜色 | `var(--alpha-warning-gold-10)` | 沿用 | 沿用 |
| `--component-status-warning-bg-soft` | 通用警告状态提示：浅背景 | `var(--alpha-warning-08)` | 沿用 | 沿用 |
| `--component-status-warning-bg-active` | 通用警告状态提示：激活背景 | `var(--alpha-warning-22)` | 沿用 | 沿用 |
| `--component-status-warning-border` | 通用警告状态提示：边框颜色 | `var(--alpha-warning-gold-30)` | 沿用 | 沿用 |
| `--component-status-warning-border-strong` | 通用警告状态提示：较强边框 | `var(--alpha-warning-25)` | 沿用 | 沿用 |
| `--component-status-warning-text` | 通用警告状态提示：文字颜色 | `var(--theme-warning-gold)` | 沿用 | 沿用 |
| `--component-status-warning-text-deep` | 通用警告状态提示：深色文字 | `var(--theme-warning-deep)` | 沿用 | 沿用 |
| `--component-status-warning-text-muted` | 通用警告状态提示：弱化文字 | `var(--theme-warning-muted)` | 沿用 | 沿用 |
| `--component-status-danger-bg` | 通用错误/危险状态提示：背景颜色 | `var(--alpha-danger-strong-10)` | 沿用 | 沿用 |
| `--component-status-danger-bg-soft` | 通用错误/危险状态提示：浅背景 | `var(--alpha-danger-08)` | 沿用 | 沿用 |
| `--component-status-danger-border` | 通用错误/危险状态提示：边框颜色 | `var(--alpha-danger-strong-30)` | 沿用 | 沿用 |
| `--component-status-danger-border-strong` | 通用错误/危险状态提示：较强边框 | `var(--alpha-danger-20)` | 沿用 | 沿用 |
| `--component-status-danger-ring` | 通用错误/危险状态提示：外圈光晕颜色 | `var(--alpha-danger-strong-20)` | 沿用 | 沿用 |
| `--component-status-danger-text` | 通用错误/危险状态提示：文字颜色 | `var(--theme-danger-strong)` | 沿用 | 沿用 |
| `--component-status-neutral-bg` | 通用中性状态提示：背景颜色 | `var(--alpha-neutral-12)` | 沿用 | 沿用 |
| `--component-status-neutral-border` | 通用中性状态提示：边框颜色 | `var(--alpha-neutral-30)` | 沿用 | 沿用 |
| `--component-status-neutral-text` | 通用中性状态提示：文字颜色 | `var(--theme-text-secondary)` | 沿用 | 沿用 |
| `--component-speaking-bar-bg` | 正在发言提示条：背景颜色 | `var(--theme-success-panel-bg)` | 沿用 | `var(--theme-success-panel-bg)` |
| `--component-speaking-bar-border` | 正在发言提示条：边框颜色 | `var(--theme-success-panel-border-bright)` | 沿用 | `var(--theme-success-panel-border-bright)` |
| `--component-speaking-bar-text-accent` | 正在发言提示条：强调文字 | `var(--theme-success-strong)` | 沿用 | `var(--theme-success-soft)` |
| `--component-speaking-bar-hover-bg` | 正在发言提示条：悬停时 · 背景颜色 | `var(--theme-current-highlight-bg)` | 沿用 | `var(--theme-current-highlight-bg)` |
| `--component-header-title-hover` | 页头标题：悬停时 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-header-station-bg` | 页头台站入口：背景颜色 | `var(--theme-current-highlight-bg)` | 沿用 | 沿用 |
| `--component-header-station-text` | 页头台站入口：文字颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-header-station-hover-bg` | 页头台站入口：悬停时 · 背景颜色 | `var(--theme-current-highlight-bg-strong)` | 沿用 | 沿用 |
| `--component-header-station-hover-border` | 页头台站入口：悬停时 · 边框颜色 | `var(--theme-current-highlight-border)` | 沿用 | 沿用 |
| `--component-header-nav-hover-text` | 页头导航：悬停时 · 文字颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-header-nav-active-text` | 页头导航：选中/激活时 · 文字颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-header-nav-active-indicator` | 页头导航：选中/激活时 · 指示条颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-header-action-hover-text` | 页头操作按钮：悬停时 · 文字颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-mobile-nav-active-text` | 手机底部导航：选中/激活时 · 文字颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-logs-table-header-bg` | 日志表格表头：背景颜色 | `var(--theme-surface-subtle)` | 沿用 | 沿用 |
| `--component-logs-table-header-text` | 日志表格表头：文字颜色 | `var(--theme-text-secondary)` | 沿用 | 沿用 |
| `--component-logs-table-header-border` | 日志表格表头：边框颜色 | `var(--theme-border-default)` | 沿用 | 沿用 |
| `--component-logs-index-bg` | 日志表格序号区域：背景颜色 | `var(--theme-surface-striped)` | 沿用 | 沿用 |
| `--component-logs-index-today-bg` | 日志表格序号区域：今日状态 · 背景颜色 | `var(--theme-current-highlight-bg-strong)` | 沿用 | 沿用 |
| `--component-logs-index-today-neutral-bg` | 日志表格序号区域：今日中性状态 · 背景颜色 | `var(--theme-current-highlight-bg)` | 沿用 | 沿用 |
| `--component-logs-index-rank-1-bg` | 日志表格序号区域：第一名 · 背景颜色 | `var(--theme-rank-gold-bg)` | 沿用 | 沿用 |
| `--component-logs-index-rank-2-bg` | 日志表格序号区域：第二名 · 背景颜色 | `var(--theme-rank-silver-bg)` | 沿用 | 沿用 |
| `--component-logs-index-rank-3-bg` | 日志表格序号区域：第三名 · 背景颜色 | `var(--theme-rank-bronze-bg)` | 沿用 | 沿用 |
| `--component-record-card-bg` | 呼号记录弹窗内的记录卡片：背景颜色 | `var(--theme-surface-subtle)` | 沿用 | 沿用 |
| `--component-record-card-border` | 呼号记录弹窗内的记录卡片：边框颜色 | `var(--theme-border-subtle)` | 沿用 | 沿用 |
| `--component-record-card-label-text` | 呼号记录弹窗内的记录卡片：标签 · 文字颜色 | `var(--theme-text-muted)` | 沿用 | 沿用 |
| `--component-record-card-value-text` | 呼号记录弹窗内的记录卡片：数值 · 文字颜色 | `var(--theme-text-primary)` | 沿用 | 沿用 |
| `--component-record-card-address-text` | 呼号记录弹窗内的记录卡片：地址 · 文字颜色 | `var(--theme-text-muted)` | 沿用 | 沿用 |
| `--component-record-card-count-text` | 呼号记录弹窗内的记录卡片：计数 · 文字颜色 | `var(--theme-text-muted)` | 沿用 | 沿用 |
| `--component-record-card-today-bg` | 呼号记录弹窗内的记录卡片：今日状态 · 背景颜色 | `var(--theme-current-highlight-bg)` | 沿用 | 沿用 |
| `--component-record-card-today-border` | 呼号记录弹窗内的记录卡片：今日状态 · 边框颜色 | `var(--theme-current-highlight-border)` | 沿用 | 沿用 |
| `--component-record-card-highlight-outline` | 呼号记录弹窗内的记录卡片：高亮状态 · 外轮廓颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-speaking-history-uncontacted-text` | 发言历史：未通联呼号 · 文字颜色 | `var(--neutral-175)` | 沿用 | 沿用 |
| `--component-more-icon-bg` | 更多页面：图标 · 背景颜色 | `var(--status-success-bg-strong)` | 沿用 | 沿用 |
| `--component-more-icon-text` | 更多页面：图标 · 文字颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-more-item-hover-border` | 更多页面：列表项 · 悬停时 · 边框颜色 | `var(--theme-current-highlight-border)` | 沿用 | 沿用 |
| `--component-more-item-hover-bg` | 更多页面：列表项 · 悬停时 · 背景颜色 | `var(--bg-table-hover)` | 沿用 | 沿用 |
| `--component-more-arrow-hover-text` | 更多页面：箭头 · 悬停时 · 文字颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-page-nav-button-hover-border` | 分页控件：按钮 · 悬停时 · 边框颜色 | `var(--theme-current-highlight-border)` | 沿用 | 沿用 |
| `--component-page-nav-button-hover-bg` | 分页控件：按钮 · 悬停时 · 背景颜色 | `var(--bg-table-hover)` | 沿用 | 沿用 |
| `--component-page-nav-input-focus-border` | 分页控件：输入框 · 获得焦点时 · 边框颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-button-hover-bg` | 通用按钮：悬停时 · 背景颜色 | `var(--theme-surface-accent-soft)` | 沿用 | 沿用 |
| `--component-button-hover-border` | 通用按钮：悬停时 · 边框颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-button-hover-text` | 通用按钮：悬停时 · 文字颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-quick-nav-item-hover-border` | 快捷导航弹窗：列表项 · 悬停时 · 边框颜色 | `var(--theme-current-highlight-border)` | 沿用 | 沿用 |
| `--component-quick-nav-item-active-bg` | 快捷导航弹窗：列表项 · 选中/激活时 · 背景颜色 | `var(--status-success-bg-soft)` | 沿用 | 沿用 |
| `--component-quick-nav-item-active-text` | 快捷导航弹窗：列表项 · 选中/激活时 · 文字颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-quick-nav-item-active-border` | 快捷导航弹窗：列表项 · 选中/激活时 · 边框颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-quick-nav-item-active-icon` | 快捷导航弹窗：列表项 · 选中/激活时 · 图标 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-station-name-hover-text` | 台站列表弹窗：台站名称 · 悬停时 · 文字颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-station-primary-badge-bg` | 台站列表弹窗：主台站标记 · 背景颜色 | `var(--status-success-bg-active)` | 沿用 | 沿用 |
| `--component-station-primary-badge-text` | 台站列表弹窗：主台站标记 · 文字颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-station-search-focus-border` | 台站列表弹窗：搜索框 · 获得焦点时 · 边框颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-station-refresh-hover-text` | 台站列表弹窗：刷新按钮 · 悬停时 · 文字颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-station-item-hover-border` | 台站列表弹窗：列表项 · 悬停时 · 边框颜色 | `var(--theme-current-highlight-border)` | 沿用 | 沿用 |
| `--component-station-item-active-bg` | 台站列表弹窗：列表项 · 选中/激活时 · 背景颜色 | `var(--theme-current-highlight-bg)` | 沿用 | 沿用 |
| `--component-station-item-active-border` | 台站列表弹窗：列表项 · 选中/激活时 · 边框颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-station-item-active-text` | 台站列表弹窗：列表项 · 选中/激活时 · 文字颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-station-item-active-pin-bg` | 台站列表弹窗：列表项 · 选中/激活时 · 置顶标记 · 背景颜色 | `var(--theme-current-highlight-bg-strong)` | 沿用 | 沿用 |
| `--component-station-item-active-pin-text` | 台站列表弹窗：列表项 · 选中/激活时 · 置顶标记 · 文字颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-settings-slider-thumb` | 设置页面：滑块 · 滑块圆点颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-settings-info-text` | 设置页面：说明 · 文字颜色 | `var(--theme-success)` | 沿用 | 沿用 |
| `--component-settings-focus-border` | 设置页面：获得焦点时 · 边框颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-settings-add-button-text` | 设置页面：添加按钮 · 文字颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-settings-add-button-border` | 设置页面：添加按钮 · 边框颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-settings-add-button-hover-bg` | 设置页面：添加按钮 · 悬停时 · 背景颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-settings-address-hover-border` | 设置页面：地址 · 悬停时 · 边框颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-settings-address-hover-bg` | 设置页面：地址 · 悬停时 · 背景颜色 | `var(--theme-surface-hover)` | 沿用 | 沿用 |
| `--component-settings-address-active-border` | 设置页面：地址 · 选中/激活时 · 边框颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-settings-address-active-bg` | 设置页面：地址 · 选中/激活时 · 背景颜色 | `var(--alpha-primary-08)` | 沿用 | 沿用 |
| `--component-settings-status-active-bg` | 设置页面：状态指示 · 选中/激活时 · 背景颜色 | `var(--theme-success)` | 沿用 | 沿用 |
| `--component-settings-status-active-shadow` | 设置页面：状态指示 · 选中/激活时 · 阴影颜色 | `var(--theme-success)` | 沿用 | 沿用 |
| `--component-settings-status-connecting-bg` | 设置页面：状态指示 · 连接中状态 · 背景颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-settings-user-callsign-bg` | 设置页面：用户呼号标签 · 背景颜色 | `var(--alpha-primary-15)` | 沿用 | 沿用 |
| `--component-settings-user-callsign-text` | 设置页面：用户呼号标签 · 文字颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-settings-user-uid-bg` | 设置页面：用户 UID 标签 · 背景颜色 | `var(--status-success-bg-active)` | 沿用 | 沿用 |
| `--component-settings-user-uid-text` | 设置页面：用户 UID 标签 · 文字颜色 | `var(--theme-success)` | 沿用 | 沿用 |
| `--component-settings-icon-hover-text` | 设置页面：图标 · 悬停时 · 文字颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-settings-sync-status-text` | 设置页面：同步状态 · 文字颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-settings-toggle-checked-bg` | 设置页面：开关 · 选中时 · 背景颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-settings-toggle-focus-ring` | 设置页面：开关 · 获得焦点时 · 外圈光晕颜色 | `var(--alpha-primary-20)` | 沿用 | 沿用 |
| `--component-settings-checkbox-checked-border` | 设置页面：复选框 · 选中时 · 边框颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-settings-checkbox-checked-fill` | 设置页面：复选框 · 选中时 · 填充颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-settings-primary-badge-bg` | 设置页面：主台站标记 · 背景颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-settings-primary-badge-text` | 设置页面：主台站标记 · 文字颜色 | `var(--theme-text-inverse)` | 沿用 | 沿用 |
| `--component-settings-server-id-bg` | 设置页面：服务器 ID 标签 · 背景颜色 | `var(--status-success-bg-active)` | 沿用 | 沿用 |
| `--component-settings-server-id-text` | 设置页面：服务器 ID 标签 · 文字颜色 | `var(--theme-success)` | 沿用 | 沿用 |
| `--component-message-accent-text` | 消息页面：强调颜色 · 文字颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-message-hover-text` | 消息页面：悬停时 · 文字颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-message-hover-bg` | 消息页面：悬停时 · 背景颜色 | `var(--theme-surface-hover)` | 沿用 | 沿用 |
| `--component-message-spinner-top` | 消息页面：加载转圈顶部颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-message-item-hover-border` | 消息页面：列表项 · 悬停时 · 边框颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-message-item-active-border` | 消息页面：列表项 · 选中/激活时 · 边框颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-message-item-active-bg` | 消息页面：列表项 · 选中/激活时 · 背景颜色 | `var(--theme-surface-accent-soft)` | 沿用 | 沿用 |
| `--component-message-load-more-hover-border` | 消息页面：加载更多按钮 · 悬停时 · 边框颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-message-load-more-hover-text` | 消息页面：加载更多按钮 · 悬停时 · 文字颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-message-primary-button-bg` | 消息页面：主要按钮 · 背景颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-message-primary-button-border` | 消息页面：主要按钮 · 边框颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-message-primary-button-hover-bg` | 消息页面：主要按钮 · 悬停时 · 背景颜色 | `var(--theme-accent-primary-hover)` | 沿用 | 沿用 |
| `--component-message-primary-button-hover-border` | 消息页面：主要按钮 · 悬停时 · 边框颜色 | `var(--theme-accent-primary-hover)` | 沿用 | 沿用 |
| `--component-message-secondary-button-hover-border` | 消息页面：次要按钮 · 悬停时 · 边框颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-message-secondary-button-hover-text` | 消息页面：次要按钮 · 悬停时 · 文字颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-message-text-button-hover-text` | 消息页面：文字按钮 · 悬停时 · 文字颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-message-text-button-hover-bg` | 消息页面：文字按钮 · 悬停时 · 背景颜色 | `var(--theme-surface-hover)` | 沿用 | 沿用 |
| `--component-message-form-focus-border` | 消息页面：表单 · 获得焦点时 · 边框颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-message-success-bg` | 消息页面：成功状态 · 背景颜色 | `var(--theme-surface-success-soft)` | 沿用 | 沿用 |
| `--component-message-success-text` | 消息页面：成功状态 · 文字颜色 | `var(--theme-success)` | 沿用 | 沿用 |
| `--component-remote-connected-bg` | 远程控制页面：已连接状态 · 背景颜色 | `var(--theme-success)` | 沿用 | 沿用 |
| `--component-remote-connected-shadow` | 远程控制页面：已连接状态 · 阴影颜色 | `var(--theme-success)` | 沿用 | 沿用 |
| `--component-remote-connecting-bg` | 远程控制页面：连接中状态 · 背景颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-remote-add-button-text` | 远程控制页面：添加按钮 · 文字颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-remote-add-button-border` | 远程控制页面：添加按钮 · 边框颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-remote-add-button-hover-bg` | 远程控制页面：添加按钮 · 悬停时 · 背景颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-remote-icon-hover-text` | 远程控制页面：图标 · 悬停时 · 文字颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-remote-select-focus-border` | 远程控制页面：下拉选择框 · 获得焦点时 · 边框颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-remote-checkbox-accent` | 远程控制页面：复选框 · 强调颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-remote-password-hover-text` | 远程控制页面：密码显示按钮 · 悬停时 · 文字颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-remote-input-focus-border` | 远程控制页面：输入框 · 获得焦点时 · 边框颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-remote-control-hover-border` | 远程控制页面：操作控件 · 悬停时 · 边框颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-remote-control-hover-text` | 远程控制页面：操作控件 · 悬停时 · 文字颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-remote-primary-button-bg` | 远程控制页面：主要按钮 · 背景颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-remote-primary-button-hover-bg` | 远程控制页面：主要按钮 · 悬停时 · 背景颜色 | `var(--theme-accent-primary-hover)` | 沿用 | 沿用 |
| `--component-location-refresh-text` | 定位上报页面：刷新按钮 · 文字颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-location-refresh-border` | 定位上报页面：刷新按钮 · 边框颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-location-refresh-hover-bg` | 定位上报页面：刷新按钮 · 悬停时 · 背景颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-location-toggle-checked-bg` | 定位上报页面：开关 · 选中时 · 背景颜色 | `var(--theme-success)` | 沿用 | 沿用 |
| `--component-location-slider-thumb` | 定位上报页面：滑块 · 滑块圆点颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-location-slider-value` | 定位上报页面：滑块数值 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-location-primary-button-bg` | 定位上报页面：主要按钮 · 背景颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-location-primary-button-hover-bg` | 定位上报页面：主要按钮 · 悬停时 · 背景颜色 | `var(--theme-accent-primary-hover)` | 沿用 | 沿用 |
| `--component-location-status-success-text` | 定位上报页面：状态指示 · 成功状态 · 文字颜色 | `var(--theme-success)` | 沿用 | 沿用 |
| `--component-filter-panel-bg` | 筛选区域：面板 · 背景颜色 | `var(--theme-surface-card)` | 沿用 | 沿用 |
| `--component-filter-panel-border` | 筛选区域：面板 · 边框颜色 | `var(--theme-border-subtle)` | 沿用 | 沿用 |
| `--component-filter-control-bg` | 筛选区域：操作控件 · 背景颜色 | `var(--theme-surface-input)` | 沿用 | 沿用 |
| `--component-filter-control-border` | 筛选区域：操作控件 · 边框颜色 | `var(--theme-border-default)` | 沿用 | 沿用 |
| `--component-filter-control-hover-border` | 筛选区域：操作控件 · 悬停时 · 边框颜色 | `var(--theme-current-highlight-border)` | 沿用 | 沿用 |
| `--component-filter-chip-bg` | 筛选区域：筛选标签 · 背景颜色 | `var(--theme-surface-container)` | 沿用 | 沿用 |
| `--component-filter-chip-text` | 筛选区域：筛选标签 · 文字颜色 | `var(--theme-text-secondary)` | 沿用 | 沿用 |
| `--component-filter-chip-hover-bg` | 筛选区域：筛选标签 · 悬停时 · 背景颜色 | `var(--theme-current-highlight-bg)` | 沿用 | 沿用 |
| `--component-filter-chip-hover-text` | 筛选区域：筛选标签 · 悬停时 · 文字颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-filter-chip-active-bg` | 筛选区域：筛选标签 · 选中/激活时 · 背景颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-filter-chip-active-text` | 筛选区域：筛选标签 · 选中/激活时 · 文字颜色 | `var(--theme-text-inverse)` | 沿用 | 沿用 |
| `--component-date-picker-clear-hover-text` | 日期选择器：清除按钮 · 悬停时 · 文字颜色 | `var(--theme-danger)` | 沿用 | 沿用 |
| `--component-date-picker-nav-hover-bg` | 日期选择器：月份切换按钮 · 悬停时 · 背景颜色 | `var(--theme-surface-hover)` | 沿用 | 沿用 |
| `--component-date-picker-nav-hover-border` | 日期选择器：月份切换按钮 · 悬停时 · 边框颜色 | `var(--theme-current-highlight-border)` | 沿用 | 沿用 |
| `--component-date-picker-stats-text` | 日期选择器：统计 · 文字颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-date-picker-day-hover-bg` | 日期选择器：日期格 · 悬停时 · 背景颜色 | `var(--theme-surface-hover)` | 沿用 | 沿用 |
| `--component-date-picker-day-has-data-hover-bg` | 日期选择器：有记录的日期 · 悬停时 · 背景颜色 | `var(--status-success-bg-soft)` | 沿用 | 沿用 |
| `--component-date-picker-day-selected-bg` | 日期选择器：选中日期 · 背景颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-date-picker-day-selected-border` | 日期选择器：选中日期 · 边框颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-date-picker-badge-bg` | 日期选择器：徽标 · 背景颜色 | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--component-date-picker-badge-text` | 日期选择器：徽标 · 文字颜色 | `var(--theme-text-inverse)` | 沿用 | 沿用 |
| `--component-old-friend-card-bg` | 老朋友卡片：背景颜色 | `var(--theme-warning-panel-bg)` | 沿用 | 沿用 |
| `--component-old-friend-card-border` | 老朋友卡片：边框颜色 | `var(--theme-warning-panel-border-strong)` | 沿用 | 沿用 |
| `--component-info-panel-bg` | 通用信息提示面板：背景颜色 | `var(--theme-info-panel-bg)` | 沿用 | `var(--dark-830)` |
| `--component-info-panel-bg-hover` | 通用信息提示面板：悬停背景 | `var(--theme-info-panel-bg-strong)` | 沿用 | `var(--dark-830)` |
| `--component-info-panel-border` | 通用信息提示面板：边框颜色 | `var(--theme-info-panel-border)` | 沿用 | `var(--theme-border-default)` |
| `--component-info-panel-border-soft` | 通用信息提示面板：较轻边框 | `var(--theme-info-panel-border-soft)` | 沿用 | `var(--theme-border-subtle)` |
| `--component-info-panel-text` | 通用信息提示面板：文字颜色 | `var(--theme-text-secondary)` | 沿用 | `var(--theme-text-secondary)` |
| `--component-info-panel-accent` | 通用信息提示面板：强调颜色 | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--component-error-panel-bg` | 通用错误提示面板：背景颜色 | `var(--theme-danger-panel-bg)` | 沿用 | `var(--theme-surface-danger-soft)` |
| `--component-error-panel-border` | 通用错误提示面板：边框颜色 | `var(--theme-danger-panel-border)` | 沿用 | `var(--theme-border-default)` |
| `--component-modal-backdrop` | 弹窗：背景遮罩 | `var(--theme-overlay-default)` | 沿用 | 沿用 |
| `--component-modal-backdrop-soft` | 弹窗：较轻背景遮罩 | `var(--theme-overlay-soft)` | 沿用 | 沿用 |
| `--component-modal-shadow` | 弹窗：阴影颜色 | `0 8px 32px var(--alpha-black-20)` | 沿用 | 沿用 |
| `--component-modal-glass-highlight` | 弹窗：玻璃高光 | `var(--theme-glass-highlight)` | 沿用 | 沿用 |
| `--component-modal-glass-highlight-strong` | 弹窗：较强玻璃高光 | `var(--theme-glass-highlight-strong)` | 沿用 | 沿用 |
| `--component-badge-count-bg` | 徽标：计数 · 背景颜色 | `var(--theme-accent-secondary)` | 沿用 | 沿用 |
| `--component-badge-online-bg` | 徽标：在线状态 · 背景颜色 | `var(--theme-success-emerald)` | 沿用 | 沿用 |
| `--component-badge-warning-bg` | 徽标：警告状态 · 背景颜色 | `var(--theme-warning-gold)` | 沿用 | 沿用 |
| `--component-rank-gold` | 排行榜：金牌颜色 | `var(--theme-warning-gold)` | 沿用 | 沿用 |
| `--component-rank-silver` | 排行榜：银牌颜色 | `var(--neutral-400)` | 沿用 | 沿用 |
| `--component-rank-bronze` | 排行榜：铜牌颜色 | `var(--theme-bronze)` | 沿用 | 沿用 |
| `--component-rank-gold-muted` | 排行榜：金牌弱化色 | `var(--theme-warning-muted)` | 沿用 | 沿用 |
| `--component-rank-slate-muted` | 排行榜：灰蓝弱化色 | `var(--neutral-650)` | 沿用 | 沿用 |
| `--component-rank-bronze-muted` | 排行榜：铜牌弱化色 | `var(--theme-bronze-muted)` | 沿用 | 沿用 |
| `--component-rank-dark-bg` | 排行榜：深色模式 · 背景颜色 | `var(--dark-540)` | 沿用 | 沿用 |
| `--component-rank-dark-border` | 排行榜：深色模式 · 边框颜色 | `var(--dark-610)` | 沿用 | 沿用 |
| `--component-control-primary-bg` | 控制按钮：主操作 · 背景颜色 | `var(--theme-accent-primary-strong)` | 沿用 | 沿用 |
| `--component-control-primary-ring` | 控制按钮：主操作 · 外圈光晕颜色 | `var(--alpha-primary-strong-20)` | 沿用 | 沿用 |
| `--component-control-success-bg` | 控制按钮：成功状态 · 背景颜色 | `var(--theme-success-emerald)` | 沿用 | 沿用 |
| `--component-control-success-ring` | 控制按钮：成功状态 · 外圈光晕颜色 | `var(--alpha-emerald-20)` | 沿用 | 沿用 |
| `--component-control-danger-bg` | 控制按钮：危险操作 · 背景颜色 | `var(--theme-danger-strong)` | 沿用 | 沿用 |
| `--component-control-danger-ring` | 控制按钮：危险操作 · 外圈光晕颜色 | `var(--alpha-danger-strong-20)` | 沿用 | 沿用 |
| `--component-timeline-dot-send-bg` | APRS 远控操作时间线节点：发送操作 · 背景颜色 | `#409eff` | 沿用 | 沿用 |
| `--component-timeline-dot-send-ring` | APRS 远控操作时间线节点：发送操作 · 外圈光晕颜色 | `rgba(64, 158, 255, 0.2)` | 沿用 | 沿用 |
| `--component-timeline-dot-success-bg` | APRS 远控操作时间线节点：成功状态 · 背景颜色 | `#22c55e` | 沿用 | 沿用 |
| `--component-timeline-dot-success-ring` | APRS 远控操作时间线节点：成功状态 · 外圈光晕颜色 | `rgba(34, 197, 94, 0.2)` | 沿用 | 沿用 |
| `--component-timeline-dot-fail-bg` | APRS 远控操作时间线节点：失败操作 · 背景颜色 | `#ef4444` | 沿用 | 沿用 |
| `--component-timeline-dot-fail-ring` | APRS 远控操作时间线节点：失败操作 · 外圈光晕颜色 | `rgba(239, 68, 68, 0.2)` | 沿用 | 沿用 |

### 基础色板与半透明色

| 完整变量名 | 对应位置 / 用途 | 基础声明 | 混色覆盖 | 深色覆盖 |
| --- | --- | --- | --- | --- |
| `--color-transparent` | 透明基础值，用于无填充、透明边框等；例如：触摸点击时浏览器高亮颜色 | `transparent` | 沿用 | 沿用 |
| `--color-white` | 白色基础值，用于浅色背景、反色文字等；例如：整个页面最底层背景 | `#ffffff` | 沿用 | 沿用 |
| `--color-black` | 黑色基础值，用于遮罩和装饰等；例如：纹理遮罩实心部分的颜色 | `#000000` | 沿用 | 沿用 |
| `--neutral-900` | 中性灰色板 900 号，供文字、背景和分隔线引用；不是某个页面专属色；例如：正文、标题、呼号等主要文字 | `#333333` | 沿用 | 沿用 |
| `--neutral-800` | 中性灰色板 800 号，供文字、背景和分隔线引用；不是某个页面专属色；例如：悬浮提示框背景 | `#4a4a4a` | 沿用 | 沿用 |
| `--neutral-700` | 中性灰色板 700 号，供文字、背景和分隔线引用；不是某个页面专属色；例如：标签、次要内容文字 | `#606266` | 沿用 | 沿用 |
| `--neutral-650` | 中性灰色板 650 号，供文字、背景和分隔线引用；不是某个页面专属色；例如：排行榜：灰蓝弱化色 | `#5c6b7f` | 沿用 | 沿用 |
| `--neutral-600` | 中性灰色板 600 号，供文字、背景和分隔线引用；不是某个页面专属色；例如：不可操作或禁用内容的文字 | `#666666` | 沿用 | 沿用 |
| `--neutral-500` | 中性灰色板 500 号，供文字、背景和分隔线引用；不是某个页面专属色；例如：时间、地址、说明等辅助文字 | `#909399` | 沿用 | 沿用 |
| `--neutral-400` | 中性灰色板 400 号，供文字、背景和分隔线引用；不是某个页面专属色；例如：排行榜：银牌颜色 | `#94a3b8` | 沿用 | 沿用 |
| `--neutral-350` | 中性灰色板 350 号，供文字、背景和分隔线引用；不是某个页面专属色 | `#969696` | 沿用 | 沿用 |
| `--neutral-300` | 中性灰色板 300 号，供文字、背景和分隔线引用；不是某个页面专属色；例如：标签、次要内容文字 | `#b8b8b8` | 沿用 | 沿用 |
| `--neutral-250` | 中性灰色板 250 号，供文字、背景和分隔线引用；不是某个页面专属色；例如：不可操作或禁用内容的文字 | `#c0c4cc` | 沿用 | 沿用 |
| `--neutral-200` | 中性灰色板 200 号，供文字、背景和分隔线引用；不是某个页面专属色；例如：输入控件和普通区域的默认边框 | `#dcdfe6` | 沿用 | 沿用 |
| `--neutral-175` | 中性灰色板 175 号，供文字、背景和分隔线引用；不是某个页面专属色；例如：表格等需要明显分隔的边框 | `#dddddd` | 沿用 | 沿用 |
| `--neutral-150` | 中性灰色板 150 号，供文字、背景和分隔线引用；不是某个页面专属色 | `#e5e7eb` | 沿用 | 沿用 |
| `--neutral-100` | 中性灰色板 100 号，供文字、背景和分隔线引用；不是某个页面专属色；例如：卡片、面板之间较轻的边框 | `#ebeef5` | 沿用 | 沿用 |
| `--neutral-075` | 中性灰色板 075 号，供文字、背景和分隔线引用；不是某个页面专属色；例如：页头分隔线、台站信息卡等浅边框 | `#eeeeee` | 沿用 | 沿用 |
| `--neutral-050` | 中性灰色板 050 号，供文字、背景和分隔线引用；不是某个页面专属色；例如：禁用控件背景 | `#f0f2f5` | 沿用 | 沿用 |
| `--neutral-040` | 中性灰色板 040 号，供文字、背景和分隔线引用；不是某个页面专属色；例如：次级内容区、日志表头和普通记录卡片的默认背景 | `#f5f7fa` | 沿用 | 沿用 |
| `--neutral-030` | 中性灰色板 030 号，供文字、背景和分隔线引用；不是某个页面专属色；例如：表格交替行背景，也参与顶部卡片的待机渐变 | `#f8f9fb` | 沿用 | 沿用 |
| `--neutral-020` | 中性灰色板 020 号，供文字、背景和分隔线引用；不是某个页面专属色 | `#f9fafb` | 沿用 | 沿用 |
| `--brand-primary` | 品牌/状态基础色板：按钮、链接、输入焦点等主要交互强调色；例如：按钮、链接、输入焦点等主要交互强调色 | `#4caf50` | 沿用 | 沿用 |
| `--brand-primary-hover` | 品牌/状态基础色板：主要交互元素悬停时的强调色；例如：主要交互元素悬停时的强调色 | `#3d8b40` | 沿用 | 沿用 |
| `--brand-primary-soft` | 品牌/状态基础色板：柔和主色，也作为默认深色模式的主色悬停色；例如：柔和主色，也作为默认深色模式的主色悬停色 | `#81c784` | 沿用 | 沿用 |
| `--brand-primary-strong` | 品牌/状态基础色板：深主色，供强调控制按钮等使用；例如：深主色，供强调控制按钮等使用 | `#2e7d32` | 沿用 | 沿用 |
| `--brand-indigo` | 品牌/状态基础色板：第二强调色，用于计数徽标等；例如：第二强调色，例如计数徽标 | `#2f9e89` | 沿用 | 沿用 |
| `--brand-success` | 品牌/状态基础色板：成功、在线和发言的基础语义色；例如：成功、在线和发言的基础语义色 | `#67c23a` | 沿用 | 沿用 |
| `--brand-success-strong` | 品牌/状态基础色板：成功、在线和发言的强强调色；例如：成功、在线和发言的强强调色 | `#22c55e` | 沿用 | 沿用 |
| `--brand-success-emerald` | 品牌/状态基础色板：成功、在线和发言的翠绿强调色；例如：成功、在线和发言的翠绿强调色 | `#10b981` | 沿用 | 沿用 |
| `--brand-success-soft` | 品牌/状态基础色板：成功、在线和发言的柔和强调色；例如：成功、在线和发言的柔和强调色 | `#4ade80` | 沿用 | 沿用 |
| `--brand-success-accent` | 品牌/状态基础色板：成功、在线和发言的强调色（默认当前高亮来源）；例如：成功、在线和发言的强调色（默认当前高亮来源） | `#4caf50` | 沿用 | 沿用 |
| `--brand-warning` | 品牌/状态基础色板：警告和排名金色的基础语义色；例如：警告和排名金色的基础语义色 | `#d46b08` | 沿用 | 沿用 |
| `--brand-warning-soft` | 品牌/状态基础色板：警告和排名金色的柔和强调色；例如：警告和排名金色的柔和强调色 | `#e6a23c` | 沿用 | 沿用 |
| `--brand-warning-gold` | 品牌/状态基础色板：警告和排名金色的金色强调色；例如：警告和排名金色的金色强调色 | `#f59e0b` | 沿用 | 沿用 |
| `--brand-warning-deep` | 品牌/状态基础色板：警告和排名金色的深强调色；例如：警告和排名金色的深强调色 | `#b45309` | 沿用 | 沿用 |
| `--brand-warning-muted` | 品牌/状态基础色板：警告和排名金色的弱化色；例如：警告和排名金色的弱化色 | `#c69500` | 沿用 | 沿用 |
| `--brand-warning-bright` | 品牌/状态基础色板：警告和排名金色的亮强调色；例如：警告和排名金色的亮强调色 | `#fbbf24` | 沿用 | 沿用 |
| `--brand-bronze` | 品牌/状态基础色板：排行榜铜牌的基础语义色；例如：排行榜铜牌的基础语义色 | `#d97706` | 沿用 | 沿用 |
| `--brand-bronze-muted` | 品牌/状态基础色板：排行榜铜牌的弱化色；例如：排行榜铜牌的弱化色 | `#a0522d` | 沿用 | 沿用 |
| `--brand-danger` | 品牌/状态基础色板：错误、危险操作的基础语义色；例如：错误、危险操作的基础语义色 | `#f56c6c` | 沿用 | 沿用 |
| `--brand-danger-hover` | 品牌/状态基础色板：错误、危险操作的悬停色；例如：错误、危险操作的悬停色 | `#e64242` | 沿用 | 沿用 |
| `--brand-danger-strong` | 品牌/状态基础色板：错误、危险操作的强强调色；例如：错误、危险操作的强强调色 | `#ef4444` | 沿用 | 沿用 |
| `--brand-danger-soft` | 品牌/状态基础色板：错误、危险操作的柔和强调色；例如：错误、危险操作的柔和强调色 | `#f78989` | 沿用 | 沿用 |
| `--brand-danger-close` | 品牌/状态基础色板：错误、危险操作的关闭操作色；例如：错误、危险操作的关闭操作色 | `#ff5f57` | 沿用 | 沿用 |
| `--surface-blue-050` | 蓝色基础背景色板，供提示面板、记录高亮等引用 | `#ecf5ff` | 沿用 | 沿用 |
| `--surface-blue-100` | 蓝色基础背景色板，供提示面板、记录高亮等引用；例如：信息提示区域：较强背景 | `#e6f7ff` | 沿用 | 沿用 |
| `--surface-blue-150` | 蓝色基础背景色板，供提示面板、记录高亮等引用；例如：信息提示区域：背景颜色 | `#f0f9ff` | 沿用 | 沿用 |
| `--surface-blue-200` | 蓝色基础背景色板，供提示面板、记录高亮等引用 | `#f0f4ff` | 沿用 | 沿用 |
| `--surface-green-050` | 绿色基础背景色板，供提示面板、记录高亮等引用；例如：主色浅背景，供按钮悬停和选中区域使用 | `#f0f9eb` | 沿用 | 沿用 |
| `--surface-green-100` | 绿色基础背景色板，供提示面板、记录高亮等引用；例如：成功提示的浅背景 | `#f0fdf4` | 沿用 | 沿用 |
| `--surface-green-110` | 绿色基础背景色板，供提示面板、记录高亮等引用；例如：成功/发言提示区域：备用浅背景 | `#f6fef6` | 沿用 | 沿用 |
| `--surface-green-120` | 绿色基础背景色板，供提示面板、记录高亮等引用；例如：成功/发言提示区域：较强背景 | `#e8f8e8` | 沿用 | 沿用 |
| `--surface-orange-050` | 橙色基础背景色板，供提示面板、记录高亮等引用；例如：警告提示的浅背景 | `#fff7e6` | 沿用 | 沿用 |
| `--surface-orange-100` | 橙色基础背景色板，供提示面板、记录高亮等引用；例如：警告/老朋友提示区域：背景颜色 | `#fff7ed` | 沿用 | 沿用 |
| `--surface-red-050` | 红色基础背景色板，供提示面板、记录高亮等引用；例如：错误提示的浅背景 | `#fef0f0` | 沿用 | 沿用 |
| `--surface-red-100` | 红色基础背景色板，供提示面板、记录高亮等引用 | `#fde2e2` | 沿用 | 沿用 |
| `--surface-yellow-050` | 黄色基础背景色板，供提示面板、记录高亮等引用；例如：排行榜：金牌颜色 · 背景颜色 | `#fef9e7` | 沿用 | 沿用 |
| `--surface-yellow-100` | 黄色基础背景色板，供提示面板、记录高亮等引用；例如：排行榜：金牌颜色 · 徽标 · 背景颜色 | `#fef3c7` | 沿用 | 沿用 |
| `--surface-tan-050` | 棕色基础背景色板，供提示面板、记录高亮等引用；例如：排行榜：铜牌颜色 · 背景颜色 | `#fdf2e9` | 沿用 | 沿用 |
| `--surface-slate-050` | 灰蓝色基础背景色板，供提示面板、记录高亮等引用；例如：排行榜：银牌颜色 · 背景颜色 | `#e8ecf2` | 沿用 | 沿用 |
| `--border-blue-100` | 蓝色基础边框色板，供状态面板或高亮边框引用；例如：信息提示区域：边框颜色 | `#b3d8ff` | 沿用 | 沿用 |
| `--border-blue-050` | 蓝色基础边框色板，供状态面板或高亮边框引用；例如：信息提示区域：较轻边框 | `#d9ecff` | 沿用 | 沿用 |
| `--border-orange-100` | 橙色基础边框色板，供状态面板或高亮边框引用；例如：警告/老朋友提示区域：边框颜色 | `#ffd591` | 沿用 | 沿用 |
| `--border-yellow-100` | 黄色基础边框色板，供状态面板或高亮边框引用 | `#fcd34d` | 沿用 | 沿用 |
| `--border-red-100` | 红色基础边框色板，供状态面板或高亮边框引用；例如：错误提示区域：边框颜色 | `#fde2e2` | 沿用 | 沿用 |
| `--border-green-100` | 绿色基础边框色板，供状态面板或高亮边框引用；例如：成功/发言提示区域：边框颜色 | `#e1f3d8` | 沿用 | 沿用 |
| `--border-green-200` | 绿色基础边框色板，供状态面板或高亮边框引用；例如：成功/发言提示区域：较轻边框 | `#c8e6c9` | 沿用 | 沿用 |
| `--border-green-300` | 绿色基础边框色板，供状态面板或高亮边框引用；例如：成功/发言提示区域：较强边框 | `#a5d6a7` | 沿用 | 沿用 |
| `--border-green-400` | 绿色基础边框色板，供状态面板或高亮边框引用；例如：成功/发言提示区域：醒目边框 | `#86efac` | 沿用 | 沿用 |
| `--border-orange-200` | 橙色基础边框色板，供状态面板或高亮边框引用；例如：警告/老朋友提示区域：较强边框 | `#fed7aa` | 沿用 | 沿用 |
| `--dark-900` | 深色模式色板 900 号，供背景、边框等语义变量引用；例如：整个页面最底层背景 | `#1a1a1a` | 沿用 | 沿用 |
| `--dark-850` | 深色模式色板 850 号，供背景、边框等语义变量引用；例如：成功/发言提示区域：备用浅背景 | `#1a241a` | 沿用 | 沿用 |
| `--dark-840` | 深色模式色板 840 号，供背景、边框等语义变量引用 | `#1a281a` | 沿用 | 沿用 |
| `--dark-830` | 深色模式色板 830 号，供背景、边框等语义变量引用；例如：主色浅背景，供按钮悬停和选中区域使用 | `#1a2a3a` | 沿用 | 沿用 |
| `--dark-820` | 深色模式色板 820 号，供背景、边框等语义变量引用；例如：成功/发言提示区域：较强背景 | `#1e2e1e` | 沿用 | 沿用 |
| `--dark-800` | 深色模式色板 800 号，供背景、边框等语义变量引用；例如：成功提示的浅背景 | `#1f3a1f` | 沿用 | 沿用 |
| `--dark-750` | 深色模式色板 750 号，供背景、边框等语义变量引用；例如：内容容器背景 | `#242424` | 沿用 | 沿用 |
| `--dark-740` | 深色模式色板 740 号，供背景、边框等语义变量引用；例如：成功/发言提示区域：较轻边框 | `#263626` | 沿用 | 沿用 |
| `--dark-700` | 深色模式色板 700 号，供背景、边框等语义变量引用；例如：列表、控件悬停时的通用背景 | `#2a2a2a` | 沿用 | 沿用 |
| `--dark-680` | 深色模式色板 680 号，供背景、边框等语义变量引用；例如：页头背景 | `#2c2c2c` | 沿用 | 沿用 |
| `--dark-660` | 深色模式色板 660 号，供背景、边框等语义变量引用；例如：成功/发言提示区域：边框颜色 | `#2d5a2d` | 沿用 | 沿用 |
| `--dark-640` | 深色模式色板 640 号，供背景、边框等语义变量引用；例如：次级内容区、日志表头和普通记录卡片的默认背景 | `#363636` | 沿用 | 沿用 |
| `--dark-620` | 深色模式色板 620 号，供背景、边框等语义变量引用；例如：错误提示的浅背景 | `#3a1f1f` | 沿用 | 沿用 |
| `--dark-610` | 深色模式色板 610 号，供背景、边框等语义变量引用；例如：警告提示的浅背景 | `#3a2e1f` | 沿用 | 沿用 |
| `--dark-600` | 深色模式色板 600 号，供背景、边框等语义变量引用；例如：输入框、选择框背景 | `#3a3a3a` | 沿用 | 沿用 |
| `--dark-580` | 深色模式色板 580 号，供背景、边框等语义变量引用；例如：排行榜：银牌颜色 · 背景颜色 | `#3a3d42` | 沿用 | 沿用 |
| `--dark-560` | 深色模式色板 560 号，供背景、边框等语义变量引用；例如：排行榜：铜牌颜色 · 背景颜色 | `#3d2e20` | 沿用 | 沿用 |
| `--dark-540` | 深色模式色板 540 号，供背景、边框等语义变量引用；例如：排行榜：金牌颜色 · 背景颜色 | `#3d3520` | 沿用 | 沿用 |
| `--dark-500` | 深色模式色板 500 号，供背景、边框等语义变量引用；例如：禁用控件背景 | `#404040` | 沿用 | 沿用 |
| `--dark-text-primary` | 深色模式主文字的基础颜色；例如：正文、标题、呼号等主要文字 | `#e8e8e8` | 沿用 | 沿用 |
| `--alpha-black-06` | 半透明基础色（6% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：装饰条纹颜色 | `rgba(0, 0, 0, 0.06)` | 沿用 | 沿用 |
| `--alpha-black-10` | 半透明基础色（10% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：普通卡片阴影的颜色，不含偏移和模糊尺寸 | `rgba(0, 0, 0, 0.1)` | 沿用 | 沿用 |
| `--alpha-black-12` | 半透明基础色（12% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算 | `rgba(0, 0, 0, 0.12)` | 沿用 | 沿用 |
| `--alpha-black-15` | 半透明基础色（15% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：弹窗阴影的颜色，不含偏移和模糊尺寸 | `rgba(0, 0, 0, 0.15)` | 沿用 | 沿用 |
| `--alpha-black-20` | 半透明基础色（20% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：弹窗：阴影颜色 | `rgba(0, 0, 0, 0.2)` | 沿用 | 沿用 |
| `--alpha-black-25` | 半透明基础色（25% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：装饰纹理边缘的淡出颜色 | `rgba(0, 0, 0, 0.25)` | 沿用 | 沿用 |
| `--alpha-black-30` | 半透明基础色（30% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：普通卡片阴影的颜色，不含偏移和模糊尺寸 | `rgba(0, 0, 0, 0.3)` | 沿用 | 沿用 |
| `--alpha-black-40` | 半透明基础色（40% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：较轻的弹窗背景遮罩 | `rgba(0, 0, 0, 0.4)` | 沿用 | 沿用 |
| `--alpha-black-50` | 半透明基础色（50% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：弹窗阴影的颜色，不含偏移和模糊尺寸 | `rgba(0, 0, 0, 0.5)` | 沿用 | 沿用 |
| `--alpha-black-70` | 半透明基础色（70% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：弹窗背后的遮罩颜色 | `rgba(0, 0, 0, 0.7)` | 沿用 | 沿用 |
| `--alpha-white-06` | 半透明基础色（6% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：装饰条纹颜色 | `rgba(255, 255, 255, 0.06)` | 沿用 | 沿用 |
| `--alpha-white-15` | 半透明基础色（15% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：装饰纹理边缘的淡出颜色 | `rgba(255, 255, 255, 0.15)` | 沿用 | 沿用 |
| `--alpha-white-30` | 半透明基础色（30% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：玻璃效果的浅色高光 | `rgba(255, 255, 255, 0.3)` | 沿用 | 沿用 |
| `--alpha-white-35` | 半透明基础色（35% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：玻璃效果的较强高光 | `rgba(255, 255, 255, 0.35)` | 沿用 | 沿用 |
| `--alpha-primary-08` | 半透明基础色（8% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用主色状态提示：浅背景 | `rgba(64, 158, 255, 0.08)` | 沿用 | 沿用 |
| `--alpha-primary-10` | 半透明基础色（10% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用主色状态提示：背景颜色 | `rgba(64, 158, 255, 0.1)` | 沿用 | 沿用 |
| `--alpha-primary-12` | 半透明基础色（12% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用主色状态提示：较强背景 | `rgba(64, 158, 255, 0.12)` | 沿用 | 沿用 |
| `--alpha-primary-15` | 半透明基础色（15% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用主色状态提示：激活背景 | `rgba(64, 158, 255, 0.15)` | 沿用 | 沿用 |
| `--alpha-primary-20` | 半透明基础色（20% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：主色焦点光晕的颜色 | `rgba(64, 158, 255, 0.2)` | 沿用 | 沿用 |
| `--alpha-primary-30` | 半透明基础色（30% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：主色悬停光晕的颜色 | `rgba(64, 158, 255, 0.3)` | 沿用 | 沿用 |
| `--alpha-success-08` | 半透明基础色（8% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用成功/在线状态提示：浅背景 | `rgba(103, 194, 58, 0.08)` | 沿用 | 沿用 |
| `--alpha-success-12` | 半透明基础色（12% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用成功/在线状态提示：较强背景 | `rgba(103, 194, 58, 0.12)` | 沿用 | 沿用 |
| `--alpha-success-15` | 半透明基础色（15% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用成功/在线状态提示：背景颜色 | `rgba(103, 194, 58, 0.15)` | 沿用 | 沿用 |
| `--alpha-success-25` | 半透明基础色（25% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用成功/在线状态提示：激活背景 | `rgba(103, 194, 58, 0.25)` | 沿用 | 沿用 |
| `--alpha-success-strong-12` | 半透明基础色（12% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算 | `rgba(34, 197, 94, 0.12)` | 沿用 | 沿用 |
| `--alpha-emerald-20` | 半透明基础色（20% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：控制按钮：成功状态 · 外圈光晕颜色 | `rgba(16, 185, 129, 0.2)` | 沿用 | 沿用 |
| `--alpha-warning-08` | 半透明基础色（8% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用警告状态提示：浅背景 | `rgba(230, 162, 60, 0.08)` | 沿用 | 沿用 |
| `--alpha-warning-22` | 半透明基础色（22% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用警告状态提示：激活背景 | `rgba(230, 162, 60, 0.22)` | 沿用 | 沿用 |
| `--alpha-warning-25` | 半透明基础色（25% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用警告状态提示：较强边框 | `rgba(230, 162, 60, 0.25)` | 沿用 | 沿用 |
| `--alpha-warning-gold-10` | 半透明基础色（10% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用警告状态提示：背景颜色 | `rgba(245, 158, 11, 0.1)` | 沿用 | 沿用 |
| `--alpha-warning-gold-30` | 半透明基础色（30% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用警告状态提示：边框颜色 | `rgba(245, 158, 11, 0.3)` | 沿用 | 沿用 |
| `--alpha-warning-brown-12` | 半透明基础色（12% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算 | `rgba(212, 107, 8, 0.12)` | 沿用 | 沿用 |
| `--alpha-danger-08` | 半透明基础色（8% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用错误/危险状态提示：浅背景 | `rgba(245, 108, 108, 0.08)` | 沿用 | 沿用 |
| `--alpha-danger-20` | 半透明基础色（20% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用错误/危险状态提示：较强边框 | `rgba(245, 108, 108, 0.2)` | 沿用 | 沿用 |
| `--alpha-danger-strong-10` | 半透明基础色（10% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用错误/危险状态提示：背景颜色 | `rgba(239, 68, 68, 0.1)` | 沿用 | 沿用 |
| `--alpha-danger-strong-20` | 半透明基础色（20% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用错误/危险状态提示：外圈光晕颜色 | `rgba(239, 68, 68, 0.2)` | 沿用 | 沿用 |
| `--alpha-danger-strong-30` | 半透明基础色（30% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用错误/危险状态提示：边框颜色 | `rgba(239, 68, 68, 0.3)` | 沿用 | 沿用 |
| `--alpha-danger-close-12` | 半透明基础色（12% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：弹窗关闭按钮：悬停时 · 背景颜色 | `rgba(255, 95, 87, 0.12)` | 沿用 | 沿用 |
| `--alpha-danger-close-55` | 半透明基础色（55% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：弹窗关闭按钮：边框颜色 | `rgba(255, 95, 87, 0.55)` | 沿用 | 沿用 |
| `--alpha-danger-close-70` | 半透明基础色（70% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：弹窗关闭按钮：文字颜色 | `rgba(255, 95, 87, 0.7)` | 沿用 | 沿用 |
| `--alpha-danger-close-80` | 半透明基础色（80% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：弹窗关闭按钮：悬停时 · 边框颜色 | `rgba(255, 95, 87, 0.8)` | 沿用 | 沿用 |
| `--alpha-danger-close-90` | 半透明基础色（90% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：弹窗关闭按钮：悬停时 · 文字颜色 | `rgba(255, 95, 87, 0.9)` | 沿用 | 沿用 |
| `--alpha-primary-strong-20` | 半透明基础色（20% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：控制按钮：主操作 · 外圈光晕颜色 | `rgba(59, 130, 246, 0.2)` | 沿用 | 沿用 |
| `--alpha-neutral-12` | 半透明基础色（12% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用中性状态提示：背景颜色 | `rgba(128, 128, 128, 0.12)` | 沿用 | 沿用 |
| `--alpha-neutral-30` | 半透明基础色（30% 不透明度），供背景、边框或光晕引用；不会随品牌主色自动重算；例如：通用中性状态提示：边框颜色 | `rgba(150, 150, 150, 0.3)` | 沿用 | 沿用 |

### 兼容别名

| 完整变量名 | 对应位置 / 用途 | 基础声明 | 混色覆盖 | 深色覆盖 |
| --- | --- | --- | --- | --- |
| `--bg-page` | 整个页面最底层背景（兼容别名，优先修改对应语义/组件变量） | `var(--theme-surface-page)` | 沿用 | 沿用 |
| `--bg-container` | 内容容器背景（兼容别名，优先修改对应语义/组件变量） | `var(--theme-surface-container)` | 沿用 | 沿用 |
| `--bg-header` | 页头背景（兼容别名，优先修改对应语义/组件变量） | `var(--theme-surface-header)` | 沿用 | 沿用 |
| `--bg-card` | 普通卡片背景；仪表盘小卡片另有局部变量（兼容别名，优先修改对应语义/组件变量） | `var(--theme-surface-card)` | 沿用 | 沿用 |
| `--bg-input` | 输入框、选择框背景（兼容别名，优先修改对应语义/组件变量） | `var(--theme-surface-input)` | 沿用 | 沿用 |
| `--bg-table-header` | 次级内容区、日志表头和普通记录卡片的默认背景（兼容别名，优先修改对应语义/组件变量） | `var(--theme-surface-subtle)` | 沿用 | 沿用 |
| `--bg-table-hover` | 列表、控件悬停时的通用背景（兼容别名，优先修改对应语义/组件变量） | `var(--theme-surface-hover)` | 沿用 | 沿用 |
| `--bg-table-stripe` | 表格交替行背景，也参与顶部卡片的待机渐变（兼容别名，优先修改对应语义/组件变量） | `var(--theme-surface-striped)` | 沿用 | 沿用 |
| `--bg-hover` | 列表、控件悬停时的通用背景（兼容别名，优先修改对应语义/组件变量） | `var(--theme-surface-hover)` | 沿用 | 沿用 |
| `--bg-button-hover` | 通用按钮：悬停时 · 背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-button-hover-bg)` | 沿用 | 沿用 |
| `--text-button-hover` | 通用按钮：悬停时 · 文字颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-button-hover-text)` | 沿用 | 沿用 |
| `--bg-disabled` | 禁用控件背景（兼容别名，优先修改对应语义/组件变量） | `var(--theme-surface-disabled)` | 沿用 | 沿用 |
| `--bg-success-light` | 成功提示的浅背景（兼容别名，优先修改对应语义/组件变量） | `var(--theme-surface-success-soft)` | 沿用 | 沿用 |
| `--bg-warning-light` | 警告提示的浅背景（兼容别名，优先修改对应语义/组件变量） | `var(--theme-surface-warning-soft)` | 沿用 | 沿用 |
| `--bg-error-light` | 错误提示的浅背景（兼容别名，优先修改对应语义/组件变量） | `var(--theme-surface-danger-soft)` | 沿用 | 沿用 |
| `--bg-https-hint` | HTTPS 等提示区域的浅背景（兼容别名，优先修改对应语义/组件变量） | `var(--theme-surface-hint-soft)` | 沿用 | 沿用 |
| `--bg-primary-light` | 主色浅背景，供按钮悬停和选中区域使用（兼容别名，优先修改对应语义/组件变量） | `var(--theme-surface-accent-soft)` | 沿用 | 沿用 |
| `--text-primary` | 正文、标题、呼号等主要文字（兼容别名，优先修改对应语义/组件变量） | `var(--theme-text-primary)` | 沿用 | 沿用 |
| `--text-secondary` | 标签、次要内容文字（兼容别名，优先修改对应语义/组件变量） | `var(--theme-text-secondary)` | 沿用 | 沿用 |
| `--text-tertiary` | 时间、地址、说明等辅助文字（兼容别名，优先修改对应语义/组件变量） | `var(--theme-text-muted)` | 沿用 | 沿用 |
| `--text-disabled` | 不可操作或禁用内容的文字（兼容别名，优先修改对应语义/组件变量） | `var(--theme-text-disabled)` | 沿用 | 沿用 |
| `--text-white` | 主色按钮、徽标等有色背景上的反色文字（兼容别名，优先修改对应语义/组件变量） | `var(--theme-text-inverse)` | 沿用 | 沿用 |
| `--border-primary` | 输入控件和普通区域的默认边框（兼容别名，优先修改对应语义/组件变量） | `var(--theme-border-default)` | 沿用 | 沿用 |
| `--border-secondary` | 卡片、面板之间较轻的边框（兼容别名，优先修改对应语义/组件变量） | `var(--theme-border-subtle)` | 沿用 | 沿用 |
| `--border-light` | 页头分隔线、台站信息卡等浅边框（兼容别名，优先修改对应语义/组件变量） | `var(--theme-border-muted)` | 沿用 | 沿用 |
| `--border-table` | 表格等需要明显分隔的边框（兼容别名，优先修改对应语义/组件变量） | `var(--theme-border-strong)` | 沿用 | 沿用 |
| `--color-primary` | 按钮、链接、输入焦点等主要交互强调色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-accent-primary)` | 沿用 | 沿用 |
| `--color-primary-hover` | 主要交互元素悬停时的强调色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-accent-primary-hover)` | 沿用 | 沿用 |
| `--color-success` | 成功、在线和发言的基础语义色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-success)` | 沿用 | 沿用 |
| `--color-success-border` | 成功/发言提示区域：边框颜色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-success-panel-border)` | 沿用 | 沿用 |
| `--color-warning` | 警告和排名金色的基础语义色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-warning)` | 沿用 | 沿用 |
| `--color-warning-border` | 警告/老朋友提示区域：边框颜色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-warning-panel-border)` | 沿用 | 沿用 |
| `--color-danger` | 错误、危险操作的基础语义色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-danger)` | 沿用 | 沿用 |
| `--color-danger-hover` | 错误、危险操作的悬停色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-danger-hover)` | 沿用 | 沿用 |
| `--bg-friend-card` | 老朋友卡片：背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-old-friend-card-bg)` | 沿用 | 沿用 |
| `--border-friend-card` | 老朋友卡片：边框颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-old-friend-card-border)` | 沿用 | 沿用 |
| `--bg-today-card` | 今日卡片、台站选中项等高亮背景（兼容别名，优先修改对应语义/组件变量） | `var(--theme-current-highlight-bg)` | 沿用 | 沿用 |
| `--bg-today-row` | 今日表格行等较轻的高亮背景（兼容别名，优先修改对应语义/组件变量） | `var(--theme-current-highlight-bg-alt)` | 沿用 | 沿用 |
| `--bg-today-index` | 今日序号、选中标签等较强的高亮背景（兼容别名，优先修改对应语义/组件变量） | `var(--theme-current-highlight-bg-strong)` | 沿用 | 沿用 |
| `--bg-today-index-neutral` | 今日卡片、台站选中项等高亮背景（兼容别名，优先修改对应语义/组件变量） | `var(--theme-current-highlight-bg)` | 沿用 | 沿用 |
| `--border-today-row` | 今日记录行等较轻的高亮边框（兼容别名，优先修改对应语义/组件变量） | `var(--theme-current-highlight-border-soft)` | 沿用 | 沿用 |
| `--border-today-card` | 当前高亮卡片、导航等的边框（兼容别名，优先修改对应语义/组件变量） | `var(--theme-current-highlight-border)` | 沿用 | 沿用 |
| `--color-today-accent` | 导航选中、今日记录等当前高亮的强调文字与指示色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-current-highlight-accent)` | 沿用 | 沿用 |
| `--color-today-uncontacted` | 发言历史：未通联呼号 · 文字颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-speaking-history-uncontacted-text)` | 沿用 | 沿用 |
| `--bg-rank-1` | 排行榜：金牌颜色 · 背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-rank-gold-bg)` | 沿用 | 沿用 |
| `--bg-rank-2` | 排行榜：银牌颜色 · 背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-rank-silver-bg)` | 沿用 | 沿用 |
| `--bg-rank-3` | 排行榜：铜牌颜色 · 背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-rank-bronze-bg)` | 沿用 | 沿用 |
| `--bg-record-card` | 呼号记录弹窗内的记录卡片：背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-record-card-bg)` | 沿用 | 沿用 |
| `--border-record-card` | 呼号记录弹窗内的记录卡片：边框颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-record-card-border)` | 沿用 | 沿用 |
| `--shadow-card` | 普通卡片阴影的颜色，不含偏移和模糊尺寸（兼容别名，优先修改对应语义/组件变量） | `var(--theme-shadow-card)` | 沿用 | 沿用 |
| `--shadow-modal` | 弹窗阴影的颜色，不含偏移和模糊尺寸（兼容别名，优先修改对应语义/组件变量） | `var(--theme-shadow-modal)` | 沿用 | 沿用 |
| `--shadow-primary` | 主色焦点光晕的颜色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-shadow-focus-primary)` | 沿用 | 沿用 |
| `--shadow-primary-hover` | 主色悬停光晕的颜色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-shadow-focus-primary-hover)` | 沿用 | 沿用 |
| `--overlay-bg` | 弹窗：背景遮罩（兼容别名，优先修改对应语义/组件变量） | `var(--component-modal-backdrop)` | 沿用 | 沿用 |
| `--tooltip-bg` | 悬浮提示框背景（兼容别名，优先修改对应语义/组件变量） | `var(--theme-tooltip-bg)` | 沿用 | 沿用 |
| `--body-text-shadow` | 正文微弱文字阴影的完整值，包含尺寸和颜色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-text-shadow-subtle)` | 沿用 | 沿用 |
| `--texture-edge-fade` | 装饰纹理边缘的淡出颜色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-texture-edge-fade)` | 沿用 | 沿用 |
| `--texture-stripe` | 装饰条纹颜色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-texture-stripe)` | 沿用 | 沿用 |
| `--texture-mask-solid` | 纹理遮罩实心部分的颜色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-texture-mask-solid)` | 沿用 | 沿用 |
| `--tap-highlight-color` | 触摸点击时浏览器高亮颜色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-tap-highlight)` | 沿用 | 沿用 |
| `--app-edge-shadow` | 应用边缘阴影颜色（兼容别名，优先修改对应语义/组件变量） | `var(--theme-app-edge-shadow)` | 沿用 | 沿用 |
| `--close-btn-border` | 弹窗关闭按钮：边框颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-close-button-border)` | 沿用 | 沿用 |
| `--close-btn-color` | 弹窗关闭按钮：文字颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-close-button-text)` | 沿用 | 沿用 |
| `--close-btn-hover-bg` | 弹窗关闭按钮：悬停时 · 背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-close-button-hover-bg)` | 沿用 | 沿用 |
| `--close-btn-hover-border` | 弹窗关闭按钮：悬停时 · 边框颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-close-button-hover-border)` | 沿用 | 沿用 |
| `--close-btn-hover-color` | 弹窗关闭按钮：悬停时 · 文字颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-close-button-hover-text)` | 沿用 | 沿用 |
| `--status-primary-bg` | 通用主色状态提示：背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-primary-bg)` | 沿用 | 沿用 |
| `--status-primary-bg-soft` | 通用主色状态提示：浅背景（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-primary-bg-soft)` | 沿用 | 沿用 |
| `--status-primary-bg-strong` | 通用主色状态提示：较强背景（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-primary-bg-strong)` | 沿用 | 沿用 |
| `--status-primary-bg-active` | 通用主色状态提示：激活背景（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-primary-bg-active)` | 沿用 | 沿用 |
| `--status-primary-border` | 通用主色状态提示：边框颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-primary-border)` | 沿用 | 沿用 |
| `--status-primary-shadow` | 通用主色状态提示：阴影颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-primary-shadow)` | 沿用 | 沿用 |
| `--status-primary-text` | 通用主色状态提示：文字颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-primary-text)` | 沿用 | 沿用 |
| `--status-success-bg` | 通用成功/在线状态提示：背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-success-bg)` | 沿用 | 沿用 |
| `--status-success-bg-soft` | 通用成功/在线状态提示：浅背景（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-success-bg-soft)` | 沿用 | 沿用 |
| `--status-success-bg-strong` | 通用成功/在线状态提示：较强背景（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-success-bg-strong)` | 沿用 | 沿用 |
| `--status-success-bg-active` | 通用成功/在线状态提示：激活背景（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-success-bg-active)` | 沿用 | 沿用 |
| `--status-success-border` | 通用成功/在线状态提示：边框颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-success-border)` | 沿用 | 沿用 |
| `--status-success-text` | 通用成功/在线状态提示：文字颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-success-text)` | 沿用 | 沿用 |
| `--status-success-ring` | 通用成功/在线状态提示：外圈光晕颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-success-ring)` | 沿用 | 沿用 |
| `--color-speaking` | 正在发言提示条：强调文字（兼容别名，优先修改对应语义/组件变量） | `var(--component-speaking-bar-text-accent)` | 沿用 | 沿用 |
| `--bg-speaking-bar` | 正在发言提示条：背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-speaking-bar-bg)` | 沿用 | 沿用 |
| `--border-speaking-bar` | 正在发言提示条：边框颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-speaking-bar-border)` | 沿用 | 沿用 |
| `--bg-speaking-bar-hover` | 正在发言提示条：悬停时 · 背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-speaking-bar-hover-bg)` | 沿用 | 沿用 |
| `--status-warning-bg` | 通用警告状态提示：背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-warning-bg)` | 沿用 | 沿用 |
| `--status-warning-bg-soft` | 通用警告状态提示：浅背景（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-warning-bg-soft)` | 沿用 | 沿用 |
| `--status-warning-bg-active` | 通用警告状态提示：激活背景（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-warning-bg-active)` | 沿用 | 沿用 |
| `--status-warning-border` | 通用警告状态提示：边框颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-warning-border)` | 沿用 | 沿用 |
| `--status-warning-border-strong` | 通用警告状态提示：较强边框（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-warning-border-strong)` | 沿用 | 沿用 |
| `--status-warning-text` | 通用警告状态提示：文字颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-warning-text)` | 沿用 | 沿用 |
| `--status-warning-text-deep` | 通用警告状态提示：深色文字（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-warning-text-deep)` | 沿用 | 沿用 |
| `--status-warning-text-muted` | 通用警告状态提示：弱化文字（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-warning-text-muted)` | 沿用 | 沿用 |
| `--status-danger-bg` | 通用错误/危险状态提示：背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-danger-bg)` | 沿用 | 沿用 |
| `--status-danger-bg-soft` | 通用错误/危险状态提示：浅背景（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-danger-bg-soft)` | 沿用 | 沿用 |
| `--status-danger-border` | 通用错误/危险状态提示：边框颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-danger-border)` | 沿用 | 沿用 |
| `--status-danger-border-strong` | 通用错误/危险状态提示：较强边框（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-danger-border-strong)` | 沿用 | 沿用 |
| `--status-danger-ring` | 通用错误/危险状态提示：外圈光晕颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-danger-ring)` | 沿用 | 沿用 |
| `--status-danger-text` | 通用错误/危险状态提示：文字颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-danger-text)` | 沿用 | 沿用 |
| `--status-neutral-bg` | 通用中性状态提示：背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-neutral-bg)` | 沿用 | 沿用 |
| `--status-neutral-border` | 通用中性状态提示：边框颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-neutral-border)` | 沿用 | 沿用 |
| `--status-neutral-text` | 通用中性状态提示：文字颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-status-neutral-text)` | 沿用 | 沿用 |
| `--panel-info-bg` | 通用信息提示面板：背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-info-panel-bg)` | 沿用 | 沿用 |
| `--panel-info-bg-hover` | 通用信息提示面板：悬停背景（兼容别名，优先修改对应语义/组件变量） | `var(--component-info-panel-bg-hover)` | 沿用 | 沿用 |
| `--panel-info-border` | 通用信息提示面板：边框颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-info-panel-border)` | 沿用 | 沿用 |
| `--panel-info-border-soft` | 通用信息提示面板：较轻边框（兼容别名，优先修改对应语义/组件变量） | `var(--component-info-panel-border-soft)` | 沿用 | 沿用 |
| `--panel-info-text` | 通用信息提示面板：文字颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-info-panel-text)` | 沿用 | 沿用 |
| `--panel-info-accent` | 通用信息提示面板：强调颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-info-panel-accent)` | 沿用 | 沿用 |
| `--panel-error-bg` | 通用错误提示面板：背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-error-panel-bg)` | 沿用 | 沿用 |
| `--panel-error-border` | 通用错误提示面板：边框颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-error-panel-border)` | 沿用 | 沿用 |
| `--filter-panel-bg` | 筛选区域：面板 · 背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-filter-panel-bg)` | 沿用 | 沿用 |
| `--filter-panel-border` | 筛选区域：面板 · 边框颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-filter-panel-border)` | 沿用 | 沿用 |
| `--filter-control-bg` | 筛选区域：操作控件 · 背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-filter-control-bg)` | 沿用 | 沿用 |
| `--filter-control-border` | 筛选区域：操作控件 · 边框颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-filter-control-border)` | 沿用 | 沿用 |
| `--filter-control-hover-border` | 筛选区域：操作控件 · 悬停时 · 边框颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-filter-control-hover-border)` | 沿用 | 沿用 |
| `--filter-chip-bg` | 筛选区域：筛选标签 · 背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-filter-chip-bg)` | 沿用 | 沿用 |
| `--filter-chip-text` | 筛选区域：筛选标签 · 文字颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-filter-chip-text)` | 沿用 | 沿用 |
| `--filter-chip-hover-bg` | 筛选区域：筛选标签 · 悬停时 · 背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-filter-chip-hover-bg)` | 沿用 | 沿用 |
| `--filter-chip-hover-text` | 筛选区域：筛选标签 · 悬停时 · 文字颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-filter-chip-hover-text)` | 沿用 | 沿用 |
| `--filter-chip-active-bg` | 筛选区域：筛选标签 · 选中/激活时 · 背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-filter-chip-active-bg)` | 沿用 | 沿用 |
| `--filter-chip-active-text` | 筛选区域：筛选标签 · 选中/激活时 · 文字颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-filter-chip-active-text)` | 沿用 | 沿用 |
| `--modal-backdrop-soft` | 弹窗：较轻背景遮罩（兼容别名，优先修改对应语义/组件变量） | `var(--component-modal-backdrop-soft)` | 沿用 | 沿用 |
| `--modal-surface-shadow` | 弹窗：阴影颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-modal-shadow)` | 沿用 | 沿用 |
| `--modal-glass-highlight` | 弹窗：玻璃高光（兼容别名，优先修改对应语义/组件变量） | `var(--component-modal-glass-highlight)` | 沿用 | 沿用 |
| `--modal-glass-highlight-strong` | 弹窗：较强玻璃高光（兼容别名，优先修改对应语义/组件变量） | `var(--component-modal-glass-highlight-strong)` | 沿用 | 沿用 |
| `--badge-count-bg` | 徽标：计数 · 背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-badge-count-bg)` | 沿用 | 沿用 |
| `--badge-online-bg` | 徽标：在线状态 · 背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-badge-online-bg)` | 沿用 | 沿用 |
| `--badge-warning-bg` | 徽标：警告状态 · 背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-badge-warning-bg)` | 沿用 | 沿用 |
| `--rank-gold` | 排行榜：金牌颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-rank-gold)` | 沿用 | 沿用 |
| `--rank-silver` | 排行榜：银牌颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-rank-silver)` | 沿用 | 沿用 |
| `--rank-bronze` | 排行榜：铜牌颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-rank-bronze)` | 沿用 | 沿用 |
| `--rank-gold-muted` | 排行榜：金牌弱化色（兼容别名，优先修改对应语义/组件变量） | `var(--component-rank-gold-muted)` | 沿用 | 沿用 |
| `--rank-slate-muted` | 排行榜：灰蓝弱化色（兼容别名，优先修改对应语义/组件变量） | `var(--component-rank-slate-muted)` | 沿用 | 沿用 |
| `--rank-bronze-muted` | 排行榜：铜牌弱化色（兼容别名，优先修改对应语义/组件变量） | `var(--component-rank-bronze-muted)` | 沿用 | 沿用 |
| `--rank-dark-bg` | 排行榜：深色模式 · 背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-rank-dark-bg)` | 沿用 | 沿用 |
| `--rank-dark-border` | 排行榜：深色模式 · 边框颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-rank-dark-border)` | 沿用 | 沿用 |
| `--control-primary-bg` | 控制按钮：主操作 · 背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-control-primary-bg)` | 沿用 | 沿用 |
| `--control-primary-ring` | 控制按钮：主操作 · 外圈光晕颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-control-primary-ring)` | 沿用 | 沿用 |
| `--control-success-bg` | 控制按钮：成功状态 · 背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-control-success-bg)` | 沿用 | 沿用 |
| `--control-success-ring` | 控制按钮：成功状态 · 外圈光晕颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-control-success-ring)` | 沿用 | 沿用 |
| `--control-danger-bg` | 控制按钮：危险操作 · 背景颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-control-danger-bg)` | 沿用 | 沿用 |
| `--control-danger-ring` | 控制按钮：危险操作 · 外圈光晕颜色（兼容别名，优先修改对应语义/组件变量） | `var(--component-control-danger-ring)` | 沿用 | 沿用 |
