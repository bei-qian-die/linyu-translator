// @ts-check
'use strict';

// 版本公告数据 —— 当前版本 1.40.0（2026-11-15）
//
// 生成物：由 `npm run changelog:build` 从根目录 CHANGELOG.md 解析生成，不要手改这个文件。
// 只保留**最新一条**：公告栏只展示当前版本，不做历史版本列表。
// 版本号与 package.json 的 version 强绑定（脚本里是门禁），升版本只改 package.json + CHANGELOG.md。
//
// 双端导出：Node/打包器走 module.exports，浏览器走 window.CHANGELOG_DATA，小程序 require。
const __export = {
  version: "1.40.0",
  date: "2026-11-15",
  summary: "音乐板块 batch 5：野花香 × Gulp 的搞怪二创音源再加 31 条（抖音 8 / 哔哩哔哩 23），二创样例 +62。数据总量 150 → 181 条音源 / 225 → 287 条二创，仍只覆盖这两个梗，不混别的。",
  items: [
    "规模：抖音 45 → 53、哔哩哔哩 40 → 63（网易云 40 / QQ 音乐 25 不动）；分组 野花香 109 → 127、Gulp 32 → 43、双音源 9 → 11",
    "抖音怎么采的：站内搜索仍被「验证码中间页」拦（与 batch 2 同），改三条路——① 基线野花香/Gulp 作品页的 aweme/related 相关推荐流（36 个种子，产出极少）；② 基线 45 个音源的音乐页反取作品作者，再扒作者主页 aweme/post（作者池 300+）；③ batch 1 的登录采集池离线复挖，还留着 1087 个基线里没有的 music_id（batch 3/4 只挑走了多作品分组）",
    "B 站怎么采的：40 个关键词 × 3 页，107 次搜索 / 3210 条结果，命中基线 1148、批内重复 416、无梗标签 1193，剩 453 条过 x/web-interface/view 核验；再人工从 453 里挑 23 条（剔除伴奏/简谱/KTV/影视搬运/尚硅谷 gulp 教程/ASMR 吞咽等无关项）",
    "逐条开页：抖音 35 个音乐页 music/detail 全通过、30 条示例作品页 aweme/detail 全通过；B 站 453 条 view 接口全通过。示例池里「科目二」「数学课」这类只借 BGM 的一律不进正文",
    "修掉一个精度坑：抖音 19 位 id 直接 JSON.parse 会被双精度截断成末尾 000，整批候选全废；改用 Node 22 JSON.parse reviver 的 context.source 取原文后恢复",
    "门禁：本轮不用改校验逻辑（1.38 起已由 scripts/music-platforms.js 平台注册表驱动），npm run music:build 直接过；单测 257 条全绿",
    "四端：桌面 / 安卓 / Web / 小程序同步重发，小程序内 B 站条目仍是「复制 BV 链接」，不跳站外",
  ],
};

if (typeof module === 'object' && module.exports) module.exports = __export;
else if (typeof window !== 'undefined') window.CHANGELOG_DATA = __export;
