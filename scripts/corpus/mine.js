'use strict';
const fs = require('fs');
const seed = JSON.parse(fs.readFileSync('src/core/seed.json', 'utf8'));
let lore = { flashcards: [], quotes: [], heroes: [] };
try {
  const vm = require('vm');
  const m = { exports: {} };
  vm.runInNewContext(fs.readFileSync('src/core/lore.js', 'utf8'), {
    module: m,
    exports: m.exports,
    require: (p) => require('../../src/core/' + String(p).replace(/^.*[\\/]/, '')),
  });
  lore = m.exports;
} catch (e) {
  console.error('lore load fail', e.message);
}

const known = new Set();
for (const w of seed.words) {
  known.add(w.zh);
  known.add(w.linyu);
}
for (const c of lore.flashcards) known.add(c.term);
for (const q of lore.quotes) known.add(q.text);

const files = (process.argv[2] || 'corpus5.txt').split(',');
let text = '';
for (const f of files) if (fs.existsSync(f)) text += fs.readFileSync(f, 'utf8') + '\n';

const lines = text
  .split('\n')
  .map((l) => l.replace(/^\[(dm|cmt|sub|desc)\]\s*/, '').trim())
  .filter((l) => l && !l.startsWith('===='));

const MARK = /[惹噜厚靴熏翻淋汁吸银宫绝嗑姐解塑]/;

// 1) candidate n-grams with 淋 flavor
const cnt = new Map();
for (const l of lines) {
  const clean = l.replace(/[\s，。！？、；：,.!?;:"'“”‘’()（）【】\[\]~～^*#@$%&+=|\\/_-]+/g, '#');
  for (const seg of clean.split('#')) {
    if (seg.length < 2 || seg.length > 12) continue;
    for (let n = 2; n <= Math.min(6, seg.length); n++) {
      for (let i = 0; i + n <= seg.length; i++) {
        const g = seg.slice(i, i + n);
        if (!MARK.test(g)) continue;
        if (/^[惹噜厚靴]$/.test(g)) continue;
        cnt.set(g, (cnt.get(g) || 0) + 1);
      }
    }
  }
}

const cands = [...cnt.entries()]
  .filter(([g, c]) => c >= 2 && !known.has(g) && !known.has(g + '惹') && !known.has(g + '噜'))
  .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);

// drop substrings already represented by a higher-count longer gram
const kept = [];
for (const [g, c] of cands) {
  const covered = kept.some(
    ([k, kc]) => k.includes(g) && kc >= c && !cnt.get(k) === false
  );
  if (!covered || c >= 5) kept.push([g, c]);
}

const out = [];
out.push('## TOP n-gram candidates (count>=2, not in seed/lore) total=' + kept.length);
kept.slice(0, 400).forEach(([g, c]) => out.push(c + '\t' + g));

// 2) full lines carrying strong 淋 markers, deduped
const strong = /^.{0,25}(惹$|噜$|厚$|靴靴|素.{1,8}(惹|噜|厚)$)/;
const seenLine = new Set();
const sLines = [];
for (const l of lines) {
  if (l.length > 30) continue;
  if (!strong.test(l)) continue;
  const k = l.slice(0, 20);
  if (seenLine.has(k)) continue;
  seenLine.add(k);
  sLines.push(l);
}
out.push('\n## STRONG 淋-style short lines (' + sLines.length + ')');
sLines.slice(0, 250).forEach((l) => out.push(l));

// 3) lines mentioning hero names, for 名言 mining
const names = lore.heroes.map((h) => h.name).concat(
  lore.heroes.filter((h) => h.alias).flatMap((h) => (Array.isArray(h.alias) ? h.alias : [h.alias]))
);
out.push('\n## Hero-name lines');
const hn = new Set();
for (const l of lines) {
  for (const nm of names) {
    if (nm && l.includes(nm) && l.length <= 60) {
      const k = nm + '|' + l.slice(0, 18);
      if (!hn.has(k)) {
        hn.add(k);
        out.push(nm + ' :: ' + l);
      }
      break;
    }
  }
}

fs.writeFileSync('mined.txt', out.join('\n'), 'utf8');
console.log('cands', kept.length, 'strong', sLines.length, 'lines', lines.length);
