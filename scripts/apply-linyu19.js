'use strict';

// 第十九轮合库：scripts/curated-linyu19.js（词库 + 句式）→ src/core/seed.json
//
// 规则沿用 14/15/16/18 轮：
//   - zh 已存在 → 只并入 alias 变体、只补空字段，绝不覆盖已有解释
//   - 句式 unshift 到 rules 最前（seed 顺序决定匹配优先级）
//   - pop 由 corpus/*.txt 逐字计数推导，不手写（高≥100 / 中≥20 / 低<20）
//   - 幂等可重跑
//
// 本轮新增两件事：
//   1) WORD_MERGE：把「我 / 蝰蛇 / 暮蝶 / 黑梦 / 奇乐 / 钢索」这几条既有词条的别名补进去，
//      这是「一个词头多种译法」的落地口——不再为「我🐍」另立词条。
//   2) 分区串味闸门：合库前先验一遍「linyu 是否在瓦罗语境里出现过」，串味直接 FATAL。
//
// 用法: node scripts/apply-linyu19.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEED_FILE = path.join(ROOT, 'src/core/seed.json');
const CORPUS_DIR = path.join(ROOT, 'corpus');
const FREQ_FILE = path.join(ROOT, 'evidence/slot-freq19.json');
const { WORDS, RULES } = require(path.join(ROOT, 'scripts/curated-linyu19.js'));
const { WORD_MERGE } = require(path.join(ROOT, 'scripts/curated-heroes19.js'));
const tax = require(path.join(ROOT, 'scripts/slot-taxonomy19.js'));
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

// ---------- 2. 校验 ----------
const bad = [];
for (const w of WORDS) {
  const unknown = w.slot ? tax.validateSlot(w.slot) : [];
  if (unknown.length) bad.push(`${w.zh}: slot 未登记 ${unknown.join('/')}`);
  if (!w.linyu || !String(w.linyu).trim()) bad.push(`${w.zh}: linyu 为空`);
  if (!w.slot) bad.push(`${w.zh}: slot 缺失`);
  if (!w.sense) bad.push(`${w.zh}: sense 缺失（禁止悬空引用）`);
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
// 只在瓦罗语境的句子里找 linyu；一条都找不到就说明这个词在瓦罗区没有实际用法，禁止挂本分区
const VA_STRONG =
  /无畏契约|瓦罗兰特|瓦罗淋特|大沙田契约|爆能器|捷风|婕提|夜露|夜戮|芮娜|蕾娜|瑞纳|猎枭|苏法|黑梦|菲德|贤者|圣祈|奇乐|恺宙|尚勃勒|钱博尔|钱包|瑟符|炼狱|布史东|不死鸟|菲尼克斯|火男|雷兹|炸弹妹|星礈|黑妹|蝰蛇|薇蝮|暮蝶|克洛芙|慕蝶|幽影|海神|铁臂|斯凯|盖可|盖克|钛狐|钛湖|壹决|一决|一绝|幻棱|维斯|钢锁|霓虹|遐思|赋能|源能战魂|瓦学弟|VCT|冠军赛|獠犬|戍卫|骇灵|蜂刺|雄鹿|奥丁|莽侠|鬼魅|源工重镇|亚海悬城|日落之城|霓虹町|森寒冬港|极地寒港|微风岛屿|裂变峡谷|深海明珠|幽邃地窟|隐世修所|盐海矿镇|莲华古城|意境空岛|天枢云阙|一突|二突|烟位|哨位|信息位|打瓦|手瓦|瓦手|掌瓦|我🐍|我梦|我🔒|瓦的|瓦罗/;
const OTHER_STRONG =
  /第五人格|庄园|求生者|监管者|屠夫|密码机|地窖|狂欢之椅|洛克王国|迪莫|魔力猫|明日方舟|罗德岛|原神|钟离|雷电将军|珊瑚宫|星穹|崩铁|王者荣耀|英雄联盟|永劫|三角洲|鸣潮|绝区零|阴阳师|黎明杀机|守望先锋|炉石/;

const vaLines = [];
for (const line of blob.split(/\r?\n/)) {
  const t = line.replace(/^【(评论|弹幕|视频|UP|简介)】\s*/, '').replace(/\[[^\]]{1,8}\]/g, '').trim();
  if (t.length < 4) continue;
  if (!VA_STRONG.test(t)) continue;
  if (OTHER_STRONG.test(t) && !/无畏契约|瓦罗兰特|瓦罗淋特|大沙田契约/.test(t)) continue;
  vaLines.push(norm(t));
}
const VABLOB = vaLines.join('\n');
const bleed = WORDS.filter((w) => !VABLOB.includes(norm(w.linyu)));
if (bleed.length) {
  console.error('[FATAL] 以下词条的 linyu 在瓦罗语境里一次都没出现，属跨游戏通用词，禁止挂本分区：');
  for (const w of bleed) console.error(`  - ${w.zh} → ${w.linyu} [${w.slot}]`);
  console.error('  处理方式：跑 node scripts/check-slot-bleed19.js --write 剔除，或改挂通用语义位。');
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

// 4a. 先把 WORD_MERGE 的别名灌进既有词条（多译法的落地口）
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
// 本轮专有自检：所有新增词条的 slot 必须落在瓦罗淋特分区下（不串味到通用位）
const wrongSlot = WORDS.filter((w) => !String(w.slot || '').includes('瓦罗淋特'));
if (wrongSlot.length) {
  console.error(`[FATAL] ${wrongSlot.length} 条词条没有挂在瓦罗淋特分区下：${wrongSlot.map((w) => w.zh).join('、')}`);
  process.exit(1);
}

if (DRY) {
  console.error('[dry-run] 不写盘');
  process.exit(0);
}
fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2) + '\n', 'utf8');
console.error('[OK] 已写回 ' + SEED_FILE);
