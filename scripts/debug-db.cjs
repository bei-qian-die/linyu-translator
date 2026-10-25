'use strict';
/*
 * 数据层端到端诊断（Node，无需浏览器）
 *
 * 冒烟测试只断言全局变量挂载，从没真正调用过 createDb —— 所以「词库 0 条」这类
 * 问题一直没被自动化抓到。本脚本在 vm 里按 index.html 的顺序加载全部脚本，
 * 用内存 fsAdapter 真正调一次 createDb，然后打印每张表的条数。
 *
 * 用法：node scripts/debug-db.cjs
 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'www-web');

const ctx = vm.createContext({
  console,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  ArrayBuffer,
  Promise,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Date,
  Math,
  JSON,
  Object,
  Array,
  String,
  Number,
  Boolean,
  Function,
  Error,
  TypeError,
  URIError,
  SyntaxError,
  RangeError,
  ReferenceError,
  Map,
  Set,
  WeakMap,
  WeakSet,
  RegExp,
  Intl,
  URL,
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
});

vm.runInContext('var window = globalThis; window.self = window;', ctx);

// ---- 内存 fsAdapter：模拟 sessionStorage 落盘（异步接口，和 IndexedDB 同形） ----
const files = new Map();
const memAdapter = {
  kind: 'memory',
  dirOf: (p) => { const i = String(p).lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); },
  basenameOf: (p) => { const i = String(p).lastIndexOf('/'); return i < 0 ? p : p.slice(i + 1); },
  async read(p) { return files.has(p) ? new Uint8Array(files.get(p)) : new Uint8Array(0); },
  async write(p, b) { files.set(p, b instanceof Uint8Array ? b : new Uint8Array(b)); },
  async unlink(p) { files.delete(p); },
  async exists(p) { return files.has(p); },
  async rename(a, b) { if (!files.has(a)) return; files.set(b, files.get(a)); files.delete(a); },
  async copy(a, b) { if (files.has(a)) files.set(b, files.get(a)); },
  async readdir() { return []; },
  async stat(p) { const v = files.get(p); return { size: v ? v.length : 0, mtime: new Date().toISOString() }; },
  async mkdirp() {},
};

vm.runInContext(`
  window.document = {
    readyState: 'complete',
    baseURI: 'http://localhost/',
    body: { classList: { add() {}, remove() {} }, dataset: {} },
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    dispatchEvent() {},
    createElement() { return { classList: { add() {} }, setAttribute() {}, appendChild() {}, addEventListener() {}, style: {} }; },
  };
  window.location = { hash: '', search: '', href: 'http://localhost/', pathname: '/', origin: 'http://localhost' };
  window.history = { replaceState() {}, pushState() {} };
  window.navigator = {};
  window.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {}, key() { return null; }, length: 0, clear() {} };
  window.sessionStorage = { getItem() { return null; }, setItem() {}, removeItem() {}, key() { return null; }, length: 0, clear() {} };
  window.CustomEvent = function (name, opts) { return { name, detail: (opts || {}).detail }; };
  window.indexedDB = undefined;
`, ctx);

// sql.js 由 Node 提供，wasm 指向 node_modules 里的真实文件
const sqlJsDist = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist');
const initSqlJsNode = require('sql.js');
ctx.window.initSqlJs = (opts) =>
  initSqlJsNode({ locateFile: (f) => path.join(sqlJsDist, f) });

// 注意：mobile/fsAdapter.js 加载时会把 window.fsAdapter 换成 capacitor 版，
// 所以内存适配器必须在它之后、core/db.js 之前挂上（db.js 在加载时就捕获 fsAdapter）。
const orderBeforeAdapter = [
  'vendor/scrypt.js',
  'seed-data.js',
  'mobile/fsAdapter.js',
  'mobile/scrypt.js',
];
const orderAfterAdapter = [
  'core/deprecated.js',
  'core/lore-extra3.js', 'core/lore-extra4.js', 'core/lore-extra5.js',
  'core/lore-extra6.js', 'core/lore-extra7.js', 'core/lore-extra8.js',
  'core/lore-extra9.js', 'core/lore-extra10.js', 'core/lore-extra11.js',
  'core/lore-extra12.js', 'core/lore-extra13.js', 'core/lore-extra14.js',
  'core/lore.js',
  'core/tokenizer.js',
  'core/translator.js',
  'core/db.js',
  'core/auth.js',
  'core/service.js',
  'mobile/api.js',
];

console.log('加载脚本…');
for (const f of orderBeforeAdapter) {
  const code = fs.readFileSync(path.join(buildDir, f), 'utf8');
  try {
    vm.runInContext(code, ctx, { filename: f });
  } catch (err) {
    console.error(`  ERR ${f}: ${err.message}`);
    process.exit(1);
  }
}

// 换成本机内存适配器（模拟浏览器端被 webEntry 换成 idbAdapter 的时机）
ctx.window.fsAdapter = memAdapter;

for (const f of orderAfterAdapter) {
  const code = fs.readFileSync(path.join(buildDir, f), 'utf8');
  try {
    vm.runInContext(code, ctx, { filename: f });
  } catch (err) {
    console.error(`  ERR ${f}: ${err.message}`);
    process.exit(1);
  }
}

(async () => {
  console.log('全局检查：');
  console.log('  __SEED_DATA.words =', ctx.__SEED_DATA && ctx.__SEED_DATA.words ? ctx.__SEED_DATA.words.length : 'MISSING');
  console.log('  __SEED_DATA.rules =', ctx.__SEED_DATA && ctx.__SEED_DATA.rules ? ctx.__SEED_DATA.rules.length : 'MISSING');
  console.log('  LORE_DATA.flashcards =', ctx.LORE_DATA && ctx.LORE_DATA.flashcards ? ctx.LORE_DATA.flashcards.length : 'MISSING');
  console.log('  fsAdapter.kind =', ctx.window.fsAdapter && ctx.window.fsAdapter.kind);
  console.log('  LINYU_VERSION =', ctx.LINYU_VERSION);

  console.log('\n调用 createDb…');
  let db;
  try {
    db = await ctx.createDb({
      filePath: 'linyu.db',
      seed: ctx.__SEED_DATA,
      lore: ctx.LORE_DATA,
      version: ctx.LINYU_VERSION || 'test',
      onPersistError: (stage, err) => console.log(`  [persistError:${stage}]`, err && err.message),
    });
  } catch (err) {
    console.error('createDb 抛错：', err);
    process.exit(1);
  }

  console.log('\n--- 首次建库（空盘）---');
  console.log('  words   =', db.getWords().length);
  console.log('  rules   =', db.getRules().length);
  console.log('  cards   =', db.getCards().length);
  console.log('  quotes  =', db.getQuotes().length);
  console.log('  heroes  =', db.getHeroes().length);

  // 等 persist 队列跑完
  await new Promise((r) => setTimeout(r, 1500));
  console.log('\n落盘文件：');
  for (const [k, v] of files) console.log(`  ${k}  ${v.length} bytes`);

  console.log('\n--- 模拟刷新：用落盘文件重建 ---');
  const db2 = await ctx.createDb({
    filePath: 'linyu.db',
    seed: ctx.__SEED_DATA,
    lore: ctx.LORE_DATA,
    version: ctx.LINYU_VERSION || 'test',
    onPersistError: (stage, err) => console.log(`  [persistError:${stage}]`, err && err.message),
  });
  console.log('  words   =', db2.getWords().length);
  console.log('  cards   =', db2.getCards().length);
  console.log('  quotes  =', db2.getQuotes().length);
  console.log('  heroes  =', db2.getHeroes().length);

  // 模拟 webEntry 的 upgradeSeed 分支
  try {
    const hash = ctx.LINYU_CONTENT_HASH || '';
    const curV = db2.getSetting('content.version');
    const curH = db2.getSetting('content.hash');
    console.log('\n  content.version 记录 =', JSON.stringify(curV), ' 期望 =', JSON.stringify(db2.version));
    console.log('  content.hash 记录 =', JSON.stringify(curH), ' 期望 =', JSON.stringify(hash));
    if (curV !== db2.version || curH !== hash) {
      const r = db2.upgradeSeed();
      console.log('  upgradeSeed 结果 =', JSON.stringify(r));
      console.log('  upgrade 后 words =', db2.getWords().length, ' cards =', db2.getCards().length);
    }
  } catch (err) {
    console.log('  upgradeSeed 抛错：', err.message);
  }
})();
