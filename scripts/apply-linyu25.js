'use strict';

// 第二十五轮合库：四分区策展数据 → src/core/seed.json
//
// 纪律沿用 14/15/16/18/19/20/21/24 轮：
//   - 同词头不覆盖已有解释，只并入 alias / 补空字段
//   - 句式 unshift 到 rules 最前（seed 顺序决定匹配优先级）
//   - pop 由 corpus/*.txt 逐字计数推导，不手写
//   - 幂等可重跑
//
// 本轮额外两件事（§2.3 / §2.4 的归一与迁移，逐条可回滚）：
//   · 三角洲分区名归一：`三角淋行动` 改主名为 `淋角洲行动`，旧名降为 alias
//   · DIVA 迁移：`霉霉`(圈层黑话) / `玛莎`(人物) 的 slot 改为 `divatag`，文本一字不改，
//     只在 sense 末尾追加「（DIVA 分区）」
//
// 用法: node scripts/apply-linyu25.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEED_FILE = path.join(ROOT, 'src/core/seed.json');
const CORPUS_DIR = path.join(ROOT, 'corpus');

const BATCHES = ['curated-linyu25', 'curated-linyu25b', 'curated-linyu25c', 'curated-linyu25d'];
const DRY = process.argv.includes('--dry-run');
const HIGH = 100;
const MID = 20;

const tax = require(path.join(ROOT, 'scripts/slot-taxonomy25.js'));

// ---------- 1. 合并四批策展数据 ----------
const seenKey = new Set();
const ALL = [];
for (const b of BATCHES) {
  const mod = require(path.join(ROOT, 'scripts', b + '.js'));
  for (const w of mod.WORDS || []) {
    const k = w.zone + '|' + w.zh;
    if (seenKey.has(k)) continue;
    seenKey.add(k);
    ALL.push(w);
  }
}
const RULES = require(path.join(ROOT, 'scripts/curated-linyu25.js')).RULES;

// ---------- 2. 语料计数 → pop ----------
// 只保留实义字符：标点与空白一律剔除，供 pop 计数用
const PUNCT = new Set(Array.from(' \t\r\n，。、！？；：""\'\'（）()【】[]…~～·—-_/\\|,.:;!?"\''));
const norm = (s) =>
  Array.from(String(s || ''))
    .filter((c) => !PUNCT.has(c))
    .join('')
    .toLowerCase();
let blob = '';
for (const f of fs.readdirSync(CORPUS_DIR).filter((f) => /^corpus.*\.txt$/.test(f)).sort()) {
  blob += fs.readFileSync(path.join(CORPUS_DIR, f), 'utf8') + '\n';
}
const NBLOB = norm(blob);
const countOf = (needle) => {
  const n = norm(needle);
  if (n.length < 2) return 0;
  let c = 0;
  let i = NBLOB.indexOf(n);
  while (i !== -1) {
    c++;
    i = NBLOB.indexOf(n, i + n.length);
  }
  return c;
};
const popOf = (w) => {
  const c = Math.max(countOf(w.linyu), countOf(w.zh));
  return c >= HIGH ? '高' : c >= MID ? '中' : '低';
};
const searchUrl = (zh) => 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(zh);

// ---------- 3. 读 seed ----------
const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
const before = { words: seed.words.length, rules: seed.rules.length };
const byZh = new Map(seed.words.map((w) => [w.zh, w]));

const splitAlias = (s) => String(s || '').split(/[、,，]/).map((x) => x.trim()).filter(Boolean);
const mergeAlias = (target, extra) => {
  const set = new Set(splitAlias(target.alias));
  for (const a of splitAlias(extra)) if (a !== target.zh) set.add(a);
  target.alias = [...set].join('、');
};

// ---------- 4. 归一与迁移（§2.3 / §2.4）----------
const migrated = [];
const normalized = [];

// 4.1 三角洲：三角淋行动 → 淋角洲行动（主名归一，旧名只留 alias）
const tri = byZh.get('三角淋行动');
if (tri) {
  tri.zh = '淋角洲行动';
  tri.linyu = '淋角洲行动';
  tri.alias = '三角淋行动、三角洲行动';
  tri.slot = '淋角洲行动 / 淋角洲整活梗';
  tri.sense = '《三角洲行动》在淋语区的规范名（淋角洲行动），早期写法「三角淋行动」保留为别名。';
  byZh.delete('三角淋行动');
  byZh.set('淋角洲行动', tri);
  normalized.push('三角淋行动 → 淋角洲行动（linyu 同步归一，旧名降为 alias）');
}
// 策展数据里若仍以「三角淋行动」为独立词头，不再新增词条，只并 alias
const SKIP_ZH = new Set(['三角淋行动']);

// 4.2 三角洲：库里挂「三角淋行动」rank 的分区名归一（只在 words 侧做，lore 侧由 apply-lore25 处理）
for (const w of seed.words) {
  if (typeof w.slot === 'string' && w.slot.includes('三角淋行动')) {
    w.slot = w.slot.replace(/三角淋行动/g, '淋角洲行动');
    normalized.push('slot 归一：' + w.zh);
  }
}

// 4.3 DIVA 迁移：霉霉 / 玛莎 → divatag，文本一字不改，只在 sense 末尾追加归属标注
for (const name of ['霉霉', '玛莎']) {
  const w = byZh.get(name);
  if (!w) continue;
  if (w.slot === 'divatag' || String(w.slot).includes('divatag')) continue;
  w.slot = 'divatag / diva人物淋名';
  if (!/DIVA 分区/.test(w.sense || '')) w.sense = String(w.sense || '') + '（DIVA 分区）';
  migrated.push(name + '：' + '→ divatag / diva人物淋名');
}

// ---------- 5. 词库落库 ----------
const added = [];
const merged = [];

for (const w of ALL) {
  const bad = tax.validateSlot(w.slot);
  if (bad.length) throw new Error('slot 未登记：' + w.zh + ' → ' + w.slot + '（' + bad.join('/') + '）');
  if (SKIP_ZH.has(w.zh)) {
    const main = byZh.get('淋角洲行动');
    if (main) mergeAlias(main, w.alias || w.zh);
    merged.push(w.zh + '（旧分区名，只并 alias）');
    continue;
  }
  const exist = byZh.get(w.zh);
  if (exist) {
    // 同词头：只并 alias，绝不覆盖已有解释
    mergeAlias(exist, w.alias);
    if (!exist.rel && w.zone) exist.rel = [w.zone];
    merged.push(w.zh + '（并入 alias）');
    continue;
  }
  const item = {
    zh: w.zh,
    linyu: w.linyu,
    alias: w.alias,
    slot: w.slot,
    sense: w.sense,
    source: searchUrl(w.zh),
    pop: popOf(w),
    rel: [w.zone],
  };
  seed.words.push(item);
  byZh.set(w.zh, item);
  added.push(item);
}

// ---------- 6. 句式落库 ----------
const ruleKey = (r) => r.pattern + '=>' + r.output;
const have = new Set(seed.rules.map(ruleKey));
const DROP_RULES = new Set([
  // 「白嫖」在词库里已有一条长译法（不给硬币小心被吸了噜），句式会把它截成一模一样的两个字，必须让位
  '(?:开荒|白嫖|氪金)',
]);
const newRules = [];
for (const [pattern, output] of RULES) {
  if (DROP_RULES.has(pattern)) continue;
  // source 同时承担两个作用：给 attest 一个可访问的回源，以及让句式在界面上能点回原文
  const r = { pattern, output, source: 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(output) };
  if (have.has(ruleKey(r))) continue;
  have.add(ruleKey(r));
  newRules.push(r);
}
// 追加到末尾：本轮的新句式是「分区专用」的补充，不能抢掉既有句式的优先级——
// 第二十五轮实测，unshift 到最前会让 白嫖／顶流／英雄联盟 三条通用句式被本轮的同类规则截胡。
seed.rules.push(...newRules);

// ---------- 7. 写回 ----------
if (!DRY) fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2) + '\n', 'utf8');

const zoneCount = {};
for (const w of added) zoneCount[w.rel[0]] = (zoneCount[w.rel[0]] || 0) + 1;

console.log('words', before.words, '→', seed.words.length, '（新增 ' + added.length + '）');
console.log('  分区新增：' + Object.entries(zoneCount).map(([k, v]) => k + ' ' + v).join(' / '));
console.log('  同词头并入 alias：' + merged.length + ' 条');
console.log('rules', before.rules, '→', seed.rules.length, '（新增 ' + newRules.length + '）');
if (normalized.length) console.log('归一：' + normalized.length + ' 条\n  ' + normalized.slice(0, 8).join('\n  '));
if (migrated.length) console.log('迁移：' + migrated.length + ' 条\n  ' + migrated.join('\n  '));
if (DRY) console.log('\n[dry-run] 未写入');
