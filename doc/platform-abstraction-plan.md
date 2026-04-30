# 平台抽象层实施计划

> 目标：将 FmoLogs 现有"JS + Android 原生双套实现"整理为统一抽象层，业务层不再出现 `Capacitor.getPlatform() === 'android'` 硬判，后续新增平台只需实现接口。
>
> **平台策略明确**：
> - **Web（浏览器）**：Web 实现
> - **Android**：Capacitor Android 原生实现
> - **Tauri 桌面端（macOS / Windows / Linux）**：沿用 Web 实现，不做原生插件
> - **Tauri Android / Tauri iOS**：**不做**，移动端完全交给 Capacitor Android；iOS 暂不支持
>
> 配套分支：`feature/platform-abstraction`（基于 `feature/tauri` 创建）
>
> **语言策略**：
> - `src/platform/**` 全部用 **TypeScript** 编写（接口契约 + Web / Capacitor 实现 + utils）
> - 业务层（`views/` `components/` `composables/` 及旧 `services/*`）**保持 JavaScript**，本次不迁
> - Vite 7 原生支持 `.ts`，无需额外 loader；类型检查按需手动 `vue-tsc --noEmit`，**不进 CI 强校验**
> - `tsconfig.json` 起步配置：`strict: false` + `allowJs: true`，避免对业务层 JS 造成阻塞
>
> 原则：**行为零变更**。本次重构不引入新功能，只做分层与迁移；每个任务做完都要能直接替换掉旧调用，旧文件逐步下线。

---

## 0. 范围与不做的事

### 会做
- 新建 `src/platform/` 目录，内含接口定义、能力探测、工厂入口和 Web / Capacitor-Android 两套实现
- 业务层（composables、views、services）逐步改为只依赖 `createPlatformServices()`
- 下线或退化 `fmoNativeAudio.js` / `fmoNativeEvents.js` / `fmoNativeGrid.js` / `fmoNativeAprs.js` 这几个薄桥，统一收敛到 `platform/native-capacitor/`

### 不会做
- 不改任何 Android 插件的内部实现（`FmoAudioPlugin` / `FmoEventsPlugin` / `FmoGridPlugin` / `FmoAprsPlugin` / `GridAddressResolver` 保持现状）
- 不新增 iOS 原生代码
- 不为 Tauri 桌面端做原生插件（沿用 Web 实现，capability 全 false）
- **不支持 Tauri 移动端**（Android/iOS 不走 Tauri 路线，无需预留目录）
- 不迁移 ADIF / SQLite 导出的算法（属于纯函数，只换下游 I/O，随 utils 一并迁到 TS）
- 不迁移业务层到 TS（`views/` / `components/` / `composables/` / 旧 `services/*.js` 保持 JS）
- 不开启 TS 严格模式（`strict:false` 起步，后续按需收紧）
- 不把 `vue-tsc` 接入 `npm run build` 或 CI 作为阻断项（仅作为可选本地校验）

---

## 1. 目录规划

```
tsconfig.json              # 仓库根新增，仅覆盖 src/platform/**
src/platform/
  types.ts                 # 公共类型：PlatformId / ListenerHandle / Listener<T> / Capabilities
  capabilities.ts          # 能力探测，导出 detectCapabilities()
  index.ts                 # createPlatformServices() 工厂入口；导出 PlatformServices 类型
  interfaces/              # 接口契约（纯 TS type / interface，无运行时代码）
    IKvStore.ts
    ILogsRepository.ts
    IEventConnection.ts
    IRpcClient.ts
    IAudioStream.ts
    IGridResolver.ts
    IAprsTransport.ts
    IHttpClient.ts
    IFileSystem.ts
    IKeepAlive.ts
    INowPlaying.ts
    IPermission.ts
  web/                     # Web 实现（同时服务 Tauri 桌面）
    kvStore.ts
    logsRepository.ts      # 迁移自 services/db.js
    eventConnection.ts     # 迁移自 useSpeakingStatus.js 的 WebSocket 部分
    rpcClient.ts           # 迁移自 services/fmoApi.js
    audioStream.ts         # 迁移自 services/audioPlayer.js
    gridResolver.ts        # 迁移自 services/gridService.js
    aprsTransport.ts       # WebSocket 中转实现
    httpClient.ts          # fetch
    fileSystem.ts          # <a download>
    keepAlive.ts           # no-op（可选：navigator.wakeLock 保留为 Web 专属）
    nowPlaying.ts          # no-op
    permission.ts          # no-op
  native-capacitor/        # Capacitor Android 实现（项目唯一移动端原生方案）
    kvStore.ts             # @capacitor/preferences
    logsRepository.ts      # 阶段 2 再实现（Room 插件），阶段 1 先复用 Web
    eventConnection.ts     # 封装 FmoEvents 插件
    rpcClient.ts           # 阶段 2 再考虑原生化，阶段 1 先复用 Web
    audioStream.ts         # 封装 FmoAudio 插件
    gridResolver.ts        # 封装 FmoGrid 插件
    aprsTransport.ts       # 封装 FmoAprs 插件
    httpClient.ts          # CapacitorHttp
    fileSystem.ts          # Capacitor Filesystem + Share
    keepAlive.ts           # 由原生插件自管理，此处 no-op
    nowPlaying.ts          # 由 FmoEventsPlugin 自动驱动，此处 no-op
    permission.ts          # @capacitor/app + Android 运行时权限
  utils/                   # 平台无关的纯函数
    aprsCodec.ts           # 迁移自 useAprsControl.js 的签名/打包逻辑
    audioGain.ts           # percentToGain
    gridValidator.ts       # validateGrid
    adifFormatter.ts       # 迁移自 services/db.js 的 ADIF 导出算法
    sqliteExporter.ts      # 迁移自 services/db.js 的 SQLite 导出算法
```

> **业务层 JS 如何享受 TS 类型？**  
> Vite 构建时自动解析 `.ts`；编辑器（Volar / TS Plugin）对 `.js` 文件也会根据 `tsconfig.json` 的 `allowJs: true + checkJs: false` 读取 `src/platform/**` 的类型，实现 `import { createPlatformServices } from '@/platform'` 自动补全、跳转定义。

---

## 2. 任务拆分与依赖

> 每个任务对应一次独立提交，便于回滚。验收方式：跑 `npm run dev` 和一次 Android 打包，行为与旧版一致。

### 阶段 A：骨架（无迁移，行为 0 变更）

**任务 A0：初始化 TypeScript 环境（仅覆盖抽象层）**
- 根目录新增 `tsconfig.json`：
  ```jsonc
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "ESNext",
      "moduleResolution": "Bundler",
      "strict": false,
      "allowJs": true,
      "checkJs": false,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "noEmit": true,
      "jsx": "preserve",
      "types": ["vite/client"],
      "baseUrl": ".",
      "paths": { "@/*": ["src/*"] }
    },
    "include": ["src/platform/**/*", "src/**/*.d.ts"]
  }
  ```
- 新增 `npm run typecheck` 脚本：`vue-tsc --noEmit -p tsconfig.json`（**仅作为可选手动校验**，不进 CI、不接 `npm run build`）
- `devDependencies` 补 `typescript` 与 `vue-tsc`
- ESLint 保持现状；若后续想对 `.ts` 生效再引入 `typescript-eslint`，本阶段不做
- 业务层 JS **不需要**任何改动（Vite 自动共存 `.js` + `.ts`）
- **验收**：`npm run build` 通过；`npm run typecheck` 可运行（初期无 TS 文件时无报错）

**任务 A1：建立 platform 目录骨架**
- 新建上述全部 `.ts` 文件，`interfaces/*.ts` 内只写 `interface` / `type` / 事件载荷判别联合（discriminated union），**不含运行时代码**
- `types.ts` 落地：`PlatformId` / `ListenerHandle` / `Listener<T>` / `Capabilities` 等公共类型
- 各 Web / native-capacitor 实现文件先写成 `throw new Error('not impl')` 占位（带类型签名即可）
- 新增 `capabilities.js`：
  ```js
  export function detectCapabilities() {
    const isCap = Capacitor.isNativePlatform()
    const isTauri = !!window.__TAURI_INTERNALS__ || !!window.__TAURI__
    const platform = isCap
      ? Capacitor.getPlatform()  // 'android' | 'ios'（ios 实际不会出现）
      : (isTauri ? 'tauri-desktop' : 'web')
    const isAndroid = isCap && platform === 'android'
    // Tauri 桌面端完全走 Web 实现分支，capability 全为 false
    return {
      platform,
      hasNativeEvents: isAndroid,
      hasNativeAudio: isAndroid,
      hasNativeGrid: isAndroid,
      hasNativeAprs: isAndroid,
      hasNativeRpc: false,
      hasNativeLogsDB: false,
      hasNativeHttp: isCap,
      hasNativeShare: isCap,
      hasKeepAlive: isAndroid,
      hasMediaNotification: isAndroid
    }
  }
  ```
- 新增 `index.js`：导出 `createPlatformServices()`，但初版内部全部返回 null，只暴露 capabilities
- **验收**：业务层尚未改动，`npm run build` 通过

**任务 A2：把纯函数迁入 utils（直接写成 TS）**
- `aprsCodec.ts` ← `useAprsControl.js`（parseCallsignSsid / calcSignature / buildAPRSPacket）
- `audioGain.ts` ← `useAudioPlayer.js`（percentToGain）
- `gridValidator.ts` ← `gridService.js`（validateGrid）
- `adifFormatter.ts` / `sqliteExporter.ts` ← `services/db.js` 的导出相关函数
- 旧 JS 文件 re-export 保持向后兼容（`export * from '@/platform/utils/xxx'`），**业务代码暂不改**
- **验收**：全量功能回归一遍；编辑器里业务 JS 能看到从 `utils/*.ts` 导出的类型

---

### 阶段 B：Web 实现 + 业务层迁移（一次一个能力）

原则：**每个能力完成一次完整闭环**（接口契约 → Web 实现 → Android 实现 → 业务层替换 → 删旧薄桥）。

**任务 B1：KV 存储 IKvStore**
- Web 实现：localStorage 适配（保持同步语义但接口返回 Promise）
- Android 实现：`@capacitor/preferences`
- 迁移点：
  - `useSettings.js` 的 `audioVolume` / `audioPlaying` / `fmo_aprs_params` / `fmo_aprs_history` / `fmo_aprs_server_list`
  - `useSpeakingStatus.js` 的 `loadSpeakingHistoryFromStorage` / `saveSpeakingHistoryToStorage`
- 关键决策：原生侧 `FmoEventsPlugin` 自己用 SharedPreferences 存发言历史，**这条链路不动**，只把 JS 侧的 localStorage 读写换成 IKvStore
- **验收**：切 Android，发言历史在 App 重启后仍存在

**任务 B2：Grid 解析 IGridResolver**
- Web 实现：迁移 `services/gridService.js` 全量
- Android 实现：封装 `FmoGrid` 插件调用
- 迁移点：替换 `gridService.js` 的所有 import（`useSpeakingStatus.js` 等）
- 下线：`services/fmoNativeGrid.js`
- **验收**：Grid → 地址在 Web 和 Android 下均命中三级缓存

**任务 B3：音频流 IAudioStream**
- Web 实现：包装 `AudioStreamPlayer`（保留滤波/EQ 作为实现细节）
- Android 实现：包装 `FmoAudio` 插件（status / muteChanged 事件透传）
- 迁移点：重写 `composables/useAudioPlayer.js`：
  - 删除所有 `isAndroid` 分支
  - 删除 `BackgroundMode` 相关代码（保活归原生，已在原生前台服务中完成）
  - 删除 `navigator.wakeLock`（同上，Web 端若仍想保持屏幕常亮可放入 `web/keepAlive.js`，默认关闭）
  - `visibilitychange` 仅保留"AudioContext resume"语义，由 web 实现自持有
- 下线：`services/fmoNativeAudio.js`
- **验收**：Web 端音频播放正常；Android 息屏/切后台不中断

**任务 B4：Events 连接 IEventConnection**
- Web 实现：迁移 `createEventWsConnection` 及相关逻辑（重连 / serverInfo 轮询均在这里做）
- Android 实现：封装 `FmoEvents` 插件
- 迁移点：重写 `composables/useSpeakingStatus.js`：
  - 删除 `isAndroid` 分支
  - `handleEventMessage` 作为回调传给 `services.events.on('message', ...)`
  - `getSnapshot` 在 `visibilitychange=visible` 时调用，Web 实现直接返回空快照
- 下线：`services/fmoNativeEvents.js`
- **验收**：主地址 + 多地址均正常；Android WebView 冻结恢复后状态一致

**任务 B5：RPC 客户端 IRpcClient**
- Web 实现：迁移 `services/fmoApi.js`
- Android 实现：阶段 1 直接复用 Web 实现（`hasNativeRpc=false`）
- 迁移点：`useSettings.js` / `useFmoSync.js` / 其它 `new FmoApiClient(...)` 改为 `services.rpc.create(...)`
- **验收**：同步日志、切换 station 等功能正常

**任务 B6：APRS 传输层 IAprsTransport**
- Web 实现：WebSocket 中转（从 `useAprsControl.js` 抽离连接逻辑）
- Android 实现：封装 `FmoAprs` 插件
- 迁移点：`useAprsControl.js` 调用 `services.aprs.sendCommand(...)`，内部根据 `hasNativeAprs` 自动选路
- 下线：`services/fmoNativeAprs.js`
- **验收**：Web 端走中转正常，Android 端走 TCP 直连正常

**任务 B7：HTTP / FileSystem**
- `IHttpClient`：Web fetch / Android CapacitorHttp
- `IFileSystem`：Web `<a download>` / Android Filesystem + Share
- 迁移点：
  - `useSettings.backupLogs` 改用 `services.http.download` + `services.fs.save` + `services.fs.share`
  - `services/db.js` 的 `exportDataToDbFile` / `exportDataToAdif` 改为返回二进制，再由调用方走 `services.fs`
  - `utils/exportFile.js` 下线
- **验收**：导出 / 备份在 Web / Android 下均可保存，Android 可分享

**任务 B8：权限 / 保活 / NowPlaying**
- 三个接口 Web 全部 no-op
- Android 权限包装现有 `ensureNotificationPermission` 到 `IPermission`
- `IKeepAlive` / `INowPlaying` 在 Android 下也是 no-op（由原生插件内部自管）；预留接口是为未来 Tauri Android 用
- **验收**：无行为变化

---

### 阶段 C：日志数据库原生化（可选，独立 PR）

**任务 C1：ILogsRepository 的 Android 原生实现**
- 新增 `FmoLogsPlugin.java`，用 Room 管理 QSO 表
- 迁移点：`services/db.js` 的 IndexedDB 读写在 Android 下切换到原生
- 注意：导出（ADIF / SQLite）继续在 JS 侧走 `utils/adifFormatter.js` + `utils/sqliteExporter.js`，原生只负责 CRUD
- **风险**：存量用户 IndexedDB 数据迁移。方案：首次启动时原生读 IndexedDB（通过 JS 桥）→ 批量 import 到 Room → 设置迁移完成标志
- 这个任务复杂度高，**与阶段 B 解耦，可单独开 PR**

---

### 阶段 D：清理

**任务 D1：删除废弃文件**
- `services/fmoNativeAudio.js`、`fmoNativeEvents.js`、`fmoNativeGrid.js`、`fmoNativeAprs.js`
- `services/audioPlayer.js`、`gridService.js`、`fmoApi.js`（确认所有引用已迁走后）
- `utils/exportFile.js`

**任务 D2：全局搜索 `Capacitor.getPlatform`**
- 除 `capabilities.js` 外应无剩余
- 除 `capabilities.js` 外应无 `Capacitor.isNativePlatform()` 调用

**任务 D3：文档**
- 更新 `README.md`：新增"平台抽象层"一节，说明如何实现一个新平台
- `doc/` 下新增 `platform-interfaces.md`：接口契约的最终版

---

## 3. 风险与对策

| 风险 | 对策 |
|---|---|
| 迁移中途某个接口漏考虑业务场景 | 每个阶段 B 任务完成后在 Web / Android 真机各回归一次核心流程（连接 / 播放 / 发言 / 同步 / 导出） |
| 发言历史两份存储（原生 SharedPrefs + JS localStorage）在迁移中错位 | B1 只动 JS 侧读写入口，原生 `FmoEventsPlugin` 的 SharedPreferences 完全不改；IKvStore 的 key 命名保留历史值 |
| `useAudioPlayer` 删 BackgroundMode 后 Web 端音频被息屏打断 | Web 端实现可选保留 `navigator.wakeLock`，只是不再跨平台共享逻辑；Android 端由原生前台服务 + PARTIAL_WAKE_LOCK 接管（已完成） |
| 迁移期间 Web 和 Android 行为分叉 | 每个任务在 PR 里同时提交两端实现，评审时对着接口契约检查 |
| Tauri 桌面端构建可能受路径调整影响 | 路径调整只发生在 `src/platform/`，与 Tauri Rust 侧无关；阶段 B 合入后跑一次 `tauri-build.yml` workflow 验证三端构建 |
| TS 类型偶发编辑器报错阻碍开发 | `strict:false` + `allowJs:true` 宽松起步；`vue-tsc` 只手动跑不进 CI；疑难类型允许 `// @ts-expect-error` 留 TODO |
| 业务层 JS 调用 TS 时类型丢失 | `index.ts` 统一导出 `PlatformServices` 具名类型；业务层需要时用 JSDoc `@type {import('@/platform').PlatformServices}` 接住 |

---

## 4. 验收清单

最终验收要满足的硬性条件：

- [ ] 除 `src/platform/capabilities.js` 外，**全局搜索不到** `Capacitor.getPlatform` 和 `Capacitor.isNativePlatform`
- [ ] 除 `src/platform/web/*` 外，**全局搜索不到** 直接的 `new WebSocket`、`localStorage`、`indexedDB`、`fetch`、`navigator.wakeLock`、`document.createElement('a')` 用于下载
- [ ] `services/fmoNative*.js` 全部删除
- [ ] Android 端：发言历史 / 音频 / Grid / APRS / 导出 / 同步 全部功能正常
- [ ] Web 端：以上全部功能正常
- [ ] Tauri 桌面端（macOS/Windows/Linux）：以上全部功能正常（沿用 Web 实现，无需原生插件）
- [ ] 新增平台只需写 `src/platform/native-xxx/*.ts` 和一个 capability 分支
- [ ] `src/platform/` 下 **无 `.js` 源文件**（`.d.ts` 可选）
- [ ] `tsconfig.json` 已落地，`npm run typecheck`（`vue-tsc --noEmit`）通过
- [ ] 业务层 JS 导入 `@/platform` 时 IDE 自动补全、跳转定义可用

---

## 5. 分支建议

```bash
# 基于 feature/tauri 创建开发分支
git checkout feature/tauri
git pull --rebase      # 如有远端更新
git checkout -b feature/platform-abstraction
```

- 阶段 A + B 全部在 `feature/platform-abstraction` 上推进。
- 阶段 C（原生 DB）建议新开 `feature/native-logs-db`，从 `feature/platform-abstraction` 切出。
- 阶段 D 清理合到 `feature/platform-abstraction` 末尾统一处理，再整体合回主线。

---

## 6. 本文档关联的接口草案

参见上一轮对话中的接口 TS 定义草案（每个接口的具体方法签名、参数、事件约定）。实施时直接落成 `src/platform/interfaces/*.ts` 的 TypeScript `interface` / `type` 定义，无需再做 JSDoc 翻译。
