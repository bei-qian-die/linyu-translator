'use strict';

// 第十八轮：把 scripts/curated-lore18.js（第五淋格 词卡/名言/人物）写入 src/core/lore-extra18.js。
//
// 与 16 轮同构：
//   - 每次都从 curated 全量重建 extra18（本轮唯一来源），可安全重跑
//   - 去重基线 = 「第十八轮之前」的库：先把 extra18 置空再聚合，避免自己判成重复
//   - 人物配图已在 curated 里写好（img: img/hero-NNN.png），这里只做存在性校验
//
// 用法: node scripts/apply-lore18.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry-run');
const { CARDS, QUOTES, HEROES, HEROES_MERGE } = require(path.join(ROOT, 'scripts/curated-lore18.js'));

const EXTRA18 = path.join(ROOT, 'src/core/lore-extra18.js');
const EMPTY18 = 'module.exports = { cards: [], quotes: [], heroes: [], heroMerge: [], quoteMerge: [] };';
const orig18 = fs.existsSync(EXTRA18) ? fs.readFileSync(EXTRA18, 'utf8') : EMPTY18;
if (!DRY) fs.writeFileSync(EXTRA18, EMPTY18);
let lore;
try {
  const p = require.resolve(path.join(ROOT, 'src/core/lore.js'));
  delete require.cache[p];
  lore = require(path.join(ROOT, 'src/core/lore'));
} finally {
  if (!DRY) fs.writeFileSync(EXTRA18, orig18);
}

const existingCards = new Set(lore.flashcards.map((c) => c.term));
const existingQuotes = new Set(lore.quotes.map((q) => q.text));
const existingHeroes = new Set(lore.heroes.map((h) => h.name));

const dupCards = CARDS.filter((c) => existingCards.has(c.term)).map((c) => c.term);
const dupQuotes = QUOTES.filter((q) => existingQuotes.has(q.text)).map((q) => q.text.slice(0, 20));
const dupHeroes = HEROES.filter((h) => existingHeroes.has(h.name)).map((h) => h.name);
if (dupCards.length) console.error('[警告] 词卡重复（将丢弃）：' + dupCards.join('、'));
if (dupQuotes.length) console.error('[警告] 名言重复（将丢弃）：' + dupQuotes.join('、') + ` 共 ${dupQuotes.length} 条`);
if (dupHeroes.length) console.error('[警告] 人物重复（将丢弃）：' + dupHeroes.join('、'));

// 配图文件存在性校验：curated 里写的 img 必须真有对应文件，否则前端会出破图
const missingImg = [];
for (const h of HEROES) {
  if (!h.img) continue;
  const f = path.join(ROOT, 'src/renderer', h.img);
  if (!fs.existsSync(f)) missingImg.push(`${h.name} → ${h.img}`);
}
if (missingImg.length) {
  console.error('[FATAL] 配图文件不存在：\n  ' + missingImg.join('\n  '));
  process.exit(1);
}

const out = {
  cards: CARDS.filter((c) => !existingCards.has(c.term)),
  quotes: QUOTES.filter((q) => !existingQuotes.has(q.text)),
  heroes: HEROES.filter((h) => !existingHeroes.has(h.name)),
  heroMerge: HEROES_MERGE || [],
  quoteMerge: [],
};

// hero 关联校验：词卡与名言挂的人物必须真实存在
const knownHeroes = new Set([...lore.heroes.map((h) => h.name), ...out.heroes.map((h) => h.name)]);
const badCardRefs = out.cards.filter((c) => c.hero && !knownHeroes.has(c.hero)).map((c) => `${c.term}→${c.hero}`);
const badQuoteRefs = out.quotes.filter((q) => q.hero && !knownHeroes.has(q.hero)).map((q) => `${q.text.slice(0, 14)}→${q.hero}`);
if (badCardRefs.length || badQuoteRefs.length) {
  console.error('[FATAL] 挂了不存在的人物：\n  ' + [...badCardRefs, ...badQuoteRefs].join('\n  '));
  process.exit(1);
}

const noImg = out.heroes.filter((h) => !h.img).map((h) => h.name);

const banner = `// @ts-check
'use strict';
// 第十八轮扩充（2026-10-26）：第五淋格分区 新增词卡 ${out.cards.length} 条、名言 ${out.quotes.length} 条、人物 ${out.heroes.length} 位
// （其中监管者 / 求生者 / UP 主）+ 既有人物合并 ${out.heroMerge.length} 条。
// 生成器：scripts/apply-lore18.js（从 scripts/curated-lore18.js 全量重建，可安全重跑）。
// 名言逐字摘自 corpus/ 存量语料 + corpus-bili-20261026134452.txt（80 视频 / 1558 评论）；
// 配图为百度图库第五人格角色图 + B 站 UP 主头像（evidence/hero-images18*.json），无 AI 图。
// 待补图：${noImg.join('、') || '无'}。

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
  ';\n\nconst quoteMerge = [];\n\nconst __export = { cards, quotes, heroes, heroMerge, quoteMerge };\n' +
  "if (typeof module === 'object' && module.exports) module.exports = __export;\n" +
  "else if (typeof window !== 'undefined') window.LORE_EXTRA18 = __export;\n";

if (DRY) {
  console.error(`[dry-run] 词卡 ${out.cards.length} / 名言 ${out.quotes.length} / 人物 ${out.heroes.length} / heroMerge ${out.heroMerge.length}`);
  process.exit(0);
}

fs.writeFileSync(EXTRA18, body, 'utf8');
console.error(`[OK] 写入 src/core/lore-extra18.js：词卡 ${out.cards.length} / 名言 ${out.quotes.length} / 人物 ${out.heroes.length} / heroMerge ${out.heroMerge.length}`);
if (noImg.length) console.error('[提示] 待配图人物: ' + noImg.join('、'));
