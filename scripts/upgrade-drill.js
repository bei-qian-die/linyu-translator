'use strict';

// 升级演练：造一个「旧版本」的库（内容缺一大截、还留着这版已剔除的条目），
// 用打包后的 exe 打开一次，确认主进程的版本迁移把内容补齐、把剔除项清掉，且不动用户自建数据。
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const initSqlJs = require('sql.js');
const { createDb } = require('../src/core/db');
const fullSeed = require('../src/core/seed.json');
const lore = require('../src/core/lore');

const UNPACKED = path.join(__dirname, '..', 'release', 'win-unpacked');
const EXE = fs.readdirSync(UNPACKED).find((f) => f.endsWith('.exe'));
const PROFILE = path.join(os.tmpdir(), 'ly-upgrade-profile');
const GONE_WORD = '真的假的';
const GONE_RULE = '(?:笑死|笑翻|乐死)';
const GONE_CARD = '满命';
const GONE_QUOTE = '有点像杨幂。';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  fs.mkdirSync(PROFILE, { recursive: true });
  const dbFile = path.join(PROFILE, 'linyu.db');

  // 造旧库：只给一半内置内容，再塞进这版已经剔除的词条/句式/梗/名言，外加一条用户自建的
  const oldSeed = { words: fullSeed.words.slice(0, 60), rules: fullSeed.rules.slice(-20) };
  const oldLore = {
    flashcards: lore.flashcards.slice(0, 40),
    quotes: lore.quotes.slice(0, 40),
    heroes: lore.heroes.slice(0, 10),
  };
  let st = await createDb({ filePath: dbFile, seed: oldSeed, lore: oldLore });
  st.addWord(GONE_WORD, '珍哒假哒');
  st.addRule(GONE_RULE, '孝死本可惹', '旧句式');
  st.addCard({ term: GONE_CARD, meaning: '上一版还收着的梗' });
  st.addQuote({ text: GONE_QUOTE, author: '上一版' });
  st.addWord('用户自建词', '自建噜');
  st.addCard({ term: '用户自建卡', meaning: '开发者自己加的' });
  st.setSetting('content.version', '1.4.0');
  const before = {
    words: st.getWords().length,
    rules: st.getRules().length,
    cards: st.getCards().length,
    quotes: st.getQuotes().length,
    heroes: st.getHeroes().length,
  };
  st.close();
  console.log('旧库', JSON.stringify(before));

  const child = spawn(path.join(UNPACKED, EXE), [`--user-data-dir=${PROFILE}`, '--no-sandbox'], {
    cwd: UNPACKED,
    stdio: 'ignore',
    detached: true,
  });
  console.log('启动 ' + EXE + ' pid=' + child.pid);
  await sleep(15000);
  spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  await sleep(1500);

  const SQL = await initSqlJs({
    locateFile: (f) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', f),
  });
  const db = new SQL.Database(fs.readFileSync(dbFile));
  const one = (sql) => (db.exec(sql)[0] ? db.exec(sql)[0].values : []);
  const count = (t) => Number(one('SELECT COUNT(*) FROM ' + t)[0][0]);
  const has = (sql) => one(sql).length > 0;
  const after = { words: count('words'), rules: count('rules'), cards: count('cards'), quotes: count('quotes'), heroes: count('heroes') };
  console.log('升级后', JSON.stringify(after));
  console.log('剔除项已清走', !has(`SELECT 1 FROM words WHERE zh='${GONE_WORD}'`) && !has(`SELECT 1 FROM rules WHERE pattern='${GONE_RULE}'`) && !has(`SELECT 1 FROM cards WHERE term='${GONE_CARD}'`) && !has(`SELECT 1 FROM quotes WHERE body='${GONE_QUOTE}'`));
  console.log('用户自建还在', has(`SELECT 1 FROM words WHERE zh='用户自建词'`) && has(`SELECT 1 FROM cards WHERE term='用户自建卡'`));
  console.log('新句式排在最前', one('SELECT pattern FROM rules ORDER BY id LIMIT 1')[0][0] === fullSeed.rules[0].pattern);
  console.log('版本号', one("SELECT v FROM settings WHERE k='content.version'")[0][0]);

  const expect = {
    words: fullSeed.words.length + 1,
    rules: fullSeed.rules.length,
    cards: lore.flashcards.length + 1,
    quotes: lore.quotes.length,
    heroes: lore.heroes.length,
  };
  console.log('对得上新版内置量', JSON.stringify(after) === JSON.stringify(expect), JSON.stringify(expect));
  db.close();
})();
