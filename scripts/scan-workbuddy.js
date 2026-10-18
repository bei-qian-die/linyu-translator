'use strict';

// scan-workbuddy.js
// 从调查报告里抽出的候选词条 + 跟 514 baseline 去重
const fs = require('fs');

const have = new Set(
  JSON.parse(fs.readFileSync('src/core/seed.json', 'utf8')).words.map((w) => w.zh)
);

const cand = [
  // 地名 / 概念
  ['仙都', '南宁市的淋化称呼（周阴婷住址）'],
  ['人淡如菊', '淋语圈形容阴湿美感的标准用语'],
  ['像仙子', '淋语圈形容阴湿美感的标准用语'],
  ['钮祜禄 X', '我钮祜禄·X 回来了强势回归句式'],
  // 关键人物别名
  ['周阴婷', '蔡依林在淋语圈的核心称呼'],
  ['阴婷宝', '周阴婷主题的 AI 语音助手'],
  // 黑话层（调查报告新收录）
  ['slay', '惊艳全场（英源）'],
  ['b*nz', '饭圈侮辱性黑话'],
  ['我o', '我受（攻受关系的受方）'],
  ['你o', '你受'],
  ['买榜', '花钱冲榜单'],
  ['搬床', '网络约炮/同床'],
  ['耍大牌', '明星摆架子'],
  // 造词法层（4 个概念词条）
  ['淋字嵌入', '淋字替代灵/令/零等的造词法'],
  ['阴字替换', '阴字替代英/应/因等的造词法'],
  ['位分级', '用甄嬛传位分命名社区等级'],
  ['tag 小品', '以 tag 为单位做的短文本段子'],
  // 语气词层（新增奴）
  ['奴', '了的另一种淋化语气词（台湾腔）'],
  // 调查报告里的核心作品 / 概念
  ['找不到从良的理由', '《Love Options》填词的淋语同人曲，南宁市市歌'],
  ['四大名言', '对周阴婷语录系统化整理的二创'],
  // 后宫位分级补充
  ['后宫位分级', '用皇后/贵妃/贵嫔/昭仪/贵人命名社区用户等级'],
  // UP 主（B 站出现频次高，按人物传候选）
  ['木头人的磁带旧时光', '周阴婷《淋语一起厚》上传 UP，5.4 万播'],
  ['FLY 组合工作室', '阴婷宝语音包作者，15.6 万播，2021'],
  ['提瓦淋新人桑', '四大名言阴文版上传 UP，14.4 万播'],
  // 名言系
  ['阴文版', '将周阴婷语录整理为文本的版本'],
  // 圈层地址梗
  ['大沙田街道', '南宁良庆区，周阴婷住址所在地'],
];

const haveIt = cand.filter((c) => have.has(c[0]));
const newC = cand.filter((c) => !have.has(c[0]));

console.log('candidates:', cand.length, '| new (not in 514):', newC.length, '| already in baseline:', haveIt.length);
console.log('---NEW---');
newC.forEach((c, i) => console.log((i + 1).toString().padStart(2, '0') + '. ' + c[0] + '  =>  ' + c[1]));
console.log('---ALREADY IN---');
haveIt.forEach((c) => console.log('   ' + c[0] + ' (skip)'));

const heroes = new Set(['周阴婷', '阴婷宝', '木头人的磁带旧时光', 'FLY 组合工作室', '提瓦淋新人桑']);
const wordEntries = newC.filter((c) => !heroes.has(c[0]));
const heroEntries = newC.filter((c) => heroes.has(c[0]));

let out = '# 1.13.0 调查报告候选词条（来自 workbuddy.cn 淋语梗系生态调研报告）\n\n';
out += '候选 ' + cand.length + ' 个；新增 ' + newC.length + ' 个（待你审）；已收 ' + haveIt.length + ' 个（跳过）。\n\n';
out += '## 词库候选（' + wordEntries.length + ' 条，仅 zh -> linyu 两键）\n\n';
out += '| 序 | zh | linyu（建议） |\n|---|---|---|\n';
wordEntries.forEach((c, i) => {
  out += (i + 1).toString().padStart(2, '0') + '. ' + c[0] + ' | ' + c[1] + '\n';
});
out += '\n## 人物传候选（' + heroEntries.length + ' 条，建议作为 1.13.0 单独处理）\n\n';
out += '| 序 | 名称 | 说明 |\n|---|---|---|\n';
heroEntries.forEach((c, i) => {
  out += (i + 1).toString().padStart(2, '0') + '. ' + c[0] + ' | ' + c[1] + '\n';
});
out += '\n## 已收在 baseline（跳过，' + haveIt.length + ' 条）\n\n';
haveIt.forEach((c, i) => {
  out += (i + 1).toString().padStart(2, '0') + '. ' + c[0] + '\n';
});

fs.writeFileSync('evidence/workbuddy-candidates.md', out);
console.log('wrote evidence/workbuddy-candidates.md');
