'use strict';
// 第三轮扩充：来自 corpus8f（19 个淋语相关视频：蔡依林 MV 弹幕、新酱爱追剧、
// 通讯录女英雄大乱斗、通讯录典藏金曲、那艺娜综艺新闻）与豆瓣《淋语教材》词表
const fs = require('fs');
const P = 'src/core/seed.json';
const seed = JSON.parse(fs.readFileSync(P, 'utf8'));

const NEW_WORDS = [
  ['灵感', '淋光乍现惹'],
  ['五毛特效', '1.3毛特效'],
  ['配音', '配阴'],
  ['人美心善', '我淋人美心善惹'],
  ['冰雪聪明', '我淋冰雪聪明惹'],
  ['太美了', '美到维纳斯怀孕惹'],
  ['王炸', '开局王炸惹'],
  ['背景板', '连背景板都当不成惹'],
  ['直男认证', '那已经素直男惹'],
  ['调理', '调理好了惹'],
  ['水牛音', '超绝水牛音'],
  ['蠢死了', '蠢die噜'],
  ['吓到', '吓属惹'],
  ['怪美的', '我林怪美的'],
  ['太美', '珍素太美惹'],
  ['淋雨', '淋雨一直走惹'],
  ['床戏', '床戏女王'],
  ['电音', '紫薇邦漏电'],
  ['谢谢谢谢', '靴靴的靴靴惹'],
  ['恶心', '恶熏'],
  ['天哪', '天了噜'],
  ['去世', '请你立即去世惹'],
  ['野鸡', '野鸡咕咕day'],
  ['高贵', '真素高贵得不像话'],
  ['马戏团', '马戏团天后'],
  ['钢索', '为爱走钢索'],
  ['命大', '命大也鼠惹'],
  ['艾莉', '有点像艾莉惹'],
  ['恒河水', '敢喝恒河水'],
  ['墙板报', '破坏墙板报的人'],
  ['假发', '位移噜'],
  ['鹅螺狮', '鹅螺狮辣辣'],
  ['吱花', '不素吱花惹'],
  ['一梦奇缘', '大梦是三梦的姐姐'],
];

const NEW_RULES = [
  { pattern: '(?:灵感来了?|有灵感|突然想到|灵光一闪)', template: '淋光乍现惹', note: '灵感句式' },
  { pattern: '(?:五毛特效|特效很差|渣特效)', template: '1.3毛特效惹', note: '特效句式' },
  { pattern: '(?:配音|用替身|假唱)', template: '台词太差，所以用配阴惹', note: '配音句式' },
  { pattern: '(?:人美心善|又美又善解人意)', template: '我淋人美心善惹', note: '夸句式' },
  { pattern: '(?:冰雪聪明|真聪明)', template: '我淋冰雪聪明惹', note: '夸句式' },
  { pattern: '(?:美翻了|美得冒泡|好看到爆)', template: '美到维纳斯怀孕惹', note: '夸句式' },
  { pattern: '(?:开局王炸|一把好牌)', template: '开局王炸惹', note: '开局句式' },
  { pattern: '(?:没镜头|没台词|当路人)', template: '连背景板都当不成惹', note: '背景板句式' },
  { pattern: '(?:已经变直男|就是直男|变成直男)', template: '那已经素直男惹', note: '直男句式' },
  { pattern: '(?:调理好了?|养好了|治好了)', template: '那确实调理的比较好一点惹', note: '调理句式' },
  { pattern: '(?:淋雨|下雨了)', template: '淋雨一直走惹，靴靴', note: '淋雨句式' },
  { pattern: '(?:听你说|倾诉|诉苦)', template: '我淋听你的故事秽，同情1.3秒', note: '倾听句式' },
  { pattern: '(?:赶紧去死|你怎么不去死|去死吧)', template: '请你立即去世，靴靴', note: '喝句式' },
  { pattern: '(?:太谢谢了|多谢多谢|感激不尽)', template: '靴靴的靴靴惹', note: '感谢句式' },
];

const haveW = new Set(seed.words.map((w) => w.zh));
const haveR = new Set(seed.rules.map((r) => r.pattern));
let aw = 0;
let ar = 0;
for (const [zh, linyu] of NEW_WORDS) {
  if (haveW.has(zh)) continue;
  seed.words.push({ zh, linyu });
  aw++;
}
for (const r of NEW_RULES) {
  if (haveR.has(r.pattern)) continue;
  // 具体句式放前面，避免被通用规则先吃掉
  seed.rules.unshift(r);
  ar++;
}

const wLines = seed.words.map((w) => '    { "zh": ' + JSON.stringify(w.zh) + ', "linyu": ' + JSON.stringify(w.linyu) + ' }').join(',\n');
const rLines = seed.rules.map((r) => '    { "pattern": ' + JSON.stringify(r.pattern) + ', "template": ' + JSON.stringify(r.template) + ', "note": ' + JSON.stringify(r.note) + ' }').join(',\n');
fs.writeFileSync(P, '{\n  "words": [\n' + wLines + '\n  ],\n  "rules": [\n' + rLines + '\n  ]\n}\n', 'utf8');
console.log('added words', aw, 'rules', ar, '=> total', seed.words.length, '/', seed.rules.length);
JSON.parse(fs.readFileSync(P, 'utf8'));
console.log('seed.json parses ok');
