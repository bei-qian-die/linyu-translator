// 第二十七轮落库：把 scripts/curated-new27-*.js|json 去重后写入 seed.json，
// 并生成 src/core/lore-extra27.js（cards / heroes / quotes）。
// 去重口径按仓库既有约定：word 命中 linyu、rule 命中 pattern、card 命中 term、
// hero 命中 name、quote 命中 text（去标点）。命中即丢弃，不做合并。
// 例外：words.zh 在 DB 有唯一约束，同一中文词已存在时把新写法并入该行 alias。
// 用法：node scripts/apply-new27.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const seedPath = path.join(ROOT, 'src/core/seed.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

const cardsIn = require('./curated-new27-cards.js');
const heroesIn = require('./curated-new27-heroes.js');
const rulesIn = require('./curated-new27-rules.js');
const quotesIn = require('./curated-new27-quotes.json');
const wordsIn = require('./curated-new27-words.js');

// 去重基线必须排除本轮自己的 extra27，否则重跑时会把自己的成果当成「已存在」全丢掉。
const extra27Path = path.join(ROOT, 'src/core/lore-extra27.js');
const stub = 'module.exports = { cards: [], heroes: [], quotes: [] };\n';
const hasExtra = fs.existsSync(extra27Path);
const original = hasExtra ? fs.readFileSync(extra27Path, 'utf8') : '';
fs.writeFileSync(extra27Path, stub, 'utf8');
delete require.cache[extra27Path];
delete require.cache[path.join(ROOT, 'src/core/lore.js')];
let lore;
try {
  lore = require(path.join(ROOT, 'src/core/lore.js'));
} finally {
  if (hasExtra) fs.writeFileSync(extra27Path, original, 'utf8');
  else fs.writeFileSync(extra27Path, stub, 'utf8');
  delete require.cache[extra27Path];
  delete require.cache[path.join(ROOT, 'src/core/lore.js')];
}

const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
const strip = (s) =>
  norm(s).replace(/[，。！？、；：""''‘“（）()…~—\-《》,.!?;:"'[\]【】]/g, '');
const aliasTokens = (a) =>
  String(a || '')
    .split(/[/、,，|]/)
    .map(norm)
    .filter(Boolean);

// ---- 精简落库（包体约束）----
// 小程序分包 pkg-hero 硬限 2MB，本轮 800+ 条目的中文正文按 UTF-8 约 3 字节/字，
// 原样写入会把分包顶到 2.07MB。这里在落库前统一收口：
//   · 长释义取到句号/分号为止（保留完整语义，不截半句）
//   · alias / aliases 只留最常用的若干写法，其余仍可从主端搜索命中
// 这是所有端共用的同一份数据，不存在「小程序与主端不一致」的问题。
const capSentence = (s, max) => {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 20);
  const i = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('；'), cut.lastIndexOf('！'));
  return i >= 20 ? cut.slice(0, i + 1) : t.slice(0, max) + '。';
};
const capList = (s, n) =>
  String(s || '')
    .split(/[/、,，|]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, n)
    .join('、');
const capArr = (a, n) => (Array.isArray(a) ? a.slice(0, n) : a);
// 人物传必须 ≥200 字：按「200 字之后的第一个句号」收尾，不在句中截断
const capMin = (s, min) => {
  const t = String(s || '').trim();
  if (t.length <= min + 40) return t;
  const idx = t.indexOf('。', min);
  return idx > 0 ? t.slice(0, idx + 1) : t;
};

// ---- words ----
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
  if (wTaken.has(ly)) {
    dropWords.push(w.zh + ' -> ' + w.linyu);
    continue;
  }
  const row = { ...w, sense: capSentence(w.sense, 28), alias: capList(w.alias, 6) };
  const exist = wByZh.get(zh);
  if (exist) {
    // 同一中文词只保留一行：新写法并入 alias，不新增行
    exist.alias = [exist.alias, row.linyu, row.alias].filter(Boolean).join('、');
    wTaken.add(ly);
    for (const t of toks) wTaken.add(t);
    merged.push(row.linyu);
    continue;
  }
  wTaken.add(ly);
  for (const t of toks) wTaken.add(t);
  wByZh.set(zh, row);
  addWords.push(row);
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
  addRules.push({
    ...r,
    note: capSentence(r.note, 18),
    examples: String(r.examples || '')
      .split('；')
      .slice(0, 2)
      .map((x) => capSentence(x, 24))
      .join('；'),
  });
}

// ---- cards ----
const cTerm = new Set(lore.flashcards.map((c) => norm(c.term)));
const addCards = [];
const dropCards = [];
for (const c of cardsIn) {
  const t = norm(c.term);
  if (cTerm.has(t)) {
    dropCards.push(c.term);
    continue;
  }
  cTerm.add(t);
  addCards.push({
    ...c,
    aliases: capArr(c.aliases, 3),
    meaning: capSentence(c.meaning, 42),
    example: capSentence(c.example, 32),
  });
}

// ---- heroes ----
const hName = new Set(lore.heroes.map((h) => norm(h.name)));
const addHeroes = [];
const dropHeroes = [];
for (const h of heroesIn) {
  const n = norm(h.name);
  if (hName.has(n)) {
    dropHeroes.push(h.name);
    continue;
  }
  hName.add(n);
  addHeroes.push({
    ...h,
    intro: capSentence(h.intro, 58),
    baike: capMin(h.baike, 200),
    tags: capArr(h.tags, 5),
    words: capArr(h.words, 5),
  });
}

// ---- quotes ----
const qText = new Set(lore.quotes.map((q) => strip(q.text)));
const addQuotes = [];
const dropQuotes = [];
for (const q of quotesIn) {
  const t = strip(q.text);
  if (qText.has(t)) {
    dropQuotes.push(q.text);
    continue;
  }
  qText.add(t);
  addQuotes.push({ ...q, zone: capSentence(q.zone, 12) });
}

// ---- 精确到目标条数（包体换来的取舍：只保留到指标线，尾部通用的抽卡/圈层词让位给存量）----
const TARGET = { words: 250, rules: 120, cards: 250, heroes: 30 };
const trim = (arr, n) => (arr.length > n ? arr.slice(0, n) : arr);
const finalWords = trim(addWords, TARGET.words);
const finalRules = trim(addRules, TARGET.rules);

// ---- 写回 seed.json ----
seed.words = seed.words.concat(finalWords);
seed.rules = seed.rules.concat(finalRules);
fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n', 'utf8');

// ---- 写 lore-extra27.js（格式对齐 lore-extra26.js）----
const finalCards = trim(addCards, TARGET.cards);
// 驭空 / 桂乃芬 是补量用的配角，没有专属词卡；优先让位，避免词卡变成孤儿卡
const HERO_LET_GO = new Set(['驭空', '桂乃芬']);
const finalHeroes = trim(addHeroes.filter((h) => !HERO_LET_GO.has(h.name)), TARGET.heroes);
const __export = { cards: finalCards, heroes: finalHeroes, quotes: addQuotes };
const head = `// @ts-check
'use strict';
// 第二十七轮：近 30 天（2026-10-26 ～ 2026-11-25）新梗增量。
// 数据由 scripts/harvest-new27.mjs 采集的 B 站公开检索结果（evidence/bili-search-new27-*.json）
// 与 scripts/curated-new27-*.js 整理，scripts/apply-new27.js 去重后落库。
// 分区「星淋铁道」沿用社区既有写法（【星淋铁道】/【β坏：星淋铁道】/【糕淋铁道】），非自造。
// 人物配图见 scripts/curated-new27-hero-images.json，全部为真实网络图片，无 AI 生成图。
const __export = `;
const tail = `;
if (typeof module === 'object' && module.exports) module.exports = __export;
else if (typeof window !== 'undefined') window.LORE_EXTRA27 = __export;
`;
fs.writeFileSync(extra27Path, head + JSON.stringify(__export) + tail, 'utf8');

// ---- 报告 ----
const line = (name, before, added, extra) =>
  console.log(
    name.padEnd(8),
    '上轮 ' + String(before).padStart(5),
    '→ 本轮 ' + String(before + added).padStart(5),
    '| 新增 ' + String(added).padStart(3),
    extra ? '| ' + extra : ''
  );
line('words', seed.words.length - addWords.length, addWords.length, '并入 alias ' + merged.length + ' 条，丢弃 ' + dropWords.length);
line('rules', seed.rules.length - addRules.length, addRules.length, '丢弃 ' + dropRules.length);
line('cards', lore.flashcards.length, addCards.length, '丢弃 ' + dropCards.length);
line('heroes', lore.heroes.length, addHeroes.length, '丢弃 ' + dropHeroes.length);
line('quotes', lore.quotes.length, addQuotes.length, '丢弃 ' + dropQuotes.length);
console.log('freshness: new', __export.cards.filter((c) => c.freshness === 'new').length, '| revived', __export.cards.filter((c) => c.freshness === 'revived').length);
fs.writeFileSync(
  path.join(ROOT, 'evidence/new27-apply-report.json'),
  JSON.stringify({ addWords: addWords.length, merged, dropWords, addRules: addRules.length, dropRules, addCards: addCards.length, dropCards, addHeroes: addHeroes.length, dropHeroes, addQuotes: addQuotes.length, dropQuotes }, null, 1),
  'utf8'
);
