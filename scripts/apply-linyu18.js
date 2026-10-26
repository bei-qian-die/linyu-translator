'use strict';

// 第十八轮合库：scripts/curated-linyu18.js（词库 + 句式）→ src/core/seed.json
//
// 规则与 14/15/16 轮一致：
//   - zh 已存在 → 只并入 alias 变体、只补空字段，绝不覆盖已有解释
//   - 句式 unshift 到 rules 最前（seed 顺序决定匹配优先级）
//   - pop 由 corpus/*.txt 逐字计数推导，不手写（高≥100 / 中≥20 / 低<20）
//   - 幂等可重跑
//
// 第十七轮的剔除清单（scripts/drop-words17.js）同样要跳过，否则本轮若收录同名词会把它们复活。
//
// 用法: node scripts/apply-linyu18.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEED_FILE = path.join(ROOT, 'src/core/seed.json');
const CORPUS_DIR = path.join(ROOT, 'corpus');
const FREQ_FILE = path.join(ROOT, 'evidence/slot-freq18.json');
const { WORDS, RULES } = require(path.join(ROOT, 'scripts/curated-linyu18.js'));
const tax = require(path.join(ROOT, 'scripts/slot-taxonomy18.js'));
const { DROP } = require(path.join(ROOT, 'scripts/drop-words17.js'));
const DROPPED = new Set(DROP.map((d) => d.zh));

const DRY = process.argv.includes('--dry-run');
const HIGH = 100;
const MID = 20;

const splitVariants = (s) =>
  String(s || '')
    .split(/[、,，]/)
    .map((x) => x.trim())
    .filter(Boolean);
const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

// ---------- 1. 语料计数 → pop ----------
const corpusFiles = fs
  .readdirSync(CORPUS_DIR)
  .filter((f) => /^corpus.*\.txt$/.test(f))
  .sort();
let blob = '';
for (const f of corpusFiles) blob += fs.readFileSync(path.join(CORPUS_DIR, f), 'utf8') + '\n';
const NBLOB = norm(blob);

const count = (needle) => {
  const n = norm(needle);
  if (!n) return 0;
  let c = 0;
  let i = NBLOB.indexOf(n);
  while (i !== -1) {
    c++;
    i = NBLOB.indexOf(n, i + n.length);
  }
  return c;
};
const popOf = (n) => (n >= HIGH ? '高' : n >= MID ? '中' : '低');

const freq = {
  generatedAt: new Date().toISOString(),
  corpusFiles,
  corpusChars: NBLOB.length,
  thresholds: { high: HIGH, mid: MID },
  items: [],
};
for (const w of WORDS) {
  const n = count(w.linyu);
  freq.items.push({ zh: w.zh, linyu: w.linyu, n, pop: popOf(n) });
}
for (const r of RULES) {
  const keys = String(r.template || '').replace(/[{}]/g, '');
  const n = keys ? count(keys) : 0;
  freq.items.push({ rule: r.template, n, pop: popOf(n) });
}
if (!DRY) {
  fs.mkdirSync(path.dirname(FREQ_FILE), { recursive: true });
  fs.writeFileSync(FREQ_FILE, JSON.stringify(freq, null, 2) + '\n', 'utf8');
}
const popMap = new Map(freq.items.filter((x) => x.zh).map((x) => [x.zh, x.pop]));

// ---------- 2. 校验 ----------
const bad = [];
for (const w of WORDS) {
  const unknown = w.slot ? tax.validateSlot(w.slot) : [];
  if (unknown.length) bad.push(`${w.zh}: slot 未登记 ${unknown.join('/')}`);
  if (!w.linyu || !String(w.linyu).trim()) bad.push(`${w.zh}: linyu 为空`);
  if (!w.slot) bad.push(`${w.zh}: slot 缺失`);
  if (DROPPED.has(w.zh)) bad.push(`${w.zh}: 在第十七轮剔除名单里，不应再收录`);
}
const badRule = [];
for (const r of RULES) {
  if (!r.pattern || !r.template) badRule.push(JSON.stringify(r).slice(0, 40));
  try {
    new RegExp(r.pattern);
  } catch (e) {
    badRule.push(`${r.pattern}: 正则编译失败 ${e.message}`);
  }
}
if (bad.length || badRule.length) {
  console.error('[FATAL] 校验未通过：\n  ' + [...bad, ...badRule].join('\n  '));
  process.exit(1);
}

// ---------- 3. 合库 ----------
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
  const pop = popMap.get(w.zh) || '低';
  if (wordIndex.has(w.zh)) {
    const target = seed.words[wordIndex.get(w.zh)];
    const have = splitVariants(target.alias);
    const haveSet = new Set(have);
    const add = incoming.filter((v) => !haveSet.has(v) && v !== w.linyu);
    if (add.length) {
      target.alias = [...have, ...add].join('、');
      newVariants += add.length;
      mergedWords++;
    }
    // 只补空字段，不动用户手改过的内容
    if (!target.source && w.source) target.source = w.source;
    if (!target.slot && w.slot) target.slot = w.slot;
    if (!target.pop && pop) target.pop = pop;
    if (!target.sense && w.sense) target.sense = w.sense;
    continue;
  }
  seed.words.push({
    zh: w.zh,
    linyu: w.linyu,
    alias: incoming.filter((v) => v !== w.linyu).join('、'),
    slot: w.slot || '',
    sense: w.sense,
    source: w.source,
    pop,
    rel: Array.isArray(w.rel) ? w.rel : [],
  });
  wordIndex.set(w.zh, seed.words.length - 1);
  addedWords++;
}

for (let i = RULES.length - 1; i >= 0; i--) {
  const r = RULES[i];
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
  seed.rules.unshift({
    pattern: r.pattern,
    template: r.template,
    note: r.note,
    scene: r.scene,
    examples: r.examples,
    src: r.src,
  });
  ruleIndex.set(r.pattern, 0);
  addedRules++;
}

console.error(`[词库] 新增 ${addedWords}，并入 ${mergedWords}（补 ${newVariants} 个变体），总计 ${seed.words.length}`);
console.error(`[句式] 新增 ${addedRules}（unshift 到最前），并入 ${mergedRules}，总计 ${seed.rules.length}`);

// 自检：alias 内不许重复、linyu 不许空
let dupV = 0;
for (const w of seed.words) {
  const a = splitVariants(w.alias);
  if (new Set(a).size !== a.length) dupV++;
}
if (dupV) {
  console.error(`[FATAL] ${dupV} 条词条 alias 内部有重复写法`);
  process.exit(1);
}
const emptyL = seed.words.filter((w) => !String(w.linyu || '').trim());
if (emptyL.length) {
  console.error(`[FATAL] ${emptyL.length} 条 linyu 为空`);
  process.exit(1);
}

if (DRY) {
  console.error('[dry-run] 不写盘');
  process.exit(0);
}
fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2) + '\n', 'utf8');
console.error('[OK] 已写回 ' + SEED_FILE);
