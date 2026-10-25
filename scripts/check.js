'use strict';

// 聚合校验：一条命令跑完「引擎测试 + 数据层测试 + 业务层测试 + CRUD 契约 + 语料溯源 + 语法检查」。
// 打包前必须全绿；语料溯源（attest）的 unattested 必须为 0，这是本项目的硬约束。
//
// 旧实现用 steps.every(...)，第一个失败就短路，后面的步骤根本不跑——
// 于是「数据层用例」或「CRUD 契约」一挂，语法问题和溯源问题就被静默跳过，
// 看上去只是少了几行输出。现在全部并行跑完，再统一打印、统一退出。
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname ? path.join(__dirname, '..') : process.cwd();
// 语料统一放在 corpus/ 下，根目录不再堆十几份 txt。
// 目录不存在时回退到旧布局（扫根目录），免得中途切分支时 check 直接报找不到语料。
function corpusFiles() {
  const dir = path.join(ROOT, 'corpus');
  if (fs.existsSync(dir)) {
    return fs
      .readdirSync(dir)
      .filter((f) => /^corpus.*\.txt$/.test(f))
      .sort()
      .map((f) => path.posix.join('corpus', f));
  }
  return fs
    .readdirSync(ROOT)
    .filter((f) => /^corpus.*\.txt$/.test(f))
    .sort();
}
const corpus = corpusFiles().join(',');

/** 跑一个步骤，完整收下它的输出，等它自己结束 */
function run(label, args, extraArgs) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, extraArgs || args, { cwd: ROOT });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => resolve({ label, code: 127, out, err: err + String(e), ms: Date.now() - started }));
    child.on('close', (code) => resolve({ label, code, out, err, ms: Date.now() - started }));
  });
}

/** 语法检查：遍历 src/scripts/test，逐个 node --check */
async function syntaxCheck() {
  const files = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (name === 'legacy' || name === 'node_modules' || name === 'release' || name === 'node_modules') continue;
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.js')) files.push(full);
    }
  };
  for (const dir of ['src', 'scripts', 'test']) walk(path.join(ROOT, dir));
  const bad = [];
  const CONCURRENCY = 8;
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY);
    const res = await Promise.all(batch.map((f) => run('syntax', ['--check', f], ['--check', f])));
    res.forEach((r, j) => { if (r.code !== 0) bad.push({ file: batch[j], err: r.err }); });
  }
  return { label: '语法检查', code: bad.length ? 1 : 0, out: `${files.length - bad.length}/${files.length} 个文件通过`, err: bad.map((b) => 'x 语法错误：' + path.relative(ROOT, b.file) + (b.err ? ' ' + b.err.trim() : '')).join('\n'), ms: 0 };
}

/** 语料溯源：unattested 必须为 0 */
async function attest() {
  const r = await run('语料溯源', ['scripts/attest.js', corpus], ['scripts/attest.js', corpus]);
  const text = r.out + r.err;
  // attest 会先逐板块报 unattested，再报一次「合计 unattested N」。
  // 把所有数字加起来会把合计重复计一次（曾误报成 688，实际 344），所以只取最后一个。
  const counts = [...text.matchAll(/unattested (\d+)/g)].map((m) => Number(m[1]));
  const total = counts.length ? counts[counts.length - 1] : 0;
  const err = r.err + (r.code !== 0 && total > 0 ? `x 还有 ${total} 条内容在语料里找不到依据，详见 attest.txt` : '');
  return { label: '语料溯源（unattested 必须为 0）', code: r.code !== 0 || total > 0 ? 1 : 0, out: r.out, err, ms: r.ms };
}

(async () => {
  const jobs = [
    run('翻译引擎用例', ['test/core.test.js']),
    run('数据层用例', ['test/db.test.js']),
    run('业务层用例', ['test/service.test.js']),
    run('五板块 CRUD 契约', ['scripts/crud-check.js']),
    attest(),
    syntaxCheck(),
  ];

  const results = await Promise.all(jobs);

  // 统一打印：按固定顺序输出，不受并行完成先后影响
  let allOk = true;
  for (const r of results) {
    console.log(`\n== ${r.label} ==`);
    if (r.out && r.out.trim()) process.stdout.write(r.out.endsWith('\n') ? r.out : r.out + '\n');
    if (r.err && r.err.trim()) process.stderr.write(r.err.endsWith('\n') ? r.err : r.err + '\n');
    if (r.code !== 0) {
      console.error(`x ${r.label} 失败（退出码 ${r.code}${r.ms ? '，耗时 ' + (r.ms / 1000).toFixed(1) + 's' : ''}）`);
      allOk = false;
    }
  }

  console.log(allOk ? '\n全部检查通过 ♥' : '\n有检查没通过，先看上面的 x 行');
  process.exitCode = allOk ? 0 : 1;
})();
