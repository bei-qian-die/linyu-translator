'use strict';

// 第十六轮人物配图落地：
//   1) 精灵/人物 —— 从 evidence/hero-cand16.json 的百度图库候选里按人工核验过的 PICKS 取图
//      （核验记录见 evidence/hero-images16-review.md，拼图 evidence/sheet16-picks.png 等）
//   2) UP 主 —— 走 B 站 view API 取 owner.face（未露脸 UP 主的头像），与既有各轮做法一致
// 全部裁成 256x256 PNG 写到 src/renderer/img/hero-N.png，来源写 evidence/hero-images16.json。
// 禁止 AI 图：本脚本只下载、裁剪、缩放，不生成任何像素内容。
//
// 用法: node scripts/apply-hero-images16.js [--dry-run]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'src/renderer/img');
const CAND_DIR = path.join(ROOT, 'evidence/hero-cand16');
const CAND_JSON = path.join(ROOT, 'evidence/hero-cand16.json');
const RAW_UP = path.join(ROOT, 'evidence/hero-img-raw16');
const OUT = path.join(ROOT, 'evidence/hero-images16.json');
const PY = process.env.PY || 'py';
const DRY = process.argv.includes('--dry-run');

// [名字, hero 编号, 候选 idx]   idx = -1 表示走 B 站头像
// 编号 294 起连续分配，中间不留空号（空号会在人物列表里留下死链）。
// 撤下的对象：鬼妈妈（= 翊坤宫娘娘 的圈内叫法，不另立人物，改写进 alias）、
//             钨丝贝贝（候选全是带字截图/卡池图，无可用的官方单图，改列待补图）、
//             可丽希亚（候选只有二创绘画过程图，不符合「官方原画/立绘/百科图」白名单，改列待补图）
const PLAN = [
  ['喵喵', 294, 4], ['火花', 295, 3], ['罗隐', 296, 0], ['瞌睡王', 297, 2],
  ['鸭吉吉', 298, 2], ['水球球', 299, 2], ['奇丽花', 300, 0], ['草依虫', 301, 1],
  ['鬼雾', 302, 2], ['利灯鱼', 303, 5], ['炫目鸡', 304, 4], ['刺蜗贝', 305, 0],
  ['独眼巨魔', 306, 4], ['河马小天使', 307, 0], ['喷火鸟', 308, 3], ['陈铁兽', 309, 2],
  ['龙希帕尔', 310, 2], ['圣羽翼王', 311, 5], ['幽颖树', 312, 5], ['幽铃', 313, 3],
  ['多灵主', 314, 3], ['巴哈姆特', 315, 0], ['凡鹰', 316, 0], ['大耳帽兜', 317, 2],
  ['卡瓦重', 318, 2], ['阿布', 319, 2], ['卷毛鸭', 320, 2], ['云梦豚', 321, 5],
  ['吉洛斯', 322, 2], ['咔咔鸟', 323, 1], ['梦想三三', 324, 2], ['绒仙子', 325, 0],
  ['失心蜂', 326, 2], ['障眼魔', 327, 2], ['夜游魔', 328, 4], ['上岸蛙', 329, 2],
  ['吸泥鸥', 330, 2], ['朔夜伊芙', 331, 5],
  // UP 主头像：茶博士蔚星 / 安宁（未露脸 UP 主用头像，符合配图来源白名单）
  ['茶博士蔚星', 332, -1, 'BV1fLLh64EVk'],
  ['安宁', 333, -1, 'BV1xPnR6DEmZ'],
];

const items = JSON.parse(fs.readFileSync(CAND_JSON, 'utf8')).items;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function upFace(bvid) {
  const r = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
    headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
  });
  const j = await r.json();
  const d = j && j.data;
  if (!d || !d.owner) throw new Error('view API 无 owner');
  return { url: d.owner.face, name: d.owner.name, title: d.title };
}

(async () => {
  fs.mkdirSync(RAW_UP, { recursive: true });
  const map = {};
  const rows = [];
  for (const [name, num, idx, bvid] of PLAN) {
    const dst = path.join(IMG_DIR, `hero-${num}.png`);
    let srcFile;
    let sourceUrl;
    let candTitle;
    let type;

    if (idx === -1) {
      try {
        const face = await upFace(bvid);
        srcFile = path.join(RAW_UP, `${name}.jpg`);
        const r = await fetch(face.url, { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' } });
        fs.writeFileSync(srcFile, Buffer.from(await r.arrayBuffer()));
        sourceUrl = face.url;
        candTitle = `B站 UP 主头像 ${face.name}`;
        type = 'up';
      } catch (e) {
        rows.push(`[缺图] ${name}: 头像抓取失败 ${e.message}`);
        continue;
      }
    } else {
      const it = items.find((x) => x.name === name && x.idx === idx);
      if (!it) {
        rows.push(`[缺图] ${name}: 无候选 idx=${idx}`);
        continue;
      }
      srcFile = path.join(CAND_DIR, it.file);
      sourceUrl = it.url;
      candTitle = it.title;
      type = 'game';
    }

    if (!fs.existsSync(srcFile)) {
      rows.push(`[缺图] ${name}: 源文件缺失 ${srcFile}`);
      continue;
    }
    const rel = `img/hero-${num}.png`;
    rows.push(`[OK] ${name} -> hero-${num}.png | ${String(candTitle).slice(0, 46)}`);
    map[name] = { img: rel, source: sourceUrl, candTitle, type };
    if (!DRY) {
      try {
        execFileSync(PY, [path.join(ROOT, 'scripts/crop-hero.py'), srcFile, dst, 'contain'], { stdio: 'ignore' });
      } catch (e) {
        rows.push(`[裁剪失败] ${name}: ${e.message}`);
        delete map[name];
      }
    }
  }
  if (!DRY) fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), map }, null, 2) + '\n', 'utf8');
  console.log(rows.join('\n'));
  console.log(`\n配图 ${Object.keys(map).length} 张 -> ${DRY ? '(dry-run)' : OUT}`);
})();
