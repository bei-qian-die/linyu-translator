'use strict';

// apply-words-rules.js
// 把 curated-words.json + curated-rules.json 追加到 src/core/seed.json 末尾
// 跟既有 484 words / 123 rules 去重；幂等（重复跑结果不变）

const fs = require('fs');
const path = require('path');

const SEED = 'src/core/seed.json';
const WORDS = 'scripts/curated-words.json';
const RULES = 'scripts/curated-rules.json';

const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
const newWords = JSON.parse(fs.readFileSync(WORDS, 'utf8'));
const newRules = JSON.parse(fs.readFileSync(RULES, 'utf8'));

const haveW = new Set(seed.words.map((w) => w.zh));
const haveR = new Set((seed.rules || []).map((r) => r.pattern));

const addW = newWords.filter((w) => !haveW.has(w.zh));
const addR = newRules.filter((r) => !haveR.has(r.pattern));

console.log('seed before:', seed.words.length, 'words /', (seed.rules || []).length, 'rules');
console.log('curated:', newWords.length, 'words /', newRules.length, 'rules');
console.log('will add:', addW.length, 'words /', addR.length, 'rules');

// 拒绝写入：比预期少
if (addW.length < newWords.length || addR.length < newRules.length) {
  console.error('REFUSED: 去重后少于 curated，可能 seed.json 已经包含部分条目，请人工核对');
  process.exit(1);
}

// 拒绝写入：seed 已经包含全部 curated（幂等性保护）
if (addW.length === 0 && addR.length === 0) {
  console.log('NOOP: seed.json 已经包含全部 curated，无须改动');
  process.exit(0);
}

seed.words = seed.words.concat(addW);
seed.rules = (seed.rules || []).concat(addR);

console.log('seed after:', seed.words.length, 'words /', seed.rules.length, 'rules');
fs.writeFileSync(SEED, JSON.stringify(seed, null, 2) + '\n', 'utf8');
console.log('wrote', SEED);
