'use strict';
// 按行剔除与淋语无关的词卡/名言（每条在 lore.js 里独占一行）
const fs = require('fs');
const P = 'src/core/lore.js';

const DROP_CARDS = [
  "term: '耶斯莫拉'",
  "term: '夯'",
  "term: '开口跪'",
  "term: '一绿者'",
  "term: '火龙果上身'",
  "term: '身份证不要了'",
  "term: '网络太残酷了'",
  "term: '中路庄周'",
  "term: '九尾伟大'",
  "term: '灰指甲药膏'",
];

const DROP_QUOTES = [
  "text: '集美们，我们继续我们的郭语学习。'",
  "text: '身份证不要了。'",
  "text: '请通过正规渠道补办身份证。'",
  "text: '华语最会跳舞的是鸭姐——正确的！'",
  "text: '华语最会跳舞的是鸭姐。'",
  "text: '心理咨询师总是推荐患者找一个好的心理咨询师。'",
  "text: '专业不专业不知道，但这个何老师是很认真在倾听问题、解答问题。'",
  "text: '埃及正统在东北，因为都有内海。'",
  "text: '我怀疑唱的是亚历山大大帝。'",
  "text: '这首歌最好听的也就是前奏了。'",
  "text: '说七不说八，文明你我他。'",
  "text: '婆婆用你们家灰指甲药膏，用死了，立马赔钱。'",
  "text: '怎么老冒沫呢？'",
  "text: '太良心，失眠听一听。'",
  "text: '昨晚真的是跌宕起伏的直播，比电视剧还精彩。'",
  "text: '庄周虽然让对面白起废了，但是元歌变的白起作用可就大了。'",
  "text: '最擅长承伤的中路选手选到坦克，这不是拿到专武了吗？'",
  "text: '大胆，竟敢批了伟大的鬼图！'",
  "text: '黄总：孙策你等等我呀。'",
  "text: '一绿者，奥托 阿波卡利斯。'",
  "text: '我也觉得莉莉知道是节目效果，故意开狂暴，老地瓜反而懵了。'",
  "text: '网络太残酷了。'",
];

const lines = fs.readFileSync(P, 'utf8').split('\n');
const drop = [...DROP_CARDS, ...DROP_QUOTES];
const kept = [];
const gone = [];
for (const l of lines) {
  const hit = drop.find((d) => l.trimStart().startsWith('{') && l.includes(d));
  if (hit) gone.push(hit);
  else kept.push(l);
}
fs.writeFileSync(P, kept.join('\n'), 'utf8');
const missed = drop.filter((d) => !gone.includes(d));
console.log('removed', gone.length, 'entries; missed', missed.length);
missed.forEach((m) => console.log('MISS', m));
