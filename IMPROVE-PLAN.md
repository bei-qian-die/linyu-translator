# 淋语翻译器 · 改进计划书

> 版本基线：**1.13.0**（2026-10-18 发布）  
> 制定日期：2026-10-21  
> 执行日期：2026-10-22  
> 状态：**阶段一 / 阶段二 / P11 已完成，P9 部分完成，P10 推迟**（详见 0.1）

## 0.1 执行状态（2026-10-22）

| 阶段 | 状态 | 实测结果 |
|---|---|---|
| 一 P1 图片（方案 A） | ✅ | `src/renderer/img` 8.41 MB → 2.8 MB（另加 thumb/ 768 KB）；列表改用缩略图 + `loading="lazy"`，缩略图 404 自动退回原图 |
| 一 P2 落盘合并 | ✅ | `addHistory` 走 `batch()`，两次落盘合成一次；超限才跑裁剪 DELETE |
| 一 P3 分词缓存 | ✅ | 分词改首字符分桶；`applyRules` 复用编译实例（原来每次翻译重编译几千次正则）。5880 字 ×100 次：**1373 ms → 363 ms（-73.5%）** |
| 一 P4 `www/` 移出 git | ✅ | 97 个文件退出版本控制，README 注明需重新 `mobile:build` |
| 二 P5 LICENSE | ✅ | MIT |
| 二 P6 CI + lint | ✅ | `.github/workflows/ci.yml` + ESLint（0 error / 51 warn）+ Prettier + EditorConfig |
| 二 P7 根目录归位 | ✅ | 语料进 `corpus/`、一次性证据进 `evidence/`、`scripts/legacy/` 加归档说明；移动前后 unattested 基线一致（339） |
| 二 P8 CSP 收紧 | ✅ | 去掉两个 `unsafe-inline`、`img-src`/`connect-src` 不再放行任意 `https:`/`ws:`；`unsafe-eval` → `wasm-unsafe-eval` |
| P9 TS 化 | ⚠️ 部分 | 见下方说明 |
| P11 双端收敛 | ✅ | `src/core/service.js` 落地，桌面与移动端都只做转发 + 平台特有部分；新增 `test/service.test.js` 16 项 |
| P10 Vite + SFC | ⏸ 推迟 | 见下方说明 |

**P9 为什么只做了一半。** 真 `.ts` 迁移在当前「无打包器 + WebView 全局作用域」架构下会撞两堵墙：

1. TypeScript 7 已移除 `module: "none"`，而只有它能产出「不写 `exports`」的浏览器可用文件——
   CommonJS 产物在 WebView 里会直接 `ReferenceError: exports is not defined`，正是 1.12.4 修过的那种白屏。
2. 不用 `module: none` 就得靠 `export` 让文件成为模块，而同一程序里的多个「全局脚本」会互相污染作用域
   （`tokenizer.ts` 与 `translator.ts` 都会声明 `buildTokenizer`，实测报 TS2451）。

已落地的部分：给 `auth.js` / `tokenizer.js` / `translator.js` / `db.js` / `lore.js` 加了 `// @ts-check`
与 JSDoc，配 `jsconfig.json` + `types/globals.d.ts`（声明双环境全局），`npm run typecheck` 已进 CI，当前 **0 错误**。
真 `.ts` 源码建议在 P10 引入构建工具之后再做——那时这两个问题都不存在。

**P10 为什么推迟。** 它是唯一动 UI 全层的改动（1291 行 setup + 683 行模板 + 2082 行样式拆成 SFC），
而渲染层目前**零测试覆盖**，本机 `scripts/e2e-dev.js` 也跑不通（连不上 Electron 调试端口，基线即失败）。
在这种验证条件下一次性重做完，交付的很可能是个起不来的版本。建议下一轮按这个顺序：

1. 先把本次改动打一个包（`npm run dist`）在桌面真机装一遍，确认阶段一/二/P9/P11 无回归；
2. 补渲染层测试（jsdom + @vue/test-utils，先覆盖翻译流程与五板块 CRUD 表单）；
3. 再引入 Vite，按视图逐个替换，每个视图替换完单独验证。

**顺带修掉的两个既有 bug**（不在计划内，是排查时撞上的）：

- `src/core/auth.js` 只认全局 `linyuScrypt`，而 `scrypt.js` 的 Node 分支从不挂这个全局——
  桌面端开发者登录实际会抛 `ReferenceError`。现在 Node 侧直接 `require('../mobile/scrypt')`，
  `crud-check` 的失败项从 4 条降到 3 条。
- `src/core/lore.js` 里「斯琴低娃老师」的 `links` 键在同一对象里定义了两次，后一个覆盖前一个
  （ESLint `no-dupe-keys`）。已保留含两条链接的那份，与 `works`/`baike` 对得上。

## 0. 原则

1. **先保命，再优化。** 每一步都必须能在 `node scripts/check.js` 全绿的前提下提交，任何一个阶段做完都可以直接发版。
2. **不动架构的阶段不碰架构。** 阶段一/二只做性能、体积、工程化，不改数据流、不改 IPC 契约。
3. **每条优化都要有可验证的验收口径**，不写"感觉快了"这种没法判定的结论。
4. **存量用户优先。** 本机库（`%APPDATA%\linyu-translator\linyu.db`）里的用户数据不能被升级动作改写，这是硬约束。

---

## 1. 现状体检

### 1.1 代码规模

| 文件                        |   行数 | 说明                                  |
| ------------------------- | ---: | ----------------------------------- |
| `src/renderer/app.js`     | 1291 | 单个 `createApp({...})`，全部逻辑在 setup 内 |
| `src/renderer/index.html` |  683 | 模板全部内联，无组件拆分                        |
| `src/renderer/style.css`  | 2082 | 单文件样式                               |
| `src/core/db.js`          | 1438 | 数据层（sql.js）                         |
| `src/mobile/api.js`       |  649 | 移动端业务 API（与桌面 IPC 平行实现）             |
| `src/main/main.js`        |  521 | 桌面主进程 + IPC 注册                      |
| `src/core/lore.js`        |  947 | 内置内容聚合                              |

数据规模：词库 535 / 句式 146 / 词卡 422 / 人物传 73 / 名言 462。

### 1.2 依赖

| 依赖        | 版本      | 备注                                            |
| --------- | ------- | --------------------------------------------- |
| Electron  | ^33.4.5 | 落后主线约 4 个大版本                                  |
| Capacitor | ^6.1.2  | 主线已到 7.x                                      |
| Vue       | ^3.5.13 | 以 `vue.global.prod.js` 直接 `<script>` 引入，无构建工具 |
| sql.js    | ^1.13.0 | 内存库 + 整库落盘                                    |

### 1.3 已确认无问题的部分（重构时不要动）

- 主进程安全基线：`contextIsolation: true` + `nodeIntegration: false`、`will-navigate` 拦截、`setWindowOpenHandler` 一律 deny、`openExternal` 协议白名单。
- `db.js` 内所有 SQL 字符串拼接的表名/列名均来自内部常量表（`NEW_COLUMNS` / `SECTIONS`），无用户输入注入面。
- 坏库自愈：读不通时 quarantine 原件 → 从 `.bak1~.bakN` 滚动备份回退 → 弹窗告知。
- `check.js` 五步并行校验（引擎 / 数据层 / CRUD 契约 / 语料溯源 / 语法），失败不短路。

---

## 2. 优化项总览

| 编号  | 类别    | 问题                                     | 收益 | 成本 | 阶段 |
| --- | ----- | -------------------------------------- | -- | -- | -- |
| P1  | 性能/体积 | 人物图 8.41MB 全 PNG，列表无懒加载                | 高  | 低  | 一  |
| P2  | 性能    | 一次翻译触发两次整库落盘                           | 高  | 低  | 一  |
| P3  | 性能    | 分词器每次翻译重建词典                            | 中  | 低  | 一  |
| P4  | 仓库    | `www/` 构建产物（97 文件 / 11MB）进了版本库         | 中  | 低  | 一  |
| P5  | 工程化   | 缺 LICENSE（package.json 声明 MIT 但无文件）    | 中  | 极低 | 二  |
| P6  | 工程化   | 无 CI、无 lint、无格式化                       | 中  | 低  | 二  |
| P7  | 仓库    | 根目录 16 个 `corpus*.txt` + 一次性证据文件散落     | 低  | 中  | 二  |
| P8  | 安全    | CSP 开了 `unsafe-eval` / `unsafe-inline` | 中  | 低  | 二  |
| P9  | 求职面   | 全项目 0 行 TypeScript                     | 高  | 高  | 三  |
| P10 | 求职面   | 无构建工具、无 SFC、零组件拆分                      | 高  | 高  | 三  |
| P11 | 架构    | 桌面/移动两套平行 API 实现                       | 中  | 高  | 三  |

---

## 3. 阶段一：半天见效（不改架构）

### P1 · 人物图体积与加载

**现状**：`src/renderer/img` 71 张图共 **8.41 MB**，最大 `hero-73.png` 544 KB，平均 121 KB，png/jpg 混用。`index.html:321` 的人物列表 `v-for="h in filteredHeroes"` 无分页、无 `loading="lazy"`、无 `width/height`，首屏一次性解码全部图片，Android WebView 上尤其明显。

**约束（关键）**：`db.js` 的 `backfillHeroImg()` 只回填 **img 为空** 的行，用户库里已写入 `img/hero-N.png` 的记录不会被升级覆盖。因此**改扩展名会让存量用户的图直接裂掉**，这是必须绕开的坑。

**方案 A（推荐，零数据迁移）**

1. 文件名与扩展名**保持不变**，只对 PNG 做压缩（推荐 `sharp` 的 `png({ quality: 80, compressionLevel: 9 })`，或 `oxipng -o 4`）。预计 8.41 MB → 2~3 MB。
2. 新增缩略图目录 `src/renderer/img/thumb/`，统一输出 WebP（宽度 240px，质量 75），单张目标 < 15 KB。
3. 渲染层：列表（卡片）用缩略图，详情页用原图。改动点只有 `src/renderer/app.js:733 heroSrc()` —— 加一个 `heroSrc(h, thumb)` 变体，或新增 `heroSrcThumb(h)`。
4. `index.html:321` 与 `:352` 的 `<img>` 补 `loading="lazy"` 与显式 `width`/`height`，消除布局抖动。
5. 存量库无影响：`media:` 前缀图与相对路径图都不动。

**方案 B（备选，体积更优但需迁移）**  
转 WebP 并改 `heroes.img` 引用，同时给 `upgradeSeed()` 增加一条 img 路径 rewrite 规则（`.png` → `.webp`，仅匹配内置人物名且当前值仍是内置路径），靠 `content.version` 触发一次。风险更高，需要专门写迁移测试。

**验收**：`du -sh src/renderer/img` 总数 ≤ 3.5 MB；人物列表滚动无白块；`node scripts/check.js` 全绿；桌面与 Android 两端各目测一轮人物列表与详情页。

### P2 · 落盘合并与防抖

**现状**：`db.js:1052 addHistory()` 连续调用两次 `run()`（INSERT + 超限裁剪 DELETE），而 `run()` 内部每次都 `persist()` —— `persist()` 会 `db.export()` 整库序列化 + 同步写文件。**点一次翻译 = 两遍全库落盘**；裁剪 DELETE 在没超限时也在跑。

**改法**

1. `addHistory` 整体包进已有的 `batch()`（`db.js:534`），两次 SQL 只落盘一次。
2. 裁剪改成条件执行：先 `SELECT COUNT(*)`，超 `limit` 才 DELETE。
3. 可选：`persist()` 增加 300~500 ms 防抖合并（Node 路径保留同步语义，通过 `flush()` 在 `close()` 前强制落盘）。

**验收**：在 `persist()` 打计数日志，连续翻译 10 次，落盘次数从 20 降到 ≤ 10；`test/db.test.js` 全绿；杀进程后历史记录不丢。

### P3 · 分词器缓存

**现状**：`tokenizer.js` 的 `buildTokenizer()` 每次 `translateText()` 都重建 Set、重算 maxLen；匹配循环是 `O(n × maxLen)` 的 `slice().join('')`，逐字建串。

**改法**

1. 在 `translator.js` 层按**词库内容指纹**缓存编译结果（词库条数 + 首末条 hash 即可，避免每次全量 hash），词库变更时重建。
2. `segment()` 内部改为按首字符分桶（`Map<char, string[]>`）或直接上 Trie，去掉逐长度 `slice().join('')`。
3. 保持 `window.LINYU_TOKENIZER` 与 `module.exports` 双导出形态不变（桌面走 require，WebView 走全局）。

**验收**：`test/core.test.js` 全绿；用 5000 字长文本跑 100 次翻译，耗时对比改前下降 ≥ 30%（记入 PR）。

### P4 · `www/` 移出版本控制

**现状**：`www/` 是 `scripts/build-mobile.mjs` 的产物（脚本开头就 `rimraf(out)` 全量重建），却有 97 个文件（含 11 MB 图片）提交在 git 里。它是生成物，与 `src/` 双份存在，改了 `src/` 忘了 `npm run mobile:build` 就会出现漂移。

**改法**

1. `.gitignore` 追加 `www/`。
2. `git rm -r --cached www`（保留本地文件，只退出版本控制）。
3. README 的打包章节补一句：`www/` 由 `npm run mobile:build` 生成，不入库。
4. 同步确认 `capacitor.config.json` 的 `webDir` 仍指向 `www`（不受影响）。

**验收**：`git ls-files www | wc -l` = 0；`npm run mobile:build && npx cap sync android` 仍能正常产出。

---

## 4. 阶段二：工程化补齐（1~2 天）

### P5 · LICENSE

新增 `LICENSE`（MIT，版权行 `Copyright (c) 2026 qiuzh`），与 `package.json` 的 `"license": "MIT"` 对齐。开源门面缺这一项会被直接判定为不完整。

### P6 · CI + lint

1. **CI**：新增 `.github/workflows/ci.yml`（若继续以 Gitee 为主仓，则用 Gitee Go 等价配置），在 push/PR 上跑：`npm ci` → `node scripts/check.js` → `npm run test`。这同时也是 README 上可以挂的 badge。
2. **lint**：引入 ESLint（flat config）+ Prettier，先用 `--no-eslintrc` 的宽松规则集只开 `no-unused-vars` / `no-undef` / `eqeqeq`，避免一上来几百条报错；`.editorconfig` 统一换行与缩进。
3. lint 不进 `check.js` 的硬失败项，先作为独立脚本 `npm run lint`，稳定后再考虑并入。

### P7 · 仓库根目录归位

> 注意：`corpus*.txt` 与 `evidence/` **不能删** —— `scripts/check.js` 靠根目录的 `corpus*.txt` 做语料溯源判定，删了会直接失败（`.gitignore` 里已有这条注释）。

1. 把 16 个 `corpus*.txt` 移到 `corpus/` 下，同步改 `check.js` 里扫描根目录的 `fs.readdirSync(ROOT).filter(/^corpus.*\.txt$/)` 为扫 `corpus/` 子目录，并把 `--corpus` 默认路径一起改掉。
2. 根目录的一次性证据文件 `hero4_evidence.json`、`hero5_evidence.json`、`relevance-review.txt`、`words-unverified.txt` 挪进 `evidence/`。
3. `scripts/legacy/` 下 20+ 一次性脚本整体归档（移到 `scripts/legacy/` 并加 README 说明"不再维护"，或直接删除——它们的功能都已被 `mine-corpus` / `apply-curated` 取代）。

**验收**：移动后 `node scripts/check.js` 的语料溯源步骤 unattested 数与前一致（移动前先记下基线数字）。

### P8 · CSP 收紧

`index.html:8` 当前为：

```
script-src 'self' 'unsafe-eval' 'unsafe-inline'; img-src 'self' data: blob: https: content:; connect-src 'self' data: blob: https: ws:
```

1. 先试去掉 `unsafe-eval`（Vue 用的是 `vue.global.prod.js`，不需要运行时编译；sql.js 的 wasm 走 `data:`/`blob:` 已在 `script-src` 之外单列，需实测确认）。
2. 内联样式/脚本改用 nonce 或抽到外部文件，逐步去掉 `unsafe-inline`。
3. `img-src` 的 `https:` 与 `connect-src` 的 `ws:` 收窄到实际用到的域名。
4. 每改一项就在桌面 + Android WebView 双端跑一次冒烟，白屏即回退。

---

## 5. 阶段三：架构与求职面（排期，风险较高）

> 这一阶段的动机很直接：本项目是简历上的主打项目，而求职方向是 **Vue 3 + TypeScript**。当前项目 0 行 TS、无构建工具、无组件拆分，面试官点开仓库看到的是"用了 Vue，但没用 Vue 的工程能力"。

### P9 · TypeScript 化（渐进，推荐先做）

1. **第一步（低成本，可独立上线）**：给 `src/core/` 的公开函数补 JSDoc 类型注解，根目录加 `jsconfig.json` 开启 `checkJs`，跑 `tsc --noEmit` 只报错不改行为。这一步零运行风险，但能让仓库出现真实的类型约束。
2. **第二步**：`src/core/`（db / translator / tokenizer / auth）真正迁成 `.ts`，用 `tsc` 编译输出到 `dist-core/`，`package.json` 的 `build.files` 与 `build-mobile.mjs` 同步改指向。core 层是纯逻辑、依赖最少，最适合先迁。
3. 渲染层与移动端暂不迁，等 P10 的构建工具落地后一起做。

### P10 · Vite + SFC 组件化（收益最高，改动最大）

现状是 `<script src="vendor/vue.global.prod.js">` + 内联模板，没有单文件组件、没有 HMR、没有 tree-shaking。

1. 引入 Vite，把 `src/renderer` 改成 `index.html` + `main.ts` + `components/*.vue`。
2. 按现有视图拆组件（翻译区 / 词库表 / 句式表 / 词卡 / 人物传 / 名言 / 设置 / 导入导出），1291 行的 setup 按视图切片。
3. **必须先补测试再动**：当前只有 `test/core.test.js`（3 个用例）与 `test/db.test.js`（27 个），渲染层零覆盖。建议先给关键交互补一层测试（至少覆盖翻译流程与 CRUD 表单），再开始拆。
4. 桌面端与移动端共用同一套 SFC，`build-mobile.mjs` 改为消费 Vite 产物（可顺带去掉现有的 IIFE 包裹 hack —— 那是为了绕开 `const cards` 重复声明，bundler 之后本就不存在这个问题）。

### P11 · 桌面/移动双端 API 收敛

`src/main/main.js`（521 行 IPC handler）与 `src/mobile/api.js`（649 行 `createApi`）是两份平行的业务实现，加一个接口要改两处，且容易只改一边。

1. 抽出与平台无关的 service 层（词库/句式/词卡/名言/人物/导入导出/备份的业务逻辑）。
2. 桌面端 `main.js` 只做 `ipcMain.handle` → service 的转发；移动端 `api.js` 只做 Promise 包装 → 同一 service。
3. `src/main/preload.js` 暴露的 `window.api` 契约保持不变，渲染层零改动，便于分阶段验证。

---

## 6. 排期建议

| 阶段 | 内容                                       | 预估    | 可独立发版             |
| -- | ---------------------------------------- | ----- | ----------------- |
| 一  | P1 图片 / P2 落盘 / P3 分词 / P4 www           | 半天    | 是（建议打 1.14.0）     |
| 二  | P5 LICENSE / P6 CI+lint / P7 归位 / P8 CSP | 1~2 天 | 是（1.14.x）         |
| 三  | P9 TS 化 → P11 双端收敛 → P10 Vite+SFC        | 5~8 天 | 每步单独发版（1.15~1.16） |

**推荐顺序**：一 → 二 → P9 → P11 → P10。把 P10 放最后，是因为它依赖 P9 的类型基础和 P11 的 service 分层，反过来做会返工。

---

## 7. 风险登记

| 风险                                | 影响 | 应对                                                               |
| --------------------------------- | -- | ---------------------------------------------------------------- |
| 图片改扩展名导致存量用户图裂                    | 高  | 走方案 A（不改文件名）；若必须改格式，先补 img rewrite 迁移 + 专门测试                     |
| `corpus*.txt` 移位导致语料溯源失效          | 中  | 移动前后各跑一次 `check.js`，比对 unattested 基线数字                           |
| 去掉 CSP `unsafe-eval` 后 WebView 白屏 | 中  | 桌面 + Android 双端冒烟，失败即回退该条规则                                      |
| P2 落盘防抖后异常退出丢数据                   | 中  | `close()` / `window-all-closed` 前强制 `flush()`；补一条"杀进程后历史仍在"的手工验证 |
| P10 组件化引入回归                       | 高  | 先补渲染层测试再动手；分视图逐步替换，不一次性重写                                        |
| `www/` 移出版本控制后协作方拉不到              | 低  | README 明确写出 `npm run mobile:build` 这一步                           |

---

## 8. 验收总清单

每个阶段提交前，以下必须全绿：

```bash
node scripts/check.js                 # 五步并行校验
npm test                              # core + db 用例
npm run dist                          # 桌面包能出（本机需走 winCodeSign 镜像）
npm run mobile:build && npx cap sync android   # 移动产物能出
```

外加人工冒烟：启动 → 翻译一句 → 五个板块各翻一页 → 开发者模式登录 → 增改删一条 → 导出再导入 → 关闭重开数据仍在。

