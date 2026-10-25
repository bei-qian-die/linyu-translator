'use strict';
// 临时:为新英雄从语料挖配属名言(带 BV/标题/文件出处)
const fs = require('fs');
const path = require('path');
const dir = 'corpus';
const files = fs.readdirSync(dir).filter((f) => /^corpus.*\.txt$/.test(f));

const TARGETS = [
  ['胡艺莲', ['胡艺莲']],
  ['芒果君101号', ['芒果君']],
  ['一个安东尼', ['安东尼']],
  ['零时序', ['零时序']],
  ['不是地才素天才', ['不是地才素天才', '地才素天才']],
  ['松下丶Aoki', ['松下']],
  ['阴TV', ['阴TV', '婊时代', '乘风破浪就要银']],
  ['poke萌虻', ['poke萌虻', '鸡圈甜菜']],
  ['xx辰丶', ['xx辰', '你辰']],
  ['郭门小神童', ['郭门小神童', '郭门']],
  ['拉克丝', ['拉克丝', '你光', '德玛妈祖']],
  ['大副', ['大副']],
  ['玩具商', ['玩具商']],
  ['玛薇卡', ['玛薇卡', '我玛', '化身为胱']],
  ['淋语一起厚歌', ['淋语一起厚']],
];

const FLAVOR = /淋|阴|鼠|惹|噜|厚|靴|珍|尊|素|吸|婊|解|仙|公主|女王|姐妹|本可|老娘|吓|糕|蛤|嘻|婷|凤|娜|呗|蕾|饺|糕|橘|锅|莓|薯|咩/;
for (const [name, keys] of TARGETS) {
  console.log('\n######## ' + name);
  let shown = 0;
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.length < 12 || l.length > 160) continue;
      if (!keys.some((k) => l.includes(k))) continue;
      // 只在淋味行里挑,跳过纯标题行以外的上下文头部
      if (!FLAVOR.test(l)) continue;
      // 找到所在视频块(向上找【视频】头)
      let bv = '', title = '';
      for (let j = i; j >= Math.max(0, i - 40); j--) {
        const m = lines[j].match(/BV[0-9A-Za-z]{8,12}/);
        if (m) { bv = m[0]; }
        const t = lines[j].match(/【视频】(.+)/);
        if (t) { title = t[1].slice(0, 50); break; }
      }
      console.log('  [' + f.replace('corpus', '').replace('.txt', '') + '|' + (bv || '?') + '] ' + l.trim().slice(0, 100));
      if (++shown >= 14) break;
    }
  }
}
