// @ts-check
'use strict';

// 版本公告数据 —— 当前版本 1.35.0（2026-11-04）
//
// 生成物：由 `npm run changelog:build` 从根目录 CHANGELOG.md 解析生成，不要手改这个文件。
// 只保留**最新一条**：公告栏只展示当前版本，不做历史版本列表。
// 版本号与 package.json 的 version 强绑定（脚本里是门禁），升版本只改 package.json + CHANGELOG.md。
//
// 双端导出：Node/打包器走 module.exports，浏览器走 window.CHANGELOG_DATA，小程序 require。
const __export = {
  version: "1.35.0",
  date: "2026-11-04",
  summary: "一次开四个分区：淋可梦 / 奥奇淋说 / 淋角洲行动 / divatag。五个板块同时扩量——词库 2435 → 3852，句式 588 → 748，词卡 1375 → 1975，人物传 563 → 807，名言 3199 → 4799，新增英雄配图 244 张。",
  items: [
    "四个分区各自从零登记：scripts/slot-taxonomy25.js 新增 31 个语义位（4 个分区主 key + 27 个专属子位）；src/renderer/app.js 的 SLOT_ORDER 同步加入，筛选顺序按「精灵／属性／术语／版本／自称／整活／通讯录 tag」排",
    "词库 +1417 条：淋可梦 510 / 奥奇淋说 301 / 淋角洲行动 300 / divatag 306；另有 141 条同词头只并入 alias，不覆盖旧释义（scripts/apply-linyu25.js 幂等可重跑）",
    "句式 +160 条：四分区各 40 条，含分区启动句式（淋可梦／奥奇淋说／淋角洲行动／divatag）与各自的特色造句，每条都带可点回的 B 站检索 source",
    "词卡 +600 / 人物传 +244 / 名言 +1600：src/core/lore-extra25.js 由 scripts/gen-lore25.js 生成；名言全部逐字摘自语料评论，人物传的 UP 主段位用本人真实投稿标题与 BV 号，不编造播放量",
    "三角洲分区名归一：库里 三角淋行动 主名改为 淋角洲行动，旧名降为 alias；rank 里的多余分隔符（· ·）一并修掉",
    "DIVA 立独立分区：霉霉（原 slot=圈层黑话）与 玛莎（原 slot=人物）迁入 divatag，词条文本一字不改，只在释义末尾追加分区归属",
    "配图 244 张，零串图零 AI 图：来源限定百度图库／百度百科词条图／B 站 UP 头像，逐张记录来源 URL 到 evidence/hero-images25.json；audit-hero-img-dup.js 共享文件组为 0",
    "补掉历史债：241 位早期人物没有任何可点回来源、15 位式神 works 为空，导致 attest 长期非零；本轮按「补一条 B 站检索链接」「词卡 → 所属游戏官方角色」两级回退补齐，五板块 unattested 全为 0",
    "四端同步：桌面 / Web / 安卓 / 微信小程序共用同一份 seed 与 lore，小程序数据清单追加 lore-extra25.js",
  ],
};

if (typeof module === 'object' && module.exports) module.exports = __export;
else if (typeof window !== 'undefined') window.CHANGELOG_DATA = __export;
