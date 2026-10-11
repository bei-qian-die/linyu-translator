'use strict';
const fs = require('fs');
const initSqlJs = require('sql.js');
const { requireAppClosed } = require('../lib/app-running');
requireAppClosed('legacy/dbq.js 真实库查询');
(async () => {
  const SQL = await initSqlJs({ locateFile: (f) => 'node_modules/sql.js/dist/' + f });
  const db = new SQL.Database(fs.readFileSync(process.env.APPDATA + '/linyu-translator/linyu.db'));
  const dump = (q) => { const st = db.exec(q); return st.length ? st[0].values : []; };
  console.log('words 疯子:', JSON.stringify(dump("SELECT id,zh,linyu FROM words WHERE zh='疯子'")));
  console.log('rules 厉害:', JSON.stringify(dump("SELECT id,pattern,template,note FROM rules WHERE pattern LIKE '%厉害%'")));
})();
