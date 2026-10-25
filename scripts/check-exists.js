'use strict';
// 检查候选词是否已在库里，避免重复条目。
const seed = require('../src/core/seed.json');
const lore = require('../src/core/lore');

const zhSet = new Set(seed.words.map((w) => w.zh));
const cardSet = new Set(lore.flashcards.map((c) => c.term));
const heroSet = new Set(lore.heroes.map((h) => h.name));
const quoteSet = new Set(lore.quotes.map((q) => q.text));

const cands = (process.argv[2] || '').split(',').map((s) => s.trim()).filter(Boolean);
for (const c of cands) {
  const marks = [];
  if (zhSet.has(c)) marks.push('词库已有');
  if (cardSet.has(c)) marks.push('词卡已有');
  if (heroSet.has(c)) marks.push('人物已有');
  if (quoteSet.has(c)) marks.push('名言已有');
  console.log(`${c}\t${marks.length ? marks.join('/') : 'NEW'}`);
}
