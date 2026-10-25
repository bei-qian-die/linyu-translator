'use strict';

// 写入 scripts/curated-words9b.js：新增角色词条 + 给已有词条补别名/出处（不覆盖已有释义）。
const fs = require('fs');
const path = require('path');
const { words, patches } = require('./curated-words9b');

const seedPath = path.join(__dirname, '..', 'src', 'core', 'seed.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const byZh = new Map(seed.words.map((w) => [w.zh, w]));
let added = 0;
let patched = 0;

for (const [zh, linyu, alias, slot, sense, source, pop, rel] of words) {
  if (byZh.has(zh)) continue;
  if (!/^https?:\/\//i.test(String(source || ''))) throw new Error('新词缺出处: ' + zh);
  const w = { zh, linyu, alias, slot, sense, source, pop, rel: rel || [] };
  seed.words.push(w);
  byZh.set(zh, w);
  added += 1;
}

const splitAlias = (s) =>
  String(s || '')
    .split(/[、,，/]/)
    .map((x) => x.trim())
    .filter(Boolean);

for (const [zh, patch] of Object.entries(patches)) {
  const w = byZh.get(zh);
  if (!w) {
    console.warn('[skip] 词条不存在，无法补字段: ' + zh);
    continue;
  }
  let changed = false;
  if (patch.alias) {
    const merged = [...new Set(splitAlias(w.alias).concat(splitAlias(patch.alias)))];
    const next = merged.join('、');
    if (next !== (w.alias || '')) {
      w.alias = next;
      changed = true;
    }
  }
  for (const key of ['sense', 'source', 'pop']) {
    if (patch[key] && !String(w[key] || '').trim()) {
      w[key] = patch[key];
      changed = true;
    }
  }
  if (changed) patched += 1;
}

fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n', 'utf8');
console.log(`词库：${seed.words.length} 条（新增 ${added}，补字段 ${patched}）`);
