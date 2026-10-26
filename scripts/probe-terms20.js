'use strict';

// 第二十轮策展辅助：给定候选词，统计它在「淋威争锋语境行」里的出现次数与样例，
// 供 scripts/curated-linyu20.js 挑词。只读脚本，不改数据。
//
// 用法: node scripts/probe-terms20.js "词1,词2,词3" [--all]
//   --all 表示在整个语料里计数（默认只在淋威语境行里数）
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { load } = require('./_mrctx20.js');

const terms = (process.argv[2] || '').split(',').map((s) => s.trim()).filter(Boolean);
const useAll = process.argv.includes('--all');

const { lines: mrLines, all } = load();
const lines = useAll ? all : mrLines;
const BLOB = lines.join('\n');
console.error(`[语境] ${useAll ? '全语料' : '淋威争锋语境'} 行 ${lines.length}`);

const rows = terms.map((t) => {
  let c = 0;
  let i = BLOB.indexOf(t);
  let sample = '';
  while (i !== -1) {
    if (!sample) {
      const s = Math.max(0, i - 14);
      sample = BLOB.slice(s, i + t.length + 16).replace(/\n/g, ' ');
    }
    c++;
    i = BLOB.indexOf(t, i + t.length);
  }
  return { t, c, sample };
});
rows.sort((a, b) => b.c - a.c);
for (const r of rows) console.log(`${r.c}\t${r.t}\t${r.sample}`);
