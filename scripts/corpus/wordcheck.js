'use strict';
// 严校验词库：>=2 字的映射必须由语料或经典淋语词表佐证（单字谐音是淋语语音规则，不参与）
const fs = require('fs');
const seed = JSON.parse(fs.readFileSync('src/core/seed.json', 'utf8'));
const WEB = new Set(JSON.parse(fs.readFileSync('scripts/lexicon-web.json', 'utf8')));
const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
const strip = (s) => norm(s).replace(/[，。！？、；：""''‘“（）()…~—\-《》,.!?;:"'\[\]【】]/g, '');

let blob = '';
for (const f of ['corpus3.txt', 'corpus4.txt', 'corpus5.txt', 'corpus6.txt', 'corpus7.txt', 'corpus8.txt', 'corpus9.txt']) {
  if (fs.existsSync(f)) blob += fs.readFileSync(f, 'utf8') + '\n';
}
const BLOB = norm(blob);
const SBLOB = strip(blob);

const bad = [];
for (const w of seed.words) {
  if (w.zh.length < 2 || w.linyu.length < 2) continue;
  const key = norm(w.linyu);
  const sk = strip(w.linyu);
  const inCorpus = BLOB.includes(key) || (sk.length >= 2 && SBLOB.includes(sk));
  const inWeb = [...WEB].some((p) => p.split('->')[0].trim() === w.zh);
  if (!inCorpus && !inWeb) bad.push(w.zh + ' -> ' + w.linyu + ' [' + (sk.slice(0, 6)) + ']');
}
console.log('corpus chars', BLOB.length, '| words', seed.words.length, '| unverified linyu side', bad.length);
console.log(bad.join('\n'));
fs.writeFileSync('words-unverified.txt', bad.join('\n'), 'utf8');
