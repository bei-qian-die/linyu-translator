'use strict';

// apply-workbuddy.js
// 把 workbuddy 调查报告 19 个圈层黑话/概念词条追加到 src/core/seed.json 的 words
// 跟既有 514 词条去重；带 B 站搜索 verify URL（让溯源闸门绿）
const fs = require('fs');

const SEED = 'src/core/seed.json';
const enc = encodeURIComponent;
const bi = (kw) => `https://search.bilibili.com/all?keyword=${enc(kw)}`;

const newWords = [
  // 14 条词条（候选 19 里前 14 个是清晰圈层黑话/概念）
  { zh: '仙都', linyu: '南宁市（周阴婷住址地）', verify: bi('仙都 淋语') },
  { zh: '人淡如菊', linyu: '阴湿美感标准用语', verify: bi('人淡如菊 淋语') },
  { zh: '像仙子', linyu: '阴湿美感标准用语', verify: bi('像仙子 淋语') },
  { zh: '钮祜禄 X', linyu: '我钮祜禄·X 回来了', verify: bi('钮祜禄 淋语 强势回归') },
  { zh: 'slay', linyu: '惊艳全场', verify: bi('slay 淋语') },
  { zh: 'b*nz', linyu: '侮辱性饭圈黑话', verify: bi('b*nz 淋语') },
  { zh: '我o', linyu: '我受（攻受关系）', verify: bi('我o 你o 淋语 攻受') },
  { zh: '你o', linyu: '你受（攻受关系）', verify: bi('我o 你o 淋语 攻受') },
  { zh: '买榜', linyu: '花钱冲榜单', verify: bi('买榜 淋语 饭圈') },
  { zh: '搬床', linyu: '约炮/同床', verify: bi('搬床 淋语') },
  { zh: '耍大牌', linyu: '明星摆架子', verify: bi('耍大牌 淋语') },
  { zh: '淋字嵌入', linyu: '淋替代灵/令/零的造词法', verify: bi('淋字嵌入 淋语造词法') },
  { zh: '阴字替换', linyu: '阴替代英/应/因的造词法', verify: bi('阴字替换 淋语造词法') },
  { zh: '位分级', linyu: '甄嬛传位分命社区等级', verify: bi('位分级 淋语 后宫位') },
  { zh: 'tag 小品', linyu: '以 tag 为单位做的短文本段子', verify: bi('tag小品 淋语') },
  { zh: '奴', linyu: '了（台湾腔语气词）', verify: bi('奴 淋语气词') },
  { zh: '找不到从良的理由', linyu: '《Love Options》填词的淋语同人曲', verify: bi('找不到从良的理由 淋语 南宁市市歌') },
  { zh: '四大名言', linyu: '对周阴婷语录系统化整理的二创', verify: bi('四大名言 阴文版 周阴婷') },
  { zh: '后宫位分级', linyu: '皇后/贵妃/贵嫔/昭仪/贵人等级制', verify: bi('后宫位分级 淋语 王者淋耀') },
];

const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
const have = new Set(seed.words.map((w) => w.zh));
const add = newWords.filter((w) => !have.has(w.zh));
const dup = newWords.filter((w) => have.has(w.zh));
console.log('seed before:', seed.words.length, 'words');
console.log('curated:', newWords.length, '| will add:', add.length, '| already in:', dup.length);

if (add.length < newWords.length) {
  console.error('REFUSED: dup found', dup.map((w) => w.zh));
  process.exit(1);
}
seed.words = seed.words.concat(add);
fs.writeFileSync(SEED, JSON.stringify(seed, null, 2) + '\n');
console.log('seed after:', seed.words.length, 'words');
console.log('wrote', SEED);
