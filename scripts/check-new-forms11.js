'use strict';
// 1) 检查候选新词是否已在词库/词卡里；2) 用 manifest 把【视频】标题映射到 BV 号。
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

// 别名也算已知
const aliasHit = [];
for (const w of seed.words) for (const a of w.alias || []) aliasHit.push(a);
for (const c of lore.flashcards || []) for (const a of c.aliases || []) aliasHit.push(a);
const aliasSet = new Set(aliasHit);

const CANDIDATES = [
  '淋明杀鸡', '引茎据典', '素这样惹', '珍素努力', '本可岁月静好', '赛淋', '淋味',
  '柱厚', '狗表柱厚', '猪头凤', '小阴', '凤凤', '厚', '解解', '杯糕', '杯糕姐',
  '阴厚', '洗脚婢', '大制作', '素', '惹', '噜', '你币有了', '潮起潮落', '真素',
];

console.log('=== 查重 ===');
for (const t of CANDIDATES) {
  const s = known.has(t) ? '已存在' : aliasSet.has(t) ? '已存在(别名)' : '★ 新';
  console.log(s.padEnd(16), t);
}

// 标题 → BV 映射
const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'evidence', 'manifest-20261024202023.json'), 'utf8')
);
const items = Array.isArray(manifest) ? manifest : manifest.items || manifest.videos || [];
console.log('\nmanifest 条目', items.length, 'keys=', Object.keys(items[0] || {}).join(','));

const title2bv = new Map();
for (const it of items) {
  const t = String(it.title || it.name || '').replace(/<[^>]+>/g, '');
  if (t) title2bv.set(t, it.bvid || it.bvid || it.id);
}

const corpus = fs.readFileSync(path.join(ROOT, 'corpus/corpus-bili-20261024202023.txt'), 'utf8').split(/\r?\n/);
const want = process.argv.slice(2);
const seen = new Set();
for (const line of corpus) {
  const m = /^(【视频】|【弹幕】|【评论】|【字幕】)/.exec(line);
  if (!m) continue;
  const kind = m[1];
  const body = line.slice(kind.length).trim();
  if (kind === '【视频】') continue;
  for (const t of want) {
    if (!body.includes(t)) continue;
    const key = t + '|' + body;
    if (seen.has(key)) continue;
    seen.add(key);
    // 往上找最近的【视频】标题
    const idx = corpus.indexOf(line);
    let title = '';
    for (let i = idx; i >= 0 && i > idx - 60; i--) {
      if (corpus[i].startsWith('【视频】')) { title = corpus[i].slice(4).trim(); break; }
    }
    console.log('\n【' + t + '】' + kind.replace(/【|】/g, '') + '：' + body.slice(0, 120));
    console.log('   标题: ' + title.slice(0, 80));
    console.log('   BV: ' + (title2bv.get(title) || '(未匹配)'));
  }
}
