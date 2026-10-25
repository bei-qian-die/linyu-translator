'use strict';

// 把 scripts/curated-linyu14.js 的扩充集合并进 src/core/seed.json。
// 合并规则与第十二轮一致（zh 已在 → 并入 alias 集合，不新增重复行），幂等可重跑。
//
// 用法: node scripts/apply-linyu14.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEED_FILE = path.join(ROOT, 'src/core/seed.json');
const { WORDS, RULES } = require(path.join(ROOT, 'scripts/curated-linyu14.js'));

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
    if (!target.source && w.source) target.source = w.source;
    if (!target.slot && w.slot) target.slot = w.slot;
    if (!target.pop && w.pop) target.pop = w.pop;
    if (!target.sense && w.sense) target.sense = w.sense;
    continue;
  }
  seed.words.push({
    zh: w.zh,
    linyu: w.linyu,
    alias: incoming.join('、'),
    slot: w.slot || '',
    sense: w.sense,
    source: w.source,
    pop: w.pop || '',
    rel: Array.isArray(w.rel) ? w.rel : [],
  });
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

let dupV = 0;
for (const w of seed.words) {
  const a = splitVariants(w.alias);
  if (new Set(a).size !== a.length) dupV++;
}
if (dupV) {
  console.error(`[词库] 警告：${dupV} 条词条 alias 内部出现重复写法`);
  process.exit(1);
}

if (DRY) {
  console.error('[dry-run] 不写盘');
  process.exit(0);
}

fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2) + '\n', 'utf8');
console.error('[OK] 已写回 ' + SEED_FILE);
