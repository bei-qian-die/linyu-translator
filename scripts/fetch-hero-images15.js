'use strict';
// 第十五轮人物配图（洛克淋国）：从 evidence/hero-cand15.json（百度图库候选）+ UP 头像里，
// 按标题启发式挑出最像「官方立绘/百科图/wiki 图鉴」的一张，用 scripts/crop-hero.py 裁成 256x256 PNG，
// 写到 src/renderer/img/hero-N.png，并把来源/命中标题/被否决候选写进 evidence/hero-images15.json。
// 全程只用百度图库真实官方图 / 百度百科词条图 / B 站 UP 头像，绝不使用 AI 图。
// 裁剪后由主控逐张 Read 核验；挑错的改 FORCE_IDX 后重跑。
//
// 用法: node scripts/fetch-hero-images15.js [--dry-run]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'src', 'renderer', 'img');
const CAND_DIR = path.join(ROOT, 'evidence', 'hero-cand15');
const CAND_MANIFEST = path.join(ROOT, 'evidence', 'hero-cand15.json');
const UP_MANIFEST = path.join(ROOT, 'evidence', 'hero-up-avatars15.json');
const OUT_EVI = path.join(ROOT, 'evidence', 'hero-images15.json');
const PY = process.env.PY || 'py';
const DRY = process.argv.includes('--dry-run');

const cands = JSON.parse(fs.readFileSync(CAND_MANIFEST, 'utf8')).items;
const ups = fs.existsSync(UP_MANIFEST) ? JSON.parse(fs.readFileSync(UP_MANIFEST, 'utf8')).items : [];

// 加分：百科词条图 / wiki 图鉴 / 官方素材立绘
const GOOD = /\/item\/洛克王国|游戏《|wiki|bwiki|素材|立绘|原画|图鉴|百科|官方|宠物档案|进化链|中的宠物|设定的/;
// 减分：带字截图 / 攻略 / 实机 / 炫彩异色展示
const BAD = /技能|攻略|怎么|如何|强度|培养|评测|获取|搭配|介绍|一览|解析|教学|效果|炫彩|异色|刷|pvp|阵容|推荐|课题|流程|记录|展示|亲昵|骑乘|孵化|预测|制作过程|核爆|最优|大肉|抗|c位|通关|挑战|贪玩|想和你|杂技|跑得|宝藏|主流|拉风|坐骑|重做|毫无关联|颜值|帅气|软萌|童年神宠|双进化|大块头|最重|最高|无可匹敌|三倍|男主|棱镜球|洛克钻|黑白/;

// [收录名, 起始 hero 编号, 类型 game|up, 强制候选 idx(可选)]
const PLAN = [
  ['火神', 273, 'game'], ['冥古龙', 274, 'game'], ['花衣蝶', 275, 'game'], ['锤头鹳', 276, 'game', 8],
  ['音速犬', 277, 'game'], ['恶魔狼', 278, 'game', 9], ['雪影娃娃', 279, 'game'], ['夜枭', 280, 'game', 0],
  ['布灵布灵', 281, 'game'], ['波多西', 282, 'game'], ['饮雪狂兽', 283, 'game'], ['水灵', 284, 'game'],
  ['彩蝶鲨', 285, 'game'], ['白金独角兽', 286, 'game'], ['奇梦咪', 287, 'game'], ['小幽幽', 288, 'game'],
  ['一只高脂阴猫', 289, 'up'], ['翊坤宫娘娘', 290, 'up'], ['森先茶茶', 291, 'up'],
  ['南极石化了', 292, 'up'], ['苏卡Remix', 293, 'up'],
];

function score(it) {
  const t = String(it.title || '');
  let s = 0;
  if (GOOD.test(t)) s += 100;
  if (BAD.test(t)) s -= 60;
  // 面积适中加分（太大可能是长图/截图，太小画质差）
  const area = (it.w || 0) * (it.h || 0);
  if (area >= 400 * 400 && area <= 2000 * 2000) s += 10;
  if ((it.w || 0) >= (it.h || 0) * 1.6) s -= 15; // 过宽像横幅截图
  return s;
}

const out = {};
const report = [];
for (const [name, num, type, forceIdx] of PLAN) {
  const dst = path.join(IMG_DIR, `hero-${num}.png`);
  let srcFile, sourceUrl, chosenTitle, rejected = [];

  if (type === 'up') {
    const u = ups.find((x) => x.name === name);
    if (!u || !u.size) { report.push(`[缺图] ${name} 无 UP 头像`); continue; }
    srcFile = path.join(CAND_DIR, u.file);
    sourceUrl = u.url;
    chosenTitle = 'B站 UP 主头像 ' + name;
  } else {
    const list = cands.filter((c) => c.name === name);
    if (!list.length) { report.push(`[缺图] ${name} 无百度候选`); continue; }
    const ranked = [...list].sort((a, b) => score(b) - score(a));
    const chosen = forceIdx != null ? list.find((c) => c.idx === forceIdx) || ranked[0] : ranked[0];
    srcFile = path.join(CAND_DIR, chosen.file);
    sourceUrl = chosen.url;
    chosenTitle = chosen.title;
    rejected = ranked.slice(1, 4).map((r) => ({ idx: r.idx, title: String(r.title).slice(0, 50), score: score(r) }));
  }

  if (!fs.existsSync(srcFile)) { report.push(`[缺图] ${name} 源文件不存在 ${srcFile}`); continue; }
  // 竖长立绘用 contain，其余 fit
  const mode = 'fit';
  if (DRY) { report.push(`[dry] ${name} -> hero-${num}.png | ${chosenTitle.slice(0, 50)}`); continue; }
  try {
    execFileSync(PY, [path.join(ROOT, 'scripts/crop-hero.py'), srcFile, dst, mode], { stdio: 'ignore' });
  } catch (e) {
    report.push(`[裁剪失败] ${name}: ${e.message}`);
    continue;
  }
  out[name] = { img: `img/hero-${num}.png`, source: sourceUrl, candTitle: chosenTitle, type, rejected };
  report.push(`[OK] ${name} -> hero-${num}.png | ${String(chosenTitle).replace(/\s+/g, ' ').slice(0, 50)}`);
}

if (!DRY) fs.writeFileSync(OUT_EVI, JSON.stringify({ generatedAt: new Date().toISOString(), map: out }, null, 2), 'utf8');
console.log(report.join('\n'));
console.log(`\n[done] 配图 ${Object.keys(out).length} 张 -> ${DRY ? '(dry-run)' : OUT_EVI}`);
