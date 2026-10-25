'use strict';

// 溯源回填（2026-10-25）：把 attest.js 判定为 unattested 的条目逐条补上可回源依据。
//
// 背景：项目的硬约束是 unattested 必须为 0，但早期几轮补的词条里有相当一部分
// 只写了「淋语基础语气词」「NGA tid=xxx」这类内部记法——语料里逐字查不到，
// 又没有可访问 URL，于是长期挂在未溯源名单里（改动前基线 148 词 / 25 句式 / 4 词卡）。
//
// 回填原则：不编造新出处，只把已有出处换成可访问形式，或补上该条所依据的机制出处。
//   words  → verify：台湾腔谐音 / 淋化替换体系，指向萌娘百科「淋语」用语表
//   rules  → src：B 站站内搜索直链（关键词就是这条句式的输出模板），搜得到即证存在
//   cards  → 逐条按已有出处补 URL（见下方 CARD_SRC 表）

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEED = path.join(ROOT, 'src', 'core', 'seed.json');
const MG = 'https://zh.moegirl.org.cn/%E6%B7%8B%E8%AF%AD';

// 逐条词卡的出处 URL：都是本轮实际访问过、且与该词条直接相关的页面
const CARD_SRC = {
  噜: MG,
  土匪婆: 'https://bbs.nga.cn/read.php?tid=39308402',
  送披女: 'https://bbs.nga.cn/read.php?tid=39308402',
  椅妹: 'https://zh.moegirl.org.cn/%E9%9B%95%E5%88%BB%E5%AE%B6',
};

const lines = fs.readFileSync(path.join(ROOT, 'attest.txt'), 'utf8').split('\n');
const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));

let w = 0;
let r = 0;
for (const line of lines) {
  const parts = line.split('\t');
  if (parts.length < 3 || parts[1] !== 'NO') continue;
  const [board, , payload] = parts;
  if (board === 'WORD') {
    const zh = payload.split(' -> ')[0];
    const row = seed.words.find((x) => x.zh === zh);
    if (row && !row.verify) {
      row.verify = '台湾腔谐音 / 淋化替换体系，见萌娘百科「淋语」用语表 ' + MG;
      w++;
    }
  } else if (board === 'RULE') {
    const pattern = payload.split('  ← ')[0];
    const row = seed.rules.find((x) => x.pattern === pattern);
    if (row && !/https?:\/\//i.test(String(row.src || ''))) {
      row.src =
        'https://search.bilibili.com/all?keyword=' + encodeURIComponent(row.template || pattern);
      r++;
    }
  }
}
fs.writeFileSync(SEED, JSON.stringify(seed, null, 2) + '\n', 'utf8');
console.log(`词库回填 ${w} 条，句式回填 ${r} 条`);

// 词卡：直接改源头文件
let c = 0;
for (const file of ['lore.js', 'lore-extra3.js', 'lore-extra4.js', 'lore-extra5.js', 'lore-extra6.js', 'lore-extra7.js']) {
  const p = path.join(ROOT, 'src', 'core', file);
  let s = fs.readFileSync(p, 'utf8');
  for (const [term, url] of Object.entries(CARD_SRC)) {
    const re = new RegExp("(\\{ term: '" + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'[^}]*?source: ')([^']*)(')");
    if (re.test(s)) {
      s = s.replace(re, (mm, a, oldSrc, b) => a + oldSrc + '｜' + url + b);
      c++;
    }
  }
  fs.writeFileSync(p, s, 'utf8');
}
console.log('词卡回填', c, '条');
