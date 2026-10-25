'use strict';

// 把 scripts/curated-words8*.js 里的词条并入 src/core/seed.json。
//
// words.zh 是唯一键，所以：
//   upd: true  → 只补 alias / slot / sense / source / pop 这些字段，不动 zh→linyu 主译法
//   未标 upd   → 新增；若 zh 已存在则跳过并报警（不覆盖已有条目）
// 每次跑都会重写 seed.json，可重复执行；跑完会打印本轮并入/补字段/跳过的条数。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const seedPath = path.join(ROOT, 'src', 'core', 'seed.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

const bundles = ['curated-words8a.js', 'curated-words8b.js', 'curated-words8c.js']
  .map((f) => path.join(__dirname, f))
  .filter((f) => fs.existsSync(f))
  .map((f) => require(f).words);

const items = [].concat(...bundles);
const byZh = new Map(seed.words.map((w) => [w.zh, w]));

let added = 0;
let patched = 0;
const skipped = [];

for (const it of items) {
  const zh = String(it.zh || '').trim();
  if (!zh) continue;
  const exist = byZh.get(zh);
  if (exist) {
    if (!it.upd) {
      skipped.push(zh);
      continue;
    }
    if (it.alias) exist.alias = it.alias;
    if (it.slot) exist.slot = it.slot;
    if (it.sense) exist.sense = it.sense;
    if (it.source) exist.source = it.source;
    if (it.pop) exist.pop = it.pop;
    if (it.rel && it.rel.length) exist.rel = it.rel;
    patched++;
    continue;
  }
  const row = { zh, linyu: String(it.linyu || '').trim() };
  if (!row.linyu) {
    skipped.push(zh + '(缺淋语)');
    continue;
  }
  if (it.alias) row.alias = it.alias;
  if (it.slot) row.slot = it.slot;
  if (it.sense) row.sense = it.sense;
  if (it.source) row.source = it.source;
  if (it.pop) row.pop = it.pop;
  if (it.rel && it.rel.length) row.rel = it.rel;
  seed.words.push(row);
  byZh.set(zh, row);
  added++;
}

fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n', 'utf8');
console.log(`新增 ${added} / 补字段 ${patched} / 跳过 ${skipped.length}`);
if (skipped.length) console.log('跳过（zh 已存在或缺淋语）：' + skipped.join('、'));
console.log(`词库合计 ${seed.words.length} 条，句式 ${seed.rules.length} 条`);
const withSlot = seed.words.filter((w) => w.slot).length;
const withAlias = seed.words.filter((w) => w.alias).length;
console.log(`带语义位 ${withSlot} 条，带多译法变体 ${withAlias} 条`);
