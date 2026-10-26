'use strict';

// 第十八轮配图落地：从 evidence/hero-cand18.json 里按人物挑一张，裁成 256×256 装进
// src/renderer/img/hero-NNN.png，并同步生成 240 宽 WebP 缩略图。
//
// 挑图策略：默认取该人物评分最高的候选（candidate.json 已按 score 降序存放，即 idx 0）；
//   PICK 表里显式指定了 idx 的人物以 PICK 为准 —— 人工复核发现首选带字/群像时就在这张表里改号。
//
// 用法: node scripts/pick-hero-images18.js [--dry-run]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CAND = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/hero-cand18.json'), 'utf8')).items;
// 第二批候选：首轮取到的图带水印/大字/二创，改用「第五人格 X 立绘」重抓的那批
const CAND_B = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/hero-cand18b.json'), 'utf8')).items;
const LEDGER = path.join(ROOT, 'evidence/hero-images18.json');
const DRY = process.argv.includes('--dry-run');

const START = 334; // 上一轮（第十七轮）用到 333

// 人物名 → 候选 idx。未列出的人物取 0（评分最高）。
// 值是 { b: n } 表示取第二批（hero-cand18b）里的第 n 张。
const PICK = {
  小丑: { b: 0 },
  时空之影: { b: 0 },
  喧嚣: { b: 0 },
  爱哭鬼: { b: 0 },
  梦之女巫: { b: 1 },
  蜡像师: { b: 1 },
  大副: { b: 0 },
  魔术师: { b: 0 },
  冒险家: { b: 0 },
  病患: { b: 0 },
  玩具商: { b: 0 },
  空军: { b: 0 },
  咒术师: { b: 1 },
  昆虫学者: { b: 0 },
  囚徒: { b: 1 },
};

const by = new Map();
for (const it of CAND) {
  if (!by.has(it.name)) by.set(it.name, []);
  by.get(it.name).push(it);
}
for (const [k, arr] of by) arr.sort((a, b) => a.idx - b.idx);

const byB = new Map();
for (const it of CAND_B) {
  if (!byB.has(it.name)) byB.set(it.name, []);
  byB.get(it.name).push(it);
}
for (const [k, arr] of byB) arr.sort((a, b) => a.idx - b.idx);

const py = process.platform === 'win32' ? 'python' : 'python3';
const ledger = [];
const missing = [];
let num = START;

for (const [name, arr] of by) {
  const pick = PICK[name];
  let cand;
  let dir = 'hero-cand18';
  if (pick && typeof pick === 'object' && pick.b !== undefined) {
    const arrB = byB.get(name) || [];
    cand = arrB.find((x) => x.idx === pick.b) || arrB[0];
    dir = 'hero-cand18b';
  } else {
    cand = arr.find((x) => x.idx === (pick === undefined ? 0 : pick)) || arr[0];
  }
  if (!cand) {
    missing.push({ name, why: '无候选' });
    continue;
  }
  const src = path.join(ROOT, 'evidence', dir, cand.file);
  if (!fs.existsSync(src)) {
    missing.push({ name, why: '候选文件缺失' });
    continue;
  }
  const png = path.join(ROOT, 'src/renderer/img', `hero-${num}.png`);
  const webp = path.join(ROOT, 'src/renderer/img/thumb', `hero-${num}.webp`);
  // 竖图用 contain 防止裁掉头；横图用 fit 填满
  const portrait = (cand.h || 0) >= (cand.w || 1);
  const mode = portrait ? 'contain' : 'fit';
  const rec = {
    name,
    img: `img/hero-${num}.png`,
    thumb: `img/thumb/hero-${num}.webp`,
    candFile: cand.file,
    title: cand.title,
    w: cand.w,
    h: cand.h,
    crop: mode,
    from: dir,
    source: dir === 'hero-cand18b' ? '百度图库（第五人格 角色 + 立绘检索）' : '百度图库（第五人格 角色检索）',
    url: cand.url,
    origin: cand.origin,
  };
  if (!DRY) {
    execFileSync(py, [path.join(ROOT, 'scripts/crop-hero.py'), src, png, mode], { stdio: 'pipe' });
    execFileSync(
      py,
      [
        '-c',
        [
          'import sys',
          'from PIL import Image',
          'im = Image.open(sys.argv[1]).convert("RGB")',
          'w = 240',
          'h = max(1, round(im.height * w / im.width))',
          'im.resize((w, h), Image.LANCZOS).save(sys.argv[2], "WEBP", quality=75, method=6)',
        ].join('\n'),
        png,
        webp,
      ],
      { stdio: 'pipe' }
    );
    rec.bytes = fs.statSync(png).size;
  }
  ledger.push(rec);
  num++;
}

if (!DRY) {
  fs.writeFileSync(
    LEDGER,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: ledger.length,
        startNum: START,
        note: '第五人格角色配图，来源仅百度图库；竖图 contain 补黑边，横图 fit 居中裁切。',
        items: ledger,
        missing,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
}

console.log(`[pick18] 落地 ${ledger.length} 张（hero-${START} ~ hero-${num - 1}）${DRY ? '（dry-run）' : ''}`);
for (const r of ledger) console.log(`  ${r.name.padEnd(6)} ${r.img}  ${r.crop.padEnd(7)} ${r.w}x${r.h}`);
for (const m of missing) console.log(`  [缺失] ${m.name} ${m.why}`);
