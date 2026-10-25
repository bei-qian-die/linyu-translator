'use strict';

// 语义位体系自检（只读，不改任何文件）：
//   1) seed.json 里已存在的每个 slot key 是否都在 taxonomy 里（不许出现野 key）
//   2) taxonomy 的每个 examples 是否真的逐字可查（seed 的 zh/linyu/alias，或 corpus 全文）
//   3) curated-slots13.js 的每条 slot 是否合法、是否覆盖全部缺 slot 的词
// 用法: node scripts/check-taxonomy13.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
const { TAXONOMY, KEYS, splitSlot, validateSlot } = require('./slot-taxonomy13.js');
const { SLOTS } = require('./curated-slots13.js');

const norm = (s) => String(s).replace(/\s+/g, '').toLowerCase();
const strip = (s) =>
  norm(s).replace(/[，。！？、；：""''‘“（）()…~—\-《》,.!?;:"'[\]【】「」『』·＠@#＊*＋+／/\\|_=^%&<>{}]/g, '');

let blob = '';
for (const f of fs.readdirSync(path.join(ROOT, 'corpus')).filter((x) => /^corpus.*\.txt$/.test(x))) {
  blob += strip(fs.readFileSync(path.join(ROOT, 'corpus', f), 'utf8'));
}
const inSeed = new Set();
for (const w of seed.words) {
  [w.zh, w.linyu].concat(String(w.alias || '').split(/[、,，]/)).forEach((v) => v && inSeed.add(strip(v)));
}
for (const r of seed.rules)
  [r.template, r.examples].forEach(
    (v) =>
      (v || '') &&
      String(v)
        .split(/[；;]/)
        .forEach((x) => inSeed.add(strip(x)))
  );

const exists = (v) => {
  const s = strip(v);
  return inSeed.has(s) || (s.length >= 2 && blob.includes(s));
};

let bad = 0;
// 1) 野 key
const used = new Set();
seed.words.forEach((w) => splitSlot(w.slot).forEach((k) => used.add(k)));
const wild = [...used].filter((k) => !KEYS.includes(k));
console.log(
  '[1] seed 里用到的 slot key',
  used.size,
  '| taxonomy 定义',
  KEYS.length,
  '| 野 key:',
  wild.length ? wild.join(',') : '无'
);
bad += wild.length;

// 2) examples 可查
const ghostEx = [];
for (const t of TAXONOMY) for (const e of t.examples) if (!exists(e)) ghostEx.push(t.key + ' :: ' + e);
console.log(
  '[2] examples 总数',
  TAXONOMY.reduce((n, t) => n + t.examples.length, 0),
  '| 查不到:',
  ghostEx.length ? ghostEx.join(' / ') : '无'
);
bad += ghostEx.length;

// 3) curated 覆盖与合法性：目标名单取 evidence/slot-freq13.json 里那 465 条（本轮的靶子），
//    而不是「现在还剩多少条没 slot」—— 因为 apply 跑完之后靶子就填满了，用后者会误报。
const FREQ = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', 'slot-freq13.json'), 'utf8'));
const TARGET = FREQ.entries.map((e) => e.zh);
const map = new Map(SLOTS.map((s) => [s.zh, s]));
const byZh = new Map(seed.words.map((w) => [w.zh, w]));
const missing = TARGET.filter((zh) => !map.has(zh));
const extra = SLOTS.filter((s) => !TARGET.includes(s.zh)).map((s) => s.zh);
const notApplied = TARGET.filter((zh) => {
  const w = byZh.get(zh);
  return !w || !w.slot;
});
const badSlot = [];
const badPop = [];
for (const s of SLOTS) {
  if (validateSlot(s.slot).length) badSlot.push(s.zh + '=' + s.slot);
  if (s.pop && !['高', '中', '低'].includes(s.pop)) badPop.push(s.zh + '=' + s.pop);
}
const CAN = new Set(['corpus', 'literal', 'weak+rule']);
const senseWithoutEvidence = SLOTS.filter((s) => s.sense && !CAN.has(s.popEvidence.tier)).map((s) => s.zh);
console.log(
  '[3] curated ' +
    SLOTS.length +
    ' 条 | 本轮靶子 ' +
    TARGET.length +
    ' 条 | 未覆盖:' +
    (missing.length ? missing.join(',') : '无') +
    ' | 多余:' +
    (extra.length ? extra.join(',') : '无') +
    ' | 已填进 seed 的:' +
    (TARGET.length - notApplied.length) +
    '，seed 里仍未填:' +
    (notApplied.length ? notApplied.join(',') : '无') +
    ' | 非法 slot:' +
    (badSlot.length ? badSlot.join(',') : '无') +
    ' | 非法 pop:' +
    (badPop.length ? badPop.join(',') : '无')
);
console.log(
  '[4] sense 已写 ' +
    SLOTS.filter((s) => s.sense).length +
    ' / 留空 ' +
    SLOTS.filter((s) => !s.sense).length +
    ' | 越权写 sense（tier 不允许）:' +
    (senseWithoutEvidence.length ? senseWithoutEvidence.join(',') : '无') +
    '（留空判据见 evidence/slot-freq13.json 的 evidenceTiers）'
);
bad += missing.length + extra.length + badSlot.length + badPop.length + senseWithoutEvidence.length + notApplied.length;

console.log(bad ? '== 有 ' + bad + ' 处问题 ==' : '== OK ==');
process.exitCode = bad ? 1 : 0;
