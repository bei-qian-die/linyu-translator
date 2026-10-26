'use strict';

// 第十九轮 alias 清理：把 curated-linyu19.js 里每条 alias 逐个拿语料核一遍，
// 未命中的变体直接从源文件剔除，保证「落库的每个 alias 都能回源」。
//
// 为什么改源文件而不是在 apply 时过滤：源文件是本轮策展意图的唯一载体，
// 留一堆查不到的变体会让下一轮的人以为它们是既有资产。清理后落 evidence 留档。
//
// 用法：
//   node scripts/prune-alias19.js            # 只报告
//   node scripts/prune-alias19.js --write    # 实际改写源文件
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'scripts/curated-linyu19.js');
const WRITE = process.argv.includes('--write');

const norm = (s) => String(s || '').replace(/[\s，。、！？；：""''（）()【】[\]…~～·—\-_/\\|,.:;!?"']/g, '').toLowerCase();

let blob = '';
for (const f of fs.readdirSync(path.join(ROOT, 'corpus')).filter((x) => x.endsWith('.txt')).sort()) {
  blob += fs.readFileSync(path.join(ROOT, 'corpus', f), 'utf8') + '\n';
}
const NB = norm(blob);

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
} catch {
  /* 既有数据读不到就只用语料判定 */
}

const hit = (s) => {
  const n = norm(s);
  if (!n) return false;
  return NB.includes(n) || (KNOWN && KNOWN.includes(n));
};

let src = fs.readFileSync(FILE, 'utf8');
const dropped = [];
let touched = 0;

// 逐块处理：以 "zh: '...'," 为块起点，块内第一条 alias 行即该词条的别名
src = src.replace(/(\{\s*\n\s*zh:\s*'([^']*)',[\s\S]*?alias:\s*')([^']*)(')/g, (m, pre, zh, alias, post) => {
  const items = alias
    .split('、')
    .map((x) => x.trim())
    .filter(Boolean);
  const keep = items.filter((a) => hit(a));
  const gone = items.filter((a) => !hit(a));
  if (!gone.length) return m;
  touched += 1;
  for (const g of gone) dropped.push(`${zh} : ${g}`);
  return pre + keep.join('、') + post;
});

console.log(`[prune-alias19] 处理词条 ${touched} 条，剔除 alias ${dropped.length} 项`);
for (const d of dropped) console.log('   - ' + d);

fs.writeFileSync(
  path.join(ROOT, 'evidence/qc19-alias-dropped.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), why: 'alias 未能在语料或既有数据中逐字命中，按优化提示词第 2 节第 4 条剔除', items: dropped }, null, 2)
);

if (WRITE) {
  fs.writeFileSync(FILE, src);
  console.log('[prune-alias19] 已写回源文件');
} else {
  console.log('[prune-alias19] 未加 --write，未写盘');
}
