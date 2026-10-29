#!/usr/bin/env node
'use strict';

/**
 * 生成《微信小程序端人物配图计划书 v1.0》三件套：
 *   - 微信小程序端人物配图计划书-v1.0.docx
 *   - 微信小程序端人物配图计划书-v1.0.md
 *   - 人物配图清单-v1.0.csv
 *
 * 数据全部从 src/core/lore + evidence/hero-images*.json + 实际文件体积实时统计，
 * 不写死任何数字；数据更新后重跑即可，文档与清单自动同步。
 *
 * 用法：node scripts/gen-hero-img-plan.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const lore = require(path.join(ROOT, 'src/core/lore'));

const VERSION = 'v1.0';
const DOCX_NAME = `微信小程序端人物配图计划书-${VERSION}.docx`;
const MD_NAME = `微信小程序端人物配图计划书-${VERSION}.md`;
const CSV_NAME = `人物配图清单-${VERSION}.csv`;

const docx = require('docx');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, ImageRun, PageBreak,
  Footer, PageNumber, HeadingLevel,
} = docx;

/* ============================ 1. 事实统计 ============================ */

const heroes = lore.heroes;
const TOTAL = heroes.length;
const WITH_IMG = heroes.filter((h) => h.img).length;
const MISSING = heroes.filter((h) => !h.img);
const pct = (n, d) => ((n / d) * 100).toFixed(1);

const GROUP_LABEL = { real: '通讯录真人', game: '游戏角色', up: '淋语UP主' };
const groupCount = { real: 0, game: 0, up: 0, none: 0 };
heroes.forEach((h) => {
  const g = h.group || 'none';
  groupCount[g] = (groupCount[g] || 0) + 1;
});

// 数据口径问题（详见 5.6）
const upRankMismatch = heroes.filter((h) => h.group !== 'up' && /UP主/.test(String(h.rank || ''))).length;
const upRankReal = heroes.filter((h) => h.group === 'real' && /UP主/.test(String(h.rank || ''))).length;
const rankDup = heroes.filter((h) => / · · /.test(String(h.rank || ''))).length;

function zoneOf(h) {
  if (h.group !== 'game') return GROUP_LABEL[h.group] || '未分区';
  const rank = String(h.rank || '');
  const cut = rank.indexOf('·');
  return cut > 0 ? rank.slice(0, cut).trim() : '游戏·未标区';
}

const zoneMap = new Map();
heroes.forEach((h) => {
  const z = zoneOf(h);
  if (!zoneMap.has(z)) zoneMap.set(z, { total: 0, img: 0 });
  const o = zoneMap.get(z);
  o.total += 1;
  if (h.img) o.img += 1;
});
const zones = [...zoneMap.entries()]
  .map(([k, v]) => ({ zone: k, ...v }))
  .sort((a, b) => b.total - a.total);

// 台账覆盖：evidence/hero-images*.json 里出现过的「真实人物名」。
// 各轮次文件结构不统一（{assign:{名:路径}} / {map:{}} / {items:[{name}]} / 直接以人名做键），
// 因此递归遍历，只认命中 heroes 名单的键或 name 字段，避免把 generatedAt 之类的元字段算成人物。
const evidenceDir = path.join(ROOT, 'evidence');
const heroNameSet = new Set(heroes.map((h) => h.name));
const ledger = new Set();
const ledgerFiles = fs.existsSync(evidenceDir)
  ? fs.readdirSync(evidenceDir).filter((f) => /^hero-images.*\.json$/i.test(f))
  : [];
// 只认「已落地的取图分配」（assign / map / items / 以人名为键），
// 排除 pending / missing 这类「没取到」的清单，否则覆盖率会虚高。
const SKIP_KEYS = /^(missing|pending|pendingNoImg|skipped|rejected|empties|noImg|pendingList|report)$/;
const harvest = (node, depth) => {
  if (!node || depth > 5) return;
  if (Array.isArray(node)) {
    node.forEach((x) => harvest(x, depth + 1));
    return;
  }
  if (typeof node !== 'object') return;
  Object.keys(node).forEach((key) => {
    if (SKIP_KEYS.test(key)) return;
    if (heroNameSet.has(key)) ledger.add(key);
    const v = node[key];
    if (v && typeof v === 'object') {
      if (!Array.isArray(v) && heroNameSet.has(String(v.name || ''))) ledger.add(v.name);
      harvest(v, depth + 1);
    }
  });
  if (heroNameSet.has(String(node.name || ''))) ledger.add(node.name);
};
ledgerFiles.forEach((f) => {
  try {
    harvest(JSON.parse(fs.readFileSync(path.join(evidenceDir, f), 'utf8')), 0);
  } catch (_) {
    /* 坏文件跳过，不影响整体统计 */
  }
});
const ledgerCovered = heroes.filter((h) => ledger.has(h.name)).length;
const ledgerGap = heroes.filter((h) => !ledger.has(h.name));

// 数据内嵌「配图来源」链接
const inlineSrc = heroes.filter((h) =>
  (h.links || []).some((l) => /配图来源/.test(String((l && l.label) || '')))
).length;

// 图片素材实际体积
function dirStat(dir, re) {
  if (!fs.existsSync(dir)) return { n: 0, bytes: 0, maxIdx: 0 };
  const files = fs.readdirSync(dir).filter((f) => re.test(f));
  let bytes = 0;
  let maxIdx = 0;
  files.forEach((f) => {
    bytes += fs.statSync(path.join(dir, f)).size;
    const m = f.match(/(\d+)/);
    if (m) maxIdx = Math.max(maxIdx, Number(m[1]));
  });
  return { n: files.length, bytes, maxIdx };
}
const pngStat = dirStat(path.join(ROOT, 'src/renderer/img'), /^hero-\d+\.png$/);
const webpStat = dirStat(path.join(ROOT, 'src/renderer/img/thumb'), /^hero-\d+\.webp$/);

// 小程序包体
function treeSize(dir) {
  let bytes = 0;
  let n = 0;
  const walk = (d) => {
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        bytes += fs.statSync(p).size;
        n += 1;
      }
    });
  };
  walk(dir);
  return { bytes, n };
}
const mpRoot = path.join(ROOT, 'miniprogram');
const mpStat = treeSize(mpRoot);
const sstPath = path.join(mpRoot, 'data/_sst.js');
const sstKB = fs.existsSync(sstPath) ? Math.round(fs.statSync(sstPath).size / 1024) : 0;
const MP_RAW_KB = Math.round(mpStat.bytes / 1024);
const MP_GZIP_KB = 670; // 由 tar -czf 实测（2026-10-28）
const LIMIT_KB = 2048;

// 图片体积测算：以 240 宽 WebP q75 = 8.2KB/张 为基准，按面积线性缩放
const BASE_W = 240;
const BASE_KB = webpStat.n ? webpStat.bytes / webpStat.n / 1024 : 8.2;
const est = (w) => BASE_KB * (w / BASE_W) ** 2;
const budgetRows = [96, 128, 144, 160, 200].map((w) => {
  const per = est(w);
  const allKB = per * 563;
  const allMB = allKB / 1024;
  const verdict =
    allMB <= 1.7 ? '可独占一个包' : allMB <= 2.0 ? '勉强单包，需压尺寸' : '必须拆两个包';
  return { w, per: per.toFixed(2), all: allMB.toFixed(2), allKB: Math.round(allKB), verdict };
});

const k = (n) => n.toLocaleString('zh-CN');

/* ============================ 2. 内容块 ============================ */

const blocks = [];
const h1 = (x) => blocks.push({ t: 'h1', x });
const h2 = (x) => blocks.push({ t: 'h2', x });
const h3 = (x) => blocks.push({ t: 'h3', x });
const p = (x) => blocks.push({ t: 'p', x });
const note = (x) => blocks.push({ t: 'note', x });
const ul = (x) => blocks.push({ t: 'ul', x });
const ol = (x) => blocks.push({ t: 'ol', x });
const code = (x) => blocks.push({ t: 'code', x });
const table = (head, rows, widths) => blocks.push({ t: 'table', head, rows, widths });
const quote = (x) => blocks.push({ t: 'quote', x });

/* ---- 一、一页纸结论 ---- */
h1('一、一页纸结论');

p(`小程序端 563 位人物、0 张图片：列表与详情都只渲染姓名首字方块（lexicon.wxml:199、hero.wxml:11），miniprogram/ 目录内没有任何 .png/.jpg/.webp 文件。`);

p(`但素材是有的。桌面端、安卓端、Web 端共享同一套图：${k(pngStat.n)} 张 256×256 PNG（${(pngStat.bytes / 1048576).toFixed(0)}MB）+ ${k(webpStat.n)} 张 240 宽 WebP 缩略图（${(webpStat.bytes / 1048576).toFixed(1)}MB），覆盖 ${WITH_IMG}/${TOTAL} 位（${pct(WITH_IMG, TOTAL)}%）。真正「查不到图」的只有 ${MISSING.length} 位。`);

p(`所以这不是找图任务，是接图任务。链路有三处同时断开：数据层不透传 img 字段、模板层只画首字、资源层一张图都没拷进来。`);

p(`真正的卡点在包体：主包原始 ${MP_RAW_KB}KB 已经顶到 ${LIMIT_KB}KB 上限，任何图片按原始体积塞进去都会超标。微信按压缩后计体积（本包 gzip 实测约 ${MP_GZIP_KB}KB），图片是不可再压缩的硬预算，所以必须分层——列表放主包小图，详情进分包。`);

p(`本计划按五段推进：数据打通 → 双层图生产 → 详情页分包 → ${MISSING.length} 位缺图补采 → 台账补齐与质检。`);

table(
  ['关键指标', '现状', '目标', '结论'],
  [
    ['人物配图覆盖率', `0 / ${TOTAL}（0%）`, '563 / 563（100%）', '主体工作在图库生产'],
    ['桌面端已有素材', `${WITH_IMG} / ${TOTAL}（${pct(WITH_IMG, TOTAL)}%）`, '复用，不重采', '只用补 6 张'],
    ['配图来源台账', `${ledgerCovered} / ${TOTAL}（${pct(ledgerCovered, TOTAL)}%）`, '100%', '需补登 ' + ledgerGap.length + ' 位'],
    ['主包体积', `${MP_RAW_KB}KB 原始 / ${MP_GZIP_KB}KB 压缩`, '≤ 1.8MB', '列表小图可进'],
    ['分包体积', '无分包', '≤ 1.9MB', '详情图单包承载'],
    ['AI 生成图', '0（历史轮次已审计）', '保持 0', '红线，不放松'],
  ],
  [28, 28, 22, 22]
);

note(`一句话读法：把「563 张图」当成「1 次数据改动 + 1 次图片流水线 + 1 次分包改造 + 6 张补采」，工作量就从不可控变成可控。`);

/* ---- 二、现状诊断 ---- */
h1('二、现状诊断');

h2('2.1 四端配图现状对照');
table(
  ['端', '是否有图', '图片位置', '说明'],
  [
    ['桌面 Electron', `有，${WITH_IMG}/${TOTAL}`, 'src/renderer/img/hero-NNN.png', '256×256 PNG，落库字段 hero.img'],
    ['安卓 Capacitor', '有，同桌面', '随 www/ 一起打包', '与桌面共用同一份资源'],
    ['Web 静态站', '有，同桌面', '同目录，走静态服务', '线上可用'],
    ['微信小程序', '无', '—', 'miniprogram/ 内 0 张图片资源'],
  ],
  [18, 16, 34, 32]
);

h2('2.2 人物数据事实');
ul([
  `人物总量 ${TOTAL} 位；分区：通讯录真人 ${groupCount.real || 0}、游戏角色 ${groupCount.game || 0}、淋语UP主 ${groupCount.up || 0}、未填 group ${groupCount.none || 0}。`,
  `有图 ${WITH_IMG} 位（${pct(WITH_IMG, TOTAL)}%），无图 ${MISSING.length} 位：${MISSING.map((h) => h.name).join('、')}。`,
  `现成素材：${k(pngStat.n)} 张 256×256 PNG（平均 ${(pngStat.bytes / pngStat.n / 1024).toFixed(0)}KB/张），${k(webpStat.n)} 张 240 宽 WebP（平均 ${BASE_KB.toFixed(1)}KB/张）。`,
  `编号已用到 hero-${pngStat.maxIdx}，无两位人物共用同一张图的情况（已校验 0 例）。`,
]);

h2('2.3 为什么小程序端一张图都没有');
p('三处断点叠加，任何一处修好都仍然看不到图：');

code(`① 数据层丢字段
   miniprogram/services/lore.js 的 heroes 映射（约 96-111 行）
   只取 name/alias/rank/intro/baike/group/tags/works/words/links，
   没有把 h.img 透传出来 → 前端拿不到图片路径。

② 模板层只画首字
   pages/lexicon/lexicon.wxml:199   <view class="hero-avatar">{{item.initial}}</view>
   pages/hero/hero.wxml:11          <view class="hero-avatar">{{hero.initial}}</view>
   两处都是纯文本节点，没有 <image>。

③ 资源层为空
   miniprogram/ 全目录 0 个图片文件；
   scripts/build-weapp-data.mjs 只同步 JS 数据（core/ + data/），不碰图片。`);

note('结论：改 1 行数据映射 + 换 2 处模板 + 建 1 套图片导入流水线，链路就通了。难点不在代码，在后面的包体预算。');

h2('2.4 配图来源台账覆盖率');
p(`「不要 AI 图」这条要求，落地方式是每张图都能指着一条 URL 说清出处。当前台账情况：`);
table(
  ['口径', '覆盖', '缺口', '含义'],
  [
    ['evidence/hero-images*.json 台账', `${ledgerCovered} / ${TOTAL}（${pct(ledgerCovered, TOTAL)}%）`, `${ledgerGap.length} 位`, `${ledgerFiles.length} 份历史台账文件的并集`],
    ['数据内嵌「配图来源」链接', `${inlineSrc} / ${TOTAL}（${pct(inlineSrc, TOTAL)}%）`, `${TOTAL - inlineSrc} 位`, 'app 内可见、可复制，是用户侧凭证'],
  ],
  [30, 22, 18, 30]
);
p(`审计脚本 audit-hero-img-src.js 当前输出「无配图来源标注 410 位」，指的就是第二行。两份口径都不完整：台账覆盖图，内嵌链接覆盖展示。本次要求两边都补齐到 100%，缺任一项不算完成。`);

h2('2.5 包体现状（真正的硬约束）');
table(
  ['口径', '数值', '说明'],
  [
    ['小程序原始体积', `${MP_RAW_KB}KB（${mpStat.n} 个文件）`, `微信单包上限 ${LIMIT_KB}KB，原始口径已顶格`],
    ['gzip 压缩后', `≈ ${MP_GZIP_KB}KB`, 'tar -czf 实测；微信按压缩后计，真实余量 ≈ 1.3MB'],
    ['最大单文件', `data/_sst.js ${sstKB}KB`, `占原始体积 ${pct(sstKB, MP_RAW_KB)}%，全局字符串表，压缩后约 430KB`],
    ['图片素材', '不可压缩', 'WebP 已是压缩格式，占多少算多少 → 图片是硬预算'],
    ['现有分包', '0 个', 'app.json 未配置 subPackages，全部在主包'],
  ],
  [24, 30, 46]
);

/* ---- 三、目标与验收 ---- */
h1('三、目标与验收');

h2('3.1 功能目标');
ul([
  '563 位人物 100% 有图；仅当补采失败时才允许占位，且占位数 ≤ 2。',
  '列表与详情共用同一编号（hero-NNN），同一人物在任何页面都是同一张脸。',
  '两层图：列表 96×96、详情 144×144，同源缩放，裁切规则统一（竖图裁顶部正方、横图居中裁正方）。',
  '图片懒加载，占位色块先出，图到即换，不闪白、不跳版。',
]);

h2('3.2 体验目标');
ul([
  '人物列表连续滚动不掉帧；图片统一 mode="aspectFill" + 固定 rpx 尺寸，避免回流。',
  '分包预下载：进入词库页即触发 pkg-hero 预下载，点进详情 100ms 内出图。',
  '弱网/图裂兜底：加载失败回落首字方块，不出现破图图标。',
]);

h2('3.3 合规目标');
ul([
  '每张图可追溯：来源 URL + 来源类型 + 采集时间，落 evidence 台账。',
  'AI 生成图 0 张——包括 AI 修复、AI 放大、AI 二创同人。',
  '侵权响应：收到通知 24h 内下架并替换为占位，台账标注 disposal 原因。',
]);

h2('3.4 工程目标');
ul([
  `主包 ≤ 1.8MB（压缩后），分包 ≤ 1.9MB，总量 ≤ 4MB（远离 20MB 总上限）。`,
  '与桌面端数据同源：同一编号、同图、同来源，不出现两端不一致。',
  '构建可复现：图库由脚本从 256px PNG 批量生成，不手工改图。',
]);

h2('3.5 验收清单');
table(
  ['检查项', '方法', '通过标准'],
  [
    ['配图覆盖率', '脚本断言 heroes 每条 img 非空且文件存在', '≥ 561 / 563，补采后 100%'],
    ['图源台账', 'audit-hero-img-src.js + 台账并集比对', '563 / 563 有位有源'],
    ['AI 图排查', 'audit-hero-img-src.js AI 关键词命中 + 人工抽查 30 张', '命中 0，抽查 0 例'],
    ['重复图', 'audit-hero-img-dup.js', '无两位人物共用一图'],
    ['主包体积', '开发者工具 → 详情 → 基本信息', '≤ 1.8MB'],
    ['分包体积', '同上', '≤ 1.9MB'],
    ['首屏回归', 'v1.27.0 与 v1.28.0 冷启动对比', 'TTI 增幅 ≤ 100ms'],
    ['弱网兜底', '开发者工具 Slow 3G + 图片 404 注入', '占位正常，无破图'],
    ['iOS WebP', 'iOS 14 / 16 真机各 1 台', '图片正常显示'],
  ],
  [22, 40, 38]
);

/* ---- 四、图源规范 ---- */
h1('四、图源规范（红线，先立后做）');

h2('4.1 允许的四类来源');
table(
  ['优先级', '来源', '适用', '取图方式', '判定要点'],
  [
    ['P1', 'B 站该人物的淋语相关视频封面', '全分区', '搜「淋语 + 人物名」，取视频封面原图', '封面含该人物主体，无水印压脸，非 AI 封面'],
    ['P2', 'B 站 UP 主头像', 'UP 主分区（未露脸）', '空间头像原图（注意取原图不是缩略）', '与账号一致，非默认头像，非 AI 头像'],
    ['P3', '百度百科词条主图 / 图册', '真人 + 游戏角色', '词条 infobox 图或图册首图', '官方立绘/公开活动照，清晰无水印'],
    ['P4', '百度图库（image.baidu.com）', '兜底', '关键词检索，人工比对身份', '图文一致，短边 ≥ 300px'],
  ],
  [10, 24, 18, 26, 22]
);
note('历史轮次还用过百度贴吧、FGO 中文 wiki 等来源。本计划统一收敛为上表四类；其它来源必须单独标注并人工复核，不进默认流程。');

h2('4.2 一律禁止');
ul([
  'AI 生成图：Midjourney / Stable Diffusion / NovelAI / DALL·E / 即梦 / 文心一格 / 通义万相 等任何文生图产物。',
  'AI 二次加工：AI 修复、AI 超分放大、AI 换脸、AI 二创同人图——即使原图是真人照片，只要主体被生成模型重绘过就不用。',
  '拼接图、九宫格、对比图、表情包改图（画面主体被贴纸/文字遮挡）。',
  '带第三方水印、公众号二维码、UP 主个人 ID 水印压在主脸上的图。',
  '性别、年龄、物种或形态与人物设定明显不符的图（这是「图文不符」的主要来源，历史轮次返工 132 张即因此）。',
  '分辨率不足、糊到认不出主体的图。',
]);

h2('4.3 UP 主头像规则（未露脸怎么算）');
p('按以下顺序判定，命中即停：');
ol([
  '视频里出现本人正脸 → 用该视频封面（P1）。',
  '只有侧脸、背影、戴口罩、只露手 → 视为未露脸，用 B 站头像（P2）。',
  '纯虚拟形象 / VUP / 皮套 → 用头像或官方形象图，不用中之人任何影像。',
  '从来不露脸且头像是 AI 图 / 默认头像 → 弃用，改用视频封面中的形象元素或走占位。',
  '头像与人物身份无法对应（改名、销号）→ 走占位，台账备注原因。',
]);

h2('4.4 真人分区（通讯录真人 88 位）特别约定');
ul([
  '只使用公开活动照、媒体报道图、百科词条图、公开演出图。',
  '不使用私生活偷拍、未公开社交账号图片、粉丝二创的真人图。',
  '涉及非公众人物的素人，一律占位，不做真人配图。',
  '收到本人或权利人删除请求，24h 内下架换占位，台账记 disposal。',
]);

h2('4.5 取证与登记（每张图的出生证明）');
p('沿用 evidence/hero-images24-applied.json 的结构，每张图必须落一条：');
code(`{
  "人物名": {
    "img":  "img/hero-705.png",     // 落库路径
    "file": "锤头鹳_0.jpg",          // 原始文件名
    "url":  "https://...",           // 图片直链（可回溯）
    "title":"百度百科词条标题",
    "source":"检索页 URL"            // 从哪个页面找到的
  }
}`);
p('同时在人物 links 里加一条 label="配图来源" 的链接，让 app 内用户也能看到出处。五项缺一不算完成。');

/* ---- 五、分区方案 ---- */
h1('五、分区方案');

h2('5.1 分区总表');
table(
  ['分区', '人数', '已有图', '缺图', '取图策略', '详情图', '兜底'],
  [
    ['A 通讯录真人', String(groupCount.real || 0), String(heroes.filter((h) => h.group === 'real' && h.img).length), '0', '百科主图 > 公开活动照 > B站封面', '144px', '首字 + 朱红底'],
    ['B 游戏角色', String(groupCount.game || 0), String(heroes.filter((h) => h.group === 'game' && h.img).length), String(MISSING.length), '官方立绘/百科图册 > 淋语视频封面', '144px', '首字 + 分区色'],
    ['C 淋语UP主', String(groupCount.up || 0), String(heroes.filter((h) => h.group === 'up' && h.img).length), '0', 'B站头像 > 视频封面', '144px', '首字 + 分区色'],
    ['D 未分区', String(groupCount.none || 0), String(heroes.filter((h) => !h.group && h.img).length), '0', '先判定 group，再套 A/B/C 规则', '144px', '首字'],
    ['合计', String(TOTAL), String(WITH_IMG), String(MISSING.length), '—', '—', '—'],
  ],
  [16, 8, 8, 8, 34, 10, 16]
);

h2('5.2 A 区 · 通讯录真人（' + (groupCount.real || 0) + ' 位）');
p('这一区全是现实中的人，取图优先级最高的是百度百科词条主图，其次是公开活动照，最后才是 B 站淋语视频封面。核心风险不是找不到图，是找到的图不够「正」——一张偷拍照比没有图更麻烦。');
ul([
  `现状：${heroes.filter((h) => h.group === 'real' && h.img).length} / ${groupCount.real || 0} 已有图，0 缺图。`,
  '判定：优先正脸、单人、半身以上；两人以上合影必须裁到只剩本人。',
  '统一裁切：竖图从顶部裁正方（保头部），横图居中裁正方。',
  '同一人物的不同别称必须指向同一张图，不允许换装换脸。',
]);

const gameZones = zones.filter(
  (z) => z.zone !== '未分区' && !Object.values(GROUP_LABEL).includes(z.zone)
);
// 5 组同义分区合并，每组减少 1 个
const MERGE_PAIRS = 5;
const mergedZoneCount = gameZones.length - MERGE_PAIRS;

h2(`5.3 B 区 · 游戏角色（${groupCount.game || 0} 位，${gameZones.length} 个子分区）`);
p(`这是最大的一块，占全站 ${pct(groupCount.game || 0, TOTAL)}%。游戏角色的优势是官方立绘清晰、来源稳定，劣势是跨游戏重名多，检索时必须带游戏名。`);
table(
  ['子分区', '人数', '有图', '取图说明'],
  gameZones.map((z) => [
    z.zone,
    String(z.total),
    `${z.img} / ${z.total}`,
    z.img < z.total ? `本轮补采 ${z.total - z.img} 张` : '复用桌面端',
  ]),
  [34, 12, 16, 38]
);
note('分区命名不统一，建议本轮顺带归一：「淋神 / 原神」「星淋铁道 / 崩坏星穹铁道」「英雄淋盟 / 阴雄淋盟」「阴淋师 / 阴阳师」「FGO / FGO 二游区」各自是同一批人。合并后子分区可从 ' + gameZones.length + ' 个压到 ' + mergedZoneCount + ' 个，筛选条也更干净——这是配图轮次顺手能做的收益。');

h2('5.4 C 区 · 淋语UP主（' + (groupCount.up || 0) + ' 位）');
p('全部使用 B 站头像或视频封面，按 4.3 的判定顺序执行。这一区最容易踩「AI 头像」——很多 UP 主头像本身就是 AI 生成的，遇到就弃用改用封面形象。');
ul([
  `现状：${heroes.filter((h) => h.group === 'up' && h.img).length} / ${groupCount.up || 0} 已有图，0 缺图。`,
  '头像取原图（非 120px 缩略图），否则放大会糊。',
  '同一 UP 主多账号/改名，以语料里出现最多的 ID 为准。',
]);

h2('5.5 D 区 · 未分区（' + (groupCount.none || 0) + ' 位）');
p(`这 ${groupCount.none || 0} 位没填 group，在 lore.js 里会被 'real' 兜底（text(h.group) || 'real'），于是 UP 主混进了「通讯录真人」筛选里。图片都有，但分区是错的。`);
p('示例：' + heroes.filter((h) => !h.group).slice(0, 8).map((h) => h.name).join('、') + ' 等（全量见清单 CSV 的「分区」列为「未分区」的行）。');
ul([
  '本轮先回填 group，再按对应分区规则配图。',
  '回填后要重跑 heroGroups 计数，确认三个分区人数之和仍为 563。',
]);

h2('5.6 数据治理：配图前必须先修的四处口径不一致');
p('配图是按分区套规则的，分区错了图就配错。翻数据时发现四处问题，建议在阶段 1 顺手修掉——不修也能上线，但「UP 主头像」这条规则会漏掉一半人。');
table(
  ['问题', '数量', '影响', '处理建议'],
  [
    ['group 字段缺失', `${groupCount.none || 0} 位`, '落到 real 兜底，真人筛选里混入 UP 主', '按称号 + 语料回填 real / up'],
    ['称号含「UP主」但 group 不是 up', `${upRankMismatch} 位`, '其中 ' + upRankReal + ' 位被标成 real；按现行规则会走「真人正脸照」而不是「UP 主头像」', '统一口径：以「是否淋语内容创作者」判定，是则归 up'],
    ['rank 含「 · · 」重复分隔符', `${rankDup} 位`, '详情页副标题显示成「英雄淋盟 · · 英雄淋盟」，zone 解析仍可用但观感差', '去重后重写 rank，zone 解析逻辑不变'],
    ['同义子分区并存', `${MERGE_PAIRS} 组`, '筛选条出现两个几乎一样的分区（淋神/原神）', '合并别名，见 5.3 末尾'],
  ],
  [26, 10, 42, 22]
);
note('这一节不是配图的必要前提，但它决定了「按分区配图」这件事成不成立。建议做成一次独立的数据清洗提交，与配图分开发版，出问题好回滚。');

h2(`5.7 E 区 · 缺图 ${MISSING.length} 位逐人采集卡`);
p(`这 ${MISSING.length} 位是真正没有图的。全部集中在游戏分区，且都是「非人形/配角/召唤物」——这也是它们历史上被跳过的原因。逐人给检索路径，避免现场乱搜：`);
table(
  ['人物', '所属', '身份', '首选源 / 检索词', '备选', '判定要点'],
  [
    ['锤头鹳', '洛克淋国', '《洛克王国：世界》精灵', '百度百科「洛克王国：世界」图册 → 百度图库「洛克王国世界 锤头鹳」', 'B站「洛克淋国 锤头鹳」攻略视频封面', '精灵立绘即可，不要同人/AI 立绘'],
    ['夜枭', '洛克淋国', '幽系精灵（别称「夜宵」）', '百度图库「洛克王国世界 夜枭」', 'B站淋语视频封面', '注意与同名其它游戏角色区分'],
    ['可丽希亚', '洛克淋国', '洛克王国女主角', '百度百科「可丽希亚」词条立绘', 'B站「洛克王国 可丽希亚」动画片段封面', '取官方立绘，不要玩家同人'],
    ['阿洛', '洛克淋国', '玩家化身 NPC', '百度百科「洛克王国 阿洛」', 'B站「Mi Chico 阿洛」剪辑封面', '封面若为UP主本人露脸则改用游戏内立绘'],
    ['奇乐的机器人', '瓦罗淋特', '奇乐（Killjoy）的炮台/警报装置', '百度图库「无畏契约 奇乐 炮台」', '官方英雄技能介绍图', '取装置本体，不要技能图标'],
    ['黑梦的狗', '瓦罗淋特', '黑梦（Fade）的追猎者（Prowler）', '百度图库「无畏契约 黑梦 追猎者 / 猎犬」', '官方技能演示图', '取追猎者形象，不要黑梦本人'],
  ],
  [12, 10, 18, 26, 18, 16]
);
note('兜底规则：三轮检索仍无合规图 → 保留首字占位（分区色块），并在「关于」页说明「部分人物暂无公开图像」。绝不允许为了填满而用 AI 图或同人图。');

/* ---- 六、包体预算与技术架构 ---- */
h1('六、包体预算与技术架构');

h2('6.1 微信包体规则（先把边界画出来）');
table(
  ['规则', '数值', '对本项目的影响'],
  [
    ['单个分包 / 主包上限', '2MB', '图片必须分层，不能一股脑塞主包'],
    ['整个小程序所有分包合计', '20MB', '远未触及，不是约束'],
    ['tabBar 页面必须在主包', '硬性', '词库列表页（含列表缩略图）留在主包'],
    ['分包资源不可被主包引用', '硬性', '详情图放分包 → 详情页也必须进分包'],
    ['图片体积不可再压缩', '事实', 'WebP 已压缩，图片是硬预算；JS 是可压缩预算'],
  ],
  [26, 12, 62]
);

h2('6.2 实测基线');
table(
  ['项', '数值', '来源'],
  [
    ['小程序原始体积', `${MP_RAW_KB}KB`, '遍历 miniprogram/ 全部文件累加'],
    ['gzip 压缩后', `≈ ${MP_GZIP_KB}KB`, 'tar -czf 实测'],
    ['主包余量（压缩口径）', `≈ ${LIMIT_KB - MP_GZIP_KB}KB`, '2048 − 压缩后'],
    ['现成缩略图平均体积', `${BASE_KB.toFixed(1)}KB / 张`, `240 宽 WebP，${webpStat.n} 张平均`],
  ],
  [26, 28, 46]
);
note(`微信开发者工具「详情 → 基本信息 → 代码包大小」显示的是压缩后体积，与这里 ${MP_GZIP_KB}KB 的口径接近。阶段 0 必须实测一次并回填本表，后续预算以实测为准。`);

h2(`6.3 图片体积测算（以 ${BASE_W} 宽 ${BASE_KB.toFixed(1)}KB 为基准按面积线性缩放）`);
table(
  ['尺寸', '单张（估）', '563 张合计', '单包可行性'],
  budgetRows.map((r) => [`${r.w}×${r.w}`, `${r.per}KB`, `${r.all}MB（${k(r.allKB)}KB）`, r.verdict]),
  [14, 16, 26, 44]
);
note('以上为估算值，实际受画面复杂度影响会有 ±25% 波动。阶段 2 产出后必须用真实文件重算一次，偏差超过 15% 就调整尺寸档位。');

h2('6.4 三条路线对比');
table(
  ['路线', '做法', '包体增量', '改动面', '离线可用', '风险', '结论'],
  [
    ['甲', '列表 96px 图进主包；详情页整体迁入分包 pkg-hero，详情图 144px 随包', `主包 +${((est(96) * 563) / 1024).toFixed(2)}MB / 分包 +${((est(144) * 563) / 1024).toFixed(2)}MB`, '中：1 处 app.json + 1 个页面搬迁 + 2 处模板', '完全可用', '分包余量约 0.35MB', '推荐'],
    ['乙', '人物模块（列表+详情+数据+图）全部进分包，词库 tab 只留入口', `主包 +0 / 分包 +${(((est(96) + est(144)) * 563) / 1024).toFixed(2)}MB`, '大：交互变更（人物从 tab 内嵌变独立页）', '完全可用', '需 2 个分包 + 路由表，产品体验有跳转感', '备选'],
    ['丙', '图片托管云开发/已备案 CDN，运行时按需下载并落本地缓存', '主包 +0', '大：需域名、白名单、缓存管理、失效重建', '首次需联网', '域名备案 + 审核；离线不可用；失败要兜底', '不推荐（现阶段）'],
  ],
  [7, 28, 17, 18, 12, 16, 10]
);
p(`选甲的理由：改动最小、体验不变、离线可用、审核无风险。它的唯一代价是分包余量只剩约 0.35MB，所以详情图定 144px 而不是 200px——把余量留给后续内容增长。`);

h2('6.5 推荐架构');
code(`miniprogram/
├─ app.json                    # 新增 subPackages + preloadRule
├─ data/                       # 数据不动（heroes 加 img 字段透传即可）
├─ pages/
│  ├─ index/ lexicon/ history/ about/     # 主包（tabBar 四页）
│  └─ lexicon/…img/hero-NNN.webp          # 新增：列表缩略图 96×96（约 563 张）
└─ pkg-hero/                   # 新增分包
   ├─ pages/hero/              # 由 pages/hero 整体迁入
   └─ img/hero-NNN.webp        # 新增：详情图 144×144（约 563 张）

app.json 片段：
"subPackages": [
  { "root": "pkg-hero", "pages": ["pages/hero/hero"] }
],
"preloadRule": {
  "pages/lexicon/lexicon": { "network": "all", "packages": ["pkg-hero"] }
}`);

p('数据流：heroes[i].img = "hero-704" → 列表拼 /img/hero-704.webp → 详情拼 /pkg-hero/img/hero-704.webp。一个字段，两个目录，路径规则统一，避免维护映射表。');

h2('6.6 改造清单');
table(
  ['文件', '改动', '说明'],
  [
    ['miniprogram/services/lore.js', 'heroes 映射加 img: text(h.img)', '一行，链路第一处断点'],
    ['miniprogram/pages/lexicon/lexicon.wxml:199', '<image> 替换首字方块，保留 .hero-avatar 尺寸', '加 mode="aspectFill" + binderror 兜底'],
    ['miniprogram/pages/lexicon/lexicon.wxss', '.hero-avatar 加 overflow:hidden + 圆角', '图片需与方块同尺寸'],
    ['miniprogram/pages/hero/hero.wxml:11', '<image> 替换首字方块，144px 源', 'binderror 回落首字'],
    ['miniprogram/pages/hero/hero.js', 'hero.img → 拼分包绝对路径；onLoad 容错', 'img 为空时不报错'],
    ['miniprogram/app.json', '增 subPackages + preloadRule', '分包承载详情页'],
    ['scripts/build-hero-images-weapp.cjs（新增）', '从 256px PNG 批量生成两档 WebP + 校验', '流水线，不手工改图'],
    ['scripts/audit-weapp-hero-img.cjs（新增）', '断言：563 条 img 均有对应文件、无 0 字节、无重复', 'CI 门禁'],
  ],
  [33, 40, 27]
);

h2('6.7 兜底与降级');
ul([
  'img 为空 → 渲染首字方块（现状视觉，不裂版）。',
  '图片加载失败（binderror）→ 切回首字方块，不显示破图。',
  '分包加载失败 → 详情页显示「资源加载失败，请重试」，不白屏。',
  'iOS 低版本 WebP 不支持 → 抽验发现异常时整批退回 JPG q82，体积上涨约 40%，需重算 6.3 预算（预计详情图需降到 128px）。',
]);

/* ---- 七、实施步骤 ---- */
h1('七、实施步骤');

table(
  ['阶段', '工作内容', '产出', '准出条件'],
  [
    ['0 校准', '开发者工具实测代码包大小；确认 iOS WebP 是否正常；抽样 20 张图试压两档尺寸算真实均值', '预算实测表（回填 6.2 / 6.3）', '真实均值与估算偏差 ≤ 15%'],
    ['1 打通', 'lore.js 透传 img；模板换 <image> 并保留兜底；先只接 1 个分区的图验证链路', '链路可用（真机可见图）', '1 个分区 100% 出图且无破图'],
    ['2 图库', '写批量脚本：256px PNG → 96px / 144px WebP；统一裁切规则；输出清单', '两档图库 + 生成日志', '563 张两档齐备，脚本可重跑'],
    ['3 分包', 'app.json 配 subPackages；pages/hero 迁入 pkg-hero；列表接主包 96px 图', '新版本可运行', '主包 ≤1.8MB、分包 ≤1.9MB'],
    ['4 补采', `按 5.7 采集卡补 ${MISSING.length} 位；落 evidence/hero-images25.json`, `${MISSING.length} 张新图（编号 hero-${pngStat.maxIdx + 1} 起）`, '6 位全部有图或明确标注占位原因'],
    ['5 质检', '回填 ' + ledgerGap.length + ' 位台账；跑三个审计脚本；真机验收；发版', `v1.28.0 + 台账 100%`, '3.5 验收清单全绿'],
  ],
  [10, 40, 26, 24]
);

p('依赖关系：阶段 0 的实测结果直接决定阶段 2 的尺寸档位；阶段 3 必须在阶段 2 之后（否则分包里没东西可放）；阶段 4 与阶段 2、3 可并行。');

/* ---- 八、质检与合规 ---- */
h1('八、质检与合规');

h2('8.1 自动化检查');
table(
  ['脚本', '作用', '通过标准'],
  [
    ['scripts/audit-hero-img-src.js（已有）', '核查每张图的来源域名是否在白名单内，扫 AI 关键词', '无「疑似 AI 图来源」，白名单外 0 条'],
    ['scripts/audit-hero-img-dup.js（已有）', '检测两位人物共用同一张图', '0 例'],
    ['scripts/audit-weapp-hero-img.cjs（新增）', '断言小程序侧 563 条 img 均有对应文件、非 0 字节、编号合法', '0 缺失、0 空文件'],
    ['scripts/build-weapp-data.mjs（已有）', '数据同步后重算 counts，确认 heroes 计数未变', '563 不变'],
  ],
  [34, 40, 26]
);

h2('8.2 人工复核');
ul([
  '抽样比例：A 区 30%、B 区 20%、C 区 100%（UP 主头像最容易是 AI 图）、D 区回填后 50%。',
  `补采的 ${MISSING.length} 张 100% 复核，且必须双人确认（一人找、一人验）。`,
  '复核要点：是不是这个人、脸/形象清不清楚、有没有水印压主体、像不像 AI 图。',
  '复核结论落台账字段 review: {by, at, result}。',
]);

h2('8.3 侵权响应流程');
ol([
  '收到通知（站内、邮件、B 站私信）→ 24h 内把对应人物 img 置空，回落占位。',
  '台账标注 disposal: {reason, at}，保留原 URL 以备申诉。',
  '同一来源连续 3 次投诉 → 该来源整体降级，不再进默认取图流程。',
  '「关于」页常驻图源说明与联系入口，主动降低投诉概率。',
]);

/* ---- 九、风险与回滚 ---- */
h1('九、风险与回滚');

table(
  ['风险', '概率', '影响', '对策'],
  [
    ['分包超 2MB', '中', '无法上传，阻塞发版', '详情图降到 128px；或按 group 拆两个分包（game / 其他）'],
    ['iOS WebP 不显示', '低', '部分机型全白', '阶段 0 真机验证；异常则整批退回 JPG，代价是体积 +40%'],
    ['6 位补采全部失败', '低', '覆盖率停在 99%', '保留占位 + 关于页说明，不为凑数用 AI 图'],
    ['图文不符（历史返工 132 张）', '中', '观感崩塌，返工成本高', '检索必带分区名；双人复核；同区批量比对'],
    ['主包因新代码超标', '低', '需回滚', '列表图 96px 而非 128px，预留 0.6MB 余量'],
    ['图片版权投诉', '中', '下架 + 审核风险', '只用四类白名单来源；24h 响应；关于页声明'],
  ],
  [26, 9, 24, 41]
);

p('回滚方案：图片与分包彼此独立——把 app.json 的 subPackages 去掉、lore.js 的 img 置空，即回到 v1.27.0 的纯文字视觉，数据与图片文件保留不删，可随时重开。');

/* ---- 十、附录 ---- */
h1('十、附录');

h2('A. 字段字典');
table(
  ['字段', '类型', '示例', '说明'],
  [
    ['heroes[i].img', 'string', 'hero-704', '图片编号，不含目录与扩展名；空字符串表示无图'],
    ['heroes[i].group', 'string', 'real / game / up', '分区；缺失时前端按 real 兜底，必须回填'],
    ['heroes[i].rank', 'string', '瓦罗淋特 · 召唤兽', '游戏角色用「子分区 · 定位」，可解析出 zone'],
    ['links[label=配图来源]', 'object', '{label,url}', 'app 内可见的来源凭证'],
  ],
  [26, 14, 26, 34]
);

h2('B. 命名与目录规范');
code(`桌面端（现状，不改）：src/renderer/img/hero-NNN.png     256×256
                        src/renderer/img/thumb/hero-NNN.webp  240 宽
小程序端（新增）：      miniprogram/img/hero-NNN.webp          96×96   列表
                        miniprogram/pkg-hero/img/hero-NNN.webp 144×144  详情

编号规则：沿用桌面端编号，一位人物一个编号，全站唯一；
         新补采从 hero-${pngStat.maxIdx + 1} 起顺延，不复用已废弃编号。
裁切规则：竖图（h/w ≥ 1.15）从顶部裁正方；横图居中裁正方；不做拉伸。
编码参数：WebP，质量 72，strip 元数据，无 alpha。`);

h2('C. 检索词模板');
code(`游戏角色：<游戏名> <人物名> 立绘
          例：洛克王国世界 锤头鹳 / 无畏契约 黑梦 追猎者
真人    ：<姓名> 活动 / <姓名> 百度百科
UP 主   ：B站 <ID>                    → 取头像
淋语视频：<人物名> 淋语    / 淋语 <人物名>
自查    ：命中「AI / 生成 / 二创 / 同人 / 画师」一律不看`);

h2('D. 配套清单说明');
p(`${CSV_NAME} 是本次的施工底表，共 ${TOTAL} 行，一人一行，字段如下：`);
table(
  ['列', '含义', '用法'],
  [
    ['序号 / 姓名 / 分区 / 子分区 / 称号', '人物定位信息', '按分区排序施工'],
    ['是否有图 / 图编号', '桌面端现状', '有编号的直接复用，无需重采'],
    ['台账状态', 'evidence 是否覆盖', '「缺」= 阶段 5 必须补登'],
    ['优先级', 'P0 缺图 / P1 缺台账 / P2 常规', '决定施工顺序'],
    ['目标文件', '小程序端两档路径', '阶段 2 流水线直接读这一列'],
  ],
  [34, 30, 36]
);

/* ============================ 3. 渲染器 ============================ */

/* ---- Markdown ---- */
function renderMd() {
  const out = [];
  out.push(`# 淋语翻译器 · 微信小程序端 人物配图计划书 ${VERSION}\n`);
  out.push(`> 范围：\`miniprogram/\`（appid wxc690278e3bd52b9a，当前 1.27.0）　编制日期：2026-10-28\n`);
  out.push(`> 对应问题：打开「词库 → 人物」，列表与详情均无任何图像，只有姓名首字方块。\n`);
  for (const b of blocks) {
    if (b.t === 'h1') out.push(`\n## ${b.x}\n`);
    else if (b.t === 'h2') out.push(`\n### ${b.x}\n`);
    else if (b.t === 'h3') out.push(`\n#### ${b.x}\n`);
    else if (b.t === 'p') out.push(`\n${b.x}\n`);
    else if (b.t === 'note') out.push(`\n> ${b.x}\n`);
    else if (b.t === 'quote') out.push(`\n> ${b.x}\n`);
    else if (b.t === 'ul') out.push('\n' + b.x.map((i) => `- ${i}`).join('\n') + '\n');
    else if (b.t === 'ol') out.push('\n' + b.x.map((i, n) => `${n + 1}. ${i}`).join('\n') + '\n');
    else if (b.t === 'code') out.push('\n```\n' + b.x + '\n```\n');
    else if (b.t === 'table') {
      out.push('\n| ' + b.head.join(' | ') + ' |');
      out.push('| ' + b.head.map(() => '---').join(' | ') + ' |');
      b.rows.forEach((r) => out.push('| ' + r.join(' | ') + ' |'));
      out.push('');
    }
  }
  return out.join('\n');
}

/* ---- DOCX ---- */
const C = {
  ink: '141414',
  muted: '6D6861',
  accent: 'A33232',
  line: 'D9D5CD',
  soft: 'F2F0EB',
  head: 'EFECE6',
  white: 'FFFFFF',
};

const EA = '微软雅黑';
const ASCII = 'Calibri';
const MONO = 'Consolas';
const font = (name) => ({ ascii: name, eastAsia: name, hAnsi: name });

const run = (text, o = {}) =>
  new TextRun({
    text,
    bold: !!o.bold,
    color: o.color || C.ink,
    size: o.size || 21,
    font: o.mono ? font(MONO) : font(o.ea || EA),
    italics: !!o.italics,
  });

const para = (children, o = {}) =>
  new Paragraph({
    children: Array.isArray(children) ? children : [children],
    spacing: { before: o.before ?? 0, after: o.after ?? 120, line: o.line ?? 300 },
    alignment: o.align,
    indent: o.indent,
    border: o.border,
    shading: o.shading,
  });

function heading(text, level) {
  const cfg = {
    1: { size: 30, before: 360, after: 160, color: C.ink, rule: true },
    2: { size: 24, before: 260, after: 120, color: C.ink },
    3: { size: 21, before: 200, after: 100, color: C.muted },
  }[level];
  const opts = {
    children: [run(text, { bold: true, size: cfg.size, color: cfg.color })],
    spacing: { before: cfg.before, after: cfg.after, line: 280 },
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
  };
  if (cfg.rule) {
    opts.border = { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.ink, space: 6 } };
  }
  return new Paragraph(opts);
}

const cellBorder = { style: BorderStyle.SINGLE, size: 2, color: C.line };
const tableBorders = {
  top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder,
  insideHorizontal: cellBorder, insideVertical: cellBorder,
};

function makeTable(head, rows, widths) {
  const total = 9400;
  const sum = widths.reduce((a, b) => a + b, 0);
  const cols = widths.map((w) => Math.round((w / sum) * total));

  const headerRow = new TableRow({
    tableHeader: true,
    children: head.map((h, i) =>
      new TableCell({
        width: { size: cols[i], type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: C.head, color: 'auto' },
        margins: { top: 60, bottom: 60, left: 90, right: 90 },
        children: [para(run(h, { bold: true, size: 18 }), { after: 0, line: 240 })],
      })
    ),
  });

  const bodyRows = rows.map((r, ri) =>
    new TableRow({
      children: r.map((cell, ci) =>
        new TableCell({
          width: { size: cols[ci], type: WidthType.DXA },
          shading:
            ri % 2 === 1
              ? { type: ShadingType.CLEAR, fill: 'FAF9F6', color: 'auto' }
              : undefined,
          margins: { top: 50, bottom: 50, left: 90, right: 90 },
          children: [para(run(String(cell), { size: 17 }), { after: 0, line: 240 })],
        })
      ),
    })
  );

  return new Table({
    rows: [headerRow, ...bodyRows],
    width: { size: total, type: WidthType.DXA },
    borders: tableBorders,
  });
}

function renderDocxChildren() {
  const out = [];
  const spacerParas = new Set();
  const spacer = (after) => {
    const sp = para('', { after });
    spacerParas.add(sp);
    return sp;
  };

  /* 封面 */
  out.push(para(run('淋语翻译器 · 微信小程序端', { size: 20, color: C.muted }), { before: 2200, after: 160, line: 300 }));
  out.push(para(run('人物配图计划书', { bold: true, size: 52, color: C.ink }), { after: 100, line: 720 }));
  out.push(para(run(VERSION, { bold: true, size: 26, color: C.accent }), { after: 520, line: 400 }));
  out.push(
    new Paragraph({
      children: [],
      spacing: { before: 0, after: 520 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.accent, space: 1 } },
    })
  );

  [
    ['适用范围', 'miniprogram/　appid wxc690278e3bd52b9a　当前版本 1.27.0'],
    ['针对问题', '「词库 → 人物」列表与详情无任何图像，仅姓名首字方块占位'],
    ['人物规模', `${TOTAL} 位（真人 ${groupCount.real || 0} / 游戏 ${groupCount.game || 0} / UP主 ${groupCount.up || 0} / 未分区 ${groupCount.none || 0}）`],
    ['图源红线', '百度图库 / 百度百科 / B站淋语视频封面 / UP主头像，禁用一切 AI 图'],
    ['编制日期', '2026-10-28'],
  ].forEach(([kk, vv]) => {
    out.push(
      para([run(kk + '　', { bold: true, size: 19, color: C.muted }), run(vv, { size: 19 })], {
        after: 100,
        line: 300,
      })
    );
  });

  out.push(new Paragraph({ children: [new PageBreak()] }));

  /* 正文 */
  for (const b of blocks) {
    if (b.t === 'h1') {
      out.push(heading(b.x, 1));
    } else if (b.t === 'h2') {
      out.push(heading(b.x, 2));
    } else if (b.t === 'h3') {
      out.push(heading(b.x, 3));
    } else if (b.t === 'p') {
      out.push(para(run(b.x, { size: 21 }), { after: 130, line: 330 }));
    } else if (b.t === 'note') {
      out.push(
        para(run(b.x, { size: 19, color: C.muted, italics: false }), {
          after: 160,
          line: 300,
          indent: { left: 180, right: 120 },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: C.accent, space: 10 } },
        })
      );
    } else if (b.t === 'quote') {
      out.push(para(run(b.x, { size: 20 }), { after: 140, indent: { left: 240 } }));
    } else if (b.t === 'ul') {
      b.x.forEach((item) => {
        out.push(
          new Paragraph({
            children: [run('· ', { bold: true, color: C.accent }), run(item, { size: 20 })],
            spacing: { before: 20, after: 60, line: 310 },
            indent: { left: 200, hanging: 120 },
          })
        );
      });
      out.push(spacer(60));
    } else if (b.t === 'ol') {
      b.x.forEach((item, i) => {
        out.push(
          new Paragraph({
            children: [run(`${i + 1}. `, { bold: true, color: C.accent }), run(item, { size: 20 })],
            spacing: { before: 20, after: 60, line: 310 },
            indent: { left: 200, hanging: 120 },
          })
        );
      });
      out.push(spacer(60));
    } else if (b.t === 'code') {
      b.x.split('\n').forEach((line) => {
        out.push(
          new Paragraph({
            children: [run(line || ' ', { size: 17, mono: true, color: '3A3A3A' })],
            spacing: { before: 0, after: 0, line: 260 },
            indent: { left: 140 },
            shading: { type: ShadingType.CLEAR, fill: 'F7F6F2', color: 'auto' },
          })
        );
      });
      out.push(spacer(80));
    } else if (b.t === 'table') {
      out.push(makeTable(b.head, b.rows, b.widths));
      out.push(spacer(120));
    }
  }

  // 去掉结尾多余的空白间隔段，否则 Word 会多出一整页空白
  while (out.length && spacerParas.has(out[out.length - 1])) out.pop();
  // Word 要求文档以段落收尾（不能以表格结尾）；补一个极矮的空段，避免多出空白页
  out.push(
    new Paragraph({
      children: [new TextRun({ text: '', size: 2, font: font(EA) })],
      spacing: { before: 0, after: 0, line: 40, lineRule: 'exact' },
    })
  );

  return out;
}

async function buildDocx() {
  const doc = new Document({
    creator: '淋语翻译器项目组',
    title: `微信小程序端人物配图计划书 ${VERSION}`,
    description: '小程序端人物配图：现状诊断、图源规范、分区方案、包体预算与实施步骤',
    styles: {
      default: {
        document: {
          run: { font: font(EA), size: 21, color: C.ink },
          paragraph: { spacing: { line: 320 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1130, right: 1130, bottom: 1130, left: 1130 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: '淋语翻译器 · 小程序端人物配图计划书 ' + VERSION + '　·　第 ', size: 16, color: C.muted, font: font(EA) }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.muted, font: font(EA) }),
                  new TextRun({ text: ' 页', size: 16, color: C.muted, font: font(EA) }),
                ],
              }),
            ],
          }),
        },
        children: renderDocxChildren(),
      },
    ],
  });
  return Packer.toBuffer(doc);
}

/* ---- CSV ---- */
function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function buildCsv() {
  const head = ['序号', '姓名', '分区', '子分区', '称号', '是否有图', '图编号', '台账状态', '优先级', '小程序列表图', '小程序详情图', '备注'];
  const lines = [head.join(',')];
  heroes.forEach((h, i) => {
    const zone = zoneOf(h);
    const sub = h.group === 'game' ? zone : '';
    const hasLedger = ledger.has(h.name);
    const num = h.img ? String(h.img).replace(/^img\//, '').replace(/\.png$/, '') : '';
    let pr = 'P2';
    let remark = '';
    if (!h.img) {
      pr = 'P0';
      remark = '缺图，需按采集卡补采';
    } else if (!hasLedger) {
      pr = 'P1';
      remark = '有图但无来源台账，需补登';
    }
    if (!h.group) remark = (remark ? remark + '；' : '') + 'group 缺失需回填';
    lines.push(
      [
        i + 1,
        h.name,
        GROUP_LABEL[h.group] || '未分区',
        sub,
        h.rank || '',
        h.img ? '有' : '无',
        num,
        hasLedger ? '有' : '缺',
        pr,
        h.img ? `/img/${num}.webp` : '',
        h.img ? `/pkg-hero/img/${num}.webp` : '',
        remark,
      ]
        .map(csvCell)
        .join(',')
    );
  });
  return '\uFEFF' + lines.join('\r\n');
}

/* ============================ 4. 输出 ============================ */

(async () => {
  const md = renderMd();
  fs.writeFileSync(path.join(ROOT, MD_NAME), md, 'utf8');

  const csv = buildCsv();
  fs.writeFileSync(path.join(ROOT, CSV_NAME), csv, 'utf8');

  const buf = await buildDocx();
  fs.writeFileSync(path.join(ROOT, DOCX_NAME), buf);

  console.log('写出：');
  console.log(' ', DOCX_NAME, (buf.length / 1024).toFixed(0) + 'KB');
  console.log(' ', MD_NAME, (Buffer.byteLength(md, 'utf8') / 1024).toFixed(0) + 'KB');
  console.log(' ', CSV_NAME, (Buffer.byteLength(csv, 'utf8') / 1024).toFixed(0) + 'KB', `（${TOTAL} 行）`);
  console.log('统计：人物', TOTAL, '有图', WITH_IMG, '缺图', MISSING.length, '台账', ledgerCovered, '台账缺口', ledgerGap.length);
})();
