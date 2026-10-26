'use strict';

// 第二十轮：把词卡 / 人物 / 名言写入 src/core/lore-extra20.js。
//
// 数据来源：
//   - 词卡  → scripts/curated-cards20.json（scripts/build-cards20.js 生成，example 全部是语料原句）
//   - 人物  → scripts/curated-heroes20.js 的 HEROES
//   - 名言  → scripts/curated-quotes20.json（每条带 BV 号，可点回原视频）
//   - 配图  → evidence/hero-images20.json（没有映射的人物 img 留空，计入待补清单）
//
// 每次从 curated 全量重建 extra20，可安全重跑；去重基线是「第二十轮之前」的库
// （先把 extra20 置空再聚合，避免自己判成重复）。
//
// 用法：node scripts/apply-lore20.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry-run');
const { HEROES, HERO_MERGE } = require(path.join(ROOT, 'scripts/curated-heroes20.js'));
const QUOTES = require(path.join(ROOT, 'scripts/curated-quotes20.json'));
const RAW_CARDS = require(path.join(ROOT, 'scripts/curated-cards20.json'));

const IMG_FILE = path.join(ROOT, 'evidence/hero-images20.json');
const IMG_MAP = fs.existsSync(IMG_FILE) ? JSON.parse(fs.readFileSync(IMG_FILE, 'utf8')).map || {} : {};
const imgOf = (name) => {
  const m = IMG_MAP[name];
  return m && m.img ? m.img : '';
};

const EXTRA20 = path.join(ROOT, 'src/core/lore-extra20.js');
const EMPTY20 = 'module.exports = { cards: [], quotes: [], heroes: [], heroMerge: [], quoteMerge: [] };';

// ---------- 1. 去重基线 ----------
// 先把 20 号置空，拿到「19 轮为止」的聚合结果当判重基线
const orig = fs.existsSync(EXTRA20) ? fs.readFileSync(EXTRA20, 'utf8') : EMPTY20;
fs.writeFileSync(EXTRA20, EMPTY20);
let lore;
try {
  for (const k of Object.keys(require.cache)) {
    if (/[\\/]src[\\/]core[\\/]lore(-extra20)?\.js$/.test(k)) delete require.cache[k];
  }
  lore = require(path.join(ROOT, 'src/core/lore.js'));
} finally {
  fs.writeFileSync(EXTRA20, orig);
}

const existingCards = new Set(lore.flashcards.map((c) => c.term));
const existingQuotes = new Set(lore.quotes.map((q) => q.text));
const existingHeroes = new Set(lore.heroes.map((h) => h.name));

const dupCards = RAW_CARDS.filter((c) => existingCards.has(c.term)).map((c) => c.term);
const dupQuotes = QUOTES.filter((q) => existingQuotes.has(q.text)).map((q) => q.text.slice(0, 20));
const dupHeroes = HEROES.filter((h) => existingHeroes.has(h.name)).map((h) => h.name);
if (dupCards.length) console.error(`[提示] 词卡与现有库重复 ${dupCards.length} 张（去重丢弃）：${dupCards.slice(0, 8).join('、')}`);
if (dupQuotes.length) console.error(`[提示] 名言与现有库重复 ${dupQuotes.length} 条（去重丢弃）`);
if (dupHeroes.length) {
  console.error(`[FATAL] 人物与现有库重名：${dupHeroes.join('、')}`);
  process.exit(1);
}

// ---------- 2. hero 关联：卡片 term 命中某位人物的别名就挂上去 ----------
const alias2hero = new Map();
for (const h of HEROES) {
  alias2hero.set(h.name, h.name);
  for (const a of String(h.alias || '').split(/[、,，/／]/).map((s) => s.trim()).filter(Boolean)) {
    if (!alias2hero.has(a)) alias2hero.set(a, h.name);
  }
  for (const w of h.words || []) if (!alias2hero.has(w)) alias2hero.set(w, h.name);
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
// 3a. rank 只许两段（「淋威争锋 · 捍卫者」），不许出现双分隔号
const badRank = OUT_HEROES.filter((h) => String(h.rank).includes('· ·') || String(h.rank).split('·').length > 2);
if (badRank.length) {
  console.error('[FATAL] rank 格式不合规（双分隔号或多段）：\n  ' + badRank.map((h) => `${h.name}: ${h.rank}`).join('\n  '));
  process.exit(1);
}
// 3b. baike / works / links 不许为占位空值
const badBaike = OUT_HEROES.filter((h) => !String(h.baike || '').trim() || /模板|待补|TODO/.test(h.baike));
if (badBaike.length) {
  console.error('[FATAL] baike 为占位内容：' + badBaike.map((h) => h.name).join('、'));
  process.exit(1);
}
const badWorks = OUT_HEROES.filter((h) => !(h.works || []).length);
if (badWorks.length) {
  console.error('[FATAL] works 为空：' + badWorks.map((h) => h.name).join('、'));
  process.exit(1);
}
// 3c. links 必须是 [url, label] 二元组，且 url 得是 http 开头
const badLinks = OUT_HEROES.filter((h) =>
  (h.links || []).some((l) => !Array.isArray(l) || l.length !== 2 || !/^https?:\/\//.test(l[0]) || !l[1])
);
if (badLinks.length) {
  console.error('[FATAL] links 结构不合规：' + badLinks.map((h) => h.name).join('、'));
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
// 3f. 分区纪律：本轮所有人物／词卡都必须带 淋威争锋 tag / slot
const badTag = OUT_HEROES.filter((h) => !(h.tags || []).includes('淋威争锋'));
if (badTag.length) {
  console.error('[FATAL] 人物缺 淋威争锋 tag：' + badTag.map((h) => h.name).join('、'));
  process.exit(1);
}
const badSlot = RAW_CARDS.filter((c) => !/淋威争锋/.test(String(c.slot || '')));
if (badSlot.length) {
  console.error('[FATAL] 词卡 slot 不在淋威争锋分区：' + badSlot.slice(0, 10).map((c) => `${c.term}:${c.slot}`).join('、'));
  process.exit(1);
}

const noImg = OUT_HEROES.filter((h) => !h.img).map((h) => h.name);

// ---------- 4. 输出 ----------
const nGame = OUT_HEROES.filter((h) => h.grp === 'game').length;
const nUp = OUT_HEROES.filter((h) => h.grp === 'real').length;
const banner = `// @ts-check
'use strict';
// 第二十轮扩充（2026-10-27）：淋威争锋（漫威争锋 / Marvel Rivals）分区开区
// 新增词卡 ${CARDS.length} 条、名言 ${OUT_QUOTES.length} 条、人物 ${OUT_HEROES.length} 位
// （游戏英雄 ${nGame} 位 + UP主 ${nUp} 位）。
// 生成器：scripts/apply-lore20.js（从 scripts/curated-*20.* 全量重建，可安全重跑）。
// 名言逐字摘自 B 站淋威争锋相关视频的标题／评论／弹幕，每条带 BV 号可点回原视频；
// 词卡 example 一律取语料原句；人物配图见 evidence/hero-images20.json，无 AI 图、无自绘图。
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
  "else if (typeof window !== 'undefined') window.LORE_EXTRA20 = __export;\n";

if (DRY) {
  console.error(
    `[dry-run] 词卡 ${CARDS.length} / 名言 ${OUT_QUOTES.length} / 人物 ${OUT_HEROES.length} / heroMerge ${HERO_MERGE.length}`
  );
  if (noImg.length) console.error('[dry-run] 待配图人物: ' + noImg.join('、'));
  process.exit(0);
}

fs.writeFileSync(EXTRA20, body, 'utf8');
console.error(
  `[OK] 写入 src/core/lore-extra20.js：词卡 ${CARDS.length} / 名言 ${OUT_QUOTES.length} / 人物 ${OUT_HEROES.length} / heroMerge ${HERO_MERGE.length}`
);
if (noImg.length) console.error(`[提示] 待配图人物 ${noImg.length} 位: ` + noImg.join('、'));
