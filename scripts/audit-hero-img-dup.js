'use strict';
// 英雄配图串图闸门：图源合规（audit-hero-img-src）查不出图文不符，这一层只抓可程序化的硬伤。
// 退出码：有 P0（跨角色共享 / 文件缺失）返回 1；缺图单独列出，不单独判死。
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const lore = require(path.join(ROOT, 'src/core/lore'));
const heroes = (lore.__export || lore).heroes || [];
const imgDir = path.join(ROOT, 'src/renderer/img');
const files = new Set(fs.readdirSync(imgDir));
const zone = (h) => String(h.rank || '').split('·')[0].trim() || (h.tags || [])[0] || '未分区';

const byImg = new Map();
const noImg = [];
const missing = [];
const outside = [];
for (const h of heroes) {
  if (!h.img) { noImg.push(h.name); continue; }
  const base = path.basename(h.img);
  if (!files.has(base)) missing.push(`${h.name} → ${h.img}`);
  if (!/^img\/hero-/.test(h.img)) outside.push(`${h.name} → ${h.img}`);
  if (!byImg.has(h.img)) byImg.set(h.img, []);
  byImg.get(h.img).push(h);
}
const dup = [...byImg.entries()].filter(([, hs]) => hs.length > 1);
console.log('=== 英雄配图串图检查 ===');
console.log('英雄总数', heroes.length, '| 缺图', noImg.length, '| 文件缺失', missing.length, '| 共享文件组', dup.length);
dup.forEach(([img, hs]) => {
  const zs = [...new Set(hs.map(zone))];
  const cross = zs.length > 1;
  console.log(`  ${cross ? '[跨分区·错]' : '[同分区·待确认]'} ${img} ← ${hs.map((h) => h.name + '(' + zone(h) + ')').join('、')}`);
});
if (noImg.length) console.log('  缺图:', noImg.join('、'));
if (missing.length) console.log('  文件缺失:', missing.join(' | '));
if (outside.length) console.log('  非法路径:', outside.join(' | '));
if (dup.length || missing.length) { console.error('存在 P0 问题，退出码 1'); process.exit(1); }
console.log('全部通过');
