'use strict';

// 把人工审过的候选写进 lore-extra6.js（新建）。
//
// 三条硬规矩，写在这里以免日后绕过：
//   1. 去重——与现有 401 词卡 / 417 名言同名的一律跳过，且同批内也不重复；
//   2. 出处必填——每条都要有 src/source，没有的直接拒绝入库；
//   3. 不生成、不改写候选文本——本脚本只做搬运，内容判断由人做。
const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

// ---- 人工审过的候选。text/term 一字不改，出处必须有。 ----
const CARDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'curated-cards.json'), 'utf8'));
const QUOTES = JSON.parse(fs.readFileSync(path.join(__dirname, 'curated-quotes.json'), 'utf8'));

const lore = require(path.join(ROOT, 'src', 'core', 'lore'));
const extra6 = require(path.join(ROOT, 'src', 'core', 'lore-extra6'));

// 去重基线必须**排除 extra6 自己**。
// 第一版直接拿 lore.flashcards 当基线，于是第二次运行时上一轮写进去的条目全被判成
// 「已存在」而跳过，脚本只把新增的那一条写进文件——lore-extra6.js 被覆盖成只剩 1 条，
// 词卡 409→401、名言 452→418，一整轮收录被清空。
// 去重要跟「除 extra6 以外的其他内容源」比，脚本才是幂等的、可以反复重跑。
const extraTerms = new Set((extra6.cards || []).map((c) => c.term));
const extraTexts = new Set((extra6.quotes || []).map((q) => q.text));
const haveCard = new Set(lore.flashcards.filter((c) => !extraTerms.has(c.term)).map((c) => c.term));
const haveQuote = new Set(lore.quotes.filter((q) => !extraTexts.has(q.text)).map((q) => q.text));

let skipped = 0;
const newCards = [];
for (const c of CARDS) {
  const term = String(c.term || '').trim();
  if (!term || !String(c.meaning || '').trim()) { console.error('跳过（缺词名或释义）:', JSON.stringify(c)); skipped++; continue; }
  if (!String(c.source || '').trim()) { console.error(`跳过「${term}」：没有出处`); skipped++; continue; }
  if (haveCard.has(term)) { console.error(`跳过「${term}」：其他内容源已有`); skipped++; continue; }
  haveCard.add(term);
  newCards.push(c);
}

const seenQ = new Set();
const newQuotes = [];
for (const q of QUOTES) {
  const text = String(q.text || '').trim();
  if (!text) { skipped++; continue; }
  if (!String(q.src || '').trim()) { console.error(`跳过「${text.slice(0, 16)}」：没有出处`); skipped++; continue; }
  if (haveQuote.has(text)) { console.error(`跳过「${text.slice(0, 16)}」：其他内容源已有`); skipped++; continue; }
  if (seenQ.has(text)) { skipped++; continue; }
  seenQ.add(text);
  newQuotes.push(q);
}

// 生成的是「curated 名单的完整结果」，不是「相对上一轮的增量」。
// 如果它比现有 extra6 还少，说明 curated 名单被误删过条目，必须拦下来而不是默默丢数据。
const curCards = (extra6.cards || []).length;
const curQuotes = (extra6.quotes || []).length;
if (newCards.length < curCards || newQuotes.length < curQuotes) {
  console.error(
    `\n拒绝写入：本次生成 词卡 ${newCards.length} / 名言 ${newQuotes.length}，` +
    `少于现有 lore-extra6 的 ${curCards} / ${curQuotes}。\n` +
    `curated-*.json 里可能少了条目，或其他内容源里出现了同名内容。请先查清再跑。`
  );
  process.exit(1);
}

if (!newCards.length && !newQuotes.length) {
  console.log('没有可入库的新条目');
  process.exit(0);
}

const js = (v) => JSON.stringify(v, null, 2).replace(/\n/g, '\n  ');
const out = `'use strict';

// 本轮（2026-10-11）新增条目。全部逐字取自 B 站淋语相关视频的标题/简介/评论，
// 出处见每条 source / src 字段；抓取清单见 evidence/manifest-*.json。
// 由 scripts/apply-curated.js 生成，请勿手工大改——要改就改 curated-*.json 后重新生成。
const cards = ${js(newCards)};

const quotes = ${js(newQuotes)};

const heroes = [];

module.exports = { cards, quotes, heroes };
`;

const target = path.join(ROOT, 'src', 'core', 'lore-extra6.js');
fs.writeFileSync(target, out, 'utf8');
console.log(`入库：词卡 ${newCards.length} | 名言 ${newQuotes.length} | 跳过 ${skipped}`);
console.log(`写入 ${path.relative(ROOT, target)}`);