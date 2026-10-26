'use strict';

// 第十九轮验真：核对 curated-linyu19.js / curated-lore19.js 里的每一条文本
// 是否真能在 corpus/*.txt 里逐字命中（忽略空白、标点、大小写），口径同 scripts/attest.js。
//
// 与 18 号的区别：按优化提示词第 2 节第 4 条，命中源允许是「corpus 或既有 seed/lore」——
// 有些旧词条（我🦋 / 🐔婆）是本轮之前就验真过的，新抓的语料里未必再出现，
// 所以多一层 fallback：语料查不到时，去既有 seed.json + lore.js 的 alias/term 里找。
//
// 用法:
//   node scripts/verify-qc19.js            # 只报告
//   node scripts/verify-qc19.js --strict   # 有未命中即 exit 1
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STRICT = process.argv.includes('--strict');

const norm = (s) => String(s || '').replace(/[\s，。、！？；：""''（）()【】[\]…~～·—\-_/\\|,.:;!?"']/g, '').toLowerCase();

let blob = '';
for (const f of fs.readdirSync(path.join(ROOT, 'corpus')).filter((x) => x.endsWith('.txt')).sort()) {
  blob += fs.readFileSync(path.join(ROOT, 'corpus', f), 'utf8') + '\n';
}
const NB = norm(blob);

// 既有数据里已经验真过的文本，作为第二命中源
let KNOWN = '';
try {
  const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
  const L = require(path.join(ROOT, 'src/core/lore.js'));
  const parts = [];
  for (const w of seed.words || []) parts.push(w.zh, w.linyu, w.alias);
  for (const c of L.flashcards || []) parts.push(c.term, c.example, (c.aliases || []).join(''));
  for (const h of L.heroes || []) parts.push(h.name, h.alias, h.intro);
  for (const q of L.quotes || []) parts.push(q.text);
  KNOWN = norm(parts.filter(Boolean).join('\n'));
} catch (e) {
  console.warn('[verify19] 既有数据读取失败（只用语料判定）：' + e.message);
}

const countIn = (hay, s) => {
  const n = norm(s);
  if (!n) return 0;
  let c = 0;
  let i = hay.indexOf(n);
  while (i !== -1) {
    c++;
    i = hay.indexOf(n, i + n.length);
  }
  return c;
};

/** 语料优先；语料没有再看既有数据 */
const count = (s) => countIn(NB, s) || countIn(KNOWN, s);
const fromCorpus = (s) => countIn(NB, s) > 0;

const splitAl = (s) =>
  String(s || '')
    .split(/[、,，/|]/)
    .map((x) => x.trim())
    .filter(Boolean);

const report = { words: { total: 0, linyuMiss: [], aliasMiss: [], onlyKnown: [] }, rules: { total: 0, exMiss: [] } };

try {
  const { WORDS, RULES } = require(path.join(ROOT, 'scripts/curated-linyu19.js'));
  report.words.total = WORDS.length;
  for (const w of WORDS) {
    if (!count(w.linyu)) report.words.linyuMiss.push(`${w.zh} → ${w.linyu}`);
    else if (!fromCorpus(w.linyu)) report.words.onlyKnown.push(`${w.zh} → ${w.linyu}`);
    for (const a of splitAl(w.alias)) {
      if (!count(a)) report.words.aliasMiss.push(`${w.zh} : ${a}`);
    }
  }
  report.rules.total = RULES.length;
  for (const r of RULES) {
    for (const ex of String(r.examples || '').split(/[；;]/).map((x) => x.trim()).filter(Boolean)) {
      if (!count(ex)) report.rules.exMiss.push(`${r.template} :: ${ex}`);
    }
  }
} catch (e) {
  console.error('[verify19] 读取 curated-linyu19.js 失败：' + e.message);
  process.exit(1);
}

try {
  const { CARDS, HEROES, QUOTES } = require(path.join(ROOT, 'scripts/curated-lore19.js'));
  report.cards = { total: CARDS.length, exMiss: [], termMiss: [] };
  report.quotes = { total: QUOTES.length, miss: [] };
  report.heroes = { total: HEROES.length, miss: [] };
  for (const c of CARDS) {
    if (c.example && !count(c.example)) report.cards.exMiss.push(`${c.term} :: ${c.example}`);
    if (c.term && !count(c.term)) report.cards.termMiss.push(c.term);
  }
  for (const q of QUOTES) {
    if (!count(q.text)) report.quotes.miss.push(q.text.slice(0, 40));
  }
  for (const h of HEROES) {
    if (!count(h.name)) report.heroes.miss.push(h.name);
  }
} catch (e) {
  report.lore = '未就绪或读取失败：' + e.message;
}

const p = (label, arr) => {
  if (!arr.length) return;
  console.log(`\n== ${label}（${arr.length}）`);
  for (const x of arr) console.log('   ✗ ' + x);
};

console.log(`[verify19] 语料 ${(blob.length / 10000).toFixed(1)} 万字｜既有数据命中源 ${(KNOWN.length / 10000).toFixed(1)} 万字`);
console.log(`[verify19] 词库 ${report.words.total} 条：linyu 未命中 ${report.words.linyuMiss.length}，alias 未命中 ${report.words.aliasMiss.length}`);
console.log(`[verify19] 句式 ${report.rules.total} 条：examples 未命中 ${report.rules.exMiss.length}`);
if (report.cards) console.log(`[verify19] 词卡 ${report.cards.total} 条：example 未命中 ${report.cards.exMiss.length}`);
if (report.quotes) console.log(`[verify19] 名言 ${report.quotes.total} 条：未命中 ${report.quotes.miss.length}`);
if (report.heroes) console.log(`[verify19] 人物 ${report.heroes.total} 位：名字未命中 ${report.heroes.miss.length}`);

p('linyu 未命中', report.words.linyuMiss);
p('alias 未命中', report.words.aliasMiss);
p('句式 examples 未命中', report.rules.exMiss);
if (report.cards) {
  p('词卡 example 未命中', report.cards.exMiss);
  p('词卡 term 未命中', report.cards.termMiss);
}
if (report.quotes) p('名言未命中', report.quotes.miss);
if (report.heroes) p('人物名未命中', report.heroes.miss);

const bad =
  report.words.linyuMiss.length +
  report.words.aliasMiss.length +
  report.rules.exMiss.length +
  (report.cards ? report.cards.exMiss.length : 0) +
  (report.quotes ? report.quotes.miss.length : 0);

if (STRICT && bad > 0) {
  console.error(`\n[verify19] --strict：共 ${bad} 处未命中，不允许落库`);
  process.exit(1);
}
console.log(`\n[verify19] 合计未命中 ${bad} 处${STRICT ? '' : '（非 strict，仅报告）'}`);
