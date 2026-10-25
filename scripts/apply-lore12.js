'use strict';

// 把 scripts/curated-lore12.js 的扩充集合并进 src/core/lore-extra12.js，
// 并把它挂进 lore.js 的加载链（与第十一轮 extra11 同构）。
//
// 合并规则（关键：既有条目在 lore.js / lore-extra*.js 里是硬编码的，
// 在这里直接 mutate 只会改到内存，写盘后就没了。所以本文件不 mutate 既有数据，
// 而是导出一份 merge 表，由 lore.js 在合并完所有轮次之后统一应用）：
//   1. 词卡 term 已存在 → 写进 aliasMerge，把新 aliases 并入既有 aliases。
//   2. 名言 text 已存在 → 跳过。
//   3. 人物 name 已存在 → 写进 heroMerge，把新的 alias/tags/works/words/links 并入既有条目。
//
// 用法: node scripts/apply-lore12.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry-run');
const { CARDS, QUOTES, HEROES } = require(path.join(ROOT, 'scripts/curated-lore12.js'));

const lore = require(path.join(ROOT, 'src/core/lore'));
const existingCards = new Map(lore.flashcards.map((c) => [c.term, c]));
const existingQuotes = new Set(lore.quotes.map((q) => q.text));
const existingHeroes = new Set(lore.heroes.map((h) => h.name));

const cards = [];
const quotes = [];
const heroes = [];
const aliasMerge = [];
const heroMerge = [];

for (const c of CARDS) {
  if (existingCards.has(c.term)) {
    const t = existingCards.get(c.term);
    aliasMerge.push({
      term: c.term,
      aliases: c.aliases || [],
      meaningAppend: c.meaning && (!t.meaning || t.meaning.length < c.meaning.length) ? c.meaning : '',
      source: !t.source ? c.source || '' : '',
      verify: !t.verify ? c.verify || '' : '',
      hero: !t.hero && c.hero ? c.hero : '',
    });
    continue;
  }
  cards.push({
    term: c.term,
    type: c.type || 'meme',
    meaning: c.meaning,
    example: c.example || '',
    source: c.source || '',
    verify: c.verify || '',
    ...(c.hero ? { hero: c.hero } : {}),
    ...(c.aliases ? { aliases: c.aliases } : {}),
  });
}

for (const q of QUOTES) {
  if (existingQuotes.has(q.text)) continue;
  quotes.push({
    text: q.text,
    author: q.author || '',
    hero: q.hero || '',
    src: q.src || '',
    verify: q.verify || '',
  });
}

for (const h of HEROES) {
  if (existingHeroes.has(h.name)) {
    heroMerge.push({
      name: h.name,
      alias: h.alias || '',
      tags: h.tags || [],
      works: h.works || [],
      words: h.words || [],
      links: h.links || [],
      baikeAppend: h.baike || '',
    });
    continue;
  }
  heroes.push({
    name: h.name,
    alias: h.alias,
    img: h.img || '',
    group: h.group || 'game',
    rank: h.rank || '',
    intro: h.intro || '',
    tags: h.tags || [],
    baike: h.baike || '',
    works: h.works || [],
    words: h.words || [],
    links: h.links || [],
  });
}

console.error(`[词卡] 新增 ${cards.length}，既有条目合并 ${aliasMerge.length}`);
console.error(`[名言] 新增 ${quotes.length}`);
console.error(`[人物] 新增 ${heroes.length}，既有条目合并 ${heroMerge.length}`);

const banner = `// @ts-check
'use strict';
// 第十二轮扩充（2026-10-24）：词卡 / 名言 / 人物传。
// 生成器：scripts/apply-lore12.js；内容来自 scripts/curated-lore12.js。
//
// 语料来源：第十一轮 B 站高强度检索快照
//   corpus/corpus-bili-20261024202023.txt   320 视频 / 4788 弹幕 / 820 评论
//   evidence/manifest-20261024202023.json 逐条 bvid / 标题 / UP / 封面 / 标签
//
// 本轮名言均可在对应 BV 号的视频弹幕或评论里逐字核对；
// 评论作者已回 B 站评论接口核对（evidence/quote-authors11.json / quote-authors11b.json），
// 弹幕条目按项目既有惯例 author 留空。
//
// 人物配图由 scripts/fetch-hero-images11.js 取：B 站该 UP 主本人节目封面；
// 全程不使用 AI 生成图。

`;

const out = [
  banner,
  `const cards = ${JSON.stringify(cards, null, 2)};\n\n`,
  `const quotes = ${JSON.stringify(quotes, null, 2)};\n\n`,
  `const heroes = ${JSON.stringify(heroes, null, 2)};\n\n`,
  `const aliasMerge = ${JSON.stringify(aliasMerge, null, 2)};\n\n`,
  `const heroMerge = ${JSON.stringify(heroMerge, null, 2)};\n\n`,
  `const __export = { cards, quotes, heroes, aliasMerge, heroMerge };\n`,
  `if (typeof module === 'object' && module.exports) module.exports = __export;\n`,
  `else if (typeof window !== 'undefined') window.LORE_EXTRA12 = __export;\n`,
].join('');

const OUT_FILE = path.join(ROOT, 'src/core/lore-extra12.js');
if (!DRY) {
  fs.writeFileSync(OUT_FILE, out, 'utf8');
  console.error(`-> ${OUT_FILE}`);
} else {
  console.error('[dry-run] 未写入');
}
