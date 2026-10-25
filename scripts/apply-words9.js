'use strict';

// 把 scripts/curated-words9.js 写进 src/core/seed.json（幂等）。
// 变体条目继承基础词条的 slot / source / pop，只新增可独立检索的词条，不改动已有条目。

const fs = require('fs');
const path = require('path');
const { variants, words } = require('./curated-words9');

const seedPath = path.join(__dirname, '..', 'src', 'core', 'seed.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const byZh = new Map(seed.words.map((w) => [w.zh, w]));
const existing = new Set(byZh.keys());
const added = [];
const skipped = [];

function push(entry, reason) {
  if (!entry.zh || !entry.linyu) throw new Error('词条缺 zh/linyu: ' + JSON.stringify(entry));
  if (existing.has(entry.zh)) {
    skipped.push(entry.zh + (reason ? '（' + reason + '）' : ''));
    return;
  }
  if (!/^https?:\/\//i.test(String(entry.source || ''))) {
    throw new Error('词条缺可访问出处: ' + entry.zh + ' -> ' + entry.source);
  }
  existing.add(entry.zh);
  seed.words.push(entry);
  added.push(entry.zh);
}

for (const [zh, baseZh, sense] of variants) {
  const base = byZh.get(baseZh);
  if (!base) throw new Error('变体基础词条不存在: ' + baseZh + '（' + zh + '）');
  push(
    {
      zh,
      linyu: zh,
      alias: base.alias || '',
      slot: base.slot || '',
      sense,
      source: base.source,
      pop: base.pop || '中',
      rel: [base.zh, base.linyu],
    },
    '基础词条 ' + baseZh
  );
}

for (const [zh, linyu, alias, slot, sense, source, pop, rel] of words) {
  push({ zh, linyu, alias, slot, sense, source, pop, rel: rel || [] });
}

// 同一批里不能出现重复 zh
const seen = new Set();
for (const w of seed.words) {
  if (seen.has(w.zh)) throw new Error('seed 里出现重复 zh: ' + w.zh);
  seen.add(w.zh);
}

fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n', 'utf8');
console.log(`词库：${seed.words.length} 条（新增 ${added.length}，跳过重复 ${skipped.length}）`);
if (skipped.length) console.log('跳过：' + skipped.slice(0, 30).join('、') + (skipped.length > 30 ? ' …' : ''));
console.log('新增样例：' + added.slice(0, 12).join('、') + (added.length > 12 ? ' …' : ''));
