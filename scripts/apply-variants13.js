'use strict';

// 把 scripts/curated-variants13.js 的整词变体并入 seed.json，并修掉缺 linyu 的行。
// 幂等：变体已存在则不重复并入。
//
// 用法: node scripts/apply-variants13.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEED = path.join(ROOT, 'src/core/seed.json');
const DRY = process.argv.includes('--dry-run');
const { VARIANTS, NEW_WORDS } = require(path.join(ROOT, 'scripts/curated-variants13.js'));

const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
const byZh = new Map(seed.words.map((w, i) => [w.zh, i]));
const split = (s) => String(s || '').split(/[、,，]/).map((x) => x.trim()).filter(Boolean);
const allKnown = new Set();
for (const w of seed.words) {
  if (w.linyu) allKnown.add(w.linyu);
  split(w.alias).forEach((a) => allKnown.add(a));
}

let merged = 0;
for (const v of VARIANTS) {
  const idx = byZh.get(v.zh);
  if (idx == null) continue;
  const w = seed.words[idx];
  const have = split(w.alias);
  const set = new Set(have.concat([w.linyu]));
  const fresh = (v.add || []).map((a) => a.form).filter((f) => f && !set.has(f));
  if (!fresh.length) continue;
  w.alias = have.concat(fresh).join('、');
  fresh.forEach((f) => allKnown.add(f));
  merged += fresh.length;
}

for (const nw of NEW_WORDS) {
  if (byZh.has(nw.zh) || allKnown.has(nw.linyu)) continue;
  seed.words.push({
    zh: nw.zh,
    linyu: nw.linyu,
    alias: nw.linyu,
    slot: '基础谐音替换',
    sense: '',
    source: 'https://zh.moegirl.org.cn/%E6%B7%8B%E8%AF%AD',
    pop: nw.count >= 20 ? '中' : '低',
    rel: [],
  });
}

// 缺 linyu 的行：翻译引擎按 zh→linyu 替换，没有 linyu 就等于这条词条不生效。
// 取它自己的第一个别名补上（兄弟→姐妹、哭→Cry 都是原文里写明的用法）。
let repaired = 0;
for (const w of seed.words) {
  if (w.linyu) continue;
  const first = split(w.alias)[0];
  if (!first) continue;
  w.linyu = first;
  repaired++;
  console.log('补齐缺失的淋语写法：' + w.zh + ' → ' + first);
}

console.log(`并入变体 ${merged} 个 · 新增词行 ${NEW_WORDS.length} 条候选 · 修复缺 linyu ${repaired} 条 · 词库共 ${seed.words.length} 条`);
if (DRY) {
  console.log('（--dry-run，未写盘）');
  process.exitCode = 0;
  return;
}
fs.writeFileSync(SEED, JSON.stringify(seed, null, 2) + '\n', 'utf8');
console.log('已写盘 src/core/seed.json');
