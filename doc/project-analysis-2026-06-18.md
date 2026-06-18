# FmoLogs 项目分析报告

分析日期：2026-06-18

## 项目概况

当前项目是一个 Vue 3 + Vite 前端应用，同时维护 Capacitor Android 原生能力和 Tauri 桌面端配置。业务核心集中在 FMO 日志导入、IndexedDB 持久化、WebSocket 同步、APRS 远程控制、音频播放、定位上报和主题配置等模块。

整体结构已经从早期 composable 薄层逐步迁移到 Pinia store 和 `src/platform` 平台抽象层，方向是清晰的。但项目处在 JS/TS 混合迁移状态，工程检查链路和测试覆盖还没有跟上，导致部分真实风险不容易被自动发现。

## 本次检查结果

已执行：

- `npm run typecheck`：通过。
- `npm run build`：通过。
- `npx eslint src --ext .js,.ts,.vue`：失败，报告 137 个问题，其中 119 个 error、18 个 warning。

构建观察：

- Vite 构建成功，但提示 `sql.js/dist/sql-wasm.js` 引入的 `fs`、`path`、`crypto` 被浏览器外部化。
- legacy 入口 chunk `index-legacy-*.js` 约 605 KB，超过 Vite 默认 500 KB 告警阈值。
- `sql-asm-*.js` 约 1.36 MB，作为 fallback 会显著增加产物体积。

## 主要问题

### 1. 通联日志去重键过粗，可能覆盖有效记录

位置：`src/services/db.js`

- `writeRecordsToStore` 用 `UTC 日期 + toCallsign` 生成 `dedupKey`。
- `isQsoExistsInIndexedDB` 也用同样规则判断记录是否存在。

相关代码：

- `src/services/db.js:631-635`
- `src/services/db.js:1138-1150`

影响：同一个 `fromCallsign` 在同一个 UTC 日期内，如果与同一个 `toCallsign` 有多次通联，后导入或同步的记录会覆盖前一条。这个风险会影响日志总数、排行榜、老朋友统计、导出数据和同步判断。

建议：优先确认 FMO 原始数据是否有稳定唯一键，例如 `logId`。如果有，应将 `dedupKey` 调整为 `fromCallsign + logId` 或 `fromCallsign + timestamp + toCallsign + relayName` 等更细粒度组合，并设计一次 IndexedDB 数据迁移。

### 2. ESLint 配置不可用，无法作为质量门禁

位置：

- `package.json:12`
- `eslint.config.js:1-37`

问题：

- `npm run lint` 当前是 `eslint . --fix`，默认会修改文件，不适合作为 CI 或人工检查命令。
- ESLint 配置只声明了 `**/*.{js,vue}`，没有配置 TypeScript parser，导致所有 `.ts` 文件解析失败。
- DOM 全局变量配置不完整，`TextEncoder`、`TextDecoder`、`fetch`、`FileReader`、`history`、`requestAnimationFrame`、`ResizeObserver` 等被报 `no-undef`。
- `eslint .` 只忽略了 `dist` 和 `node_modules`，没有明确限定 `src`、`scripts` 等范围，容易扫描 Android 构建产物或其他非前端源码。

建议：

- 拆分脚本：`lint` 用只检查模式，另加 `lint:fix`。
- 引入 `typescript-eslint`，为 `.ts` 配置 parser。
- 使用 `globals` 包或明确补齐 browser globals。
- 明确 ignores：`android/**/build/**`、`src-tauri/target/**`、`scripts/font-compression/dist/**` 等。

### 3. TypeScript 检查覆盖不足

位置：`tsconfig.json:6-22`

问题：

- `strict: false`。
- `allowJs: true` 但 `include` 没有包含 `src/**/*.js`。
- `checkJs: false`。
- 多处 `.ts` 文件通过 `@ts-ignore` 接入 legacy JS 模块。

影响：`npm run typecheck` 通过并不代表核心业务 JS 代码被检查。当前数据层、FMO API、部分 composable 和视图逻辑仍可能绕过类型检查。

建议：渐进处理，不建议一次性打开全部 strict。可以先把 `src/core`、`src/services`、`src/stores` 中高风险模块迁移到类型更完整的边界，再逐步开启局部严格规则。

### 4. 自动化测试基本缺失

位置：

- `package.json` 没有 test 脚本。
- Android 侧只有默认示例测试：`android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java` 和 `android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java`。

影响：当前最关键的数据导入、去重、同步、ADIF 解析、URL 规范化、APRS 编解码等逻辑缺少回归保护。

建议：优先补核心纯函数和数据层测试，例如：

- `src/services/db.js` 的去重与导入行为。
- `src/adif/adifParser.js` 的中文、编码和字段解析。
- `src/utils/urlUtils.js` 的地址、协议、路径规范化。
- `src/core/aprsCodec.ts`、`src/core/aprsPasscode.ts`。

### 5. FMO API 请求匹配不支持同类型并发

位置：`src/services/fmoApi.js:100-156`

问题：`pendingRequests` 的 key 是 `${type}:${subType}`。如果同一连接上同时发出两个相同类型请求，例如两个 `qso:getDetail`，后一个会覆盖前一个 pending resolver。

当前同步逻辑多数是串行请求，短期不一定触发。但这个 API 类本身没有防并发保护，后续 UI 或 store 复用时容易引入间歇性超时或响应错配。

建议：如果 FMO 协议支持 request id，应加 id；如果不支持，应在 `FmoApiClient` 内部按 key 排队，或显式禁止同 key 并发并返回清晰错误。

### 6. Android 更新链路需要强化信任边界

位置：

- `src/services/updateService.ts:114-144`
- `src/services/updateService.ts:211-214`
- `android/app/src/main/AndroidManifest.xml:93`

观察：

- APK 地址和 sha256 都来自同一个远程 manifest。
- `sha256` 是可选字段。
- manifest 本身没有看到签名校验或公钥校验。
- Android 声明了 `REQUEST_INSTALL_PACKAGES`。

影响：如果 manifest URL、CDN、DNS 或传输链路被攻击，仅校验同源 manifest 提供的 sha256 不能证明 APK 可信。

建议：至少将 sha256 设为必填；更稳妥的是对 manifest 做签名校验，或将公钥/签名验证逻辑内置在客户端。

### 7. Android 明文网络权限范围较大

位置：

- `android/app/src/main/AndroidManifest.xml:11-12`
- `android/app/src/main/res/xml/network_security_config.xml:2-9`

观察：应用级启用了 `usesCleartextTraffic="true"`，`base-config` 也允许 cleartext。考虑到 FMO 局域网设备可能只支持 HTTP/WS，这可能是业务需要，但当前是全局放开。

建议：如果可行，将明文网络限制到局域网或明确域名；如果必须全局放开，应在文档中说明原因，并在远程更新、主题下载等非局域网能力上强制 HTTPS。

### 8. `v-html` 和远程主题属于可控但需要边界说明的风险

位置：

- `src/views/FriendLinksView.vue:18-20`
- `src/components/home/modals/friendLinks.js:57-69`
- `src/views/ThemeSettingsView.vue:553-595`
- `src/utils/themeManager.ts:33-37`

观察：

- `v-html` 当前渲染的是本地静态 SVG 字符串，短期风险较低。
- 远程主题允许用户输入 HTTP/HTTPS URL，下载 CSS 后直接注入 `<style>`。

建议：

- 友链 SVG 如果未来变成远程配置，必须改为白名单图标组件或 SVG sanitizer。
- 远程主题建议强制 HTTPS，提示“仅导入可信 CSS”；必要时限制 `@import` 和外部资源加载。

### 9. README 与当前代码结构不一致

位置：`README.md:131-170`

示例：

- README 仍列出 `DetailModal.vue`、`SettingsModal.vue`，当前源码中不存在。
- README 仍列出 `useFmoSync.js`、`useSettings.js`，当前已迁移到 store，项目内 `doc/platform-abstraction-refactor.md` 也说明这些薄层已删除。

影响：新贡献者会按过期结构查找文件，维护成本上升。

建议：更新 README 的项目结构章节，改成当前 `stores`、`platform`、`core/sync`、`views` 的真实结构。

## 建议处理顺序

1. 修复日志去重键，并准备 IndexedDB 迁移方案。
2. 修复 ESLint 配置和 `lint` 脚本，让它能稳定作为质量门禁。
3. 给数据导入、同步去重、ADIF 解析、URL 工具补最小测试集。
4. 处理 Android 更新链路的 sha256 必填和 manifest 签名校验。
5. 优化构建体积：路由级动态 import，评估 sql.js wasm/asm fallback 策略。
6. 更新 README，移除过期文件结构描述。

## 结论

项目主体能通过类型检查和生产构建，说明当前可运行性还可以。真正需要优先处理的是数据正确性和工程门禁：去重键过粗可能直接影响用户日志数据，ESLint/测试链路不完整会让类似问题持续漏检。建议先把数据层行为锁住，再整理检查工具和文档。
