'use strict';
// 从第十一轮语料里挑出「真正新的淋语写法」，并定位到具体 BV 号，供人工确认后入库。
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const CORPUS = process.argv[2] || 'corpus/corpus-bili-20261024202023.txt';
const lines = fs.readFileSync(path.join(ROOT, CORPUS), 'utf8').split(/\r?\n/);

// 语料是按视频分组的：先看一条视频的标题行，再往下取弹幕/评论
let cur = null;
const hits = [];
const TERMS = [
  '引茎据典', '赛淋', '柱厚', '狗表柱厚', '猪头凤', '小阴', '凤凤', '素这样惹',
  '淋明杀鸡', '珍素努力', '本可岁月静好', '厚', '你币有了', '素本可', '本可儿',
  '解解', '大制作', '阴厚', '淋味', '淋神', '本姐', '本鱼', '本喵', '本狗', '本宝',
  '洗脚婢', '洗脚丫鬟', '阴凤', '凤阴', '销冠', '典', '孝', '鸡脚', '蚌埠住了',
];

for (const line of lines) {
  const m = /^(【视频】|【弹幕】|【评论】|【字幕】)/.exec(line);
  if (!m) continue;
  const kind = m[1];
  const body = line.slice(kind.length).trim();
  if (kind === '【视频】') {
    cur = body;
    continue;
  }
  for (const t of TERMS) {
    if (body.includes(t)) hits.push({ term: t, kind, body, video: cur });
  }
}

const seen = new Set();
const out = [];
for (const h of hits) {
  const k = h.term + '\t' + h.body;
  if (seen.has(k)) continue;
  seen.add(k);
  out.push(h);
}
console.log('命中', out.length, '条\n');
for (const h of out) {
  console.log('【' + h.term + '】 ' + h.kind.replace(/【|】/g, '') + '：' + h.body.slice(0, 110));
  console.log('   视频：' + String(h.video).slice(0, 90) + '\n');
}
fs.writeFileSync(
  path.join(ROOT, 'evidence', 'lingyu-new-forms11.json'),
  JSON.stringify({ corpus: CORPUS, items: out }, null, 2),
  'utf8'
);
