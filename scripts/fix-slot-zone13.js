'use strict';

// 语义位里的游戏分区名有两套写法（英雄淋盟/阴雄淋盟、王者淋耀/淋者荣耀），
// 同一分区被拆成两个 chip，筛选时数量对不上。这里统一收敛到词库里数量多的那套。
// 幂等：跑第二次不再有变化。
//
// 用法: node scripts/fix-slot-zone13.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEED = path.join(ROOT, 'src/core/seed.json');
const DRY = process.argv.includes('--dry-run');

const ALIAS = { 阴雄淋盟: '英雄淋盟', 淋者荣耀: '王者淋耀' };

const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
let changed = 0;
for (const w of seed.words) {
  if (!w.slot) continue;
  const parts = String(w.slot)
    .split(/\s*\/\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const mapped = [...new Set(parts.map((p) => ALIAS[p] || p))];
  if (mapped.join(' / ') !== parts.join(' / ')) {
    w.slot = mapped.join(' / ');
    changed++;
  }
}

console.log(`分区语义位收敛：改动 ${changed} 条（${Object.keys(ALIAS).join(' → ')}）`);
if (DRY) {
  console.log('（--dry-run，未写盘）');
  process.exitCode = 0;
  return;
}
fs.writeFileSync(SEED, JSON.stringify(seed, null, 2) + '\n', 'utf8');
console.log('已写盘 src/core/seed.json');
