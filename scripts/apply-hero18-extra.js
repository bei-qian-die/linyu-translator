'use strict';

// 第十八轮配图 · 第二批：补充角色（hero-cand18c）+ 已验证 UP 主头像（hero-avatar18）
//
// 与 pick-hero-images18.js 分开，是因为这两批来源目录不同、且 UP 头像是方形原图不需要 contain。
// 编号接在第一批之后（382 起）。
//
// 用法: node scripts/apply-hero18-extra.js [--dry-run]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry-run');
const CAND_C = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/hero-cand18c.json'), 'utf8')).items;
const AVATAR = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/hero-avatar18.json'), 'utf8')).items;

const START = 382;

// 补充角色：取评分最高的那张（cand18c 里 idx 已按下载顺序，0 为首选）
const CHARS = ['小提琴家', '牛仔', '野人', '律师', '幸运儿', '古董商', '守墓人', '击球手'];

// UP 主：只保留「view API 返回的 owner.name 与目标名字一致」的那几个，
// 名字对不上说明 bvid 取错了，宁可不收也不要把别人的头像安到这个人身上。
const UP_OK = ['gulpppppp', '懂法的txz', '不是地才素天才'];

const py = process.platform === 'win32' ? 'python' : 'python3';
const ledger = [];
const skipped = [];
let num = START;

function emit(src, destPng, meta) {
  const webp = destPng.replace(/\.png$/, '').replace(path.join(ROOT, 'src/renderer/img'), path.join(ROOT, 'src/renderer/img/thumb')) + '.webp';
  const rec = { ...meta, img: path.relative(path.join(ROOT, 'src/renderer'), destPng).replace(/\\/g, '/'), thumb: 'img/thumb/' + path.basename(webp) };
  if (!DRY) {
    execFileSync(py, [path.join(ROOT, 'scripts/crop-hero.py'), src, destPng, meta.crop], { stdio: 'pipe' });
    execFileSync(
      py,
      [
        '-c',
        'import sys\nfrom PIL import Image\nim = Image.open(sys.argv[1]).convert("RGB")\nw = 240\nh = max(1, round(im.height * w / im.width))\nim.resize((w, h), Image.LANCZOS).save(sys.argv[2], "WEBP", quality=75, method=6)',
        destPng,
        webp,
      ],
      { stdio: 'pipe' }
    );
    rec.bytes = fs.statSync(destPng).size;
  }
  ledger.push(rec);
  num++;
  return rec;
}

for (const name of CHARS) {
  const cand = CAND_C.filter((x) => x.name === name).sort((a, b) => a.idx - b.idx)[0];
  if (!cand) {
    skipped.push({ name, why: '无候选' });
    continue;
  }
  const src = path.join(ROOT, 'evidence/hero-cand18c', cand.file);
  const png = path.join(ROOT, 'src/renderer/img', `hero-${num}.png`);
  const portrait = (cand.h || 0) >= (cand.w || 1);
  emit(src, png, {
    name,
    grade: 'char',
    crop: portrait ? 'contain' : 'fit',
    w: cand.w,
    h: cand.h,
    source: '百度图库（第五人格 角色 + 立绘检索）',
    url: cand.url,
    title: cand.title,
  });
}

for (const name of UP_OK) {
  const av = AVATAR.find((x) => x.name === name);
  if (!av) {
    skipped.push({ name, why: '头像未抓到' });
    continue;
  }
  const src = path.join(ROOT, 'evidence/hero-avatar18', `${name}.jpg`);
  if (!fs.existsSync(src)) {
    skipped.push({ name, why: '头像文件缺失' });
    continue;
  }
  const png = path.join(ROOT, 'src/renderer/img', `hero-${num}.png`);
  emit(src, png, {
    name,
    grade: 'up',
    crop: 'fit',
    w: 0,
    h: 0,
    source: 'B站 UP 主头像（view API owner.face）',
    url: av.face,
    title: `${name} 的头像`,
  });
}

fs.writeFileSync(
  path.join(ROOT, 'evidence/hero-images18-extra.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), count: ledger.length, items: ledger, skipped }, null, 2) + '\n',
  'utf8'
);

console.log(`[extra18] 落地 ${ledger.length} 张（hero-${START} ~ hero-${num - 1}）${DRY ? '（dry-run）' : ''}`);
for (const r of ledger) console.log(`  ${r.name.padEnd(6)} ${r.img}  ${r.crop}`);
for (const s of skipped) console.log(`  [跳过] ${s.name}：${s.why}`);
