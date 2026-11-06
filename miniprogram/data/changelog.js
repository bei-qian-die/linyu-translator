// @ts-check
'use strict';

// 版本公告数据 —— 当前版本 1.38.0（2026-11-06）
//
// 生成物：由 `npm run changelog:build` 从根目录 CHANGELOG.md 解析生成，不要手改这个文件。
// 只保留**最新一条**：公告栏只展示当前版本，不做历史版本列表。
// 版本号与 package.json 的 version 强绑定（脚本里是门禁），升版本只改 package.json + CHANGELOG.md。
//
// 双端导出：Node/打包器走 module.exports，浏览器走 window.CHANGELOG_DATA，小程序 require。
const __export = {
  version: "1.38.0",
  date: "2026-11-06",
  summary: "音乐板块从「能翻的静态音源库」变成「能用的音乐板块」：接入网易云 / QQ 音乐官方音源页，音源从 62 条扩到 150 条；构建脚本改成平台注册表驱动；四端补齐收藏、最近浏览、排序、每日一条 / 随机一条与分享。",
  items: [
    "音源 62 → 150（新增 88 条），二创示例 114 → 225（新增 111 条）：网易云 40 条（野花香 37 + Gulp 3）、QQ 音乐 25 条（野花香）、B 站 23 条（野花香 17 + Gulp 6）；抖音增量 0 条——登录池剩余分组全是「@xx创作的原声」、电商号与模板音乐，按宁缺毋滥口径全部放弃",
    "平台注册表（轨道 B）：新建 scripts/music-platforms.js，每个平台一条 {key, label, musicUrlRe, exampleUrlRe, idField, musicIdPolicy, usageUnit, usageLabel}；build-music.mjs 的链接校验、id 唯一性、平台筛选器与 test/music.test.js 的正则全部从这张表推导。新增平台只加一条配置，不再出现 if (src === 'douyin') 这类硬分支",
    "分组动态化：GROUPS 不再手写，脚本按 tag 自动生成「全部」+ 每梗一组，TAG_META 只负责稳定 key / 显示名 / 排序，组描述由条目数与高频玩法自动统计",
    "去重与合规：候选 531（网易云 232 / QQ 124 / B 站 175 / 抖音池 17 组）；按 slug、平台 id、示例作品 id 三路比对，叠加擦边 / 带货 / 搬运 / 教程 / AI Cover 黑名单与「同作者跨平台合计 ≤2」，最终入库 88 条；每条都开过页才写入",
    "收藏与最近浏览（轨道 C）：桌面 / 安卓落 SQLite music_favs / music_seen 两张表（走现有 SCHEMA + 迁移），Web 落 linyu.music.favs / linyu.music.seen，小程序新建 services/musicFav.js；最近浏览保留 50 条、重复点开回到最前",
    "排序 / 每日一条 / 分享：热度排序按平台内最大值归一化后再比（抖音「人在用」与 B 站 / 网易云 / QQ 的播放量、评论数不混算）；每日一条用「本地日期 + slug」做确定性哈希，同一天结果稳定；分享在小程序走 onShareAppMessage，其余三端复制链接 + 推荐语",
    "界面只加次级筛选：音乐页内新增「全部音源 / 我的收藏 / 最近浏览」chips、排序下拉、每日一条 / 随机一条按钮；小程序 tabBar 仍是 5 项，没有新开页面",
    "静态音源依然不进库：150 条音源只走 src/core/music.js，不写 SQLite、不进导出备份、不进云同步；只有收藏与浏览记录进用户态存储",
    "门禁：npm run music:build 150 首 / 225 条二创且两生成物逐字一致；npm test 全绿（含新增的用户态行为断言）；npm run test:weapp 全绿",
    "内容零改动：词库 / 句式 / 词卡 / 人物 / 名言一条没动，本次只动音乐板块",
  ],
};

if (typeof module === 'object' && module.exports) module.exports = __export;
else if (typeof window !== 'undefined') window.CHANGELOG_DATA = __export;
