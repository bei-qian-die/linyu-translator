// @ts-check
'use strict';

// 版本公告数据 —— 当前版本 1.39.0（2026-11-09）
//
// 生成物：由 `npm run changelog:build` 从根目录 CHANGELOG.md 解析生成，不要手改这个文件。
// 只保留**最新一条**：公告栏只展示当前版本，不做历史版本列表。
// 版本号与 package.json 的 version 强绑定（脚本里是门禁），升版本只改 package.json + CHANGELOG.md。
//
// 双端导出：Node/打包器走 module.exports，浏览器走 window.CHANGELOG_DATA，小程序 require。
const __export = {
  version: "1.39.0",
  date: "2026-11-09",
  summary: "新开「淋物大战阴尸」分区（《植物大战僵尸》的淋语化叫法），五板块按分区口径扩库：词库 +250、句式 +121、词卡 +285、英雄与人物传 +30、名言 +150，四端同步，配图 9 位经人工抽检后落位。",
  items: [
    "新分区：GAME_OF_ZONE 增加 淋物大战阴尸 → 植物大战僵尸；30 位角色 rank 统一「淋物大战阴尸 · 身份称号」，独立成组，不与既有 8 个分区混排",
    "词库 +250（3851 → 4101）：二创术语 54 条（淋物大战阴尸 / 浆尸 / 僵湿 / 阴雄 / 阴熊 / 植男 / 血阴葵 / 豌豆肌肉射手 / 阴夫 / 阴桃 / 阴猫 / 碧莲 / 三墓 / 阴维 / 130 / 买榜 / 雪藏 / 气鼠 / 洗脚婢 …）、植物 70、僵尸 34、玩法黑话 51、淋语通用 41",
    "句式 +121（747 → 868）：PvZ 场景句式 63 条（阳光 / 冷却 / 卡槽 / 铲子 / 小推车 / 波次 / 天梯 / 无尽 / 杂交版 / β 版 / 砸罐子 / 屋顶 / 泳池 / 迷雾 / 墓碑 / 跳波 / 狂暴 / 章鱼 / 铁桶 …）+ 淋语语法句式 58 条；裸词类句式（如「加班」）全部剔除，避免抢走既有词条匹配",
    "词卡 +285（1975 → 2259）：57 条二创术语卡、70 张淋物卡、34 张阴尸卡、51 张玩法卡、73 张淋语卡；type 只用 particle/slang/lyric/meme/hero-alias 五键",
    "英雄 +30 / 人物传 +30（807 → 837）：玉米加农炮、西瓜投手、窝瓜、僵王博士、铁桶僵尸、读报僵尸、舞王僵尸、巨人僵尸、小鬼僵尸等；baike 把「官方设定」与「社区叫法」分开写，works 落到《植物大战僵尸》官方角色",
    "名言 +150（4799 → 4949）：120 条逐字取自本轮采集到的 B 站视频标题/简介（附 BV 链接），30 条为图鉴「宝开语」与经典语录（附原文页），不编造人物原话",
    "配图 9 位：玉米加农炮 / 西瓜投手 / 窝瓜 / 僵王博士 / 铁桶僵尸 / 读报僵尸 / 舞王僵尸 / 巨人僵尸 / 小鬼僵尸，取自 B 站视频封面（图片 URL + BV + 采集时间记在 evidence/pvz-hero-images26.json），跑过联系表人工抽检，张冠李戴的一律删掉、不用占位图凑数；其余 21 位暂缺图（百度图库 / 百科 403、萌娘百科 403、B 站检索接口 412 风控）",
    "采集留痕：新增 scripts/harvest-pvz26.mjs，46 组关键词检索到 671 个视频、1514 行语料，落 corpus/corpus-bili-pvz-*.txt 与 evidence/bili-search-pvz-*.json",
    "工程改动：新增 src/core/lore-extra26.js 并登记进 lore.js 合并链、index.html、build-weapp-data.mjs 的 FILES 白名单；check-three-targets.js 的 lore 路径修正为 v1.30 起的 pkg-hero/data/",
    "门禁：npm run check / test / verify:weapp / audit:weapp-content / weapp:size（主包 1.25MB、分包 1.94MB）/ audit-hero-img-dup 全部通过；attest 本轮新增 0 条未溯源（仓库仍有 255 条历史遗留未溯源，属存量问题）；db-order-check 1 条用例「他就是直男」在改动前同样不通过（词表 直男→蠢直 与用例期望冲突）",
  ],
};

if (typeof module === 'object' && module.exports) module.exports = __export;
else if (typeof window !== 'undefined') window.CHANGELOG_DATA = __export;
