'use strict';
// 第二轮扩充：句式 + 少量词条，全部取自语料原句
const fs = require('fs');
const P = 'src/core/seed.json';
const seed = JSON.parse(fs.readFileSync(P, 'utf8'));
if (Object.keys(seed).sort().join(',') !== 'rules,words') throw new Error('seed 结构异常');

const NEW_WORDS = [
  ['全文背诵', '本质骑士请全文背诵'],
  ['才女', '尊素才女厚'],
  ['造梗', '真的很会造梗'],
  ['版本答案', '当前版本答案'],
  ['不正宗', '不正宗靴靴'],
  ['气晕', '气拥咧'],
  ['白嫖', '不给硬币小心被吸了噜'],
  ['背书', '全文背诵惹'],
  ['皇上', '王钦朕'],
  ['大赦天下', '今日大赦天下噜']
];

const NEW_RULES = [
  ['(?:不正宗|不标准|没那味儿|没内味)', '这淋语不正宗靴靴，UP主你已经被鸡笼锁定噜', '正宗度审判'],
  ['(?:全文背诵|背下来|要求背诵)', '本质骑士请全文背诵靴靴', '淋语圣歌句式'],
  ['(?:学会了|我会了|懂了|掌握了)', '伦家都会了惹，靴靴', '交作业句式'],
  ['(?:报警|抓起来|依法处置)', '本可人已经报警惹', '威胁句式'],
  ['(?:才女|真有文化|文采飞扬)', '解解珍素淋语地才，才女惹', '夸奖句式'],
  ['(?:生命在于|多运动|锻炼身体)', '生命在于用洞惹', '完颜慧德句式'],
  ['(?:会玩梗|造梗能力|梗真多)', '当前版本答案，造梗能力最强惹', '强度判词'],
  ['(?:不给硬币|不投币|白嫖)', '不给硬币小心被吸了噜', '吸入威胁'],
  ['(?:造谣|污蔑|乱说|瞎说)', '婷芷造谣本可，给我道歉，靴靴', '喝止句式'],
  ['(?:气晕|气死我了|把人气)', '气拥咧噜，本宫要先退下了', '楼兰句式'],
  ['(?:大赦天下|原谅我|放过我)', '今日大赦天下，尔等速速退下噜', '楼兰女皇句式'],
  ['(?:新英雄|版本更新|新上线)', '新英雄上线体验服噜，全体起立', '版本句式'],
  ['(?:强度|什么级别|几级)', '带狂暴就是 T0，不鸣则已一鸣惊人噜', '强度榜句式'],
  ['(?:吸我|被我吸引|走不动道)', '每次都要第一时间看，否则说不定什么时候就被吸了', '吸入句式'],
  ['(?:变身|变形|变成别人)', '这个是变形怪，什么都能变噜', '游戏区句式']
];

const have = new Set(seed.words.map((w) => w.zh));
for (const [zh, linyu] of NEW_WORDS) {
  if (have.has(zh) || zh === linyu) continue;
  seed.words.push({ zh, linyu });
}
const pat = new Set(seed.rules.map((r) => r.pattern));
for (const [pattern, template, note] of NEW_RULES) {
  if (pat.has(pattern)) continue;
  seed.rules.push({ pattern, template, note });
}

const wLines = seed.words.map((w) => '    { "zh": ' + JSON.stringify(w.zh) + ', "linyu": ' + JSON.stringify(w.linyu) + ' }').join(',\n');
const rLines = seed.rules.map((r) => '    { "pattern": ' + JSON.stringify(r.pattern) + ', "template": ' + JSON.stringify(r.template) + ', "note": ' + JSON.stringify(r.note) + ' }').join(',\n');
fs.writeFileSync(P, '{\n  "words": [\n' + wLines + '\n  ],\n  "rules": [\n' + rLines + '\n  ]\n}\n', 'utf8');
console.log('seed now:', seed.words.length, 'words,', seed.rules.length, 'rules');
