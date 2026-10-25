'use strict';
// 三端数据一致性终检：Electron / 网页+安卓 / 微信小程序
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
const www = JSON.parse(fs.readFileSync(path.join(ROOT, 'www/seed.json'), 'utf8'));
const wseed = fs.readFileSync(path.join(ROOT, 'miniprogram/data/seed.js'), 'utf8');
const counts = require(path.join(ROOT, 'miniprogram/data/counts.js'));

console.log('=== 三端数据一致性 ===');
console.log('Electron src/core/seed.json :', src.words.length, '词 /', src.rules.length, '句式');
console.log('www/seed.json               :', www.words.length, '词 /', www.rules.length, '句式');
console.log('miniprogram/data/seed.js    :', (wseed.match(/"zh":/g) || []).length, '词条');
console.log('miniprogram/data/counts.js  :', JSON.stringify(counts));

const has = (p) => fs.existsSync(path.join(ROOT, p));
console.log('www/core 有 extra11/12       :', has('www/core/lore-extra11.js'), has('www/core/lore-extra12.js'));
console.log('miniprogram/data extra11/12 :', has('miniprogram/data/lore-extra11.js'), has('miniprogram/data/lore-extra12.js'));
console.log(
  'www/core/lore.js 挂了 extra12:',
  fs.readFileSync(path.join(ROOT, 'www/core/lore.js'), 'utf8').includes('lore-extra12')
);
console.log(
  'miniprogram/data/lore.js 挂了 extra12:',
  fs.readFileSync(path.join(ROOT, 'miniprogram/data/lore.js'), 'utf8').includes('lore-extra12')
);

const vj = path.join(ROOT, 'www/version.json');
console.log('www/version.json            :', JSON.parse(fs.readFileSync(vj, 'utf8')).version);
const av = path.join(ROOT, 'android/app/src/main/assets/public/version.json');
console.log('android assets 版本          :', has('android/app/src/main/assets/public/version.json') ? JSON.parse(fs.readFileSync(av, 'utf8')).version : '(缺)');

// android assets 里的词条数
const aseed = path.join(ROOT, 'android/app/src/main/assets/public/seed-data.js');
if (has('android/app/src/main/assets/public/seed-data.js')) {
  const t = fs.readFileSync(aseed, 'utf8');
  console.log('android seed-data.js        :', (t.match(/"zh":/g) || []).length, '词 /', (t.match(/"pattern":/g) || []).length, '句式 /', /LINYU_VERSION = "([^"]+)"/.exec(t)[1]);
}

// 三端词库条数必须完全一致
const wCount = (wseed.match(/"zh":/g) || []).length;
const aCount = fs.existsSync(aseed) ? (fs.readFileSync(aseed, 'utf8').match(/"zh":/g) || []).length : -1;
const ok = src.words.length === www.words.length && src.words.length === wCount && src.words.length === aCount;
console.log('\n结论: 三端词库条数一致 =', ok ? '是' : '否');
