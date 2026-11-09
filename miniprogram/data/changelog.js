// @ts-check
'use strict';

// 版本公告数据 —— 当前版本 1.39.1（2026-11-09）
//
// 生成物：由 `npm run changelog:build` 从根目录 CHANGELOG.md 解析生成，不要手改这个文件。
// 只保留**最新一条**：公告栏只展示当前版本，不做历史版本列表。
// 版本号与 package.json 的 version 强绑定（脚本里是门禁），升版本只改 package.json + CHANGELOG.md。
//
// 双端导出：Node/打包器走 module.exports，浏览器走 window.CHANGELOG_DATA，小程序 require。
const __export = {
  version: "1.39.1",
  date: "2026-11-09",
  summary: "补齐「淋物大战阴尸」分区全部 30 位角色的配图：上一版只有 9 位有图，本版把剩余 21 位一次性落齐，无 AI 生成图。",
  items: [
    "配图来源：百度百科词条主图 16 张（豌豆射手 / 向日葵 / 寒冰射手 / 大嘴花 / 大喷菇 / 火爆辣椒 / 地刺 / 三线射手 / 杨桃 / 墓碑吞噬者 / 疯狂戴夫 / 撑杆跳僵尸 / 蹦极僵尸 / 矿工僵尸等）、百度百科《植物大战僵尸》词条图集 3 张（坚果墙 / 樱桃炸弹 / 磁力菇）、360 图片检索 3 张（模仿者 / 睡莲 / 香蒲，这三个角色百度无专属词条）",
    "核对方式：每张图先出联系表（contact sheet）逐格人工比对，确认是对应角色才落盘；上一版因封面点击诱饵删掉的 21 张没有回流，改用百科图源重取",
    "规格：统一 256×256 PNG（图鉴卡类用上偏裁切保留插画主体），缩略图 240px WebP 由 optimize-images.py 生成",
    "数据：lore-extra26.js 回填 img 与「配图来源 / 图片直链」链接；audit-hero-img-dup 无串图、audit-hero-img-src 通过",
    "四端：PC / 网页 / 安卓 / 小程序同步重发，数据条数不变（词库 4101 / 句式 868 / 词卡 2259 / 英雄 837 / 名言 4949）",
  ],
};

if (typeof module === 'object' && module.exports) module.exports = __export;
else if (typeof window !== 'undefined') window.CHANGELOG_DATA = __export;
