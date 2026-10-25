# 淋语翻译器网页端开发计划书

> 版本 v1.0 · 2026-10-25 · 基于仓库现状（v1.18.0，Electron + Capacitor + 微信小程序三端已交付）

---

## 一、项目定位

网页端是淋语翻译器的**第四端**。做完之后，同一个翻译引擎将跑在四种形态上：

| 端 | 形态 | 分发 | 数据落点 |
|---|---|---|---|
| PC 桌面 | Electron exe | Gitee 发行版附件 | `%APPDATA%\linyu-translator\linyu.db` |
| Android | Capacitor APK | APK 分发 | App 私有目录 `linyu.db` |
| 微信小程序 | 原生 WXML | 微信平台 | `wx.storage` |
| **网页（本计划书）** | **静态站** | **URL 直达** | **IndexedDB** |

三句话定位：

1. **UI 向 PC 桌面端靠拢**——直接复用 `src/renderer/` 的顶栏、七个 tab、三套主题，网页版要长得像自家产品，不是另一个网站。
2. **引擎零改动**——`src/core/` 五个模块（translator / tokenizer / db / service / auth）已经是「Node require / 浏览器 window 全局」双模式，网页端只补一个 IndexedDB 文件适配器。
3. **纯静态、纯本地**——翻译在前端毫秒级完成，无服务端、无账号、无翻译网络请求。部署成本为零，输入内容永不上传。

### 为什么值得做（简历视角）

「一套引擎，四端交付」是跨端架构能力的直接证明：三端共用的业务规则只写一份（`service.js`），每端只留平台特有的一半。网页端补上后，README 的技术故事从「跨端」升级为「一套语料 + 一套引擎 + 四种宿主环境的适配层设计」——这正是前端面试里「如何做多端复用」的满分答案，且有真实代码可看。上线后可挂进在线作品集，面试官点开链接即用。

---

## 二、现状盘点：已有资产可复用度

| 资产 | 规模 | 网页端可复用度 | 说明 |
|---|---|---|---|
| `src/core/translator.js` | 214 行 | **100%** | 纯函数，无平台依赖 |
| `src/core/tokenizer.js` | 67 行 | **100%** | 同上 |
| `src/core/db.js` | 1508 行 | **~98%** | 已有浏览器分支（window 全局注入），只吃 fsAdapter 接口 |
| `src/core/service.js` | 347 行 | **100%** | 门禁/撤销/导入暂存/登录锁定全在此 |
| `src/core/auth.js` | 142 行 | **100%** | scrypt-js 本身就是浏览器库 |
| `src/mobile/fsAdapter.js` | 259 行 | **接口可抄** | 需新增 IndexedDB 后端（第三种 adapter） |
| `src/mobile/entry.js` | 216 行 | **~90%** | 浏览器初始化链已写好（api 占位 Proxy / 播种 / 补种） |
| `src/renderer/*`（Vue 3 UI） | 715 行 HTML + 1359 行 JS + 36KB CSS | **~85%** | 顶栏/七页/弹窗/三主题全复用，需微调平台差异 |
| `www/` 构建产物 | 14MB | **管线可抄** | `build-mobile.mjs` 的 IIFE 包裹 + checkBundle 闸门直接复制 |
| `scripts/serve-www.js` | 调试服务器 | **~80%** | 已能在无 Capacitor 环境跑通全链路 |
| 内容数据 | 词库 1178 / 句式 350 / 词卡 794 / 人物传 207 / 名言 2078 | **100%** | `seed.json` 483KB + `lore*.js` ~1.4MB |
| 人物图 | 原图 234 张 9.9MB + 缩略图 233 张 2.4MB | **100%** | HTTP 天然按需加载，列表用 thumb |

**结论：网页端不是重写，是「补齐最后一层适配」。** 最大的缺口只有一个——持久化。

### 唯一的硬缺口：浏览器兜底 fsAdapter 是会话级的

`entry.js` 在非 Capacitor 浏览器环境用的兜底是 **sessionStorage**（刷新即丢库）。Capacitor 分支走 `@capacitor/filesystem`，网页上没有。所以 P0 工作就是给 fsAdapter 家族加第三个成员：**IndexedDB 后端**。其余全部是收尾、优化和 Web 特有功能。

---

## 三、核心技术决策（分级推荐）

### 决策 1：架构路线

| 级别 | 方案 | 说明 |
|---|---|---|
| **推荐** | **A：零构建静态站**——复用 `www/` 管线（IIFE 包裹 + 无 bundler），新增 `src/web/` 适配层 + `build-web.mjs` | 与现有三端共享 100% 引擎代码；`npm run test:web` 套用 `weapp.test.js` 的产物校验模式；维护成本最低。Vue 完整版含模板编译器，现有 CSP（`unsafe-eval`）照用 |
| 备选 | C：只读轻量版——预生成 JSON 索引 + 翻译引擎，砍掉 sql.js | 首屏从 ~2.3MB 降到 ~700KB，但丢开发者模式与五板块 CRUD，且多出一条「JSON↔SQLite」数据同步链路，违背「业务规则只写一份」 |
| 不推荐 | B：Vite + Vue SFC 重写渲染层 | 等于养第三个前端，`app.js` 1359 行的移植是纯成本；除非未来要做 SSR/SEO 站，现阶段不做 |

**选 A 的理由**：本项目的架构品味是「适配层薄、核心零分叉」。A 完全顺着走；B 会把渲染层也分叉成两份，每次改 UI 都要改两处——这是 `service.js` 注释里明确反对的事。

### 决策 2：库持久化落点

| 级别 | 方案 | 说明 |
|---|---|---|
| **推荐** | **IndexedDB 单 key 存整库**（`linyu.db` 存为 Blob） | `db.js` 的模型本来就是「内存库 + persist 时整体落盘」（先写 `.tmp` 再 rename），单 key 整存整取与它天然吻合，不需要分块；`media/` 目录另开 objectStore 存上传图 |
| 备选 | OPFS（Origin Private File System） | 更像文件系统，但 Safari 旧版兼容性差，且现有 rename/copy 语义要重做，收益不大 |
| 兜底 | sessionStorage（现状） | 仅在隐私模式等 IndexedDB 不可用时启用，**必须**在界面上提示「当前为临时会话，刷新后数据不保留」 |

### 决策 3：Web 端「开发者模式」的语义

PC/Android 上，开发者模式编辑的是本机库。网页上每个浏览器有自己独立的 IndexedDB 副本，所以：

- **保留**登录门禁（`linyu` / `linyu130`），定位改为「编辑我这份浏览器副本」；
- 增删改只影响本机 IndexedDB，**不可能**影响别人——这不是安全边界，和桌面端一样是防误改门禁；
- 导入/导出从「文件对话框」改为「浏览器下载 linyu.db / 文件选择器上传」，走同一套 `service.js` 导入暂存逻辑；
- 人物图上传：开发者本地上传 → 存 `media/` objectStore → 走现有 `media:` 引用机制，不需要改 db.js。

### 决策 4：CSP 与 `unsafe-eval`

现状：Vue 完整版（`vue.global.prod.js`）挂载 DOM 模板需要 `new Function`，`index.html` 的 CSP 必须带 `'unsafe-eval'`（1.15.0 收紧翻车的教训已在注释里写明）。

| 级别 | 方案 |
|---|---|
| **推荐（本期）** | CSP 原样保留，在 README 记录已知取舍。站点无后端、无用户输入渲染进 innerHTML 的路径，风险可控 |
| 后续可选（M4+） | 换 Vue runtime-only + 预编译模板（需要引入一次构建步骤，`app.js` 模板改 SFC 或 render 函数），CSP 可收紧到 `wasm-unsafe-eval` |

---

## 四、首屏体积预算与加载策略

| 资源 | 原始 | gzip 估算 | 策略 |
|---|---|---|---|
| `index.html` + `style.css` + `app.js` | ~125KB | ~35KB | 关键路径 |
| `vendor/vue.global.prod.js` | 170KB | ~60KB | 关键路径 |
| `seed-data.js`（483KB） | 483KB | ~120KB | 关键路径（entry.js 已内联优先） |
| `core/lore*.js` 聚合 | ~1.4MB | ~350KB | 关键路径（五板块浏览全靠它） |
| `core/db.js` + `service.js` 等核心 | ~100KB | ~30KB | 关键路径 |
| `vendor/sql-wasm.js` + `sql-wasm.wasm` | ~730KB | ~250KB | 关键路径（M1 全量加载；M3 评估延后预热） |
| 人物图原图 9.9MB | — | — | **不进关键路径**：列表用 thumb（2.4MB 分摊 233 张），详情按需加载原图，`loading="lazy"` + 强缓存 |
| **首屏合计** | **~2.9MB** | **~850KB** | 3G 网络 3 秒内可交互，达标后不再过度优化 |

服务端开启 gzip/brotli + 长缓存（带内容指纹的文件名）即可。Service Worker（M3）把 vendor/core/img 全量缓存后，二次访问近乎秒开，且**断网完全可用**——引擎本来就是纯本地的。

---

## 五、UI 规格：向 PC 桌面端靠拢

### 5.1 忠实复刻的部分（不改视觉语言）

| PC 端元素 | 网页端处理 |
|---|---|
| 顶栏（brand 渐变字 + 七个 tab 胶囊 + 统计条 + 模式 chip + ⚙） | 原样复用；横屏/宽屏下与 PC 完全一致 |
| 三套主题（纯白 / 黑 / 粉紫）+ CSS 变量体系 | 原样复用；新增「跟随系统」选项（`prefers-color-scheme` 映射到黑/白，粉紫仍手动） |
| 翻译页：lang-bar「中文 ➜ 淋语」+ 左输入右输出双 panel + 试试 chips + 「翻 译 ♥」 | 宽度 ≥1024px 时与 PC 双栏一致 |
| 词库/句式/词卡/人物传/名言 manage-page：搜索框 + 筛选 chips + 表格 + 分页 | 宽屏原样 |
| 设置弹窗（主题、开发者登录、导入导出、清理） | 原样复用 modal |
| 快捷键：Ctrl+Enter 翻译、Ctrl+F 搜索、Ctrl+, 设置 | 原样保留（网页上再加 `/` 聚焦搜索） |

### 5.2 响应式降级（窄屏 = 参考已有移动适配）

`style.css` 里 `body[data-mobile]` 已有一套横竖屏规则（表格卡片堆叠、panel 纵向堆叠、热区放大），网页端直接继承这套思路：

| 断点 | 处理 |
|---|---|
| ≥1024px | PC 布局原样（双栏翻译、宽表格） |
| 768–1023px | 双 panel 纵向堆叠；表格隐藏次要列，点击行展开详情 |
| <768px | 顶栏 tab 收进下拉/抽屉；manage-page 表格→卡片堆叠（照抄 data-mobile 规则）；翻译页上下两栏 |

### 5.3 Web 端新增（PC 端没有、网页特有的）

| 功能 | 设计 |
|---|---|
| **Hash 路由** | `#/translate`、`#/words`、`#/heroes/12`（人物详情可直链）；浏览器前进/后退可用；`switchView()` 挂一个 `hashchange` 监听即可，不引路由库 |
| **分享链接** | 翻译结果编码进 `?t=<encodeURIComponent>&v=<引擎版本>`，打开自动回填并翻译；带 `v` 是因为引擎随库升级，结果需可复现 |
| **PWA** | `manifest.json`（图标用 `build/icon.png`）+ Service Worker 缓存静态资源；数据本体在 IndexedDB，天然离线 |
| **OG 分享卡片** | `og:title` / `og:description` / `og:image`，微信/Twitter 分享不再秃 |
| **首屏加载态** | sql.js wasm + 播种期间显示品牌化 loading（现有 v-cloak 只有空白，网页首访 1-2 秒不能白屏） |
| **存储状态提示** | 设置页新增「本机库占用 / IndexedDB 可用」展示 + 「导出备份」入口，对冲浏览器清存储的风险 |

---

## 六、里程碑

> 节奏参考：M0-M2 是能用的网页版（核心），M3-M5 是上线品质。每阶段结束 `npm test` 全绿。

### M0 · 技术验证（0.5 天）

- [ ] `src/web/idbAdapter.js` 原型：实现 fsAdapter 同款接口（read/write/unlink/rename/copy/readdir/stat/mkdirp），`linyu.db` 存 IndexedDB 单 key
- [ ] 在 `serve-www.js` 起的站点上手动替换兜底 adapter，验证：翻译 → 改词条 → **刷新页面 → 数据还在**
- [ ] 记录 IndexedDB 配额、Safari/Edge 实测表现

### M1 · Web 壳与持久化（1 天）

- [ ] `src/web/` 目录定型：`idbAdapter.js`（正式版）+ `webEntry.js`（基于 entry.js 改：按「是否 IndexedDB 可用」选 adapter，隐私模式降级 + 顶部提示条）
- [ ] `scripts/build-web.mjs`：复制 `build-mobile.mjs` 管线（IIFE 包裹 + checkBundle 闸门 + 内容指纹），产物输出 `www-web/`；人物图默认不打进产物目录，单独 `www-web/img/` 由部署层传 CDN
- [ ] `fsAdapter.js` 增加 `makeIdb()` 导出（与 makeNode / makeCapacitor 并列），Node 分支不受影响
- [ ] 跑通五板块浏览 + 翻译 + 历史 + 三主题切换 + 刷新持久

### M2 · UI 对齐与开发者模式（1-2 天）

- [ ] 响应式三断点适配（复用 data-mobile 规则，去掉 Capacitor 特有判断）
- [ ] 开发者模式全链路：登录门禁 → 五板块 CRUD → 撤销槽位 → 导入导出（下载/上传 `.db` 文件）→ 人物图本地上传存 `media/` objectStore
- [ ] hash 路由 + 人物详情直链
- [ ] 多标签页写库冲突：`BroadcastChannel` 检测到第二个写实例时，后打开的降级为只读并提示（对齐桌面端「App 运行中拒绝直写」的先例）

### M3 · 性能与 PWA（1 天）

- [ ] Service Worker（workbox 手写即可）：vendor/core/img 预缓存 + 运行时缓存，版本号随构建指纹更新
- [ ] `manifest.json` + 安装提示
- [ ] 首屏 loading 态（品牌化，替代 v-cloak 空白）
- [ ] 评估 sql.js 延迟加载：翻译页首帧不等 wasm（db 异步就绪前走 api 占位 Proxy——entry.js 已有这个机制，验证体验即可）
- [ ] Lighthouse 基线：Performance / Accessibility ≥ 90

### M4 · Web 特有功能（0.5 天）

- [ ] 分享链接 `?t=&v=` + 「复制分享链接」按钮
- [ ] OG meta + 站点标题/favicon
- [ ] 主题「跟随系统」
- [ ] `?q=` 直达词库搜索

### M5 · 测试闸门与上线（0.5-1 天）

- [ ] `test/web.test.js`：产物完整性（文件清单 / 脚本加载顺序 / IIFE 无重声明 / index.html 引用路径全部存在）、15 条翻译用例与三端输出一致（对齐 `weapp.test.js` 模式）、内容指纹一致；挂进 `npm test`
- [ ] 浏览器冒烟：Chrome / Edge / Safari / 微信内置浏览器（X5 内核 wasm 兼容实测，不通则加降级提示）+ 隐私模式降级提示
- [ ] 部署（见下节）+ 在 README 增补「网页端」章节 + 上线链接挂进在线作品集
- [ ] 仓库 push 到 GitHub（门面治理清单里 bundle-guardian / schema-forge 之外的第 4 个项目，README 技术故事含「四端」）

### 部署方案（分级推荐）

| 级别 | 方案 | 说明 |
|---|---|---|
| **推荐** | 静态托管（Cloudflare Pages / 腾讯云 COS+CDN / WorkBuddy 站点发布） | 纯静态零后端，gzip + 长缓存即完事；国内访问选腾讯云，作品集海外展示选 CF |
| 备选 | Gitee Pages | 与现有 Gitee 发行版同生态，但 Pages 审核与带宽一般 |
| 不推荐 | 自建服务器/容器化 | 给一个无后端静态站上服务器是纯成本 |

---

## 七、风险与对策

| 风险 | 等级 | 对策 |
|---|---|---|
| 浏览器自动清理 IndexedDB（长期不访问/磁盘紧张） | 中 | 设置页展示占用 + 引导导出备份；seed 可随时重播种（`upgradeSeed` 已有），真正会丢的是用户自建词条 → M4 可做「导出 diff JSON」 |
| 微信内置浏览器（X5/旧 WebView）wasm 兼容 | 中 | M5 实测；不通则在入口检测 `WebAssembly` 缺失时给出「建议用系统浏览器打开」提示 |
| 多标签页同时写库损坏 | 中 | BroadcastChannel 单写者锁（M2），后到者只读 |
| 首屏 850KB gzip 在弱网偏重 | 低 | SW 二次访问秒开；M3 验证后仍超标再评估「轻量 JSON 引擎先行」分叉 |
| `unsafe-eval` CSP | 低 | 本期记录取舍；后续可选 runtime-only 迁移 |
| 人物图 234 张小请求拖慢列表 | 低 | thumb 优先 + `loading="lazy"` + 强缓存；thumb 404 自动退原图的机制已有 |
| 渲染层 `app.js` 微调牵动桌面/安卓 | 低 | 网页特有逻辑全部隔离进 `src/web/`，`app.js` 只加「平台分支」级别的最小改动；`check.js` 五步闸门继续兜底 |

---

## 八、刻意不做（与项目既有品味对齐）

- **不做账号系统与云同步**——网页版每人一份本地副本，语料是公开内容，同步没有用户价值，还引入服务端；
- **不做服务端翻译 API**——引擎前端毫秒级跑完，上服务端反而增加延迟和成本；
- **不做 UGC / 评论 / 广告**——对齐小程序端「刻意不做」清单；
- **不重写渲染层**——不引入 SFC/bundler，UI 用同一份 `app.js`，防止渲染层分叉；
- **不追 SEO 深度优化**——hash 路由足够，词库内容对搜索引擎的可见性不是本站目标。

---

## 九、验收清单

- [ ] 刷新/重启浏览器后词库、历史、开发者改动全部保留（IndexedDB）
- [ ] 三套主题 + 跟随系统切换正常，宽屏观感与 PC exe 一致
- [ ] 七个 tab + 人物详情直链 + 前进后退可用
- [ ] 翻译 15 条基准用例与 PC/安卓/小程序输出**逐字一致**
- [ ] 开发者模式可增删改词条并导出 `.db`；导入文件可恢复
- [ ] 断网后刷新页面仍可翻译、可浏览五板块（PWA 生效）
- [ ] Lighthouse Performance / Accessibility ≥ 90；首屏 gzip ≤ 1MB
- [ ] `npm test`（含新增 `test:web`）全绿；`check.js` 五步闸门全绿
- [ ] README「四端」章节补齐，上线链接进作品集与 GitHub 主页
