'use strict';
// 给 344 条 unattested 做结构化归因：它们到底是「差语料」还是「本身就不该按逐字命中判」。
const fs = require('fs');
const vm = require('vm');
const seed = JSON.parse(fs.readFileSync('src/core/seed.json', 'utf8'));
const m = { exports: {} };
vm.runInNewContext(fs.readFileSync('src/core/lore.js', 'utf8'), {
  module: m, exports: m.exports,
  require: (p) => require('../src/core/' + String(p).replace(/^.*[\\/]/, '')),
});
const lore = m.exports;

const files = fs.readdirSync('.').filter((f) => /^corpus.*\.txt$/.test(f)).sort();
let blob = '';
for (const f of files) blob += fs.readFileSync(f, 'utf8') + '\n';
const norm = (s) => String(s || '').replace(/\s+/g, '');
const BLOB = norm(blob).toLowerCase();
const hasUrl = (o) => !!(String(o.verify || '').trim() ||
  /https?:\/\//i.test(String(o.source || '')) || /https?:\/\//i.test(String(o.src || '')) ||
  (o.links || []).some((l) => /^https?:\/\//i.test(String((l && l.url) || ''))));

const byLen = (n) => (n <= 1 ? '1字' : n === 2 ? '2字' : n === 3 ? '3字' : '4字以上');
const tally = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('  ');

console.log('语料', files.length, '份，', (BLOB.length / 10000).toFixed(1), '万字符\n');

const badWords = seed.words.filter((w) => !hasUrl(w) && !BLOB.includes(norm(w.linyu).toLowerCase()));
console.log('=== words 未溯源', badWords.length, '===');
console.log('按淋语侧字数:', tally(badWords.reduce((a, w) => ((a[byLen(norm(w.linyu).length)] = (a[byLen(norm(w.linyu).length)] || 0) + 1), a), {})));
console.log('其中中文侧在语料里出现过的:', badWords.filter((w) => BLOB.includes(norm(w.zh).toLowerCase())).length, '（这些是「中文常见、淋语形态没出现」）');
console.log('中文侧也没出现的:', badWords.filter((w) => !BLOB.includes(norm(w.zh).toLowerCase())).length);
console.log('样本:', badWords.slice(0, 12).map((w) => `${w.zh}->${w.linyu}`).join('  '));

const strip = (s) => norm(s).replace(/[，。！？、；：""''‘“（）()…~—\-《》,.!?;:"'\[\]【】]/g, '').toLowerCase();
const SBLOB = strip(blob);
const GRAMS = new Set();
for (let i = 0; i + 10 <= SBLOB.length; i++) GRAMS.add(SBLOB.slice(i, i + 10));
const run10 = (t) => { const s = strip(t); for (let i = 0; i + 10 <= s.length; i++) if (GRAMS.has(s.slice(i, i + 10))) return true; return false; };

const badQuotes = lore.quotes.filter((q) => !hasUrl(q) && !run10(q.text));
console.log('\n=== quotes 未溯源', badQuotes.length, '===');
const srcKind = (s) => {
  s = String(s || '');
  if (/NGA/i.test(s)) return 'NGA';
  if (/贴吧/.test(s)) return '贴吧';
  if (/B ?站|bilibili/i.test(s)) return 'B站';
  if (/语料/.test(s)) return '本地语料';
  if (/合成|推断|拟写/.test(s)) return '标注为合成/推断';
  return s ? '其他' : '无来源';
};
console.log('按来源:', tally(badQuotes.reduce((a, q) => ((a[srcKind(q.src)] = (a[srcKind(q.src)] || 0) + 1), a), {})));
console.log('平均字数:', Math.round(badQuotes.reduce((s, q) => s + norm(q.text).length, 0) / badQuotes.length));
console.log('样本:', badQuotes.slice(0, 8).map((q) => `${q.hero || '?'}「${q.text.slice(0, 22)}」←${srcKind(q.src)}`).join('\n       '));

const badRules = seed.rules.filter((r) => {
  if (hasUrl(r)) return false;
  let re; try { re = new RegExp(r.pattern); } catch { return true; }
  return !blob.split(/\r?\n/).some((l) => l.length >= 2 && l.length <= 400 && re.test(l));
});
console.log('\n=== rules 未溯源', badRules.length, '===');
console.log('样例:', badRules.slice(0, 6).map((r) => r.pattern).join('\n       '));

const badCards = lore.flashcards.filter((c) => !hasUrl(c) && !BLOB.includes(norm(c.term).toLowerCase()) &&
  !(c.aliases || []).some((a) => BLOB.includes(norm(a).toLowerCase())) && !run10(c.example || ''));
console.log('\n=== cards 未溯源', badCards.length, '===');
console.log(badCards.map((c) => `${c.term}（${c.hero || c.type || ''}）←${srcKind(c.source)}`).join('  '));

const badHeroes = lore.heroes.filter((h) => !(Array.isArray(h.works) && h.works.length));
console.log('\n=== heroes 未溯源', badHeroes.length, '===');
console.log(badHeroes.map((h) => `${h.name}（${h.rank || ''}）works=${JSON.stringify(h.works)}`).join('  '));
console.log('\n合计', badWords.length + badQuotes.length + badRules.length + badCards.length + badHeroes.length);
