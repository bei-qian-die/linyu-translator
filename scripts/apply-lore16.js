'use strict';

// 第十六轮：把 scripts/curated-lore16.js（洛克淋国 词卡/名言/人物）写入 src/core/lore-extra16.js。
// - 人物配图按 evidence/hero-images16.json（name → { img, source }）回填；没有映射的人物 img 留空（待补图）
// - 每次都从 curated 全量重建 extra16（本轮唯一来源），可安全重跑
// - 去重基线 = 「第十六轮之前」的库：先把 extra16 置空再聚合，避免自己判成重复
//
// 用法: node scripts/apply-lore16.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry-run');
const { CARDS, QUOTES, HEROES, HEROES_MERGE, QUOTES_MERGE } = require(path.join(ROOT, 'scripts/curated-lore16.js'));

const IMG_FILE = path.join(ROOT, 'evidence/hero-images16.json');
const IMG_MAP = fs.existsSync(IMG_FILE) ? JSON.parse(fs.readFileSync(IMG_FILE, 'utf8')).map : {};
const imgOf = (name) => {
  const m = IMG_MAP[name];
  return m && m.img ? m.img : '';
};

const EXTRA16 = path.join(ROOT, 'src/core/lore-extra16.js');
const EMPTY16 = 'module.exports = { cards: [], quotes: [], heroes: [], heroMerge: [], quoteMerge: [] };';
const orig16 = fs.existsSync(EXTRA16) ? fs.readFileSync(EXTRA16, 'utf8') : EMPTY16;
fs.writeFileSync(EXTRA16, EMPTY16);
let lore;
try {
  const p = require.resolve(path.join(ROOT, 'src/core/lore.js'));
  delete require.cache[p];
  lore = require(path.join(ROOT, 'src/core/lore'));
} finally {
  fs.writeFileSync(EXTRA16, orig16);
}

const existingCards = new Set(lore.flashcards.map((c) => c.term));
const existingQuotes = new Set(lore.quotes.map((q) => q.text));
const existingHeroes = new Set(lore.heroes.map((h) => h.name));

const dupCards = CARDS.filter((c) => existingCards.has(c.term)).map((c) => c.term);
const dupQuotes = QUOTES.filter((q) => existingQuotes.has(q.text)).map((q) => q.text.slice(0, 24));
const dupHeroes = HEROES.filter((h) => existingHeroes.has(h.name)).map((h) => h.name);
if (dupCards.length) console.error('[警告] 词卡与现有库重复(将被去重丢弃): ' + dupCards.join('、'));
if (dupQuotes.length) console.error('[警告] 名言与现有库重复(将被去重丢弃): ' + dupQuotes.join('、'));
if (dupHeroes.length) console.error('[警告] 人物与现有库重复: ' + dupHeroes.join('、'));

const out = {
  cards: CARDS.filter((c) => !existingCards.has(c.term)),
  quotes: QUOTES.filter((q) => !existingQuotes.has(q.text)),
  heroes: HEROES.map((h) => ({ ...h, grp: 'game', group: 'game', img: imgOf(h.name) || undefined })),
  heroMerge: HEROES_MERGE || [],
  quoteMerge: QUOTES_MERGE || [],
};
for (const h of out.heroes) if (!h.img) delete h.img;

const noImg = out.heroes.filter((h) => !h.img).map((h) => h.name);

// hero 关联校验：名言的 hero 必须是「本轮人物 + 已有库人物」里存在的名字，否则会产生查无此人的引用
const knownHeroes = new Set([...lore.heroes.map((h) => h.name), ...out.heroes.map((h) => h.name)]);
const badHeroRefs = out.quotes.filter((q) => q.hero && !knownHeroes.has(q.hero)).map((q) => `${q.text.slice(0, 16)}→${q.hero}`);
if (badHeroRefs.length) {
  console.error('[FATAL] 名言 hero 关联到不存在的人物：\n  ' + badHeroRefs.join('\n  '));
  process.exit(1);
}

const banner = `// @ts-check
'use strict';
// 第十六轮扩充（2026-10-26）：洛克淋国分区 新增词卡 ${out.cards.length} 条、名言 ${out.quotes.length} 条、人物 ${out.heroes.length} 位
// （洛克王国精灵 / NPC / UP 主）+ 既有人物合并 ${out.heroMerge.length} 条。
// 生成器：scripts/apply-lore16.js（从 scripts/curated-lore16.js 全量重建，可安全重跑）。
// 语录逐字摘自 corpus/corpus-bili-20261026114722.txt 与 corpus-bili-20261026115214.txt；
// 人物配图为百度图库官方图 / 百度百科配图 / B 站 UP 头像（evidence/hero-images16.json，
// 核验见 evidence/hero-images16-review.md），无 AI 图。待补图：${noImg.join('、') || '无'}。

`;

const body =
  banner +
  'const cards = ' +
  JSON.stringify(out.cards, null, 2).replace(/"([a-zA-Z_]+)":/g, '$1: ') +
  ';\n\nconst quotes = ' +
  JSON.stringify(out.quotes, null, 2).replace(/"([a-zA-Z_]+)":/g, '$1: ') +
  ';\n\nconst heroes = ' +
  JSON.stringify(out.heroes, null, 2).replace(/"([a-zA-Z_]+)":/g, '$1: ') +
  ';\n\nconst heroMerge = ' +
  JSON.stringify(out.heroMerge, null, 2).replace(/"([a-zA-Z_]+)":/g, '$1: ') +
  ';\n\nconst quoteMerge = ' +
  JSON.stringify(out.quoteMerge, null, 2).replace(/"([a-zA-Z_]+)":/g, '$1: ') +
  ';\n\nconst __export = { cards, quotes, heroes, heroMerge, quoteMerge };\n' +
  "if (typeof module === 'object' && module.exports) module.exports = __export;\n" +
  "else if (typeof window !== 'undefined') window.LORE_EXTRA16 = __export;\n";

if (DRY) {
  console.error(`[dry-run] 词卡 ${out.cards.length} / 名言 ${out.quotes.length} / 人物 ${out.heroes.length} / heroMerge ${out.heroMerge.length}`);
  if (noImg.length) console.error('[dry-run] 待配图人物: ' + noImg.join('、'));
  process.exit(0);
}

fs.writeFileSync(EXTRA16, body, 'utf8');
console.error(`[OK] 写入 src/core/lore-extra16.js：词卡 ${out.cards.length} / 名言 ${out.quotes.length} / 人物 ${out.heroes.length} / heroMerge ${out.heroMerge.length}`);
if (noImg.length) console.error('[提示] 待配图人物: ' + noImg.join('、'));
