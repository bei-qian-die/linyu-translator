'use strict';

// 第十六轮合库：scripts/curated-linyu16.js（词库 + 句式）→ src/core/seed.json
//
// 与第十四/十五轮规则一致：
//   - zh 已存在 → 只并入 alias 变体、只补空字段，绝不覆盖已有解释（用户可能手改过）
//   - 句式 unshift 到 rules 最前（seed 顺序决定匹配优先级）
//   - 幂等可重跑
//
// 本轮新增两条硬校验：
//   - slot 必须取自 scripts/slot-taxonomy13.js，出现未定义 key 直接 throw（防止又造出第二套分区写法）
//   - linyu 不许为空（空 linyu = 翻译引擎里从未生效）
//   - pop 由 corpus/*.txt 逐字计数推导，不手写；口径同 freq-slots13（高≥100 / 中≥20 / 低<20），
//     结果落 evidence/slot-freq16.json 可复查
//
// 用法: node scripts/apply-linyu16.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEED_FILE = path.join(ROOT, 'src/core/seed.json');
const CORPUS_DIR = path.join(ROOT, 'corpus');
const FREQ_FILE = path.join(ROOT, 'evidence/slot-freq16.json');
const { WORDS, RULES } = require(path.join(ROOT, 'scripts/curated-linyu16.js'));
const tax = require(path.join(ROOT, 'scripts/slot-taxonomy13.js'));

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
  const keys = splitVariants(r.template.replace(/[{}]/g, ''));
  const n = keys.length ? count(keys[0]) : 0;
  freq.items.push({ rule: r.template, n, pop: popOf(n) });
}
if (!DRY) {
  fs.mkdirSync(path.dirname(FREQ_FILE), { recursive: true });
  fs.writeFileSync(FREQ_FILE, JSON.stringify(freq, null, 2) + '\n', 'utf8');
}
const popMap = new Map(freq.items.filter((x) => x.zh).map((x) => [x.zh, x.pop]));

// ---------- 2. 校验 ----------
const badSlot = [];
for (const w of WORDS) {
  const unknown = w.slot ? tax.validateSlot(w.slot) : [];
  if (unknown.length) badSlot.push(`${w.zh}: ${unknown.join('/')}`);
  if (!w.linyu || !String(w.linyu).trim()) badSlot.push(`${w.zh}: linyu 为空`);
}
if (badSlot.length) {
  console.error('[FATAL] 非法 slot / 空 linyu：\n  ' + badSlot.join('\n  '));
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
    const add = incoming.filter((v) => !haveSet.has(v));
    if (add.length) {
      target.alias = [...have, ...add].join('、');
      newVariants += add.length;
      mergedWords++;
    }
    if (!target.source && w.source) target.source = w.source;
    if (!target.slot && w.slot) target.slot = w.slot;
    if (!target.pop && pop) target.pop = pop;
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

console.error(`[词库] 新增条目 ${addedWords}，并入既有条目 ${mergedWords}，新增变体 ${newVariants}，总计 ${seed.words.length}`);
console.error(`[句式] 新增条目 ${addedRules}（unshift 到最前），并入既有条目 ${mergedRules}，总计 ${seed.rules.length}`);

let dupV = 0;
for (const w of seed.words) {
  const a = splitVariants(w.alias);
  if (new Set(a).size !== a.length) dupV++;
}
if (dupV) {
  console.error(`[词库] 警告：${dupV} 条词条 alias 内部出现重复写法`);
  process.exit(1);
}

const emptyLinyu = seed.words.filter((w) => !String(w.linyu || '').trim());
if (emptyLinyu.length) {
  console.error(`[词库] 警告：${emptyLinyu.length} 条 linyu 为空：${emptyLinyu.map((w) => w.zh).join('、')}`);
  process.exit(1);
}

if (DRY) {
  console.error('[dry-run] 不写盘');
  process.exit(0);
}

fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2) + '\n', 'utf8');
console.error('[OK] 已写回 ' + SEED_FILE);
