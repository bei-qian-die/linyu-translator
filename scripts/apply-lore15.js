'use strict';

// 第十五轮：把 scripts/curated-lore15.js（洛克淋国 词卡/名言/人物）写入 src/core/lore-extra15.js。
// - 人物配图按 evidence/hero-images15.json（name → { img, source }）回填，没有映射的人物 img 留空（待补图）。
// - 本脚本每次都从 curated 全量重建 extra15（本轮唯一来源），可安全重跑。
//
// 用法: node scripts/apply-lore15.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry-run');
const { CARDS, QUOTES, HEROES, HEROES_MERGE, QUOTES_MERGE } = require(path.join(ROOT, 'scripts/curated-lore15.js'));

const IMG_MAP = fs.existsSync(path.join(ROOT, 'evidence/hero-images15.json'))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/hero-images15.json'), 'utf8')).map
  : {};
const imgOf = (name) => {
  const m = IMG_MAP[name];
  return m && m.img ? m.img : '';
};

// 基线 = 「第十五轮之前」的库：聚合前先把 extra15 置空，否则上一轮产物会被自己判成重复而清空。
const EXTRA15 = path.join(ROOT, 'src/core/lore-extra15.js');
const EMPTY15 = 'module.exports = { cards: [], quotes: [], heroes: [], heroMerge: [], quoteMerge: [] };';
const orig15 = fs.existsSync(EXTRA15) ? fs.readFileSync(EXTRA15, 'utf8') : EMPTY15;
fs.writeFileSync(EXTRA15, EMPTY15);
let lore;
try {
  const lorePath = require.resolve(path.join(ROOT, 'src/core/lore.js'));
  delete require.cache[lorePath];
  lore = require(path.join(ROOT, 'src/core/lore'));
} finally {
  fs.writeFileSync(EXTRA15, orig15);
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
  heroes: HEROES.map((h) => ({ ...h, img: imgOf(h.name) || undefined })),
  heroMerge: HEROES_MERGE || [],
  quoteMerge: QUOTES_MERGE || [],
};
for (const h of out.heroes) if (!h.img) delete h.img;

const noImg = out.heroes.filter((h) => !h.img).map((h) => h.name);

const banner = `// @ts-check
'use strict';
// 第十五轮扩充（2026-10-26）：洛克淋国分区 新增词卡 ${out.cards.length} 条、名言 ${out.quotes.length} 条、人物 ${out.heroes.length} 位
// （16 位洛克王国精灵 + 5 位洛克淋国 UP 主）+ 既有人物合并 ${out.heroMerge.length} 条。
// 生成器：scripts/apply-lore15.js（从 scripts/curated-lore15.js 全量重建，可安全重跑）。
// 全部语录逐字摘自 corpus/corpus-bili-20261026102422.txt；人物配图为百度图库官方立绘 / 百度百科 bkimg / B 站 UP 头像
// （evidence/hero-images15.json，核验见 evidence/hero-images15-review.md），无 AI 图。待补图：${noImg.join('、') || '无'}。

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
  "else if (typeof window !== 'undefined') window.LORE_EXTRA15 = __export;\n";

if (DRY) {
  console.error(`[dry-run] 词卡 ${out.cards.length} / 名言 ${out.quotes.length} / 人物 ${out.heroes.length} / heroMerge ${out.heroMerge.length}`);
  if (noImg.length) console.error('[dry-run] 待配图人物: ' + noImg.join('、'));
  process.exit(0);
}

fs.writeFileSync(EXTRA15, body, 'utf8');
console.error(`[OK] 写入 src/core/lore-extra15.js：词卡 ${out.cards.length} / 名言 ${out.quotes.length} / 人物 ${out.heroes.length} / heroMerge ${out.heroMerge.length}`);
if (noImg.length) console.error('[提示] 待配图人物: ' + noImg.join('、'));
