'use strict';

// 冒烟：直接跑打包后的 exe（独立 user-data-dir，不碰用户真实库），
// 确认进程活着、sqlite 里八张表齐全且内置内容已播种，然后杀掉进程。
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const initSqlJs = require('sql.js');

const UNPACKED = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'release', 'win-unpacked');
const EXE = fs.readdirSync(UNPACKED).find((f) => f.endsWith('.exe'));
const PROFILE = path.join(os.tmpdir(), 'ly-smoke-profile');
const TABLES = ['words', 'rules', 'history', 'cards', 'quotes', 'heroes', 'settings', 'deleted'];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const childEnv = { ...process.env };
  // Qoder/IDE 的终端常带 ELECTRON_RUN_AS_NODE=1；不清掉的话 exe 会按 Node 跑，
  // main.js 里 app 是 undefined，启动即退出，看起来像冒烟失败。
  delete childEnv.ELECTRON_RUN_AS_NODE;
  const child = spawn(path.join(UNPACKED, EXE), [`--user-data-dir=${PROFILE}`, '--no-sandbox'], {
    cwd: UNPACKED,
    env: childEnv,
    stdio: 'ignore',
    detached: true,
  });
  console.log('启动 ' + EXE + ' pid=' + child.pid);
  await sleep(12000);

  const dbFile = path.join(PROFILE, 'linyu.db');
  if (!fs.existsSync(dbFile)) {
    console.log('失败：没生成 ' + dbFile);
  } else {
    console.log('库文件 ' + (fs.statSync(dbFile).size / 1024).toFixed(0) + ' KB');
    const SQL = await initSqlJs({
      locateFile: (f) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', f),
    });
    const db = new SQL.Database(fs.readFileSync(dbFile));
    const names = db
      .exec("SELECT name FROM sqlite_master WHERE type='table'")[0].values.map((v) => v[0]);
    const counts = {};
    for (const t of TABLES) counts[t] = names.includes(t) ? Number(db.exec('SELECT COUNT(*) FROM ' + t)[0].values[0][0]) : -1;
    console.log('表计数', JSON.stringify(counts));
    console.log('缺失表', TABLES.filter((t) => !names.includes(t)).join(',') || '无');
    console.log('默认开发者账号', db.exec("SELECT v FROM settings WHERE k='dev_user'")[0]?.values[0]?.[0] || '(未播种)');
    db.close();
  }

  const { spawnSync } = require('child_process');
  spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  await sleep(1500);
  console.log('已停止冒烟进程');
})();
