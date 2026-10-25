'use strict';
// 只读转储：把既有 seed / lore 的关键字段写成 UTF-8 文本，方便在 GBK 控制台下用 Read 工具查看。
// 输出 evidence/dump14-*.txt，不改动任何数据文件。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
const m = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/core/lore.js'), 'utf8'), {
  module: m,
  exports: m.exports,
  require: (p) => require(path.join(ROOT, 'src/core/' + String(p).replace(/^.*[\\/]/, ''))),
});
const lore = m.exports;

const out = [];
out.push('### heroes ' + lore.heroes.length);
lore.heroes.forEach((h) => out.push(`${h.name}\t|${h.group || ''}\t|${(h.alias || '').toString().slice(0, 60)}`));
fs.writeFileSync(path.join(ROOT, 'evidence/dump14-heroes.txt'), out.join('\n'), 'utf8');

const w = [];
w.push('### words ' + seed.words.length);
for (const x of seed.words) w.push(`${x.zh}\t${x.linyu}\t${x.alias || ''}\t${x.slot || ''}`);
fs.writeFileSync(path.join(ROOT, 'evidence/dump14-words.txt'), w.join('\n'), 'utf8');

const r = [];
r.push('### rules ' + seed.rules.length);
for (const x of seed.rules) r.push(`${x.pattern}\t${x.scene || ''}`);
fs.writeFileSync(path.join(ROOT, 'evidence/dump14-rules.txt'), r.join('\n'), 'utf8');

const c = [];
c.push('### cards ' + lore.flashcards.length);
for (const x of lore.flashcards) c.push(`${x.term}\t${x.type}\t${x.hero || ''}`);
fs.writeFileSync(path.join(ROOT, 'evidence/dump14-cards.txt'), c.join('\n'), 'utf8');

const q = [];
q.push('### quotes ' + lore.quotes.length);
for (const x of lore.quotes) q.push(`${x.hero || ''}\t${String(x.text || '').slice(0, 40)}`);
fs.writeFileSync(path.join(ROOT, 'evidence/dump14-quotes.txt'), q.join('\n'), 'utf8');

console.log('dumped heroes/words/rules/cards/quotes');
