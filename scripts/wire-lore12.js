'use strict';
// 把第十二轮数据源挂进 lore.js 的加载链（与 extra11 同构）。
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = path.join(ROOT, 'src/core/lore.js');

let s = fs.readFileSync(P, 'utf8');
const before = s;

const anchor =
  "const extra11 = (typeof require === 'function') ? require('./lore-extra11') : (typeof window !== 'undefined' ? window.LORE_EXTRA11 : {});";
if (!s.includes(anchor)) {
  console.error('!! 找不到 extra11 锚点');
  process.exit(1);
}
s = s.replace(
  anchor,
  anchor +
    "\nconst extra12 = (typeof require === 'function') ? require('./lore-extra12') : (typeof window !== 'undefined' ? window.LORE_EXTRA12 : {});"
);

s = s.replace('extra10.cards, extra11.cards)', 'extra10.cards, extra11.cards, extra12.cards)');
s = s.replace('extra10.heroes, extra11.heroes)', 'extra10.heroes, extra11.heroes, extra12.heroes)');
s = s.replace('extra10.quotes, extra11.quotes)', 'extra10.quotes, extra11.quotes, extra12.quotes)');

const mergeAnchor =
  'applyAliasMerge(allCards, extra11.aliasMerge);\napplyHeroMerge(allHeroes, extra11.heroMerge);';
if (!s.includes(mergeAnchor)) {
  console.error('!! 找不到合并锚点');
  process.exit(1);
}
s = s.replace(
  mergeAnchor,
  'applyAliasMerge(allCards, extra11.aliasMerge);\n' +
    'applyAliasMerge(allCards, extra12.aliasMerge);\n' +
    'applyHeroMerge(allHeroes, extra11.heroMerge);\n' +
    'applyHeroMerge(allHeroes, extra12.heroMerge);'
);

if (s === before) {
  console.error('!! 未发生任何替换');
  process.exit(1);
}
fs.writeFileSync(P, s, 'utf8');
console.log('[wire] lore.js 已挂载 extra12');
