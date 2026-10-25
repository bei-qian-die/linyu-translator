'use strict';
// 从新语料里挖「淋语特有构词」：自称式（我X / 本X）、句尾（惹/噜/靴靴）、叠词自称等。
// 只统计语料里逐字出现的写法，并与现有词库/词卡做去重，输出新候选供人工挑选。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
const lore = require(path.join(ROOT, 'src/core/lore.js'));

const known = new Set();
for (const w of seed.words) known.add(w.zh);
for (const c of lore.flashcards || []) known.add(c.term);
for (const h of lore.heroes || []) known.add(h.name);
for (const r of seed.rules) known.add(r.pattern);

const file = process.argv[2] || 'corpus/corpus-bili-20261024202023.txt';
const text = fs.readFileSync(path.join(ROOT, file), 'utf8');

// 只保留「【弹幕】/【评论】/【字幕】」这三类行（真实网友用语），丢掉 UP 简介与标题
const lines = text.split(/\r?\n/).filter((l) => /^【(弹幕|评论|字幕)】/.test(l));
console.log('语料行数(弹幕/评论/字幕):', lines.length);

const PATTERNS = [
  // 自称：可儿 / 仙女 / 祝妞 / 猪妞 / 洗脚丫鬟 …  前缀式
  { slot: '自称', re: /(?:本|我)([一-龥]{1,4})(?=[的啦噜惹素，,。！!？?、\s])/g },
  // 句尾语气
  { slot: '语气', re: /([一-龥]{1,4})(惹|噜|靴靴|鼠了|捏|嘞|呗)/g },
];

const freq = new Map();
for (const line of lines) {
  const body = line.replace(/^【[^】]*】/, '');
  for (const { slot, re } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(body))) {
      const tok = m[0];
      if (tok.length < 2) continue;
      const key = slot + '\t' + tok;
      freq.set(key, (freq.get(key) || 0) + 1);
    }
  }
}

const out = [];
for (const [key, n] of freq) {
  const [slot, tok] = key.split('\t');
  if (n < 2) continue;
  if (known.has(tok)) continue;
  // 排除明显是普通汉语词（不含淋语特征字）
  if (!/(惹|噜|靴|可|仙|妞|丫鬟|素|本|我|真|太|好|麻|鸡|批|鼠|美|nb|NB|典|孝|急|笑|哭|睡|想)/.test(tok)) continue;
  out.push({ slot, tok, n });
}
out.sort((a, b) => b.n - a.n);
fs.writeFileSync(
  path.join(ROOT, 'evidence', 'lingyu-freq11.json'),
  JSON.stringify({ file, lines: lines.length, items: out.slice(0, 400) }, null, 2),
  'utf8'
);
for (const it of out.slice(0, 120)) console.log(String(it.n).padStart(4), it.slot, it.tok);
console.log('\n共候选', out.length, '→ evidence/lingyu-freq11.json');
