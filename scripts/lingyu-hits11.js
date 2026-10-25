'use strict';
// 只看真正带淋语标记的行，统计新一轮语料的实际可用密度。
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const file = process.argv[2] || 'corpus/corpus-bili-20261024202023.txt';
const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
const lines = text.split(/\r?\n/);

const MARK = /(本可|本仙女|本祝妞|本猪妞|靴靴|你币|淋语|淋神|淋语人|素本可|惹|噜|你华|我华|本姐|本鱼|本喵|本狗|本宝|nea|鸡你太美|咯咯咯|剥注|蚂蚁辣么|耶啵|划水|抽象|圣子|阴中|凤姐|曼波|可达鸭|绷不住了|蚌埠住了|急急急|典|孝|笑鼠)/;

const hit = lines.filter((l) => MARK.test(l));
console.log('总行', lines.length, '带淋语标记行', hit.length);

const uniq = new Map();
for (const l of hit) {
  const b = l.replace(/^【[^】]*】/, '').trim();
  if (b.length < 4) continue;
  uniq.set(b, (uniq.get(b) || 0) + 1);
}
const arr = [...uniq.entries()].sort((a, b) => b[1] - a[1]);
console.log('去重后', arr.length);
for (const [t, n] of arr.slice(0, 80)) console.log(String(n).padStart(3), t.slice(0, 90));
fs.writeFileSync(path.join(ROOT, 'evidence', 'lingyu-hits11.txt'), arr.map(([t, n]) => n + '\t' + t).join('\n'), 'utf8');
