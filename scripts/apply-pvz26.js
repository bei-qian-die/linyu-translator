// 第二十六轮落库：把 scripts/curated-pvz26-*.js 去重后写入 seed.json，
// 并生成 src/core/lore-extra26.js（cards / heroes / quotes）。
// 去重口径按仓库既有约定：word 命中 zh/alias、rule 命中 pattern、card 命中 term/aliases、
// hero 命中 name、quote 命中 text（去标点）。命中即丢弃，不做合并。
// 用法：node scripts/apply-pvz26.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const seedPath = path.join(ROOT, 'src/core/seed.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

const cardsIn = require('./curated-pvz26-cards.js');
const heroesIn = require('./curated-pvz26-heroes.js');
const rulesIn = require('./curated-pvz26-rules.js');
const quotesIn = require('./curated-pvz26-quotes.json');
const wordsIn = require('./curated-pvz26-words.js');

// 去重基线必须排除本轮自己的 extra26，否则重跑时会把上一轮的结果当成「已存在」全丢掉。
// 做法：先把 extra26 换成空壳、清掉 require 缓存，再加载 lore.js，最后恢复原文件。
const extra26Path = path.join(ROOT, 'src/core/lore-extra26.js');
const stub = 'module.exports = { cards: [], heroes: [], quotes: [] };\n';
const hasExtra = fs.existsSync(extra26Path);
const original = hasExtra ? fs.readFileSync(extra26Path, 'utf8') : '';
if (hasExtra) fs.writeFileSync(extra26Path, stub, 'utf8');
delete require.cache[extra26Path];
delete require.cache[path.join(ROOT, 'src/core/lore.js')];
let lore;
try {
  lore = require(path.join(ROOT, 'src/core/lore.js'));
} finally {
  if (hasExtra) fs.writeFileSync(extra26Path, original, 'utf8');
  delete require.cache[extra26Path];
  delete require.cache[path.join(ROOT, 'src/core/lore.js')];
}

const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
const strip = (s) => norm(s).replace(/[，。！？、；：""''‘“（）()…~—\-《》,.!?;:"'[\]【】]/g, '');
const aliasTokens = (a) =>
  String(a || '')
    .split(/[/、,，|]/)
    .map(norm)
    .filter(Boolean);

// ---- words ----
// DB 对 zh 有唯一约束（种子导入按条插入，重复 zh 会让「导入条数 = 种子条数」的断言失败），
// 所以同一个中文词只保留一行：新的淋语写法并入该行的 alias，不再单独成条。
const wByZh = new Map();
const wTaken = new Set();
for (const w of seed.words) {
  wByZh.set(norm(w.zh), w);
  wTaken.add(norm(w.linyu));
  wTaken.add(norm(w.zh));
  for (const t of aliasTokens(w.alias)) wTaken.add(t);
}
const addWords = [];
const dropWords = [];
const merged = [];
for (const w of wordsIn) {
  const zh = norm(w.zh);
  const ly = norm(w.linyu);
  const toks = aliasTokens(w.alias);
  if (wTaken.has(ly) || toks.some((t) => wTaken.has(t))) {
    dropWords.push(w.zh + ' -> ' + w.linyu);
    continue;
  }
  const exist = wByZh.get(zh);
  if (exist) {
    exist.alias = [exist.alias, w.linyu].filter(Boolean).join('、');
    wTaken.add(ly);
    for (const t of toks) wTaken.add(t);
    merged.push(w.linyu);
    continue;
  }
  wTaken.add(ly);
  for (const t of toks) wTaken.add(t);
  wByZh.set(zh, w);
  addWords.push(w);
}

// ---- rules ----
const rPat = new Set(seed.rules.map((r) => norm(r.pattern)));
const addRules = [];
const dropRules = [];
for (const r of rulesIn) {
  const p = norm(r.pattern);
  try {
    new RegExp(r.pattern);
  } catch (e) {
    dropRules.push(r.pattern + '（正则不合法：' + e.message + '）');
    continue;
  }
  if (rPat.has(p)) {
    dropRules.push(r.pattern);
    continue;
  }
  rPat.add(p);
  addRules.push(r);
}

// 词卡以 term（淋语写法）为主键；aliases 里挂的是中文原词，不参与去重，
// 否则「植物大战僵尸」一类的原词会把新增的变体卡全部误杀。
const cTerm = new Set();
for (const c of lore.flashcards) cTerm.add(norm(c.term));
const addCards = [];
const dropCards = [];
for (const c of cardsIn) {
  const t = norm(c.term);
  if (cTerm.has(t)) {
    dropCards.push(c.term);
    continue;
  }
  cTerm.add(t);
  addCards.push(c);
}

const hName = new Set(lore.heroes.map((h) => norm(h.name)));
const addHeroes = [];
const dropHeroes = [];
for (const h of heroesIn) {
  if (hName.has(norm(h.name))) {
    dropHeroes.push(h.name);
    continue;
  }
  hName.add(norm(h.name));
  addHeroes.push(h);
}

const qText = new Set(lore.quotes.map((q) => strip(q.text)));
const addQuotes = [];
const dropQuotes = [];
for (const q of quotesIn) {
  const t = strip(q.text);
  if (!t || qText.has(t)) {
    dropQuotes.push(String(q.text).slice(0, 24));
    continue;
  }
  qText.add(t);
  addQuotes.push(q);
}


// ---- 配图回填：把 evidence/pvz-hero-images26.json 里已落盘并核过的图写回英雄 ----
const eviPath = path.join(ROOT, 'evidence/pvz-hero-images26.json');
if (fs.existsSync(eviPath)) {
  const evi = JSON.parse(fs.readFileSync(eviPath, 'utf8'));
  const byName = new Map((evi.report || []).filter((r) => r.file).map((r) => [r.name, r]));
  for (const h of addHeroes) {
    const r = byName.get(h.name);
    if (!r) continue;
    h.img = 'img/' + r.file;
    h.links = (h.links || []).filter((l) => !/配图来源|封面出处/.test(String(l.label || '')));
    h.links.push({ label: '配图来源 · B站视频封面', url: r.src });
    h.links.push({ label: '封面出处 · ' + r.bvid, url: 'https://www.bilibili.com/video/' + r.bvid });
  }
}

// ---- 写 seed.json ----
seed.words = seed.words.concat(addWords);
seed.rules = seed.rules.concat(addRules);
fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2), 'utf8');

// ---- 写 lore-extra26.js ----
const out = `// @ts-check
'use strict';
// 第二十六轮：淋物大战阴尸（植物大战僵尸淋语化）分区。
// 数据由 scripts/build-curated-pvz26.mjs 从 B 站公开检索（evidence/bili-search-pvz-*.json）
// 与官方设定整理，scripts/apply-pvz26.js 去重后落库；人物配图见 evidence/pvz-hero-images26.json。
const __export = ${JSON.stringify({ cards: addCards, heroes: addHeroes, quotes: addQuotes })};
if (typeof module === 'object' && module.exports) module.exports = __export;
else if (typeof window !== 'undefined') window.LORE_EXTRA26 = __export;
`;
fs.writeFileSync(path.join(ROOT, 'src/core/lore-extra26.js'), out, 'utf8');

console.log('words  新增', addWords.length, '| 丢弃', dropWords.length, '| 合计', seed.words.length);
console.log('rules  新增', addRules.length, '| 丢弃', dropRules.length, '| 合计', seed.rules.length);
console.log('cards  新增', addCards.length, '| 丢弃', dropCards.length);
console.log('heroes 新增', addHeroes.length, '| 丢弃', dropHeroes.length);
console.log('quotes 新增', addQuotes.length, '| 丢弃', dropQuotes.length);
if (merged.length) console.log('并入已有词条的写法', merged.length, '条:', merged.slice(0, 10).join(' / '));
if (dropWords.length) console.log('\n丢弃词条样例:', dropWords.slice(0, 12).join(' / '));
if (dropRules.length) console.log('丢弃句式样例:', dropRules.slice(0, 8).join(' / '));
if (dropCards.length) console.log('丢弃词卡样例:', dropCards.slice(0, 12).join(' / '));
if (dropHeroes.length) console.log('丢弃英雄:', dropHeroes.join(' / '));
