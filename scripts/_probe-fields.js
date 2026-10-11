const fs = require('fs');
const seed = JSON.parse(fs.readFileSync('src/core/seed.json', 'utf8'));
const lore = require('../src/core/lore');

const hasVerify = (o) => !!(o && (o.verify || (o.src && /verify:/i.test(String(o.src))) || (o.source && /verify:/i.test(String(o.source)))));

console.log('=== seed.words ===', seed.words.length);
console.log('字段样本:', JSON.stringify(seed.words[0]));
const wKeys = new Set();
for (const w of seed.words) Object.keys(w).forEach((k) => wKeys.add(k));
console.log('全部字段:', [...wKeys].join(','));
console.log('带 verify 的:', seed.words.filter(hasVerify).length);
console.log('带 examples 的:', seed.words.filter((w) => Array.isArray(w.examples) && w.examples.length).length);
console.log('带 pinyin 的:', seed.words.filter((w) => w.pinyin).length);
console.log('带 sense 的:', seed.words.filter((w) => w.sense).length);
console.log('带 source 的:', seed.words.filter((w) => w.source).length);

console.log('\n=== seed.rules ===', seed.rules.length);
console.log('字段样本:', JSON.stringify(seed.rules[0]));
const rKeys = new Set();
for (const r of seed.rules) Object.keys(r).forEach((k) => rKeys.add(k));
console.log('全部字段:', [...rKeys].join(','));
console.log('带 examples 的:', seed.rules.filter((r) => Array.isArray(r.examples) && r.examples.length).length);
console.log('带 verify 的:', seed.rules.filter(hasVerify).length);

console.log('\n=== lore.flashcards ===', lore.flashcards.length);
console.log('字段样本:', JSON.stringify(lore.flashcards[0]));
const cKeys = new Set();
for (const c of lore.flashcards) Object.keys(c).forEach((k) => cKeys.add(k));
console.log('全部字段:', [...cKeys].join(','));
console.log('带 verify 的:', lore.flashcards.filter(hasVerify).length);
console.log('带 aliases 的:', lore.flashcards.filter((c) => Array.isArray(c.aliases) && c.aliases.length).length);
console.log('带 img 的:', lore.flashcards.filter((c) => c.img).length);

console.log('\n=== lore.quotes ===', lore.quotes.length);
console.log('字段样本:', JSON.stringify(lore.quotes[0]));
const qKeys = new Set();
for (const q of lore.quotes) Object.keys(q).forEach((k) => qKeys.add(k));
console.log('全部字段:', [...qKeys].join(','));
console.log('带 verify 的:', lore.quotes.filter(hasVerify).length);

console.log('\n=== lore.heroes ===', lore.heroes.length);
console.log('字段样本:', JSON.stringify(lore.heroes[0]));
const hKeys = new Set();
for (const h of lore.heroes) Object.keys(h).forEach((k) => hKeys.add(k));
console.log('全部字段:', [...hKeys].join(','));
console.log('带 verify 的:', lore.heroes.filter(hasVerify).length);
console.log('有 works 的:', lore.heroes.filter((h) => Array.isArray(h.works) && h.works.length).length);
console.log('有 intro 的:', lore.heroes.filter((h) => h.intro).length);
console.log('有 baike 的:', lore.heroes.filter((h) => h.baike).length);
console.log('有 img 的:', lore.heroes.filter((h) => h.img).length);
console.log('有 aliases 的:', lore.heroes.filter((h) => Array.isArray(h.aliases) && h.aliases.length).length);
console.log('zones:', (lore.zones || []).length, '| pruned:', Object.keys(lore.pruned || {}).map((k) => k + '=' + lore.pruned[k].length).join(' '));
