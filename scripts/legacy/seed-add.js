'use strict';
const fs = require('fs');
const P = 'src/core/seed.json';
const seed = JSON.parse(fs.readFileSync(P, 'utf8'));
if (Object.keys(seed).sort().join(',') !== 'rules,words') throw new Error('unexpected seed.json keys: ' + Object.keys(seed));

// 全部来自 corpus3-7：B站淋语 tag / 通讯录英雄 tag / 游戏 tag 视频的标题、简介、弹幕、评论区实录
const NEW_WORDS = [
  ['人家', '本可'],
  ['本姑娘', '本可'],
  ['大姐', '哒姐'],
  ['妈呀大姐', '玛雅大姐'],
  ['好厉害', '厚礼蟹'],
  ['UP主', '阿婆主'],
  ['博主', '阿婆主'],
  ['在座各位', '在座都是姐妹惹'],
  ['高难度', '糕难度'],
  ['高兴', '糕熏'],
  ['高潮', '糕朝'],
  ['笑死人了', '孝死本仙子惹'],
  ['气死', '气die'],
  ['爱的供养', '爱的宫痒'],
  ['一笑解千愁', '一淡解千愁'],
  ['清者自清', '清者自清靴靴'],
  ['问心无愧', '阴者自阴'],
  ['关你什么事', '关你什么事厚'],
  ['闭嘴', '婷芷说惹'],
  ['住嘴', '婷芷'],
  ['盯上', '锁定'],
  ['下次见', '下见惹'],
  ['支持', '捧场'],
  ['大笑', '笑得合不拢腿'],
  ['感动', '流下13滴眼泪'],
  ['眼泪', '13滴眼泪'],
  ['夸奖', '妙语连珠'],
  ['伶牙俐齿', '尊素伶牙俐齿'],
  ['救命', '夭寿惹'],
  ['天呐', '天呐噜'],
  ['什么情况', '什么鬼了噜'],
  ['完蛋', '大事不妙噜'],
  ['奖励', '奖励130根乌干达'],
  ['顶级', 'T0'],
  ['二流', 'T1.5'],
  ['垫底', 'T3'],
  ['过气', 'flop'],
  ['翻红', '事业第二春'],
  ['顶流', '母体'],
  ['吸引力', '吸力'],
  ['道歉', '给我道歉'],
  ['学习', '补课'],
  ['小语种', '淋王星的官方语言'],
  ['离谱', '好离谱'],
  ['梗太多', '好密集的梗'],
  ['发臭', '发烂发臭'],
  ['腐烂', '发烂发臭'],
  ['报警', '已经报警'],
  ['走着瞧', '留到渊下宫再说'],
  ['学会了', '伦家都会了'],
  ['荒谬', '离谱'],
  ['演技', '阴演技'],
  ['难逃', '难逃一吸'],
  ['第一名', '宇宙第一'],
  ['合订本', '全网最全合订本'],
  ['冷笑', '吸吸'],
  ['死党', '本质骑士'],
  ['路人', '路人甲'],
  ['黑粉', '黑子'],
  ['欧皇', '欧米伽'],
  ['非酋', '敌蜜'],
  ['满命', '130分'],
  ['翻车', '大事不妙'],
  ['封神', '全体起立'],
  ['退网', '衮出这个舞台'],
  ['辣眼', '保护眼睛'],
  ['魅魔', '顶级魅魔'],
  ['开场', '开口跪'],
  ['举报', '送进天德池'],
  ['封号', '账号已注销'],
  ['掉粉', 'flop'],
  ['官宣', '第130次首谈'],
  ['撕逼', '扯头花'],
  ['塌房', '发烂发臭'],
  ['洗白', '清者自清'],
  ['阴阳怪气', '阴者自阴'],
  ['擦边', '擦边主播'],
  ['心理医生', '心理咨熊师'],
  ['运动', '用洞'],
  ['装备', '圣杯面具40cd'],
  ['大招', 'A杖效果'],
  ['削弱', '该削了'],
  ['变身', '变形怪'],
  ['整容', 'DO脸']
];

const NEW_RULES = [
  { pattern: '清者自清', template: '本仙女清者自清，我只会收到很好的评价惹', note: '自证句式' },
  { pattern: '(?:问心无愧|身正不怕影子斜)', template: '阴者自阴，靴靴', note: '自黑自证' },
  { pattern: '关你(?:什么|啥)事', template: '关你什么事厚，速速衮出这个舞台靴靴', note: '怼人句式' },
  { pattern: '(?:救命|救救我)', template: '夭寿惹！本可人已经报警惹', note: '呼救句式' },
  { pattern: '(?:什么情况|怎么回事|发生什么)', template: '这是什么鬼了噜', note: '疑惑句式' },
  { pattern: '(?:下次见|回见|拜拜)', template: '下见惹，明天再来吸入噜', note: '道别句式' },
  { pattern: '(?:走着瞧|等着看|你等着)', template: '吸吸，这话留到渊下宫再说噜', note: '威胁句式' },
  { pattern: '(?:夸我|夸一下|我厉害吗)', template: '姐姐真素妙语连珠', note: '求夸句式' },
  { pattern: '(?:好厉害|太厉害了|厉害啊)', template: '厚礼蟹！！吓我一跳噜', note: '惊叹句式' },
  { pattern: '(?:奖励你?|给你奖励)', template: '珍素努力惹，奖励130根乌干达', note: '奖励句式' },
  { pattern: '(?:给我)?道歉', template: '给我道歉，靴靴', note: '逼道歉句式' },
  { pattern: '(?:听不懂|没学会|学不会)', template: '天啦噜，伦家都会了惹', note: '学渣句式' },
  { pattern: '(?:教程|教学)', template: '竟然真有阿婆主教学噜', note: '教学句式' },
  { pattern: '(?:顶流|常青|不老女神)', template: '母体是不会过气的惹', note: '顶流句式' },
  { pattern: '(?:过气|糊了)', template: 'flop两年，事业第二春噜', note: '糊咖句式' },
  { pattern: '(?:笑死|笑翻|乐死)', template: '孝死本可惹', note: '孝死句式' },
  { pattern: '(?:你好厉害|厉害死了)', template: '厚礼蟹，你院淋神降临噜', note: '跪服句式' },
  { pattern: '(?:别说了|够了)', template: '婷芷说惹，你大事不妙噜', note: '喝止句式' }
];

const have = new Set(seed.words.map((w) => w.zh));
let addedW = 0;
for (const [zh, linyu] of NEW_WORDS) {
  if (have.has(zh) || zh === linyu) continue;
  seed.words.push({ zh, linyu });
  have.add(zh);
  addedW++;
}
const haveP = new Set(seed.rules.map((r) => r.pattern));
let addedR = 0;
for (const r of NEW_RULES) {
  if (haveP.has(r.pattern)) continue;
  seed.rules.push(r);
  addedR++;
}

// 被剔除的旧梗不再出现在句式模板里
for (const r of seed.rules) {
  if (r.template.includes('闭嘴惊艳')) r.template = '好看惹，美cry噜';
}

const wLines = seed.words.map((w) => '    { "zh": ' + JSON.stringify(w.zh) + ', "linyu": ' + JSON.stringify(w.linyu) + ' }').join(',\n');
const rLines = seed.rules.map((r) => '    { "pattern": ' + JSON.stringify(r.pattern) + ', "template": ' + JSON.stringify(r.template) + ', "note": ' + JSON.stringify(r.note) + ' }').join(',\n');
fs.writeFileSync(P, '{\n  "words": [\n' + wLines + '\n  ],\n  "rules": [\n' + rLines + '\n  ]\n}\n', 'utf8');
console.log('words +' + addedW + ' => ' + seed.words.length + ' | rules +' + addedR + ' => ' + seed.rules.length);
