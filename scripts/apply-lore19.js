'use strict';

// 第十九轮：把词卡 / 人物 / 名言写入 src/core/lore-extra19.js。
//
// 数据来源：
//   - 词卡  → scripts/curated-cards19.json（scripts/build-cards19.js 生成，example 全部是语料原句）
//   - 人物  → scripts/curated-heroes19.js 的 HEROES
//   - 名言  → scripts/curated-heroes19.js 的 QUOTES（内部 require 了 curated-quotes19.json）
//   - 配图  → evidence/hero-images19.json（没有映射的人物 img 留空，计入待补清单）
//
// 每次从 curated 全量重建 extra19，可安全重跑；去重基线是「第十九轮之前」的库
// （先把 extra19 置空再聚合，避免自己判成重复）。
//
// 用法：node scripts/apply-lore19.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry-run');
const { HEROES, HERO_MERGE } = require(path.join(ROOT, 'scripts/curated-heroes19.js'));
const QUOTES = require(path.join(ROOT, 'scripts/curated-quotes19.json'));
const RAW_CARDS = require(path.join(ROOT, 'scripts/curated-cards19.json'));

const IMG_FILE = path.join(ROOT, 'evidence/hero-images19.json');
const IMG_MAP = fs.existsSync(IMG_FILE) ? JSON.parse(fs.readFileSync(IMG_FILE, 'utf8')).map || {} : {};
const imgOf = (name) => {
  const m = IMG_MAP[name];
  return m && m.img ? m.img : '';
};

const EXTRA19 = path.join(ROOT, 'src/core/lore-extra19.js');
const EMPTY19 = 'module.exports = { cards: [], quotes: [], heroes: [], heroMerge: [], quoteMerge: [] };';

// ---------- 1. 去重基线 ----------
const orig = fs.existsSync(EXTRA19) ? fs.readFileSync(EXTRA19, 'utf8') : EMPTY19;
fs.writeFileSync(EXTRA19, EMPTY19);
let lore;
try {
  const p = require.resolve(path.join(ROOT, 'src/core/lore.js'));
  delete require.cache[p];
  lore = require(path.join(ROOT, 'src/core/lore'));
} finally {
  fs.writeFileSync(EXTRA19, orig);
}

const existingCards = new Set(lore.flashcards.map((c) => c.term));
const existingQuotes = new Set(lore.quotes.map((q) => q.text));
const existingHeroes = new Set(lore.heroes.map((h) => h.name));

const dupCards = RAW_CARDS.filter((c) => existingCards.has(c.term)).map((c) => c.term);
const dupQuotes = QUOTES.filter((q) => existingQuotes.has(q.text)).map((q) => q.text.slice(0, 20));
const dupHeroes = HEROES.filter((h) => existingHeroes.has(h.name)).map((h) => h.name);
if (dupCards.length) console.error(`[提示] 词卡与现有库重复 ${dupCards.length} 张（去重丢弃）：${dupCards.slice(0, 8).join('、')}`);
if (dupQuotes.length) console.error(`[提示] 名言与现有库重复 ${dupQuotes.length} 条（去重丢弃）`);
if (dupHeroes.length) console.error(`[FATAL] 人物与现有库重名：${dupHeroes.join('、')}`);

// ---------- 2. hero 关联：卡片 term 命中某位人物的别名就挂上去 ----------
const alias2hero = new Map();
for (const h of HEROES) {
  alias2hero.set(h.name, h.name);
  for (const a of String(h.alias || '').split(/[、,，/／]/).map((s) => s.trim()).filter(Boolean)) {
    if (!alias2hero.has(a)) alias2hero.set(a, h.name);
  }
}

const CARDS = RAW_CARDS.filter((c) => !existingCards.has(c.term)).map((c) => {
  const hero = alias2hero.get(c.term) || '';
  const out = {
    term: c.term,
    type: c.type,
    meaning: c.meaning,
    detail: `对应中文原词「${c.zh}」，语义位 ${c.slot}。`,
    example: c.example,
    source: c.source,
    verify: c.source,
  };
  if (hero) out.hero = hero;
  return out;
});

const OUT_HEROES = HEROES.map((h) => {
  const grp = /^UP主/.test(h.rank) ? 'real' : 'game';
  const o = {
    name: h.name,
    alias: h.alias,
    group: grp,
    grp,
    rank: h.rank,
    intro: h.intro,
    baike: h.baike,
    tags: h.tags,
    works: h.works,
    words: h.words,
    links: h.links,
  };
  const img = imgOf(h.name);
  if (img) o.img = img;
  return o;
});

const OUT_QUOTES = QUOTES.filter((q) => !existingQuotes.has(q.text));

// ---------- 3. 校验 ----------
// 3a. rank 不许出现双分隔号（第 0 节缺陷 1 的复发检查）
const badRank = OUT_HEROES.filter((h) => String(h.rank).includes('· ·') || String(h.rank).split('·').length > 2);
if (badRank.length) {
  console.error('[FATAL] rank 格式不合规（双分隔号或多段）：\n  ' + badRank.map((h) => `${h.name}: ${h.rank}`).join('\n  '));
  process.exit(1);
}
// 3b. baike 不许带模板尾句
const badBaike = OUT_HEROES.filter((h) => String(h.baike).includes('本条按词库既有外号与可回源出处整理'));
if (badBaike.length) {
  console.error('[FATAL] baike 仍带模板尾句：' + badBaike.map((h) => h.name).join('、'));
  process.exit(1);
}
// 3c. works 不许是别名（第 0 节缺陷 3）
const badWorks = OUT_HEROES.filter((h) => (h.works || []).some((w) => String(h.alias || '').includes(w) && w.length <= 4));
if (badWorks.length) {
  console.error('[FATAL] works 疑似仍是别名：' + badWorks.map((h) => `${h.name}:${JSON.stringify(h.works)}`).join(' ; '));
  process.exit(1);
}
// 3d. 名言的 hero 必须存在
const knownHeroes = new Set([...lore.heroes.map((h) => h.name), ...OUT_HEROES.map((h) => h.name)]);
const badHeroRefs = OUT_QUOTES.filter((q) => q.hero && !knownHeroes.has(q.hero)).map((q) => `${q.text.slice(0, 16)}→${q.hero}`);
if (badHeroRefs.length) {
  console.error('[FATAL] 名言 hero 关联到不存在的人物：\n  ' + badHeroRefs.join('\n  '));
  process.exit(1);
}
// 3e. 词卡的 hero 必须存在
const badCardRefs = CARDS.filter((c) => c.hero && !knownHeroes.has(c.hero)).map((c) => `${c.term}→${c.hero}`);
if (badCardRefs.length) {
  console.error('[FATAL] 词卡 hero 关联到不存在的人物：\n  ' + badCardRefs.join('\n  '));
  process.exit(1);
}

const noImg = OUT_HEROES.filter((h) => !h.img).map((h) => h.name);

// ---------- 4. 输出 ----------
const banner = `// @ts-check
'use strict';
// 第十九轮扩充（2026-10-26）：瓦罗淋特（无畏契约）分区
// 新增词卡 ${CARDS.length} 条、名言 ${OUT_QUOTES.length} 条、人物 ${OUT_HEROES.length} 位
// （契约者 24 位 + UP主与选手 32 位 + 召唤兽 5 位），既有人物合并 ${HERO_MERGE.length} 条。
// 生成器：scripts/apply-lore19.js（从 scripts/curated-*19.* 全量重建，可安全重跑）。
// 名言逐字摘自 corpus/corpus-bili-20261026144409/145026/145707/150255.txt；
// 词卡 example 一律取语料原句；人物配图见 evidence/hero-images19.json，无 AI 图。
// 待补图：${noImg.join('、') || '无'}。

`;

const body =
  banner +
  'const cards = ' +
  JSON.stringify(CARDS, null, 2).replace(/"([a-zA-Z_]+)":/g, '$1: ') +
  ';\n\nconst quotes = ' +
  JSON.stringify(OUT_QUOTES, null, 2).replace(/"([a-zA-Z_]+)":/g, '$1: ') +
  ';\n\nconst heroes = ' +
  JSON.stringify(OUT_HEROES, null, 2).replace(/"([a-zA-Z_]+)":/g, '$1: ') +
  ';\n\nconst heroMerge = ' +
  JSON.stringify(HERO_MERGE, null, 2).replace(/"([a-zA-Z_]+)":/g, '$1: ') +
  ';\n\nconst quoteMerge = [];\n' +
  '\nconst __export = { cards, quotes, heroes, heroMerge, quoteMerge };\n' +
  "if (typeof module === 'object' && module.exports) module.exports = __export;\n" +
  "else if (typeof window !== 'undefined') window.LORE_EXTRA19 = __export;\n";

if (DRY) {
  console.error(
    `[dry-run] 词卡 ${CARDS.length} / 名言 ${OUT_QUOTES.length} / 人物 ${OUT_HEROES.length} / heroMerge ${HERO_MERGE.length}`
  );
  if (noImg.length) console.error('[dry-run] 待配图人物: ' + noImg.join('、'));
  process.exit(0);
}

fs.writeFileSync(EXTRA19, body, 'utf8');
console.error(
  `[OK] 写入 src/core/lore-extra19.js：词卡 ${CARDS.length} / 名言 ${OUT_QUOTES.length} / 人物 ${OUT_HEROES.length} / heroMerge ${HERO_MERGE.length}`
);
if (noImg.length) console.error(`[提示] 待配图人物 ${noImg.length} 位: ` + noImg.join('、'));
