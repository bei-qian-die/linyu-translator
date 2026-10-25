# data/ 目录说明

本目录下除 `counts.js` 外全部为**生成物**，禁止手改：

| 文件 | 来源 | 同步命令 |
| --- | --- | --- |
| `seed.js` | `src/core/seed.json` | `node scripts/build-weapp-data.mjs`（仓库根目录） |
| `lore.js` / `lore-extra3~14.js` | `src/core/lore*.js`（逐字节复制） | 同上 |
| `counts.js` | 构建期从 seed + lore 统计 | 同上 |
| `version.js` | 构建期从 `package.json` 读取 | 同上 |

修改词库/句式/词卡/名言/人物请改 `src/core/` 下的源文件，再跑同步命令；
`test/weapp.test.js` 会校验这里与源文件逐字节一致，不一致会直接报错。

> `lore-extra4.js` / `lore-extra5.js` 里的 `dropCards` / `dropQuotes` / `dropHeroes`
> 是 `lore.js` 聚合时的过滤输入（用于剔除不合格条目），不是桌面端专用字段，
> **不能从包内剥离**，否则 `lore.js` 加载即报错。

运行期约定（`services/` 层）：

- `services/content.js` —— 只依赖 `seed.js`（v1.18 约 390KB），驱动翻译页首屏
- `services/lore.js` —— 依赖 `lore*.js`（v1.18 约 1.23MB），词库页/人物页 `onLoad` 时才 require
- `services/history.js` / `prefs.js` / `sec.js` —— 历史存储 / 偏好 / 内容安全（本地词表兜底）
- `services/perf.js` —— 翻译耗时采样；关于页只依赖它，不加载 seed
