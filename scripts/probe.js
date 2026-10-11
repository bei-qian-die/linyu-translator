'use strict';
// 临时抽查：代表性句子在真实 seed 上的翻译结果（纯函数，无需建库）
const path = require('path');
const fs = require('fs');
const { translateText } = require('../src/core/translator');

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'seed.json'), 'utf8'));
const samples = [
  '笑翻了', '真是笑死我了', '这个方案像风姿来的', '好厉害', '我要报警了',
  '生命在于运动', '白嫖不给币', '她都已经过气了', '关你什么事', '学会了',
  '大赦天下吧', '她真有文化', '你在造谣', '气死我了', '新英雄上线',
];

for (const s of samples) console.log(s, '->', translateText(s, seed));
const doubled = samples.filter((s) => /(惹惹|噜噜|靴靴了|厚厚|了惹惹)/.test(translateText(s, seed)));
console.log('doubled-flavor hits:', doubled.length ? doubled.join(' | ') : 'none');
