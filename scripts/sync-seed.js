'use strict';

// 把内置内容同步进已存在的本地库（新装用户由 createDb 直接播种）。
// 废弃名单、剔除名单、补种新增、句式重排全部走 db.upgradeSeed()，与 App 启动时的版本迁移同一条路；
// 这个脚本只多做一件 App 故意不做的事：把 seed 里改过写法的词条/句式模板覆盖到本地库。
const path = require('path');
const fs = require('fs');
const { createDb } = require('../src/core/db');
const lore = require('../src/core/lore');
const { requireAppClosed } = require('./lib/app-running');

// 这个脚本会直写用户真实库，App 开着跑等于两个写入方抢同一个文件。
requireAppClosed('sync-seed.js 内置内容同步');

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'seed.json'), 'utf8'));
const dbFile = path.join(process.env.APPDATA, 'linyu-translator', 'linyu.db');

(async () => {
  const store = await createDb({ filePath: dbFile, seed, lore });
  let updated = 0;

  for (const w of seed.words) {
    const exist = store.getWords().find((x) => x.zh === w.zh);
    if (exist && exist.linyu !== w.linyu) {
      store.updateWord(exist.id, w.linyu);
      updated++;
    }
  }
  for (const r of seed.rules) {
    const exist = store.getRules().find((x) => x.pattern === r.pattern);
    if (exist && exist.template !== r.template) {
      store.updateRule(exist.id, r.template, r.note);
      updated++;
    }
  }

  const mig = store.upgradeSeed();
  store.close();
  console.log(`同步完成：清理 ${mig.removed}，补入 ${mig.added}，改写 ${updated}，句式已按 seed 顺序重排 -> ${dbFile}`);

  const after = await createDb({ filePath: dbFile, seed, lore });
  console.log(
    `当前库：${after.getWords().length} 词条 / ${after.getRules().length} 句式 / ${after.getCards().length} 词卡 / ${after.getHeroes().length} 英雄 / ${after.getQuotes().length} 名言`
  );
  after.close();
})();
