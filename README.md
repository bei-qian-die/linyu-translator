# 淋语翻译器

中文 → 淋语的桌面翻译器，同时是一个 Wiki 式的淋语词条库。Electron + Vue + sql.js，数据全部落在本机 `%APPDATA%\linyu-translator\linyu.db`，不联网也能用。

## 当前版本：**1.12.2**

五大板块规模：词库 **535** / 句式 **146** / 词卡 **422** / 人物传 **73 位** / 名言 **462**。

最新一次发布（2026-10-18）：
- 顶部统计条按当前 view 实时切换（词库/句式/词卡/人物传/名言 各自独立计数）
- 删 5 处「只读模式」提示框（开发者模式登录入口仍在「设置」里）
- 1.12.1 调查报告 19 词条 + 5 人物（周阴婷 / 阴婷宝 / 3 个 B 站 UP）已入库
- 1.12.0 词库 +30 圈层黑话 / 句式 +20 高频复用完整句
- 历史版本 `release/淋语翻译器 1.11.0.exe` / `1.12.0.exe` / `1.12.1.exe` 旧产物均已 mavis-trash 进回收站

## 开发者账号

用于登录「设置 → 开发者模式」后可增删改词库 / 句式 / 词卡 / 人物 / 名言。

| 字段 | 值 |
|---|---|
| **账号** | `linyu` |
| **默认密码** | `linyu130` |

> **这不是安全边界，是防误改门禁。** 拿到 `linyu.db` 的人本就能直接改数据（sql.js 是本地文件），所以密码只是给界面操作多一道确认，不承诺抗逆向。代码定义在 `src/core/auth.js:7-8`。

首次启动时 `auth.ensureInit()` 会自动把账号 `linyu` + 默认密码 `linyu130` 写进 `settings` 表（密码用 scrypt 加盐哈希）。改密码后界面上的"默认密码"提示会消失；如果忘了改过的密码，重装 App 不会重置（`HASH` 还在 settings 里），要清掉 `%APPDATA%\linyu-translator\linyu.db` 重新走一次首次初始化流程。

---

五大板块：词库 `words` / 句式 `rules` / 词卡 `cards` / 人物传 `heroes` / 名言 `quotes`。

### 五板块的字段

| 表 | 字段 |
|---|---|
| `words` | 中文 `zh` · 淋语 `linyu` · 别名 `alias` · 解释 `sense` · 出处 `source` · 流行度 `pop`（高/中/低）· 关联词条 `rel` |
| `rules` | 匹配正则 `pattern` · 替换模板 `template` · 备注 `note` · 使用场景 `scene` · 例句 `examples` · 出处 `src` |
| `cards` | 词名 `term` · 类型 `type` · 简介 `meaning` · 详细解释 `detail` · 例句 `example` · 出处 `source` · 相关人物 `hero` · 别名 `aliases` · 关联词条 `rel` |
| `quotes` | 语录 `text` · 出处人物 `author` · 归属人物 `hero` · 出处 `src` · 出处场景 `scene` · 关联词条 `rel` |
| `heroes` | 人物名 `name` · 别名 `alias` · 称号/分区 `rank` · 简介 `intro` · 百科 `baike` · 标签 `tags` · 代表作 `works` · 关联词条 `words` · 配图 `img` · 分组 `grp` · 链接 `links` |

`heroes` 没有再单独加一份「关联词条」列——`words` 已经是这个字段，加 `relWords` 只会多一处可能对不上的重复数据。

**词卡是纯文字卡片，不配图。** 只有人物传有图（`heroes.img`），接受两种写法：仓库内相对路径（`img/hero-1.png`），或开发者本地上传后生成的 `media:<随机名>`（文件在 `%APPDATA%\linyu-translator\media\`）。

老库的表建好时还没有后加的列，`ensureColumns()` 会在首次启动时逐列 `ALTER` 补上；补列是数据表驱动的，漏一列不会报错，只会在升级后静默地存不进去。

---

## 跑校验（打包前必须全绿）

```bash
npm install
node scripts/check.js
```

`check.js` 会**并行**跑完五个步骤，再统一打印、统一退出码：

| 步骤 | 作用 |
|---|---|
| 翻译引擎用例 | `test/core.test.js` |
| 数据层用例 | `test/db.test.js` |
| 五板块 CRUD 契约 | `scripts/crud-check.js`，增/查/改/删逐条断言并落库复核 |
| 语料溯源 | `scripts/attest.js`，判定每条内容在语料里有据可依 |
| 语法检查 | `src/` `scripts/` `test/` 全量 `node --check` |

任何一个步骤失败都会置 `exitCode=1`。所有步骤都会跑完——早先的 `steps.every()` 短路会让第一个失败之后的检查整段跳过，看起来只是少几行输出，实际是把问题藏起来了。

单独跑语料溯源：

```bash
node scripts/attest.js corpus3.txt,corpus5.txt,...
```

语料文件列表由 `check.js` 自动取仓库根目录下的 `corpus*.txt`。判定结果写进 `attest.txt`，`##### NOT ATTESTED #####` 之后是所有「语料里找不到依据 + 没有 verify 来源」的条目。

### 语料与出处的约定

- `corpus*.txt`：逐字抓下来的原始语料（B 站视频标题、简介、标签、一级评论），是判定的**唯一**本地证据。
- `evidence/manifest-*.json`：采集快照，记录每个视频的 bvid、标题、UP、发布日期、封面 URL、评论条数与抓取时间。manifest 里任何一条都能顺着 bvid 回到原视频。
- 采集脚本：

```bash
node scripts/harvest-bili.js "淋神,淋语,洛克淋国" 60 1
node scripts/harvest-baike.js
```

`harvest-bili.js` 走 B 站公开接口（search / view / reply），**不需要任何账号 Cookie 或 API Key**，产出一份 `corpus-bili-*.txt` 和一份 manifest。参数依次是：关键词（逗号分隔）、最多取多少个新视频、每个视频抓几页评论。

**关键词别凭印象列。** 先从已有 manifest 的视频标题里把真实存在的圈层名挖出来再搜：

```bash
node scripts/mine-corpus.js "corpus-bili-20261011065020.txt"
```

### 从语料到条目（两步，都不许自动入库）

```bash
node scripts/mine-corpus.js <语料>   # 出候选，写 evidence/mined-*.json
node scripts/apply-curated.js        # 把人工审过的 curated-*.json 写进 lore-extra6.js
```

`mine-corpus.js` 只出候选，`apply-curated.js` 才落库，中间隔着一道人工筛选。这条路不能省——过滤器拦得住刷屏，拦不住「这是不是个梗」，那是人的判断。

`apply-curated.js` 是**幂等**的：去重基线排除 `lore-extra6` 自身，且当本次生成的结果比现有 extra6 还少时直接拒绝写入。第一版没这么做，重跑一次就把整个文件清空了。

语料里有两种格式，脚本都吃：`corpus-bili-*.txt`（`【视频】【评论】`）与 `corpus3-13`（`[dm]/[cmt]/[sub]`，无视频上下文、挂不上出处）。

调查报告扩量走 `scripts/apply-workbuddy.js`（同源幂等保护）。

---

## 打包

```bash
npm run dist
```

产物在 `release/`：`淋语翻译器 Setup <版本>.exe`（安装版）、`淋语翻译器 <版本>.exe`（绿色版）、以及 `win-unpacked/`。

`package.json` 的 `build.files` 是**白名单**，只打这几样：

```
src/core/**   src/main/**   src/renderer/**
build/icon.png
node_modules/sql.js/package.json
node_modules/sql.js/dist/sql-wasm.js
node_modules/sql.js/dist/sql-wasm.wasm
node_modules/vue/dist/vue.global.prod.js
```

sql.js 的 `dist/` 里还有十几 MB 的 debug 构建与 zip 包，`node_modules/sql.js/**/*` 会把它们全打进去；白名单只留实际会加载的 wasm 两个文件。改这个列表前先确认 `src/core/db.js` 的 `require('sql.js')` 与 `src/renderer/index.html` 的 `<script src>` 指向的路径仍然存在。

---

## 直接改本地库之前

```bash
node scripts/sync-seed.js          # 把内置内容同步进已存在的本地库
node scripts/db-order-check.js     # 句式顺序回归
```

这两个脚本会直写 `%APPDATA%` 下的真实库。启动时如果检测到「淋语翻译器.exe」还在跑（`scripts/lib/app-running.js`），会**拒绝执行并提示先退出 App**——App 运行期间会随时把内存库整体落盘，两个写入方同时操作会让滚动备份和回滚都不可信。

---

## 内置内容从哪来

`src/core/lore.js` 聚合 `lore-extra*.js`（extra3 / extra4 / extra5 / extra6 / extra7），`src/core/seed.json` 存词库与句式。收录要过三道闸：

1. **词条闸**：不能逐字溯源的，必须带 `verify:` 来源。
2. **名言闸**：必须是淋化产物。版本讨论、直播口播复述、饭圈黑话、游戏机制描述一律不收。
3. **英雄闸**：必须有淋语社群身份，且挂有通过名言闸的条目。

被判定要剔除的条目写进 `lore.pruned`，升级时由 `db.upgradeSeed()` 从老库里精确删除。改内置条目主键时会自动把旧键记进 `deleted` 表，避免下次空表播种或补种把它原样加回来。

### 词卡/名言的归属人物

`cards.hero` / `quotes.hero` 是对 `heroes.name` 的引用，指向人物详情页的「相关梗 · 词卡」「相关名言」两块。判定顺序在 `lore.inferCardHero()` / `lore.inferQuoteHero()`：

1. **显式规则表** `HERO_SOURCE_RULES`——人工过一遍的「来源关键词 → 人物」。
2. **同来源已标注**——同一条来源串在已有条目里归属某人就照抄；语料文件名、裸 BV 号、论坛帖号、百科小组等**通用来源不参与学习**。
3. 都判不出就留空，显示为通用淋语条目。

规则表排在前面，是因为它比「学到的映射」更不容易错：「欧米伽」被错标成淋淋后，同出《高等淋语》第三课弹幕的「吸入」「难逃一吸」等五个词曾跟着全被算成蔡依林的——规则表人工过过一遍，学到的只是原始数据的回声。

这段推断以前写在渲染层 `app.js` 里，只在人物详情页聚合的那一瞬间生效，猜完就丢，库里始终是空的。现在入库时就算好，界面上能直接看到和修改。规则表导出为 `lore.heroSourceRules` 供审计查看。

### 代表作的采集

```bash
node scripts/harvest-works.js   # 代表作候选（只出建议，不改内容）
```

只采**可回源**的真实数据，出处落在 `evidence/works-*.json`。对 UP 主只收作者名与人物名**精确一致**的视频，且要求标题本身是淋语内容——作者名对上还不够。

### 图片

**只有人物传配图**，只接受真实来源：百度百科词条图 / B 站视频封面 / UP 主头像。**不使用任何 AI 生成图，不使用占位图**。仓库根曾经存在的 `vibe_images/` 是 AI 生成图，已整体删除，且不在打包白名单内。

词卡一律纯文字，不配图。曾试过给重点概念梗配 B 站视频封面，按「词条名出现在视频标题里」自动匹配出 8 条，逐条核对发现一半是纯词面撞车（「正确的」贴到《生理冷知识：正确的打飞机姿势》、《乌干达》贴到星露谷物语、《体育生》贴到《一身臭汗的体育生冲澡》），已整体撤掉。
