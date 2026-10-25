'use strict';

// 第十轮前置校验：curated-lore13 的每一条 QUOTES.text / CARDS.term / example 都要能在
// corpus 语料里按「忽略空白、标点、大小写」逐字命中；hero 必须是 lore.heroes 里的真名。
// 只读校验，不写任何文件。用法: node scripts/check-curated13.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { CARDS, QUOTES, HEROES_MERGE } = require(path.join(ROOT, 'scripts/curated-lore13.js'));
const lore = require(path.join(ROOT, 'src/core/lore'));

const strip = (s) =>
  String(s || '').replace(/\s+/g, '').replace(/[，。！？、；：""''‘“（）()…~—\-《》,.!?;:"'[\]【】「」〈〉]/g, '').toLowerCase();

let blob = '';
for (const f of fs.readdirSync(path.join(ROOT, 'corpus'))) {
  if (/^corpus.*\.txt$/.test(f)) blob += fs.readFileSync(path.join(ROOT, 'corpus', f), 'utf8') + '\n';
}
const SBLOB = strip(blob);
const heroNames = new Set(lore.heroes.map((h) => h.name));

let bad = 0;
const check = (kind, name, text, min) => {
  const n = strip(text);
  if (n.length < min) { console.log(`SHORT ${kind} ${name} (${n.length}<${min}) ${text}`); bad++; return; }
  if (!SBLOB.includes(n)) { console.log(`MISSING ${kind} ${name} :: ${text}`); bad++; }
};

for (const q of QUOTES) {
  check('quote', q.hero, q.text, 10);
  if (!heroNames.has(q.hero)) { console.log('BADHERO quote ' + q.hero); bad++; }
}
for (const c of CARDS) {
  check('card.term', c.term, c.term, 2);
  if (c.example) check('card.example', c.term, c.example, 4);
  if (!heroNames.has(c.hero)) { console.log('BADHERO card ' + c.hero); bad++; }
}
for (const h of HEROES_MERGE) {
  if (!heroNames.has(h.name)) { console.log('BADHERO merge ' + h.name); bad++; }
  for (const w of h.works || []) if (!SBLOB.includes(strip(w))) console.log('WARN work-not-verbatim ' + h.name + ' :: ' + w);
}
console.log(`cards ${CARDS.length} quotes ${QUOTES.length} merge ${HEROES_MERGE.length} -> ${bad ? bad + ' PROBLEMS' : 'ALL VERBATIM OK'}`);
process.exitCode = bad ? 1 : 0;
