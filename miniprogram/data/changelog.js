// @ts-check
'use strict';

// 版本公告数据 —— 当前版本 1.37.0（2026-11-06）
//
// 生成物：由 `npm run changelog:build` 从根目录 CHANGELOG.md 解析生成，不要手改这个文件。
// 只保留**最新一条**：公告栏只展示当前版本，不做历史版本列表。
// 版本号与 package.json 的 version 强绑定（脚本里是门禁），升版本只改 package.json + CHANGELOG.md。
//
// 双端导出：Node/打包器走 module.exports，浏览器走 window.CHANGELOG_DATA，小程序 require。
const __export = {
  version: "1.37.0",
  date: "2026-11-06",
  summary: "音乐板块做了一轮双平台补货：抖音 + 哔哩哔哩新增 14 条「野花香 / Gulp」搞怪音源、26 条二创示例，全部逐条开页校验后入库，四端同步。",
  items: [
    "本轮新增 14 条 / 26 条二创：抖音 8 条（野花香 6 + Gulp 2）、哔哩哔哩 6 条（野花香 4 + Gulp 1 + 双音源 1）；数据集从 48 条涨到 62 条音源 / 114 条示例",
    "去重基线按现有 48 条执行：抖音按 music_id、B 站按 platform_id、示例按作品 id 三路比对，同一作者跨平台合计最多 2 条；命中基线的 40 条示例 + 37 个音源直接丢弃",
    "B 站条目口径写清：B 站没有独立音乐页，条目链接指向引用该音源的作品页（BV 号），music_id 为 null、platform_id 存 BV，使用量取该作品播放量",
    "合规红线：剔除擦边、性暗示、低俗、硬广带货、AI 搬运与影视搬运；「Gulp / 吞咽音」只收搞笑、表情包、卡点、教学类合规用法",
    "逐条开页校验：抖音 25 个音乐页 + 14 条作品页拦 music/detail / aweme/detail，B 站 18 个 BV 走 x/web-interface/view，失效 0 条；没开过页的链接一律不写进数据集",
    "门禁沿用 batch 2 的双平台 schema：platforms: [\"douyin\",\"bilibili\"]、每条带 source，抖音音乐 id 与 B 站 BV 各自唯一、全部 slug 唯一",
    "小程序继续走「复制链接」，B 站条目复制的是 BV 作品页地址；桌面 / 安卓 / Web 的 openLink 对 https 直接放行，无需额外改动",
    "内容零改动：词库 / 句式 / 词卡 / 人物 / 名言一条没动，本次只扩充音乐板块数据",
  ],
};

if (typeof module === 'object' && module.exports) module.exports = __export;
else if (typeof window !== 'undefined') window.CHANGELOG_DATA = __export;
