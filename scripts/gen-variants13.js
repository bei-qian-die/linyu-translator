'use strict';

// 第十三轮「同一语义位、多种译法」批量补变体。
//
// 做法（全程只做语料验真，不造词）：
//   1) 替换对来源两处：
//      a. evidence/lexicon-cand13.json 的 subTable —— 形如「神×5(为什么→为神马)」，括号里是整词对；
//      b. seed.json 里已有词条本身（zh 与 linyu 一一对齐的单字/整词差）。
//   2) 把 a 的整词对套到 1144 个中文词头上，生成「这个词按淋语规律本该长这样」的候选；
//   3) 候选必须在 corpus/*.txt 里逐字出现过（忽略空白），否则丢弃；
//   4) 已有 linyu / alias 覆盖到的不再重复；
//   5) 中文词头本身没进词库、且整词对在语料里出现的 → 作为新行（slot=基础谐音替换）。
//
// 用法: node scripts/gen-variants13.js [--min=1] [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const MIN = (() => {
  const m = argv.find((a) => a.startsWith('--min='));
  return m ? Number(m.split('=')[1]) : 1;
})();

const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
const cand = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/lexicon-cand13.json'), 'utf8'));

// ---- 语料：去掉空白后建一个可查串，另存每行原文供出处展示 ----
const corpusDir = path.join(ROOT, 'corpus');
const corpusLines = [];
let blob = '';
for (const f of fs.readdirSync(corpusDir).sort()) {
  if (!/^corpus.*\.txt$/.test(f)) continue;
  const t = fs.readFileSync(path.join(corpusDir, f), 'utf8');
  blob += t.replace(/\s+/g, '') + '\n';
  for (const line of t.split(/\r?\n/)) {
    const s = line.trim();
    if (s.length > 1 && s.length < 120) corpusLines.push({ s: s.replace(/\s+/g, ''), file: f });
  }
}
const has = (w) => w.length > 0 && blob.includes(w);
const countOf = (w) => {
  let n = 0;
  for (const l of corpusLines) if (l.s.includes(w)) n++;
  return n;
};
const firstHit = (w) => corpusLines.find((l) => l.s.includes(w)) || null;

// ---- 整词替换对 ----
const PAIR_RE = /[（(]([^\s()（）]{1,8})→([^\s()（）]{1,8})[)）]/;
const pairs = new Map(); // zh -> Map(linyu -> count from subTable text)
const addPair = (zh, linyu, n) => {
  if (!zh || !linyu || zh === linyu) return;
  if (!/^[\u4e00-\u9fa5A-Za-z0-9]+$/.test(zh) || !/^[\u4e00-\u9fa5A-Za-z0-9]+$/.test(linyu)) return;
  if (!pairs.has(zh)) pairs.set(zh, new Map());
  const m = pairs.get(zh);
  m.set(linyu, (m.get(linyu) || 0) + n);
};

for (const row of cand.subTable || []) {
  for (const item of row.to || []) {
    const mm = String(item).match(PAIR_RE);
    if (!mm) continue;
    const n = Number((String(item).match(/×(\d+)/) || [])[1] || 1);
    addPair(mm[1], mm[2], n);
  }
}
// seed 自身也是替换表：zh 与 linyu 等长时按位置对齐取单字对
const noLinyu = [];
for (const w of seed.words) {
  if (!w.linyu) {
    noLinyu.push(w.zh);
    continue;
  }
  addPair(w.zh, w.linyu, 3);
  if (w.zh.length === w.linyu.length && w.zh.length >= 2) {
    for (let i = 0; i < w.zh.length; i++) addPair(w.zh[i], w.linyu[i], 1);
  }
}

// ---- 现有词库的「已收录写法」集合，避免重复 ----
const split = (s) => String(s || '').split(/[、,，]/).map((x) => x.trim()).filter(Boolean);
const knownByZh = new Map();
for (const w of seed.words) knownByZh.set(w.zh, new Set([w.linyu].concat(split(w.alias))));
const allKnown = new Set();
for (const w of seed.words) {
  allKnown.add(w.linyu);
  split(w.alias).forEach((a) => allKnown.add(a));
}

const variantRows = [];
let variantCount = 0;
for (const w of seed.words) {
  const have = knownByZh.get(w.zh);
  const add = [];
  // 对词头做一次「整词替换」：把词头里出现的每个已知中文单字/词换成其淋语写法
  const forms = new Set();
  for (const [zhUnit, m] of pairs) {
    // 只做整词级替换（zhUnit 至少 2 字）：单字对齐会把「加班→家班」这种
    // 嵌在别的词里的巧合当成变体，语料 substring 命中并不可靠。
    if (!zhUnit || zhUnit.length < 2 || !w.zh.includes(zhUnit)) continue;
    for (const [form] of m) {
      if (!form || form === zhUnit) continue;
      const out = w.zh.split(zhUnit).join(form);
      if (out !== w.zh) forms.add(out);
    }
  }
  for (const f of forms) {
    if (have.has(f) || allKnown.has(f)) continue;
    if (f.length < 2 || f.length > 12) continue;
    if (!has(f)) continue;
    const n = countOf(f);
    if (n < MIN) continue;
    add.push({ form: f, count: n, sample: (firstHit(f) || {}).s.slice(0, 60), file: (firstHit(f) || {}).file });
  }
  if (add.length) {
    add.sort((a, b) => b.count - a.count);
    variantRows.push({ zh: w.zh, linyu: w.linyu, add: add.slice(0, 6) });
    variantCount += Math.min(add.length, 6);
  }
}

// ---- 新行：中文词头没进过词库，但整词对是语料里真实成对出现的 ----
const newRows = [];
for (const [zh, m] of pairs) {
  if (zh.length < 2 || zh.length > 8) continue;
  if (knownByZh.has(zh)) continue;
  let best = null;
  for (const [form, w] of m) {
    if (form === zh || !has(form)) continue;
    const n = countOf(form);
    if (!best || n > best.count) best = { form, count: n, sample: (firstHit(form) || {}).s.slice(0, 60) };
  }
  if (!best || best.count < MIN) continue;
  newRows.push({ zh, linyu: best.form, count: best.count, sample: best.sample });
}
newRows.sort((a, b) => b.count - a.count);

console.log(`替换对 ${pairs.size} 个词头 · 可补变体 ${variantRows.length} 条词（共 ${variantCount} 个写法） · 可新增词行 ${newRows.length} 条`);
if (noLinyu.length) console.log('x 词库里有 ' + noLinyu.length + ' 条缺 linyu：' + noLinyu.slice(0, 10).join(' '));
console.log('变体样例：', JSON.stringify(variantRows.slice(0, 3), null, 0).slice(0, 400));
console.log('新行样例：', JSON.stringify(newRows.slice(0, 5), null, 0));

const out =
  "// @ts-check\n'use strict';\n" +
  '// 第十三轮「多种译法」批量变体，由 scripts/gen-variants13.js 生成（语料逐字验真，min=' + MIN + '）。\n' +
  '// VARIANTS：给既有词条补 alias 写法；NEW_WORDS：中文词头未收录、淋语写法在语料里逐字出现过。\n' +
  '// 每条都带 count（语料命中行数）与 sample（原文），出处见 evidence/variants13.json。\n\n' +
  'const VARIANTS = ' + JSON.stringify(variantRows, null, 1) + ';\n\n' +
  'const NEW_WORDS = ' + JSON.stringify(newRows, null, 1) + ';\n\n' +
  'module.exports = { VARIANTS, NEW_WORDS };\n';

if (!DRY) {
  fs.writeFileSync(path.join(ROOT, 'scripts/curated-variants13.js'), out, 'utf8');
  fs.writeFileSync(path.join(ROOT, 'evidence/variants13.json'), JSON.stringify({ generatedAt: new Date().toISOString(), min: MIN, pairsHead: pairs.size, variants: variantRows, newWords: newRows }, null, 1), 'utf8');
  console.log('已写 scripts/curated-variants13.js + evidence/variants13.json');
}
