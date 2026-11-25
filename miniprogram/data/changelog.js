// @ts-check
'use strict';

// 版本公告数据 —— 当前版本 1.41.0（2026-11-25）
//
// 生成物：由 `npm run changelog:build` 从根目录 CHANGELOG.md 解析生成，不要手改这个文件。
// 只保留**最新一条**：公告栏只展示当前版本，不做历史版本列表。
// 版本号与 package.json 的 version 强绑定（脚本里是门禁），升版本只改 package.json + CHANGELOG.md。
//
// 双端导出：Node/打包器走 module.exports，浏览器走 window.CHANGELOG_DATA，小程序 require。
const __export = {
  version: "1.41.0",
  date: "2026-11-25",
  summary: "近 30 天（2026-10-26 ～ 2026-11-25）新梗增量：词库 +250、句式 +120、词卡 +250、英雄与人物传 +30、名言 +150，四端同步，新增 33 张真实来源配图（无 AI 图）。",
  items: [
    "本轮怎么判「新」：主窗口取 2026-10-26 ～ 2026-11-25，条件为「主窗口内首发 / 出现新用法分支 / 被重新炒热」三者之一；老梗翻新单列 freshness: revived（本轮 16 条），其余 new（234 条）",
    "采集：scripts/harvest-new27.mjs 用 62 组关键词打 B 站公开检索（带 UA / Referer、320ms 间隔），558 条去重视频、1097 行语料，其中 158 条落在主窗口内；原始响应存 evidence/bili-search-new27-*.json，语料存 corpus/corpus-bili-new27-*.txt",
    "词库 +250（4101 → 4351）：星淋铁道分区名与变体 20、角色淋名 60、版本与系统术语 70、抽象新梗 40、既有分区新说法 60；另有 30 个新写法并入既有中文词的 alias（DB 唯一约束，不新增行）",
    "句式 +120（868 → 988）：全部挂在专有词上（星淋 / 二相 / 狸狸 / 0t / 砂途刃风 / 我+单字角色 / 近 30 天抽象句式），不含裸词泛化模式；新句式追加在表尾，id 更大，不会抢走旧句式的首个命中",
    "词卡 +250（2259 → 2509）：星铁分区与版本 12、角色卡 30、系统与抽卡 40、抽象新梗 45、既有分区 45、角色细节 30、版本抽卡补充 11、圈层补充 47；type 只用 particle/slang/lyric/meme/hero-alias 五键",
    "英雄 +30（837 → 867）：星淋铁道分区补 30 位（花火 / 砂金 / 流萤 / 星期日 / 黄泉 / 白厄 / 椒丘 / 姬子 / 景元 / 刃 / 卡芙卡 / 银狼 / 镜流 / 丹恒 / 三月七 / 克拉拉 / 停云 / 白露 / 藿藿 / 银枝 / 托帕 / 真理医生 / 云璃 / 貊泽 / 飞霄 / 万敌 / 遐蝶 / 希儿 / 布洛妮娅 / 娜塔莎）；rank 统一「星淋铁道 · 称号」，人物传均 ≥200 字，把「官方设定」与「社区叫法」分开写",
    "名言 +150（4949 → 5099）：全部逐字取自本轮采集到的 B 站视频标题（带 BV 链接与 UP 主），不编造人物原话",
    "配图 33 张：星淋铁道 30 位取 biligame《崩坏：星穹铁道》WIKI 角色页官方立绘（文件名即「XX立绘」，最不容易张冠李戴）；历史缺图中「可丽希亚」补齐洛克王国 NPC 立绘。锤头鹳 / 夜枭 / 阿洛 / 奇乐的机器人 / 黑梦的狗 5 位仍无图——检索结果分别是真实鸟类照片、图鉴信息图、以及同游戏的其他角色，按「宁缺勿错」不硬凑，如实留空",
    "分区纪律：GAME_OF_ZONE 补登记 星淋铁道 → 崩坏：星穹铁道（该分区名早在第 10/12 轮就有英雄在用，但一直没登记，导致 works 回退失效）；本轮不新开分区",
    "工程改动：新增 src/core/lore-extra27.js 并登记进 lore.js 合并链 / index.html；小程序端因分包贴着 2MB 硬限，把 extra27 真实数据放主包 data/lore-extra27.js，分包 pkg-hero/data/lore-extra27.js 只留一个转发模块（微信允许分包 require 主包）",
    "包体：主包 1.54MB / pkg-hero 1.94MB，均在 2MB 内（npm run weapp:size 通过）",
    "门禁：check（attest unattested 0，历史遗留 255 条已清零）/ test / lint（新增文件 0 error）/ verify:weapp / audit:weapp-content（拦截词 22 处，与上轮持平，新增 0）/ weapp:size / audit-hero-img-dup（缺图从 27 降到 5）/ audit-hero-img-src / check-three-targets 全部通过；db-order-check 仍有 1 条存量用例「他就是直男」不通过（改前同样不通过）",
  ],
};

if (typeof module === 'object' && module.exports) module.exports = __export;
else if (typeof window !== 'undefined') window.CHANGELOG_DATA = __export;
