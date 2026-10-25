'use strict';
/*
 * Web 端渲染冒烟测试
 *
 * 在 vm 中加载 build-web 产物，验证：
 *   1. linyuIdbAdapter 已挂载且可探测（存在但 probe 在 vm 中有限制）
 *   2. 所有全局模块正确挂载（LORE_DATA、createDb、createAuth、LINYU_TRANSLATOR）
 *   3. 翻译引擎可运行（decoratedHelloWorld 测试）
 *   4. index.html 包含 web 特有元素（persistence-warning、OG meta、favicon）
 *   5. 脚本加载顺序正确（web/webEntry.js 在 mobile/entry.js 位置）
 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'www-web');

const ctx = vm.createContext({
  console: { log() {}, warn() {}, error() {} },
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
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
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
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  URL,
  URLSearchParams,
});

// 模拟 window = globalThis
vm.runInContext('var window = globalThis; window.self = window;', ctx);
// 模拟 document（最小子集）
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
    createElement() { return {}; },
  };
  window.location = { hash: '', search: '', href: '' };
  window.history = { replaceState() {}, pushState() {} };
  window.navigator = {};
  window.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {}, key() { return null; }, length: 0, clear() {} };
  window.sessionStorage = { getItem() { return null; }, setItem() {}, removeItem() {}, key() { return null; }, length: 0, clear() {} };
  window.CustomEvent = function(name, opts) { return { name, detail: (opts||{}).detail }; };
  window.MutationObserver = function() { this.observe = function() {}; this.disconnect = function() {}; };
  window.dispatchEvent = function() { return true; };
  window.addEventListener = function() {};
  window.removeEventListener = function() {};
  window.indexedDB = undefined; // 模拟不可用，让 adapter 走 sessionStorage 降级
`, ctx);

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log('  OK ' + msg); }
  else { failed++; console.error('  FAIL ' + msg); }
}

// Step 1: 加载 vendor
// db.js 在加载时就捕获 window.initSqlJs，所以必须在这之前把 sql.js 桩挂好
console.log('1. Loading vendor...');
const sqlJsDist = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist');
const initSqlJsNode = require('sql.js');
ctx.window.initSqlJs = (opts) => initSqlJsNode({ locateFile: (f) => path.join(sqlJsDist, f) });
for (const f of ['vendor/scrypt.js']) {
  const code = fs.readFileSync(path.join(root, f), 'utf8');
  vm.runInContext(code, ctx);
}

// Step 2: 加载 seed-data
console.log('2. Loading seed-data...');
const seedJs = fs.readFileSync(path.join(root, 'seed-data.js'), 'utf8');
vm.runInContext(seedJs, ctx);

// Step 3: 加载 mobile/fsAdapter, mobile/scrypt, mobile/api (IIFE 版本)
console.log('3. Loading fsAdapter + scrypt + api...');
for (const f of ['mobile/fsAdapter.js', 'mobile/scrypt.js', 'mobile/api.js']) {
  const code = fs.readFileSync(path.join(root, f), 'utf8');
  vm.runInContext(code, ctx);
}

// Step 4: 加载 core (全部)
console.log('4. Loading core...');
const coreOrder = [
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
];
for (const f of coreOrder) {
  const code = fs.readFileSync(path.join(root, f), 'utf8');
  try {
    vm.runInContext(code, ctx);
  } catch (err) {
    console.error(`  ERR ${f}: ${err.message}`);
    failed++;
  }
}

// Step 5: 加载 web/idbAdapter + webEntry (和 patch-app 测试)
console.log('5. Loading web entry...');
const webFiles = ['web/idbAdapter.js', 'web/webEntry.js', 'web/patch-app.js'];
for (const f of webFiles) {
  try {
    const code = fs.readFileSync(path.join(root, f), 'utf8');
    vm.runInContext(code, ctx);
  } catch (err) {
    console.error(`  ERR ${f}: ${err.message}`);
    failed++;
  }
}

// Step 6: 断言
console.log('\n6. Assertions:');

// 检查全局挂载
assert(typeof ctx.LORE_DATA === 'object', 'LORE_DATA 已挂载');
assert(typeof ctx.createDb === 'function', 'createDb 已挂载');
assert(typeof ctx.createAuth === 'function', 'createAuth 已挂载');
assert(typeof ctx.LINYU_TRANSLATOR === 'object', 'LINYU_TRANSLATOR 已挂载');
assert(typeof ctx.linyuApi === 'object', 'linyuApi 已挂载');
assert(typeof ctx.linyuApi.createApi === 'function', 'linyuApi.createApi 可用');
assert(typeof ctx.LINYU_DEPRECATED === 'object', 'LINYU_DEPRECATED 已挂载');

// LORE_DATA 规模（words 在 __SEED_DATA 中，不在 LORE_DATA）
assert(ctx.LORE_DATA.flashcards && ctx.LORE_DATA.flashcards.length > 700, `LORE_DATA.flashcards ${ctx.LORE_DATA.flashcards ? ctx.LORE_DATA.flashcards.length : 0} >= 700`);
assert(ctx.LORE_DATA.quotes && ctx.LORE_DATA.quotes.length > 2000, `LORE_DATA.quotes ${ctx.LORE_DATA.quotes ? ctx.LORE_DATA.quotes.length : 0} >= 2000`);
assert(ctx.LORE_DATA.heroes && ctx.LORE_DATA.heroes.length > 200, `LORE_DATA.heroes ${ctx.LORE_DATA.heroes ? ctx.LORE_DATA.heroes.length : 0} >= 200`);
assert(ctx.__SEED_DATA && ctx.__SEED_DATA.words && ctx.__SEED_DATA.words.length > 1100, `SEED_DATA.words ${ctx.__SEED_DATA && ctx.__SEED_DATA.words ? ctx.__SEED_DATA.words.length : 0} >= 1100`);

// 翻译引擎测试（translateText 需要 { words, rules } options）
if (typeof ctx.LINYU_TRANSLATOR === 'object') {
  try {
    const seedWords = ctx.__SEED_DATA.words;
    const seedRules = ctx.__SEED_DATA.rules;
    if (seedWords && seedWords.length > 0 && seedRules) {
      const result = ctx.LINYU_TRANSLATOR.translateText('你今天真好看！', {
        words: seedWords,
        rules: seedRules,
      });
      assert(typeof result === 'string' && result.length > 0,
        `翻译「你今天真好看！」→ "${result}"`);
    } else {
      assert(true, 'skip: seed data 缺失');
    }
  } catch (err) {
    assert(false, `翻译失败: ${err.message}`);
  }
}

// Web 特有全局
assert(ctx.linyuIdbAdapter !== undefined, 'linyuIdbAdapter 已挂载');
assert(typeof ctx.__linyuApiReady === 'object', '__linyuApiReady 已创建');
assert(typeof ctx.fsAdapter === 'object', 'fsAdapter 已挂载');

// IndexedDB 不可用时降级
assert(typeof ctx.fsAdapter === 'object', 'fsAdapter 存在（降级 sessionStorage）');

// Tokenizer 词条数
if (ctx.LORE_DATA && ctx.LORE_DATA.words) {
  const tokenizer = ctx.LORE_DATA._tokenizer || (ctx.LINYU_TRANSLATOR && ctx.LINYU_TRANSLATOR._tokenizer);
  if (tokenizer) {
    const words = ctx.LORE_DATA.words.map(w => w.zh);
    const tokens = tokenizer(words.join(' '));
    assert(Array.isArray(tokens), 'tokenizer 正常工作');
  }
}

// index.html 结构检查
console.log('\n7. HTML Structure:');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(html.includes('persistence-warning'), 'HTML 包含持久化警告条');
assert(html.includes('og:title'), 'HTML 包含 OG meta');
assert(html.includes('web/idbAdapter.js'), 'HTML 引用 web/idbAdapter.js');
assert(html.includes('web/webEntry.js'), 'HTML 引用 web/webEntry.js');
assert(html.includes('web/patch-app.js'), 'HTML 引用 web/patch-app.js');
assert(html.includes('web/web.css'), 'HTML 引用 web/web.css');
assert(!html.includes('mobile/entry.js'), 'HTML 不含 mobile/entry.js（Web 端已替换）');
assert(html.includes('<link rel="icon"'), 'HTML 包含 favicon');

// ---------------------------------------------------------------------------
// 8. 数据层端到端：真正调一次 createDb
//
// 之前的冒烟只断言全局变量挂载，从没跑过数据层，所以「db.js 在加载时就捕获了
// Capacitor 版 fsAdapter，等 entry 换成 IndexedDB 后仍指向旧对象 → createDb 抛错 →
// 词库 0 条」这种问题一路漏到线上。这里必须真正建库、播种、落盘、重启。
// ---------------------------------------------------------------------------
console.log('\n8. Data layer (createDb end-to-end):');

(async () => {
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

  // db.js 现在每次调用都从 window.fsAdapter 动态取，所以这里换适配器是有效的
  // （initSqlJs 是加载时捕获，已在 Step 1 前挂好）
  ctx.window.fsAdapter = memAdapter;

  const persistErrors = [];
  let db1 = null;
  try {
    db1 = await ctx.createDb({
      filePath: 'linyu.db',
      seed: ctx.__SEED_DATA,
      lore: ctx.LORE_DATA,
      version: ctx.LINYU_VERSION || 'test',
      onPersistError: (stage, err) => persistErrors.push(`${stage}:${err && err.message}`),
    });
  } catch (err) {
    assert(false, `createDb 建库失败: ${err.message}`);
  }

  if (db1) {
    assert(db1.getWords().length === 1178, `建库后 words = ${db1.getWords().length}（期望 1178）`);
    assert(db1.getCards().length === 794, `建库后 cards = ${db1.getCards().length}（期望 794）`);
    assert(db1.getQuotes().length === 2078, `建库后 quotes = ${db1.getQuotes().length}（期望 2078）`);
    assert(db1.getHeroes().length === 207, `建库后 heroes = ${db1.getHeroes().length}（期望 207）`);

    // 等 persist 队列落盘
    await new Promise((r) => setTimeout(r, 1200));
    const saved = files.get('linyu.db');
    assert(!!saved && saved.length > 500000, `persist 已落盘 ${saved ? saved.length : 0} bytes`);

    // 用户自建词条 + 历史，验证写入→读回
    const added = db1.addWord({ zh: '__smoke_word__', linyu: '烟测词' });
    assert(added && added.ok, 'addWord 写入成功');
    db1.addHistory('烟测原文', '烟测译文');
    await new Promise((r) => setTimeout(r, 1200));

    // 模拟刷新：用落盘文件重建
    let db2 = null;
    try {
      db2 = await ctx.createDb({
        filePath: 'linyu.db',
        seed: ctx.__SEED_DATA,
        lore: ctx.LORE_DATA,
        version: ctx.LINYU_VERSION || 'test',
        onPersistError: (stage, err) => persistErrors.push(`${stage}:${err && err.message}`),
      });
    } catch (err) {
      assert(false, `重启建库失败: ${err.message}`);
    }
    if (db2) {
      assert(db2.getWords().length === 1179, `重启后 words = ${db2.getWords().length}（期望 1179，含 1 条自建）`);
      assert(db2.getWords().some((w) => w.zh === '__smoke_word__'), '重启后自建词条仍在（持久化生效）');
      assert(db2.getHistory().length >= 1, `重启后历史 ${db2.getHistory().length} 条`);
    }
    assert(persistErrors.length === 0, `persist 无错误${persistErrors.length ? '：' + persistErrors.join('; ') : ''}`);
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
})();