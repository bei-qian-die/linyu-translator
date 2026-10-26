// 把 PC 端（electron userData）本地库升级到 1.19.0 的内容基准：
//   1) 删掉 15 条旧的游戏分区句式（模板带「，启动！」）
//   2) 按新版 seed 插入新句式，并把 rules 顺序排回 seed 顺序
//   3) settings.content.version 写成 1.19.0，避免下次启动再跑一遍迁移
// 改动前先复制一份 linyu.db.bak-1126 原件，脚本可重复执行（幂等）。
'use strict';
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB = 'C:/Users/qiuzh/AppData/Roaming/linyu-translator/linyu.db';
const BACKUP = DB + '.pre-1190';
const ROOT = path.join(__dirname, '..');
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'core', 'seed.json'), 'utf8'));
const dep = require('../src/core/deprecated.js');

(async () => {
  if (!fs.existsSync(BACKUP)) {
    fs.copyFileSync(DB, BACKUP);
    console.log('已备份原件 ->', BACKUP);
  } else {
    console.log('备份已存在，跳过备份');
  }

  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(fs.readFileSync(DB)));

  const del = db.prepare('DELETE FROM rules WHERE pattern = ?');
  let removed = 0;
  for (const p of dep.rules) {
    del.run([p]);
    removed += db.getRowsModified();
  }
  del.free();
  console.log('删除旧句式', removed, '条');

  const ins = db.prepare(
    'INSERT OR IGNORE INTO rules (pattern, template, note, scene, examples, src) VALUES (?, ?, ?, ?, ?, ?)'
  );
  let added = 0;
  for (const r of seed.rules) {
    ins.run([r.pattern, r.template, r.note || '', r.scene || '', r.examples || '', r.src || '']);
    added += db.getRowsModified();
  }
  ins.free();
  console.log('补入新句式', added, '条');

  // 按 seed 顺序重排 id（两段式，避开主键冲突）
  const rows = [];
  const st = db.prepare('SELECT id, pattern FROM rules ORDER BY id');
  while (st.step()) rows.push(st.getAsObject());
  st.free();
  const rank = new Map(seed.rules.map((r, i) => [r.pattern, i]));
  const last = Number.MAX_SAFE_INTEGER;
  const sorted = rows.slice().sort((a, b) => {
    const ra = rank.has(a.pattern) ? rank.get(a.pattern) : last;
    const rb = rank.has(b.pattern) ? rank.get(b.pattern) : last;
    return ra !== rb ? ra - rb : a.id - b.id;
  });
  const neg = db.prepare('UPDATE rules SET id = ? WHERE id = ?');
  sorted.forEach((r, i) => neg.run([-(i + 1), r.id]));
  neg.free();
  const pos = db.prepare('UPDATE rules SET id = ? WHERE id = ?');
  sorted.forEach((r, i) => pos.run([i + 1, -(i + 1)]));
  pos.free();
  db.run("UPDATE sqlite_sequence SET seq = (SELECT MAX(id) FROM rules) WHERE name = 'rules'");
  console.log('句式重排', sorted.length, '条');

  db.run("INSERT INTO settings (k, v) VALUES ('content.version', '1.19.0') ON CONFLICT(k) DO UPDATE SET v = '1.19.0'");

  // 校验：库里是否还有带「启动」的模板
  const chk = db.exec("SELECT COUNT(*) FROM rules WHERE template LIKE '%启动%'");
  console.log('残留带启动模板:', chk[0].values[0][0]);
  const total = db.exec('SELECT COUNT(*) FROM rules');
  console.log('句式总数:', total[0].values[0][0], '(seed', seed.rules.length, ')');

  fs.writeFileSync(DB, Buffer.from(db.export()));
  console.log('已写回', DB);
})();
