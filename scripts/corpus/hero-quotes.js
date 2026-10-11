'use strict';
const fs = require('fs');
const L = require('../../src/core/lore');
const FILES = ['corpus3.txt', 'corpus4.txt', 'corpus5.txt', 'corpus6.txt', 'corpus7.txt', 'corpus8f.txt'];

const ONLY = L.heroes.filter((h) => !L.quotes.some((q) => q.hero === h.name)).map((h) => h.name);
const zero = L.heroes.filter((h) => ONLY.includes(h.name) && !L.quotes.some((q) => q.hero === h.name)).map((h) => h.name);
const have = new Set(L.quotes.map((q) => q.text.replace(/\s/g, '')));

const LIN = /(靴|惹|噜|本可|淋|通讯录|地才|哥特心机|雌雄同体|吸吸|莲漆|晕|flop|阴|贵妇|姐圈|本仙|珍素|塔就素|厚礼蟹)/;

const blocks = [];
for (const f of FILES) {
  const txt = fs.readFileSync(f, 'utf8');
  for (const b of txt.split(/^==== /m).slice(1)) blocks.push({ f, b: '==== ' + b });
}

for (const name of zero) {
  const hits = [];
  for (const { f, b } of blocks) {
    const head = b.split('\n')[0];
    if (!head.includes(name)) continue;
    const lines = b.split('\n').slice(1);
    for (const l of lines) {
      const s = l.trim();
      if (s.length < 6 || s.length > 45) continue;
      if (!LIN.test(s)) continue;
      const bare = s.replace(/^\[(dm|cmt|sub|desc)\]\s*/, '').replace(/\s/g, '');
      if (have.has(bare)) continue;
      hits.push(head.slice(0, 78) + ' ||| ' + s);
    }
  }
  if (hits.length) {
    console.log('\n########## ' + name + ' (' + hits.length + ')');
    console.log(hits.slice(0, 14).join('\n'));
  } else {
    console.log('\n########## ' + name + ' (0)');
  }
}
