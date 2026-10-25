'use strict';

// 把 scripts/curated-linyu11.js 的扩充集合并进 src/core/seed.json。
//
// 合并规则（对应「变体不合并、但同一条目不重复」这条硬要求）：
//   1. zh 已存在 → 不新增条目，而是把新变体**并入既有条目的 alias 集合**，
//      同时保留既有条目的 linyu / sense / source，只在既有 sense 为空时才补写。
//      这样「同一个语义位、多种淋语译法」全部挂在同一条目下，不制造重复行。
//   2. zh 不存在 → 作为新条目追加。
//   3. rules 的 pattern 已存在 → 同样把 examples 追加到既有条目，不新增。
//   4. 合并前后都做「变体集合去重」，并保留既有条目的原始书写顺序。
//
// 用法: node scripts/apply-linyu11.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEED_FILE = path.join(ROOT, 'src/core/seed.json');
const { WORDS, RULES } = require(path.join(ROOT, 'scripts/curated-linyu11.js'));

const DRY = process.argv.includes('--dry-run');

const splitVariants = (s) =>
  String(s || '')
    .split(/[、,，]/)
    .map((x) => x.trim())
    .filter(Boolean);

const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));

const wordIndex = new Map(seed.words.map((w, i) => [w.zh, i]));
const ruleIndex = new Map(seed.rules.map((r, i) => [r.pattern, i]));

let addedWords = 0;
let mergedWords = 0;
let newVariants = 0;
let addedRules = 0;
let mergedRules = 0;

for (const w of WORDS) {
  const incoming = splitVariants(w.alias);
  if (wordIndex.has(w.zh)) {
    const target = seed.words[wordIndex.get(w.zh)];
    const have = splitVariants(target.alias);
    const haveSet = new Set(have);
    const add = incoming.filter((v) => !haveSet.has(v));
    if (add.length) {
      target.alias = [...have, ...add].join('、');
      newVariants += add.length;
      mergedWords++;
    }
    // 既有条目缺来源时补上扩充集的来源（来源以先到的为准，不覆盖）
    if (!target.source && w.source) target.source = w.source;
    if (!target.slot && w.slot) target.slot = w.slot;
    if (!target.pop && w.pop) target.pop = w.pop;
    continue;
  }
  const entry = {
    zh: w.zh,
    linyu: w.linyu,
    alias: incoming.join('、'),
    sense: w.sense,
    source: w.source,
    pop: w.pop || '',
    slot: w.slot || '',
    rel: Array.isArray(w.rel) ? w.rel : [],
  };
  // 字段顺序对齐既有词条风格
  const ordered = {
    zh: entry.zh,
    linyu: entry.linyu,
    alias: entry.alias,
    slot: entry.slot,
    sense: entry.sense,
    source: entry.source,
    pop: entry.pop,
    rel: entry.rel,
  };
  seed.words.push(ordered);
  wordIndex.set(w.zh, seed.words.length - 1);
  addedWords++;
}

for (const r of RULES) {
  if (ruleIndex.has(r.pattern)) {
    const target = seed.rules[ruleIndex.get(r.pattern)];
    const have = String(target.examples || '').split(/[；;]/).map((s) => s.trim()).filter(Boolean);
    const incoming = String(r.examples || '').split(/[；;]/).map((s) => s.trim()).filter(Boolean);
    const haveSet = new Set(have);
    const add = incoming.filter((e) => !haveSet.has(e));
    if (add.length) {
      target.examples = [...have, ...add].join('；');
      mergedRules++;
    }
    if (!target.src && r.src) target.src = r.src;
    if (!target.scene && r.scene) target.scene = r.scene;
    if (!target.note && r.note) target.note = r.note;
    continue;
  }
  seed.rules.push({
    pattern: r.pattern,
    template: r.template,
    note: r.note,
    scene: r.scene,
    examples: r.examples,
    src: r.src,
  });
  ruleIndex.set(r.pattern, seed.rules.length - 1);
  addedRules++;
}

console.error(`[词库] 新增条目 ${addedWords}，并入既有条目 ${mergedWords}，新增变体 ${newVariants}，总计 ${seed.words.length}`);
console.error(`[句式] 新增条目 ${addedRules}，并入既有条目 ${mergedRules}，总计 ${seed.rules.length}`);

// 自检：变体集合不得出现重复
let dupV = 0;
for (const w of seed.words) {
  const a = splitVariants(w.alias);
  if (new Set(a).size !== a.length) {
    dupV++;
    console.error(`[warn] 变体重复: ${w.zh}`);
  }
}

if (!DRY) {
  fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2) + '\n', 'utf8');
  console.error(`-> ${SEED_FILE}`);
} else {
  console.error('[dry-run] 未写入');
}
