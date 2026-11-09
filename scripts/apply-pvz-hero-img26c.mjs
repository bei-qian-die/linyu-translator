// 把本轮落地的 21 张配图写回 lore-extra26.js 的英雄条目：
//   img  → img/hero-NNN.png
//   links → 追加「配图来源 · <类型>」+「图片直链」+「出处页」
// 已存在的 9 位（949~957）不动。
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const LORE26 = path.join(ROOT, 'src/core/lore-extra26.js');
const FINAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/pvz-hero-images26-final.json'), 'utf8'));

delete require.cache[LORE26];
const data = require(LORE26);
const byName = new Map(FINAL.report.map((r) => [r.name, r]));

let hit = 0;
for (const h of data.heroes) {
  const r = byName.get(h.name);
  if (!r) continue;
  h.img = 'img/' + r.file;
  const links = (h.links || []).filter((l) => !/配图来源|图片直链|封面出处/.test(String(l.label || '')));
  links.push({ label: `配图来源 · ${r.type}`, url: r.page || r.src });
  links.push({ label: '图片直链', url: r.src });
  h.links = links;
  hit++;
}

const out = `// @ts-check
'use strict';
// 第二十六轮：淋物大战阴尸（植物大战僵尸淋语化）分区。
// 数据由 scripts/build-curated-pvz26.mjs 从 B 站公开检索（evidence/bili-search-pvz-*.json）
// 与官方设定整理，scripts/apply-pvz26.js 去重后落库。
// 人物配图见 evidence/pvz-hero-images26-final.json：百度百科词条主图 / 百科图集 / 360 图片检索，
// 全部为真实网络图片，逐张出联系表人工核对过，无 AI 生成图。
const __export = ${JSON.stringify({ cards: data.cards, heroes: data.heroes, quotes: data.quotes })};
if (typeof module === 'object' && module.exports) module.exports = __export;
else if (typeof window !== 'undefined') window.LORE_EXTRA26 = __export;
`;
fs.writeFileSync(LORE26, out, 'utf8');

delete require.cache[LORE26];
delete require.cache[path.join(ROOT, 'src/core/lore.js')];
const lore = require(path.join(ROOT, 'src/core/lore.js'));
const zone = lore.heroes.filter((h) => String(h.rank).startsWith('淋物大战阴尸'));
console.log('写回英雄', hit, '位');
console.log('新分区英雄', zone.length, '| 有图', zone.filter((h) => h.img).length);
const miss = zone.filter((h) => !h.img).map((h) => h.name);
console.log(miss.length ? '仍缺图: ' + miss.join(' / ') : '全部有图 ✓');
console.log(zone.filter((h) => h.img).map((h) => h.name + '→' + h.img.split('/').pop()).join(' | '));
