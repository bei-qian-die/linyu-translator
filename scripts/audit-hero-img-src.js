'use strict';
// 核查人物配图的来源链接：确认新配的图都来自合规来源，且没有 AI 生成图痕迹。
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const lore = require(path.join(ROOT, 'src/core/lore'));

const OK_HOST = [
  [/image\.baidu\.com/i, '百度图库'],
  [/img\d+\.baidu\.com/i, '百度图库（CDN）'],
  [/baike\.baidu\.com/i, '百度百科'],
  [/bkimg\.cdn\.bcebos\.com/i, '百度百科图床'],
  [/bilibili\.com/i, 'B站'],
  [/hdslb\.com/i, 'B站图床'],
  [/tieba\.baidu\.com/i, '百度贴吧'],
  [/bdimg\.com/i, '百度贴吧图床'],
  [/bdstatic\.com/i, '百度贴吧图床'],
  [/fategrandorder\.fandom\.com/i, 'FGO 中文 wiki'],
];

const AI_HINT = /(ai生成|ai绘图|midjourney|stable\s*diffusion|dall|novelai| Diffusion|图生成|ai图)/i;

const heroes = lore.heroes;
const report = [];
const hostCount = {};
let noLink = 0;

for (const h of heroes) {
  const imgLinks = (h.links || []).filter((l) => /配图来源/.test(String(l.label || '')));
  if (!imgLinks.length) {
    noLink++;
    report.push({ name: h.name, status: '无「配图来源」标注链接', img: h.img });
    continue;
  }
  for (const l of imgLinks) {
    const u = String(l.url || '');
    let host = '未识别';
    for (const [re, name] of OK_HOST) {
      if (re.test(u)) { host = name; break; }
    }
    hostCount[host] = (hostCount[host] || 0) + 1;
    if (AI_HINT.test(u) || AI_HINT.test(String(l.label || ''))) {
      report.push({ name: h.name, status: '!! 疑似 AI 图来源', url: u });
    }
  }
}

console.log('人物总数', heroes.length, '| 无配图来源标注', noLink);
console.log('\n配图来源域名分布:');
for (const [k, v] of Object.entries(hostCount).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + k.padEnd(16) + v);
}
console.log('\n需要留意:');
for (const r of report) console.log('  -', r.name, '|', r.status, r.url ? '| ' + r.url.slice(0, 90) : '');

console.log('\n来源域名未识别的「配图来源」链接:');
for (const h of heroes) {
  for (const l of h.links || []) {
    if (!/配图来源/.test(String(l.label || ''))) continue;
    const u = String(l.url || '');
    let host = '未识别';
    for (const [re, name] of OK_HOST) {
      if (re.test(u)) { host = name; break; }
    }
    if (host === '未识别') console.log('  - ' + (h.name + '        ').slice(0, 14) + u.slice(0, 100));
  }
}

// 本轮新配图的人单独列一遍
const EVI = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/hero-images11.json'), 'utf8'));
console.log('\n本轮新配图（evidence/hero-images11.json）:');
for (const r of EVI.report) {
  console.log('  ' + (r.name + '              ').slice(0, 16) + (r.file || '??').padEnd(14) + (r.how || '').slice(0, 70));
}
