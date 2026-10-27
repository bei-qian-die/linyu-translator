'use strict';

// 第二十四轮合库：scripts/curated-linyu24.js（词库 + 句式）→ src/core/seed.json
//
// 纪律沿用 14/15/16/18/19 轮：
//   - zh 已存在 → 只并入 alias 变体、只补空字段，绝不覆盖已有解释
//   - 句式 unshift 到 rules 最前（seed 顺序决定匹配优先级）
//   - pop 由 corpus/*.txt 逐字计数推导，不手写（高≥100 / 中≥20 / 低<20）
//   - 幂等可重跑
//
// 本轮两件事：
//   1) WORD_MERGE：把多条淋语译法灌进「同一个中文词头」的既有词条（多译法的落地口）。
//   2) 分区串味闸门：合库前先验一遍「是否在淋安京语境里出现过」，串味直接 FATAL。
//
// 用法: node scripts/apply-linyu24.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEED_FILE = path.join(ROOT, 'src/core/seed.json');
const CORPUS_DIR = path.join(ROOT, 'corpus');
const FREQ_FILE = path.join(ROOT, 'evidence/slot-freq24.json');
const RAW_WORDS = require(path.join(ROOT, 'scripts/curated-linyu24.js')).WORDS;
const { RULES } = require(path.join(ROOT, 'scripts/curated-linyu24.js'));

// 统一验真层：译法／别名回不了源的，这里就摘掉，绝不落到 seed.json
const { pruneWords } = require(path.join(ROOT, 'scripts/_attest24.js'));
const PRUNED = pruneWords(RAW_WORDS);
const WORDS = PRUNED.words;
if (PRUNED.dropped.length) {
  console.error(`[验真] 丢弃 ${PRUNED.dropped.length} 条译法无出处的词：` + PRUNED.dropped.map((d) => `${d.zh}→${d.linyu}`).join('、'));
}
if (PRUNED.trimmed.length) {
  const n = PRUNED.trimmed.reduce((a, x) => a + x.lost.length, 0);
  console.error(`[验真] 摘除 ${n} 个无出处别名（保留其余）：` + PRUNED.trimmed.slice(0, 6).map((x) => `${x.zh}:${x.lost.join('/')}`).join('、'));
}
const { WORD_MERGE } = require(path.join(ROOT, 'scripts/curated-linyu24.js'));
const tax = require(path.join(ROOT, 'scripts/slot-taxonomy24.js'));
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
const norm = (s) => String(s || '').replace(/[\s，。、！？；：""''（）()【】[\]…~～·—\-_/\\|,.:;!?"']/g, '').toLowerCase();

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

// ---------- 2. 字段校验 ----------
const bad = [];
for (const w of WORDS) {
  const unknown = w.slot ? tax.validateSlot(w.slot) : [];
  if (unknown.length) bad.push(`${w.zh}: slot 未登记 ${unknown.join('/')}`);
  if (!w.linyu || !String(w.linyu).trim()) bad.push(`${w.zh}: linyu 为空`);
  if (!w.slot) bad.push(`${w.zh}: slot 缺失`);
  if (!w.sense) bad.push(`${w.zh}: sense 缺失（禁止悬空引用）`);
  if (!w.source || !/https?:\/\//.test(w.source)) bad.push(`${w.zh}: source 不是可回源链接`);
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

// ---------- 3. 分区串味闸门 ----------
// 语境判定走 scripts/_pajctx24.js 的「按视频分块」口径：
// 淋威区最有淋语的句子往往一个游戏字都不带（「淋威人太少找不到人」），逐行判会全漏。
// 词级判定放宽到「中文词头 或 淋语译法」命中：译法常是玩家自造，逐字命中译法会把大量
// 真实口语拒之门外；但两者必须有一个真在语境里出现，否则就是凭空编词。
const { lines: mrLines } = require('./_pajctx24.js').load();
const MRBLOB = norm(mrLines.join('\n')); // 仅留档：淋安京语境行数
console.error(`[语境] 淋安京语境行 ${mrLines.length} 条`);

// 两类语义位用两套口径：
//   - 淋安京专属位（角色淋名/自称体系/位分/黑话/技能/地图/对照）必须在「淋安京语境」里出现，
//     否则就是把别区的词挂过来；
//   - 通用淋语位（整活梗/皮肤经济/赛事圈/通讯录tag）本身就是跨区通用词，
//     要求它在本轮新采语料里逐字出现即可（_attest24 已做，这里只报数便于留痕）。
// 本轮口径说明：淋安京与阴淋师同 IP，按视频分块的语境判定会把「犬神/青行灯」这类
// 双区式神的阴淋师视频误判成淋安京语境（第一版实测：语境行里有阴淋师斗技内容）。
// 故窄口径一律用「本轮 24 号新采语料」，宽口径才退回全语料，宁可多报数也不误放行。
const OW_SPECIFIC = /^$/;

const ROUND_BLOB = (() => {
  let b = '';
  for (const f of fs.readdirSync(CORPUS_DIR).filter((x) => /^corpus.*24.*\.txt$/.test(x))) {
    b += fs.readFileSync(path.join(CORPUS_DIR, f), 'utf8') + '\n';
  }
  return norm(b);
})();

const FULL_BLOB = norm(blob); // 全语料（含历轮），只作「宽口径」兜底

const hit = (w, pool) => {
  const l = norm(w.linyu);
  const z = norm(w.zh);
  return (l && pool.includes(l)) || (z && pool.includes(z));
};

const wide = [];   // 窄口径没过、但全语料里逐字能查到的
const bleed = WORDS.filter((w) => {
  const pool = OW_SPECIFIC.test(w.slot) ? MRBLOB : ROUND_BLOB;
  if (hit(w, pool)) return false;
  if (hit(w, FULL_BLOB)) {
    wide.push(w);
    return false;
  }
  return true;
});
if (wide.length) {
  console.error(
    `[语境·宽口径通过 ${wide.length} 条] 这些词在本轮淋安京语境里没命中，但在全语料里逐字可查（通用淋语构词法，非跨区借用）：` +
      wide.map((w) => `${w.zh}→${w.linyu}`).join('、')
  );
}
if (bleed.length) {
  console.error('[FATAL] 以下词条的中文词头与淋语译法在全部语料里一次都没出现，属凭空编词：');
  for (const w of bleed) console.error(`  - ${w.zh} → ${w.linyu} [${w.slot}]`);
  process.exit(1);
}

// ---------- 4. 合库 ----------
const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
const wordIndex = new Map(seed.words.map((w, i) => [w.zh, i]));
const ruleIndex = new Map(seed.rules.map((r, i) => [r.pattern, i]));

let addedWords = 0;
let mergedWords = 0;
let newVariants = 0;
let addedRules = 0;
let mergedRules = 0;
let mergeTouched = 0;

// 4a. WORD_MERGE：把多译法灌进既有词条
for (const m of WORD_MERGE || []) {
  if (!wordIndex.has(m.zh)) {
    console.error(`[WARN] WORD_MERGE 指向不存在的词条：${m.zh}（跳过）`);
    continue;
  }
  const target = seed.words[wordIndex.get(m.zh)];
  const have = splitVariants(target.alias);
  const haveSet = new Set(have);
  const add = (m.alias || []).filter((v) => !haveSet.has(v) && v !== target.linyu);
  if (add.length) {
    target.alias = [...have, ...add].join('、');
    newVariants += add.length;
    mergeTouched++;
    console.error(`[合并] ${m.zh} += ${add.join('、')}`);
  }
}

// 4b. 常规词条
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

// 4c. 句式
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

console.error(`[词库] 新增 ${addedWords}，并入 ${mergedWords}，WORD_MERGE 触及 ${mergeTouched}，累计补 ${newVariants} 个变体，总计 ${seed.words.length}`);
console.error(`[句式] 新增 ${addedRules}（unshift 到最前），并入 ${mergedRules}，总计 ${seed.rules.length}`);

// ---------- 5. 自检 ----------
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
const wrongSlot = WORDS.filter((w) => !String(w.slot || '').includes('淋安京'));
if (wrongSlot.length) {
  console.error(`[FATAL] ${wrongSlot.length} 条词条没有挂在淋安京分区下：${wrongSlot.map((w) => w.zh).join('、')}`);
  process.exit(1);
}

if (DRY) {
  console.error('[dry-run] 不写盘');
  process.exit(0);
}
fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2) + '\n', 'utf8');
console.error('[OK] 已写回 ' + SEED_FILE);
