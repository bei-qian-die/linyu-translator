'use strict';
const fs = require('fs');
const P = 'src/core/lore.js';
let src = fs.readFileSync(P, 'utf8');

const PRUNE_CARDS = [
  '谷鸡谷鸡', '130刀', '豪嗨心', '牛皮涕', '高贵冷艳', '闭嘴惊艳', '小前戏',
  '移动的Gay Bar', '捡话筒', '迪士尼式慌张', '凤鸣', '淋圈禁曲',
  '帝国最后的玫瑰', '前苏联的遗珠', '北美落难公主', '世女一', '时代巡演', '争议符号'
];
const PRUNE_QUOTES = [
  '暧昧只是小前戏。',
  '婆婆也是妈，该打就得打。',
  '俺家闲事，恁别管。',
  '人勇亦勇。'
];

const lines = src.split('\n');
const drop = [];
const kept = lines.filter((l, i) => {
  const cm = l.match(/^\s*\{ term: '([^']+)'/);
  if (cm && PRUNE_CARDS.includes(cm[1])) {
    drop.push('CARD ' + cm[1]);
    return false;
  }
  const qm = l.match(/^\s*\{ text: '([^']+)'/);
  if (qm && PRUNE_QUOTES.includes(qm[1])) {
    drop.push('QUOTE ' + qm[1]);
    return false;
  }
  return true;
});
if (kept.length === lines.length) throw new Error('nothing pruned — check patterns');
fs.writeFileSync(P, kept.join('\n'), 'utf8');
console.log('pruned ' + drop.length + ':');
drop.forEach((d) => console.log('  - ' + d));
