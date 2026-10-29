# 淋语翻译器

中文 → 淋语的翻译器，同时是一个 Wiki 式的淋语词条库。**一套翻译引擎，四端交付**：Electron 桌面 / Capacitor 安卓 / 微信小程序 / Web 静态站，业务规则只写一份，每端只补平台适配层。不联网也能用，输入内容永不上传。

> **在线体验（Web 版，无需安装）**：<https://linyu-translator.app.workbuddy.host/?sharecode=KYSNKQPHS7>
> 桌面版与安卓版见 [Releases](https://github.com/bei-qian-die/linyu-translator/releases)。

## 当前版本：**1.29.0**

五大板块规模：词库 **2435** / 句式 **588** / 词卡 **1375** / 人物传 **563 位** / 名言 **3199**。

最新一次发布（2026-10-28）：
- 1.29.0 引擎升级——**语境选变体**：把词库的 `slot` / `sense` / `rel` 三个字段变成可计算的语境信号，同一个中文词的上百个淋语说法不再靠随机挑，而是按「领域（守望 / 王者 / 瓦 / 平安京…）+ 风格（卖萌 / 自嘲 / 清宫）+ 同句呼应」打分。纯本地、零网络、零延迟，桌面 / 安卓 / Web / 小程序四端同一套权重，一致性脚本已覆盖消歧路径的逐字符比对；详见 `release/1.29.0-notes.md`

最新一次发布（2026-10-26）：
- 1.23.0 第十九轮扩充（瓦罗淋特分区）：词库 +301、句式 +43、词卡 +158、名言 +406、人物传 +61（24 位契约者 / 32 位 UP 主与职业选手 / 5 位召唤兽），49 张真实配图；「瓦罗淋特」语义位 6→141 条、变体 96，新增 8 个专属子语义位；修正 6 项既有缺陷；主包压到 1.90MB；详见 `release/1.23.0-notes.md`
- 1.22.0 第十八轮扩充（第五淋格分区）：词库 +135、句式 +30、词卡 +46、名言 +63、人物传 +51（24 监管者 / 24 求生者 / 3 UP 主），59 张真实配图；「第五淋格」语义位 6→141 条、变体 92，新增 6 个专属子语义位；主包压到 1.95MB；详见 `release/1.22.0-notes.md`
- 1.21.1 第十七轮质检（洛克淋国分区）：剔除 28 条**与淋语无关的纯玩法词条**（进化→首领化、核心输出→终端、肉盾、拉条、精灵球、亲密度、稀有度、天气队、魔法学院/占星台/圣龙宝藏等地图与赛季名），词库 1361→1333，`洛克淋国` 语义位 131→103 条、变体 237；复核 63 张人物图，**替换 18 张不合规配图**（播放器 UI / bilibili·小红书·4399·交易猫水印 / 价格编号 / 图鉴卡框 / 二创插画 / 低清 / 主体搞混），11 张改走百度百科词条主图、7 张改走百度图库；详见 `evidence/qc17-drop-report.md` 与 `evidence/qc17-image-review.md`
- 1.21.0 第十六轮扩充（洛克淋国分区）：词库 +123（并入 24 条补 82 个变体）、句式 +26、词卡 +49、名言 +99、人物传 +43（38 位《洛克王国》精灵/NPC + 2 位 UP 主 + 3 位待补图），40 张真实配图；`洛克淋国` 语义位词条 63→131、变体 296；详见 `release/1.21.0-notes.md`
- 新增两大语料批次：`corpus-bili-20261026114722.txt`（70 视频 / 1720 评论）与 `corpus-bili-20261026115214.txt`（70 视频 / 1742 评论），合 255 万字语料；`mine-quotes16.js` 按淋语特征打分挖出 233 条候选，人工勾选 99 条入库
- 谐音精灵成体系入库：布是石/布是岩/布克棱岩（不是石/不是岩/不可能耶）、哭哭菇→怖须菇→怖哭菇、波波螺/消波螺/嗜波螺、吸泥鸥/泥吼牙/上岸蛙/号儿鱼 等 20 条「名字即梗」词条
- 页游经典外号补齐：镇南王（水球球）、神机军师（瞌睡王）、大将军（魔力猫）、代管婆（音速犬）、刁蛮公主（草依虫）、圣斗士（罗隐）、KFC（炫目鸡）、绿帽子王（刺蜗贝）、摄像头（独眼巨魔）、赛贵妃（河马小天使）、战斗机（喷火鸟）
- 洛克淋国黑话扩池：布拉迪/刷布拉迪/猝亖/洛批/洛手/轮椅/严父/大阴/阴间巴巴流/花瓶/辛者库宫女/母火守/正太国/白袜/玉足/福瑞/虫母/大狗叫/子宫向 + 新赛季地图（占星台/圣龙宝藏/月涌狂想/星陨/星光对决/系别/龙之秘境）
- 通用淋语多译法继续扩：`我` 的变体池再加 28 条（本可子/本可可/本天鹅/本凤凰/本淋王后/本阴婷/本妃/本答应/本常在/本土妞/奴家/小女子…），`第一人称自称` 语义位变体数 502；鼠化家族补齐 急鼠/气鼠/累鼠/饿鼠/穷鼠/丑鼠/可爱鼠了
- 1.20.0 第十五轮扩充（洛克淋国分区）：词库 +60（并入 5 条补 14 个变体）、句式 +6、词卡 +25、名言 +60、人物传 +21（16 位《洛克王国》精灵 + 5 位洛克淋国 UP 主，19 张真实图，锤头鹳/夜枭 待补图）；`洛克淋国` 语义位词条 3→51；详见 `release/1.20.0-notes.md`
- 新语料：`harvest-bili.js` 按「洛克淋国 / 洛克王国 精灵 / 洛克王国 通讯录 / 各精灵名」等 16 组关键词抓了 80 个视频 / 1243 条评论（`corpus/corpus-bili-20261026102422.txt`），`freq-slots15.js` 逐字验真 + 语料计数定 pop（评审记录 `evidence/cand15-review.txt`、配图核验 `evidence/hero-images15-review.md`）
- 洛克淋国黑话体系入库：宫斗自称（本宫/钮祜禄）、队伍黑话（加油光队/赔钱幽队/平衡虫队/雪天女子）、对局机制（摔炮/终端/首领化/就业/回宫/单防）、精灵淋名（冻肉娃娃/鹳女王/花衣蝶老公/冥古龙daddy）、「我X/你X」精灵自称池
- 1.19.0 游戏分区句式去掉「启动」+ 词库跨端统一；详见 `release/1.19.0-notes.md`
- 1.18.0 第十四轮扩充：词库 +34（并入 13 条补 24 个变体）、句式 +24、词卡 +19、名言 +49（其中 41 条新句 + 8 条已有句补归属）、人物传 +12（10 位 UP + 大副/玛薇卡 2 位游戏角色，12 张真实图）；既有 `我光` 并入「拉克丝 / 光辉女郎」别名、`武田晴海` 补 2 条代表作；详见 `release/1.18.0-notes.md`
- 新语料五份：`harvest-bili.js` 按「淋语八级/十级、通讯录英雄、玛雅大姐、胡艺莲、拉克丝」等 25 组关键词抓了 450 个视频（约 160 万字），`mine14.js` 出 1222 个整词级候选，人工评审后采纳（评审记录 `evidence/cand14-review.txt`）
- 语义位变体继续扩池：`我` 增补 `我郭`（郭门自称）、`我命小`（命学求生欲位），`吓死/去死/赔死/笑死惹` 补齐鼠化家族（吓鼠了/去鼠/赔鼠/孝鼠惹），`但是` 补 `但素`，`闺蜜` 补 `淋比`，`单眼皮` 补 `单阴纯`，`邻家女孩` 补 `淋家女孩` 等
- 新句式 24 条全部语料逐字命中：玛雅命学（我命小我先鼠 / 命大也鼠了 / 大事不妙厚）、艺字辈斗法（音色胡艺莲秒了，机能那艺娜）、淋王星引力场（在座各位都难逃一吸）、本质骑士家法（罚你看130遍me的mv）等
- 新词卡：拉克丝做法（篡位德玛妈祖）、圣水婆、艺字辈、大中国娜娜、念器官、绿如卡、郭门、婊时代、梵蜜淋、鸡圈甜菜、莓莓小姐、化身为胱、玛皇、阴萎者、你杰、婆崎、柔博士欧文、高产似赵露思、熊黛淋
- 12 位新人物全部配真实图：10 位 UP 用 B 站本人头像（view API 反查），大副用官方立绘、玛薇卡用百度百科词条图（百度图库抓取，逐张人工核验，否决水印图/自制图/群像图）；无 AI 图
- 1.17.0 第十三轮扩充：词卡 +67、名言 +93、人物传 +31（全为游戏角色，配 31 张真实图，否决 65 个不合规候选）；465 条词条补齐语义位（40→51 个 key），流行度改由语料出现次数分档而非手写，210 条没佐证的说法释义按「宁缺不编」留空；零内容人物 26→5；详见 `release/1.17.0-notes.md`
- 修 36 条词卡的 `type` 被写成中文（「俚语梗」「网络梗」），类型 chip 只认 `slang/meme` 这套 key，这些卡在任意筛选下都不显示；`lore.js` 与老库升级各收敛一次
- 修 「兄弟 / 哭」两条词条没有 `linyu`，翻译引擎按 `zh→linyu` 替换，等于这两条一直没生效
- 修 游戏分区语义位两套写法（英雄淋盟/阴雄淋盟、王者淋耀/淋者荣耀）把同一分区拆成两个 chip
- 词库页与人物详情页新增「黑话外号」类型（`hero-alias`）
- 1.15.0 第二轮全网淋语扩充：词库 +237、句式 +91、词卡 +171、人物传 +42、名言 +370；游戏角色从 46 位扩到 88 位，分区覆盖 英雄淋盟 / 王者淋耀 / 淋神 / 第五淋格 / 淋明杀鸡 / 星淋铁道 / 淋日方舟 / 阴淋师 / 洛克淋国 / 瓦罗淋特 / 街头霸淋 / 绝区淋 等 20 个区
- 多译法独立成条：`我` 的译法池扩到 本可 / 本可儿 / 本可人儿 / 本仙女 / 本仙子 / 本祝妞 / 本猪妞 / 本猪猪女孩 / 本宫 / 本淋王 等 47 条带语义位的自称条目；新增「我狸 / 我华 / 我玛 / 我薇 / 我珍 / 我凤」等 16 条同形异义条目，按分区区分阿狸与八重神子、杨玉环与神里绫华、卡尔玛与玛薇卡等同形写法
- 词库页新增「语义位」筛选 chip：第一人称自称 / 第二人称 / 疑问 / 否定 / 惊讶 / 认同 / 催促 / 调侃 / 告别 / 称呼类 / 程度 / 语气词 / 情绪 / 祈使 / 圈层黑话 / 审美 + 20 个游戏分区，一个词条可挂多个语义位
- 42 位新游戏人物全部配真实图：来源只有百度图库（含官方原画/立绘/海报）与该人物的 B 站淋语视频封面/UP 头像；逐张人工复核，第一轮抓错的 7 张（卡莎、医生、蝰蛇、暮蝶、阿鬼、迪莫、乌尔比安）已替换，无 AI 图、无自绘图
- 修 游戏人物分组：旧版 `heroArgs`/补种只认 `h.group`，extra6~9 里大量只写 `grp:'game'` 的角色被落成「通讯录真人」；现在按 `grp || group` 入库，并在升级时只回填「库里是 real、seed 明确是 game/up」的内置人物（不改用户自改分组）
- 修 老库词条补字段：升级时给内置词条合并新别名/语义位，空白的解释/出处/流行度才回填，不覆盖用户改过的内容
- 修 预览脚本无法复制 `img/thumb/` 目录、缺少 `www` 产物导致 404；预览改为直接加载 `www/` 构建产物并 mock `window.api`

历史版本要点：
- 1.14.0 第一轮全网淋语大扩充：词库 769 / 句式 212 / 词卡 488 / 人物传 106 / 名言 1495；新增「语义位」字段、多译法别名池、15 个游戏分区与 41 张人物图
- 1.13.0 Android 版横竖屏适配：接 `@capacitor/screen-orientation`，顶栏右上角加方向切换钮，设置页加「跟随设备旋转」开关（默认锁竖屏）。表格在手机上改成卡片堆叠，横屏两列铺满，顶栏/弹窗/热区按 640~844dp 横屏宽度分别量过
- 1.12.4 修 Android APK 里词卡/名言/人物传/句式全空（WebView 全局作用域等六处断裂），构建期加 `checkBundle` 闸门，内容迁移改用 `content.hash` 触发；老设备覆盖安装即可自愈
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

人物图有一份 WebP 缩略图 `src/renderer/img/thumb/`：列表用缩略图、详情页用原图，
缩略图 404 时会自动退回原图（新增人物图后忘了跑压缩脚本也不会裂图）。
整理图片用 `python scripts/optimize-images.py --dry-run`（需要 Pillow，只压缩不改文件名——
改扩展名会让存量用户的图裂掉，因为 `backfillHeroImg` 只回填 img 为空的行）。

**CSP 要求 Chromium 97+**：`index.html` 里 `script-src` 用的是 `wasm-unsafe-eval`
（sql.js 的 WebAssembly 用得到，但通用 eval 已禁用）。Electron 33 自带 Chromium 130；
若要支持更老的 Android System WebView，把那一项改回 `'unsafe-eval'`。

**词卡是纯文字卡片，不配图。** 只有人物传有图（`heroes.img`），接受两种写法：仓库内相对路径（`img/hero-1.png`），或开发者本地上传后生成的 `media:<随机名>`（文件在 `%APPDATA%\linyu-translator\media\`）。

老库的表建好时还没有后加的列，`ensureColumns()` 会在首次启动时逐列 `ALTER` 补上；补列是数据表驱动的，漏一列不会报错，只会在升级后静默地存不进去。

---

## 代码结构

```
src/core/     纯逻辑，四端共用：db / translator / variant / tokenizer / auth / lore / service
src/main/     Electron 主进程：IPC 转发 + 平台相关（对话框、media 目录、日志、窗口几何）
src/mobile/   Capacitor WebView：文件选择 / 分享 / 屏幕方向，并用 service 组出 window.api
src/web/      网页端：idbAdapter / webEntry / patch-app / web.css（第四端的适配层）
src/renderer/ 界面：Vue 3，index.html + app.js + style.css
```

**业务规则只写一份。** 开发者门禁、撤销槽位、导入暂存过期、登录失败锁定、五板块 CRUD
都在 `src/core/service.js`；桌面 `main.js`、移动 `api.js`、Web `webEntry.js` 只是转发，
加接口不用改多处。每端各自留着平台特有的那一半：桌面管 `userData/media` 与文件对话框，
移动端管 Capacitor 插件与屏幕方向，Web 端管 IndexedDB 与浏览器生命周期。

翻译链路分三层，各自可以单独关掉：`translator.js` 默认路径（`Map<zh,linyu>` 直查，最稳）→ `variant.js` 语境选变体（按 slot / sense / rel 打分，`disambiguate` 开关）→ `llm-polish.js` 云端 LLM 润色（可选后处理，失败回退草稿）。

`service.js` 的约定是**成功返回数据、失败一律 throw**：桌面用 `wrap` 捕获成
`{ ok:false, error }`，移动端用 `safe()` 捕获成同样的形状，渲染层看到的东西一致。

改这两个文件时记得同步跑 `node test/service.test.js`——它是双端共用的那部分逻辑唯一的保护网。

## 微信小程序版

`miniprogram/` 是原生 WXML/WXSS/JS 小程序，无构建链，复用与 PC / Android 同一份翻译引擎和内容数据。

**导入方式**：微信开发者工具 → 导入项目 → 目录选 `miniprogram/` → 把 `project.config.json` 里的
`appid` 从 `touristappid` 换成自己的小程序 AppID（没有 AppID 时可用测试号预览）。页面注册在
`app.json`，底部四个 tab：翻译 / 词库 / 历史 / 关于；人物详情是 `wx.navigateTo` 打开的二级页。

**数据同步**：`miniprogram/core/`、`miniprogram/data/`、`miniprogram/pkg-hero/data/` 是生成产物，不要手改。改了
`src/core/seed.json`、`lore*.js`、`translator.js`、`tokenizer.js` 后运行：

```bash
npm run weapp:sync
npm run test:weapp
```

`weapp:sync` 会把引擎与人物数据逐字复制、把 `seed.json` 转成小程序可 require 的
`data/seed.js`；`test:weapp` 校验生成数据与源文件一致、15 条翻译用例在两端输出完全相同、
历史去重/上限/删除，以及主包体积和页面文件完整性。它也已挂进 `npm test`。

**小程序端能力**：本地翻译（最长 500 字，毫秒级）、300ms 防抖实时预览、复制、分享带原文、
历史本机存储（100/200/500/1000 条可调）、三套主题（纯白/粉紫/黑，导航栏与 tabBar 同步变色）、
词库五板块只读浏览与人物详情。主题、实时预览、历史条数都存在 `wx.storage`。

**包结构（微信主包 2MB 硬上限，按 gzip 后计）**：

- 主包只放翻译与检索：`core/`（引擎）、`data/seed.js` + `data/_sst.js`（2435 词条 / 588 句式）、四个 tab 页
- `pkg-hero` 分包放全部浏览类内容：词卡 / 名言 / 人物浏览页、人物详情页、`data/lore*.js`、557 张人物图
- 词库页的「词卡 / 名言 / 人物」三个 tab 点击直接 `navigateTo` 进分包，词库 / 句式仍在主包内切换
- 实测主包 0.53MB / 分包 1.53MB，两边都留了扩两三轮内容的余量

**刻意不做**：开发者登录与五板块 CRUD、导入导出、人物图上传、TTS、收藏、云同步、广告。
人物头像用姓名首字渐变块兜底（图片加载失败自动回落到首字），557 张人物图（112×112 WebP，
共 1388KB）全部放在 `pkg-hero` 分包，主包一张都不留；
外部链接在小程序里不能直接打开，人物详情页改成「复制链接后到浏览器访问」。
小程序不发任何翻译网络请求，输入内容不上传，历史可用「关于 → 清除历史与偏好设置」一键删除。

## 网页端（第四端 · Web 静态站）

`www-web/` 是零构建的纯静态站点，直接用浏览器打开 `index.html` 即可，**没有服务端、没有账号、没有翻译网络请求**。
它复用与桌面 / 安卓 / 小程序完全相同的 `src/core/` 引擎与语料，只补了 Web 特有的一层适配。

```bash
npm run web:build          # 出 www-web/（IIFE 包裹 + 内容指纹 + bundle 闸门），已内置分享码
node scripts/serve-web.js  # 本地调试，http://127.0.0.1:8788
node scripts/smoke-web.js  # 渲染冒烟测试，24 项
```

### 为什么要做这一端

三端已交付后，缺的是「打开链接就能用」的形态。网页端把技术故事从「跨端」推进到
**一套语料 + 一套引擎 + 四种宿主环境的适配层设计**——每端只写平台特有的那一半。

| 端 | 宿主 | 持久化落点 |
|---|---|---|
| PC 桌面 | Electron exe | `%APPDATA%\linyu-translator\linyu.db` |
| Android | Capacitor APK | App 私有目录 `linyu.db` |
| 微信小程序 | 原生 WXML | `wx.storage` |
| **网页** | **静态站** | **IndexedDB** |

### Web 端新增的三个部件

| 文件 | 作用 |
|---|---|
| `src/web/idbAdapter.js` | fsAdapter 家族的**第三种后端**：把 `linyu.db` 以单 key Blob 存进 IndexedDB。此前浏览器兜底是 sessionStorage（刷新即丢库），这是网页端唯一的硬缺口 |
| `src/web/webEntry.js` | Web 入口：IndexedDB 优先 → sessionStorage 降级，挂 `window.__IS_WEB`，持久化探测失败时给出提示条 |
| `src/web/patch-app.js` | 渲染层适配：hash 路由、`?t=` 分享链接、主题跟随系统、`/` 键聚焦搜索 |

**多标签页写入冲突**：`BroadcastChannel` 单写者锁——先打开的标签页持有写权限，后开的自动降级为只读，
避免两个标签页同时把整库 Blob 写回 IndexedDB 互相覆盖。

### 性能与体积

- 首屏约 **2.9 MB 原始 / ~850 KB gzip**；人物原图 9.9 MB 不进关键路径，列表走 2.4 MB 缩略图 + 懒加载
- 翻译在前端毫秒级完成；`checkBundle` 闸门守着内容指纹（1.22.0：词库 1468 / 词卡 914 / 名言 2300 / 人物 322）

### Web 端的语义差异

- **开发者模式** = 编辑当前浏览器 IndexedDB 里的副本，不影响其他端
- **导入 / 导出** 改为浏览器下载与上传
- 未做：桌面端的窗口几何、移动端的屏幕方向与分享面板

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
| 业务层用例 | `test/service.test.js`，门禁 / 撤销 / 导入暂存 / 登录锁定 |
| 五板块 CRUD 契约 | `scripts/crud-check.js`，增/查/改/删逐条断言并落库复核 |
| 语料溯源 | `scripts/attest.js`，判定每条内容在语料里有据可依 |
| 语法检查 | `src/` `scripts/` `test/` 全量 `node --check` |

任何一个步骤失败都会置 `exitCode=1`。所有步骤都会跑完——早先的 `steps.every()` 短路会让第一个失败之后的检查整段跳过，看起来只是少几行输出，实际是把问题藏起来了。

单独跑语料溯源：

```bash
node scripts/attest.js corpus/corpus3.txt,corpus/corpus5.txt,...
```

语料文件列表由 `check.js` 自动取 `corpus/` 目录下的 `corpus*.txt`（目录不存在时回退扫根目录）。判定结果写进 `attest.txt`，`##### NOT ATTESTED #####` 之后是所有「语料里找不到依据 + 没有 verify 来源」的条目。

### 语料与出处的约定

- `corpus/corpus*.txt`：逐字抓下来的原始语料（B 站视频标题、简介、标签、一级评论），是判定的**唯一**本地证据。
- `evidence/manifest-*.json`：采集快照，记录每个视频的 bvid、标题、UP、发布日期、封面 URL、评论条数与抓取时间。manifest 里任何一条都能顺着 bvid 回到原视频。
- 采集脚本：

```bash
node scripts/harvest-bili.js "淋神,淋语,洛克淋国" 60 1
node scripts/harvest-baike.js
```

`harvest-bili.js` 走 B 站公开接口（search / view / reply），**不需要任何账号 Cookie 或 API Key**，产出一份 `corpus-bili-*.txt` 和一份 manifest。参数依次是：关键词（逗号分隔）、最多取多少个新视频、每个视频抓几页评论。

**关键词别凭印象列。** 先从已有 manifest 的视频标题里把真实存在的圈层名挖出来再搜：

```bash
node scripts/mine-corpus.js "corpus/corpus-bili-20261011065020.txt"
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

产物在 `release/`：`淋语翻译器 Setup <版本>.exe`（安装版）、`淋语翻译器 <版本>.exe`（绿色版）、以及解包目录（默认 `win-unpacked/`，被占用时在 `build-<版本>/win-unpacked/`）。`release/` 只是本地构建目录（已 gitignore），对外分发一律挂到 Gitee 发行版的附件上，别把二进制提交进 git 历史。

这台机器上打 PC 包会踩三个坑，1.13.0 就是照着这个顺序趟过去的：

- **winCodeSign 下不动**：electron-builder 要给 exe 写图标和版本号，得先取 `winCodeSign-2.6.0.7z`，GitHub 直连经常超时。走镜像即可：
  `ELECTRON_BUILDER_BINARIES_MIRROR=https://registry.npmmirror.com/-/binary/electron-builder-binaries/ npm run dist`
- **符号链接没权限**：那个压缩包含 macOS 的 `*.dylib` 符号链接，非管理员账户建不了，解压会报 `Cannot create symbolic link`——而 Windows 侧根本用不到这两个文件。手工把包解到 `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0\`（`rcedit-x64.exe` 和 `windows-10\` 在该目录下即可），后续构建就跳过解压。
- **`app.asar` 被占住**：清理旧输出目录时会报 `remove ...\app.asar: being used by another process`（本机并没有本项目进程在跑，嫌疑是 Defender 与搜索索引器）。换个干净目录绕开：
  `npx electron-builder --win --config.directories.output=release/build-<版本>`

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

`www/`（Capacitor 的 webDir）由 `npm run mobile:build` 每次全量重建，是构建产物，已加入 `.gitignore` 不进版本库——改了 `src/` 之后记得重新跑一次 `npm run mobile:build && npx cap sync android`，别指望仓库里那份还是新的。

---

## 直接改本地库之前

```bash
node scripts/sync-seed.js          # 把内置内容同步进已存在的本地库
node scripts/db-order-check.js     # 句式顺序回归
```

这两个脚本会直写 `%APPDATA%` 下的真实库。启动时如果检测到「淋语翻译器.exe」还在跑（`scripts/lib/app-running.js`），会**拒绝执行并提示先退出 App**——App 运行期间会随时把内存库整体落盘，两个写入方同时操作会让滚动备份和回滚都不可信。

---

## 内置内容从哪来

`src/core/lore.js` 聚合 `lore-extra*.js`（extra3 ~ extra10），`src/core/seed.json` 存词库与句式。收录要过三道闸：

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

**只有人物传配图**，只接受真实来源：百度图库（官方原画 / 立绘 / 海报 / 图鉴）/ 百度百科词条图 / B 站视频封面 / UP 主头像。**不使用任何 AI 生成图，不使用占位图**。仓库根曾经存在的 `vibe_images/` 是 AI 生成图，已整体删除，且不在打包白名单内。

词卡一律纯文字，不配图。曾试过给重点概念梗配 B 站视频封面，按「词条名出现在视频标题里」自动匹配出 8 条，逐条核对发现一半是纯词面撞车（「正确的」贴到《生理冷知识：正确的打飞机姿势》、《乌干达》贴到星露谷物语、《体育生》贴到《一身臭汗的体育生冲澡》），已整体撤掉。
