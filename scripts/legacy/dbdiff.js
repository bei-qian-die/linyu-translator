'use strict';
const fs = require('fs');
const initSqlJs = require('sql.js');
const { requireAppClosed } = require('../lib/app-running');
requireAppClosed('legacy/dbdiff.js 真实库比对');
(async () => {
  const SQL = await initSqlJs({ locateFile: (f) => 'node_modules/sql.js/dist/' + f });
  const db = new SQL.Database(fs.readFileSync(process.env.APPDATA + '/linyu-translator/linyu.db'));
  const seed = JSON.parse(fs.readFileSync('src/core/seed.json', 'utf8'));
  const rows = (q) => { const st = db.exec(q); return st.length ? st[0].values.map((r) => r[0]) : []; };
  const ws = rows('SELECT zh FROM words');
  const rs = rows('SELECT pattern FROM rules');
  const sz = new Set(seed.words.map((w) => w.zh));
  const sp = new Set(seed.rules.map((r) => r.pattern));
  console.log('db words', ws.length, 'extra:', ws.filter((w) => !sz.has(w)));
  console.log('db rules', rs.length, 'extra:', rs.filter((p) => !sp.has(p)));
  console.log('missing:', seed.words.filter((w) => !ws.includes(w.zh)).map((w) => w.zh), seed.rules.filter((r) => !rs.includes(r.pattern)).map((r) => r.pattern));
})();
