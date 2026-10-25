'use strict';

// 把 scripts/curated-heroes13.js 的新增人物并进 src/core/lore-extra13.js。
// 必须等 apply-lore13.js 跑完再执行：extra13 是它生成的，这里只做增量追加。
//
// 为什么单独一个脚本：人物批次和图片批次由不同人准备，合并顺序错了会丢图。
//
// 用法: node scripts/merge-heroes13.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXTRA = path.join(ROOT, 'src/core/lore-extra13.js');
const DRY = process.argv.includes('--dry-run');

if (!fs.existsSync(EXTRA)) {
  console.error('x 找不到 src/core/lore-extra13.js，先跑 node scripts/apply-lore13.js');
  process.exit(1);
}

const { HEROES } = require(path.join(ROOT, 'scripts/curated-heroes13.js'));
const extra = require(EXTRA);
const fsMod = require('fs');

const known = new Set(extra.heroes.map((h) => h.name));
const lore = require(path.join(ROOT, 'src/core/lore'));
const dupNames = [];
const missingImg = [];
const incoming = [];

for (const h of HEROES) {
  if (known.has(h.name) || lore.heroes.some((x) => x.name === h.name)) {
    dupNames.push(h.name);
    continue;
  }
  const imgPath = path.join(ROOT, 'src/renderer', h.img);
  if (!fsMod.existsSync(imgPath)) missingImg.push(h.name + ' → ' + h.img);
  incoming.push(h);
}

console.log(
  `新增人物 ${incoming.length} 条（跳过重名 ${dupNames.length}，缺图 ${missingImg.length}），extra13 现有人物 ${extra.heroes.length}`
);
if (dupNames.length) console.log('  重名跳过：' + dupNames.join('、'));
if (missingImg.length) console.log('  缺图：' + missingImg.join(' | '));
if (missingImg.length) {
  console.error('x 有图片文件不存在，先补图再合并');
  process.exit(1);
}
if (DRY || !incoming.length) {
  console.log(DRY ? '（--dry-run，未写盘）' : '（没有需要合并的新增人物）');
  process.exitCode = 0;
  return;
}

const banner = '// [merge-heroes13] 游戏人物批次（配图由 evidence/hero-images13.json 溯源）';
const block =
  '\n' +
  banner +
  ';\n(function () {\n  var add = ' +
  JSON.stringify(incoming, null, 2) +
  ';\n  var have = new Set(heroes.map(function (h) { return h.name; }));\n' +
  '  add.forEach(function (h) { if (!have.has(h.name)) heroes.push(h); });\n})();\n';

let srcText = fs.readFileSync(EXTRA, 'utf8');
if (srcText.includes(banner)) {
  console.log('（已合并过，跳过 —— 幂等）');
  process.exitCode = 0;
  return;
}
// heroes 数组声明必须在插入点之前；追加到文件末尾的 module.exports 之前
const anchor = srcText.lastIndexOf('module.exports');
if (anchor < 0) {
  console.error('x 合并锚点（module.exports）没找到，请人工处理');
  process.exit(1);
}
srcText = srcText.slice(0, anchor) + block + '\n' + srcText.slice(anchor);
fs.writeFileSync(EXTRA, srcText, 'utf8');
console.log('已写入 lore-extra13.js，重新读取校验…');
delete require.cache[require.resolve(EXTRA)];
const after = require(EXTRA);
console.log(`合并后 extra13 人物 ${after.heroes.length} 条`);
