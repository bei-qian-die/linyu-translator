'use strict';

// 把 scripts/curated-rules9.js 插到 src/core/seed.json 的句式最前面（幂等）。
// 句式按数组顺序取第一个命中，新句式必须在前面；已在 seed 里的 pattern 不会重复插入。

const fs = require('fs');
const path = require('path');
const { rules } = require('./curated-rules9');

const seedPath = path.join(__dirname, '..', 'src', 'core', 'seed.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const existing = new Set(seed.rules.map((r) => r.pattern));
const batch = [];
const skipped = [];
let invalid = 0;

for (const [pattern, template, note, scene, examples, src] of rules) {
  if (!pattern || !template) throw new Error('句式缺 pattern/template: ' + JSON.stringify([pattern, template]));
  try {
    new RegExp(pattern);
  } catch (err) {
    invalid += 1;
    console.error('[invalid] ' + pattern + ' :: ' + err.message);
    continue;
  }
  if (existing.has(pattern)) {
    skipped.push(note || pattern);
    continue;
  }
  existing.add(pattern);
  batch.push({ pattern, template, note, scene, examples, src });
}
if (invalid) throw new Error('有 ' + invalid + ' 条正则编译失败，先修 scripts/curated-rules9.js');

seed.rules = batch.concat(seed.rules);
fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n', 'utf8');
console.log(`句式：${seed.rules.length} 条（新增 ${batch.length}，跳过重复 ${skipped.length}）`);
if (skipped.length) console.log('跳过：' + skipped.slice(0, 20).join('、') + (skipped.length > 20 ? ' …' : ''));
