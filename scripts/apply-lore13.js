'use strict';

// 第十三轮：把 scripts/curated-lore13.js（精选语料原文）与人工可核验的人物归属，
// 合并进 src/core/lore-extra13.js；同时生成 evidence/hero-coverage13.json 覆盖表。
//
// 合并语义（与 apply-lore12.js 一致）：
//   1. 词卡 term 已存在 → 写进 aliasMerge（补 aliases/meaning/hero 等空字段，不覆盖已有归属）。
//   2. 名言 text 已存在 → 写进 quoteMerge（仅当该句 hero 为空时补归属）。
//   3. 人物 name 已存在 → 写进 heroMerge（补 alias/tags/works/words/links）。
//
// 注意：lore-extra13.js 里已有 scripts/build-lore13.js 生成的 31 个新增游戏角色及其内容，
// 本脚本采取「读取现有 extra13 → 追加合并 → 整文件重写」，不会丢弃对方数据；
// 若之后重跑 build-lore13.js，需要再跑一次本脚本把精选合并补回。
//
// 用法: node scripts/apply-lore13.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry-run');
const { CARDS, QUOTES, HEROES_MERGE } = require(path.join(ROOT, 'scripts/curated-lore13.js'));

const OUT_FILE = path.join(ROOT, 'src/core/lore-extra13.js');
const prev = require(path.join(ROOT, 'src/core/lore-extra13'));

const lore = require(path.join(ROOT, 'src/core/lore'));
const existingCards = new Map(lore.flashcards.map((c) => [c.term, c]));
const existingQuotes = new Map(lore.quotes.map((q) => [q.text, q]));
const existingHeroes = new Set(lore.heroes.map((h) => h.name));

const cards = (prev.cards || []).slice();
const quotes = (prev.quotes || []).slice();
const heroes = (prev.heroes || []).slice();
let aliasMerge = (prev.aliasMerge || []).slice();
let heroMerge = (prev.heroMerge || []).slice();
let quoteMerge = (prev.quoteMerge || []).slice();
// 幂等保护：本脚本可反复运行。上一轮由本脚本写入的条目带 __src13 标记，先整体移除再重建；
// 对方 build-lore13.js 生成的条目（无标记）原样保留。
const TAG = 'curated-lore13';
const dropMine = (arr) => arr.filter((m) => !m || m.__src13 !== TAG);
aliasMerge = dropMine(aliasMerge);
heroMerge = dropMine(heroMerge);
quoteMerge = dropMine(quoteMerge);
const aIdx = new Set(aliasMerge.map((m) => m.term));
const hIdx = new Set(heroMerge.map((m) => m.name));
const qIdx = new Set(quoteMerge.map((m) => m.text));

let newCards = 0;
let mergedCards = 0;
let newQuotes = 0;
let filledQuotes = 0;

for (const c of CARDS) {
  const t = existingCards.get(c.term);
  if (t) {
    if (!aIdx.has(c.term)) {
      aliasMerge.push({
        term: c.term,
        aliases: c.aliases || [],
        meaningAppend: '',
        source: !t.source ? c.source || '' : '',
        verify: !t.verify ? c.verify || '' : '',
        hero: !t.hero && c.hero ? c.hero : '',
        __src13: TAG,
      });
      aIdx.add(c.term);
    }
    mergedCards++;
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
  existingCards.set(c.term, { term: c.term, hero: c.hero, source: c.source, verify: c.verify });
  newCards++;
}

for (const q of QUOTES) {
  const t = existingQuotes.get(q.text);
  if (t) {
    if (!t.hero && q.hero && !qIdx.has(q.text)) {
      quoteMerge.push({ text: q.text, hero: q.hero, __src13: TAG });
      qIdx.add(q.text);
    }
    filledQuotes++;
    continue;
  }
  quotes.push({ text: q.text, author: q.author || '', hero: q.hero || '', src: q.src || '', verify: q.verify || '' });
  existingQuotes.set(q.text, { text: q.text, hero: q.hero });
  newQuotes++;
}

let mergedHeroes = 0;
for (const h of HEROES_MERGE) {
  if (!existingHeroes.has(h.name)) {
    console.error(`[跳过] 人物不存在：${h.name}`);
    continue;
  }
  if (hIdx.has(h.name)) continue;
  heroMerge.push({
    name: h.name,
    alias: '',
    tags: h.tags || [],
    works: h.works || [],
    words: h.words || [],
    links: h.links || [],
    baikeAppend: '',
    __src13: TAG,
  });
  hIdx.add(h.name);
  mergedHeroes++;
}

console.error(`[词卡] 新增 ${newCards}，既有条目 aliasMerge 补空 ${mergedCards}`);
console.error(`[名言] 新增 ${newQuotes}，既有名言补归属 ${filledQuotes}`);
console.error(`[人物] heroMerge 补 works/links ${mergedHeroes}`);

const banner = `// @ts-check
'use strict';
// 第十三轮扩充（2026-10-25）：新增游戏角色 31 人 + 其黑话词卡/名言 + 既有条目的人物归属。
// 生成器：scripts/build-lore13.js（新人物与最长别名自动归属）；
//         scripts/apply-lore13.js 在其后追加合并 scripts/curated-lore13.js 的精选扩充
//         （零覆盖人物的语料原文补挖 + 人物 works/links）。
// 输入 scripts/curated-heroes13.js、evidence/hero-links13.json、evidence/mined13.json、corpus/*.txt。
// 配图全部为百度图库/B 站封面的真实图片（人工逐张核验见 evidence/hero-images13-review.md），未使用 AI 生成图。
// 名言与例句均为语料原文逐字摘录；aliasMerge/quoteMerge/heroMerge 只补空字段，不覆盖已有归属。

`;

const out = [
  banner,
  `const cards = ${JSON.stringify(cards, null, 2)};\n\n`,
  `const quotes = ${JSON.stringify(quotes, null, 2)};\n\n`,
  `const heroes = ${JSON.stringify(heroes, null, 2)};\n\n`,
  `const aliasMerge = ${JSON.stringify(aliasMerge, null, 2)};\n\n`,
  `const heroMerge = ${JSON.stringify(heroMerge, null, 2)};\n\n`,
  `const quoteMerge = ${JSON.stringify(quoteMerge, null, 2)};\n\n`,
  `const __export = { cards, quotes, heroes, aliasMerge, heroMerge, quoteMerge };\n`,
  `if (typeof module === 'object' && module.exports) module.exports = __export;\n`,
  `else if (typeof window !== 'undefined') window.LORE_EXTRA13 = __export;\n`,
].join('');

if (!DRY) {
  fs.writeFileSync(OUT_FILE, out, 'utf8');
  console.error(`-> ${OUT_FILE}`);
} else {
  console.error('[dry-run] 未写入');
}

// ---- evidence/hero-coverage13.json：重读合并后的 lore，统计每人物的 cards/quotes/words ----
if (!DRY) {
  delete require.cache[require.resolve(path.join(ROOT, 'src/core/lore'))];
  delete require.cache[require.resolve(path.join(ROOT, 'src/core/lore-extra13'))];
  const fresh = require(path.join(ROOT, 'src/core/lore'));
  const cc = {};
  const qq = {};
  for (const c of fresh.flashcards) if (c.hero) cc[c.hero] = (cc[c.hero] || 0) + 1;
  for (const q of fresh.quotes) if (q.hero) qq[q.hero] = (qq[q.hero] || 0) + 1;
  const linkStats = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/hero-links13.json'), 'utf8'));
  const why = {};
  const REASONS = {
    青行灯: '语料无该人物内容（全 22 文件零命中）',
    陈: '语料无该人物内容；单字名无法安全匹配',
    春丽: '语料无该人物内容（全 22 文件零命中）',
    蝰蛇: '语料无该人物内容（全 22 文件零命中）',
    阿鬼: '语料无该人物内容（全 22 文件零命中）',
    大天狗: '语料无该人物内容（全 22 文件零命中）',
    奇乐: '语料仅出现「猎奇/乐子」分栏文本，非人物名用法，判为误命中',
    黑梦: '语料命中句均为「我梦到/我梦里」的普通用法，与人物无关，宁缺勿挂',
    霞: '单字名在语料中只以 翠霞/紫霞/晚霞 等他人词出现，无法安全归属',
    青子: '语料仅命中另一 UP「jじ青青子衿」，非本人内容',
    摩西女: '语料仅在同一视频标题出现一次，标题句已归给血律Daddy，不重复编造',
    女王糖糖子: '本人视频只有标签式简介，弹幕评论无 ≥10 字合格句（词卡已由标题补上）',
    老凡Fv: '本人视频是庄周硬核教学，弹幕与淋语无关，按纪律不收（词卡已由标题梗补上）',
    恋爱顾问曹小派: '《淋语大全》视频评论区仅短句「爱看，UP加油！」，无 ≥10 字合格句（词卡已补）',
    'FLY 组合工作室': '阴婷宝相关词卡（智能语阴/淋性话）已归阴婷宝名下，工作室暂无独立可解释梗词（名言已补 2 条）',
    蒜姐: '同名词卡已归属同一人物的本名行「上官婉儿」（项目里蒜姐/上官婉儿是双行），不再重复造词卡',
    去听潮声吧: '候选词卡「擦边主播」被最长别名自动归属判给孙策（其体育生梗），本行保留 0 卡，宁缺勿抢',
    黑天鹅: '语料仅一句点名弹幕，已按名言收录；无其它可解释梗词',
    聊赠一枝竹: '语料只有贴吧楼主原帖一句（已按名言收录），楼主 ID 无独立梗词可做卡',
  };
  const NEW31 = new Set(require(path.join(ROOT, 'scripts/curated-heroes13.js')).HEROES.map((h) => h.name));
  const rows = fresh.heroes.map((h) => {
    const cards = cc[h.name] || 0;
    const quotesN = qq[h.name] || 0;
    const def = NEW31.has(h.name)
      ? '本轮并行新增的游戏角色：词卡以黑话写法为主，名言池仍按语料逐字补，缺者不强凑'
      : '语料无该人物内容，或相关内容与淋语无关，宁缺勿挂';
    if (!cards || !quotesN) why[h.name] = why[h.name] || REASONS[h.name] || def;
    return { name: h.name, group: h.group || 'other', cards, quotes: quotesN, words: (h.words || []).length };
  });
  const cov = {
    total: rows.length,
    linkedByAliasMerge: linkStats.stats,
    zeroCards: rows.filter((r) => !r.cards).map((r) => r.name),
    zeroQuotes: rows.filter((r) => !r.quotes).map((r) => r.name),
    whyZero: why,
    perHero: rows,
  };
  fs.writeFileSync(path.join(ROOT, 'evidence/hero-coverage13.json'), JSON.stringify(cov, null, 1), 'utf8');
  console.error(
    `coverage: heroes ${rows.length} | zeroCards ${cov.zeroCards.length} | zeroQuotes ${cov.zeroQuotes.length} -> evidence/hero-coverage13.json`
  );
}
