'use strict';
const path = require('path');
const fs = require('fs');
const { createDb } = require('../src/core/db');
const { translateText } = require('../src/core/translator');
const { requireAppClosed } = require('./lib/app-running');

// 直连用户真实库做句式顺序回归，App 开着跑会与 App 的落盘互相覆盖。
requireAppClosed('db-order-check.js 句式顺序回归');

const dbFile = path.join(process.env.APPDATA, 'linyu-translator', 'linyu.db');
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'seed.json'), 'utf8'));

const cases = [
  ['太谢谢了', '靴靴的靴靴惹'],
  ['我突然有灵感了', '淋光乍现惹'],
  ['这五毛特效', '1.3毛特效'],
  ['她人美心善', '人美心善'],
  ['美翻了', '美到维纳斯怀孕惹'],
  ['外面下雨了', '淋雨一直走'],
  ['好恶心', '恶熏'],
  ['天哪', '天啦噜'],
  ['他就是直男', '直男'],
  ['我要赶紧去死', '请你立即去世'],
  ['冰雪聪明', '冰雪聪明'],
  ['笑死我了', '笑到原地打滚'],
  ['笑翻了', '孝死本可惹'],
  ['真是乐死了', '孝死本可惹'],
  ['你说话好蠢死了', '蠢die噜']
];

(async () => {
  const st = await createDb({ filePath: dbFile, seed });
  const words = st.getWords();
  const rules = st.getRules();
  console.log('DB', dbFile, '| words', words.length, '| rules', rules.length);
  let bad = 0;
  for (const [src, expect] of cases) {
    const out = translateText(src, { words, rules });
    const ok = out.includes(expect.replace(/惹$/, ''));
    if (!ok) bad++;
    console.log((ok ? '  ok  ' : '  FAIL') + ' ' + src + ' -> ' + out + (ok ? '' : '   (expected contains ' + expect + ')'));
  }
  st.close();
  console.log('failures:', bad);
  process.exitCode = bad ? 1 : 0;
})();
