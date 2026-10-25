# scripts/legacy —— 归档，不再维护

这里放的是开发过程中用过一次就废弃的采集/修补脚本，功能都已被正式脚本取代：

| 旧脚本 | 现在的正式做法 |
|---|---|
| `fetch-heroes*.js` / `fetch-ups.js` | `scripts/harvest-bili.js`、`scripts/harvest-works.js` |
| `harvest-tagged.js` | `scripts/mine-corpus.js` + `scripts/apply-curated.js` |
| `seed-add*.js` / `seed-fix3.js` / `prune3.js` | `scripts/apply-curated.js`（幂等） |
| `lore-prune.js` / `lore-verify.js` | `scripts/attest.js` |
| `order-check.js` / `dbdiff.js` / `dbq.js` | `scripts/db-order-check.js` |
| `probe-*.js` / `sheet.js` / `ctx.js` | 一次性调试，留作当时的取证记录 |

保留它们只是为了让历史操作可追溯。**新改动不要加到这里**，也不要依赖这里的东西跑流程。
`check.js` 的语法检查与 ESLint 都已跳过这个目录。
