'use strict';
// 一次性:给 curated-linyu14.js 里仍缺 HTTP 出处的词条反查 BV 并回填 source
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// title -> bvid
const BV = new Map();
for (const g of fs.readdirSync(path.join(ROOT, 'evidence'))) {
  if (!/^manifest-.*\.json$/.test(g)) continue;
  try {
    for (const v of JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', g), 'utf8'))) {
      if (v && v.title && v.bvid && !BV.has(v.title)) BV.set(v.title, v.bvid);
    }
  } catch {}
}

const d = require(path.join(ROOT, 'evidence/lexicon-cand14.json'));
const byCand = new Map(d.usable.map((u) => [u.cand, u]));

const { WORDS } = require(path.join(ROOT, 'scripts/curated-linyu14.js'));
const file = path.join(ROOT, 'scripts/curated-linyu14.js');
let src = fs.readFileSync(file, 'utf8');
let patched = 0;

for (const w of WORDS) {
  if (/https?:\/\//i.test(w.source || '')) continue;
  let bv = '';
  const u = byCand.get(w.linyu) || byCand.get(w.zh);
  if (u && u.titles && u.titles.length) {
    const label = u.titles[0].label || '';
    if (/^BV[0-9A-Za-z]+$/.test(label)) bv = label;
    else if (BV.has(label)) bv = BV.get(label);
    if (!bv && u.samples[0] && u.samples[0].bv) bv = u.samples[0].bv;
  }
  if (!bv) {
    console.log('NO-BV', w.zh, '->', w.linyu);
    continue;
  }
  const url = 'https://www.bilibili.com/video/' + bv;
  const needle = "source: '" + w.source + "'";
  if (!src.includes(needle)) {
    console.log('MISS', w.zh);
    continue;
  }
  src = src.split(needle).join("source: '" + w.source + ' ' + url + "'");
  patched++;
  console.log('OK', w.zh, '->', bv);
}
fs.writeFileSync(file, src);
console.log('patched', patched);
