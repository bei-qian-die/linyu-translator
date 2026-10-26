#!/usr/bin/env node
/*
 * npm run mobile:build
 *
 * 把桌面渲染层（src/renderer/）+ 核心（src/core/）+ 移动入口（src/mobile/）+ 第三方依赖
 * 拼成 Capacitor 的 webDir（./www）。不做 bundler：每页 <script src=""> 直接载入。
 *
 *   www/
 *     index.html          ← src/renderer/index.html（末尾追加脚本加载顺序）
 *     style.css           ← src/renderer/style.css
 *     app.js              ← src/renderer/app.js
 *     seed.json           ← src/core/seed.json
 *     core/               ← src/core/*.js（auth / db / lore*）
 *     mobile/             ← src/mobile/*.js（fsAdapter / scrypt / api / entry）
 *     vendor/             ← sql-wasm.js, sql-wasm.wasm, scrypt.js, vue.global.prod.js
 *
 * core/ 与 mobile/ 的每个文件都会被包一层 IIFE：普通 <script> 共享同一个全局词法作用域，
 * lore-extra3..9 都写 `const cards`、tokenizer 与 translator 都写 buildTokenizer，第二个起
 * 就是 SyntaxError: Identifier has already been declared → 整个文件被丢掉，WebView 里表现为
 * 「词库/词卡/人物全是空的，但桌面 exe 正常」（桌面走 require，每个模块自带作用域）。
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { wrapDirInIIFE } from './lib/wrap-iife.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'www');

async function rimraf(p) {
  try { await fs.rm(p, { recursive: true, force: true }); } catch {}
}
async function copyFile(src, dst) {
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.copyFile(src, dst);
}
async function copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  const ents = await fs.readdir(src, { withFileTypes: true });
  for (const e of ents) {
    const sp = path.join(src, e.name);
    const dp = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(sp, dp);
    else await copyFile(sp, dp);
  }
}

// 内置内容指纹：同一版本号下改了 seed/lore 也要让老库补种，所以按源文件内容算而不是只认版本。
async function contentHash(files) {
  const h = createHash('sha256');
  for (const f of files.slice().sort()) {
    h.update(f);
    h.update(await fs.readFile(path.join(root, f), 'utf8'));
  }
  return h.digest('hex').slice(0, 16);
}

// 加载顺序直接读 index.html 里的 <script src>，这样构建检查测的就是真机上那一套顺序；
// vendor（vue / sql-wasm / scrypt-js）与 app.js 要真实浏览器环境，entry.js 会立刻拉起整条
// 初始化链，三个都跳过——检查范围是 core/ 与 mobile/ 这几个纯 JS。
const SKIP_IN_CHECK = new Set(['mobile/entry.js', 'app.js']);
const NEEDS_BEFORE = { 'core/db.js': ['fsAdapter'] };

async function bundleOrderFromIndex() {
  const html = await fs.readFile(path.join(out, 'index.html'), 'utf8');
  const list = [];
  for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) {
    const rel = m[1];
    if (rel.startsWith('vendor/') || SKIP_IN_CHECK.has(rel)) continue;
    list.push(rel);
  }
  if (!list.length) throw new Error('[bundle-check] index.html 里没解析到 <script src>');
  return list;
}

async function checkBundle() {
  const order = await bundleOrderFromIndex();
  const ctx = vm.createContext({ console: { log() {}, warn() {}, error() {} } });
  vm.runInContext('var window = globalThis; window.self = window;', ctx);
  const failed = [];
  for (const rel of order) {
    for (const need of NEEDS_BEFORE[rel] || []) {
      if (vm.runInContext(`typeof window[${JSON.stringify(need)}]`, ctx) !== 'object') {
        failed.push(`${rel} 加载时 window.${need} 还没挂上（index.html 的 <script> 顺序不对）`);
      }
    }
    const code = await fs.readFile(path.join(out, rel), 'utf8');
    try {
      vm.runInContext(code, ctx, { filename: rel });
    } catch (err) {
      failed.push(`${rel}: ${err.message}`);
    }
  }
  const got = vm.runInContext(
    `JSON.stringify({` +
    `seed: (window.__SEED_DATA||{}).words && window.__SEED_DATA.words.length || 0,` +
    `version: window.LINYU_VERSION || '',` +
    `hash: window.LINYU_CONTENT_HASH || '',` +
    `cards: (window.LORE_DATA||{}).flashcards ? window.LORE_DATA.flashcards.length : 0,` +
    `quotes: (window.LORE_DATA||{}).quotes ? window.LORE_DATA.quotes.length : 0,` +
    `heroes: (window.LORE_DATA||{}).heroes ? window.LORE_DATA.heroes.length : 0,` +
    `createDb: typeof window.createDb,` +
    `createAuth: typeof window.createAuth,` +
    `api: typeof (window.linyuApi||{}).createApi,` +
    `translator: typeof window.LINYU_TRANSLATOR,` +
    `deprecated: typeof window.LINYU_DEPRECATED})`,
    ctx
  );
  const stat = JSON.parse(got);
  const missing = [];
  if (!stat.seed) missing.push('seed.words');
  if (!stat.cards || !stat.quotes || !stat.heroes) missing.push(`LORE_DATA(cards=${stat.cards},quotes=${stat.quotes},heroes=${stat.heroes})`);
  if (stat.createDb !== 'function') missing.push('createDb');
  if (stat.createAuth !== 'function') missing.push('createAuth');
  if (stat.api !== 'function') missing.push('linyuApi.createApi');
  if (stat.translator !== 'object') missing.push('LINYU_TRANSLATOR');
  if (stat.deprecated !== 'object') missing.push('LINYU_DEPRECATED');
  if (!stat.hash || !stat.version) missing.push('LINYU_VERSION/LINYU_CONTENT_HASH');
  if (failed.length || missing.length) {
    throw new Error('[bundle-check] www 资源在共用作用域下加载失败：\n' +
      failed.map((f) => '  ' + f).join('\n') +
      (missing.length ? '\n  缺失全局: ' + missing.join(', ') : ''));
  }
  console.log(`[build-mobile] bundle check ok: ${stat.seed} 词条 / ${stat.cards} 词卡 / ${stat.quotes} 名言 / ${stat.heroes} 人物 @ ${stat.version} (${stat.hash})`);
}

async function main() {
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));

  await rimraf(out);
  await fs.mkdir(out, { recursive: true });

  // 渲染层
  await copyDir(path.join(root, 'src', 'renderer'), out);

  // 核心模块（deprecated.js 也带上：它只往 window.LINYU_DEPRECATED 挂剔除名单，db.js 的
  // require 分支在浏览器里走不到，之前删掉它反而让 index.html 的 <script> 404）
  await copyDir(path.join(root, 'src', 'core'), path.join(out, 'core'));

  // 移动入口
  await copyDir(path.join(root, 'src', 'mobile'), path.join(out, 'mobile'));

  // 每个 core/ mobile/ 文件包进 IIFE，避免普通 <script> 共用全局作用域时 const 撞名
  await wrapDirInIIFE(path.join(out, 'core'));
  await wrapDirInIIFE(path.join(out, 'mobile'));

  // vendor
  const vendor = path.join(out, 'vendor');
  await fs.mkdir(vendor, { recursive: true });
  const copies = [
    [path.join(root, 'node_modules', 'vue', 'dist', 'vue.global.prod.js'), path.join(vendor, 'vue.global.prod.js')],
    [path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.js'), path.join(vendor, 'sql-wasm.js')],
    [path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'), path.join(vendor, 'sql-wasm.wasm')],
    [path.join(root, 'node_modules', 'scrypt-js', 'scrypt.js'), path.join(vendor, 'scrypt.js')],
  ];
  for (const [src, dst] of copies) {
    try { await copyFile(src, dst); }
    catch (err) {
      console.warn('[build-mobile] missing dependency:', src);
      throw err;
    }
  }

  // seed.json 直接在 www/ 根：entry.js 的 fetch('seed.json')
  // 注意：某些 Android WebView 引擎（特别是模拟器里的 Chromium）会拦 fetch('seed.json')，
  // 所以同步把 JSON 内联成一个同步加载的脚本，避免依赖 fetch。
  // 版本号与内容指纹也一并内联：移动版没有 app.getVersion()，写死的版本串会让老库
  // 永远等不到内容迁移（见 entry.js 的 content.hash 判定）。
  const seedJsonPath = path.join(root, 'src', 'core', 'seed.json');
  const seedJsonText = await fs.readFile(seedJsonPath, 'utf8');
  const contentFiles = [
    'src/core/seed.json',
    'src/core/deprecated.js',
    'src/core/lore.js',
    'src/core/lore-extra3.js',
    'src/core/lore-extra4.js',
    'src/core/lore-extra5.js',
    'src/core/lore-extra6.js',
    'src/core/lore-extra7.js',
    'src/core/lore-extra8.js',
    'src/core/lore-extra9.js',
    'src/core/lore-extra10.js',
    'src/core/lore-extra11.js',
    'src/core/lore-extra12.js',
    'src/core/lore-extra13.js',
    'src/core/lore-extra14.js',
    'src/core/lore-extra16.js',
    'src/core/lore-extra18.js',
    'src/core/lore-extra19.js',
    'src/core/lore-extra15.js',
  ];
  const hash = await contentHash(contentFiles);
  const seedJs = `// 由 scripts/build-mobile.mjs 自动生成；source: src/core/seed.json\n` +
    `window.__SEED_DATA = ${seedJsonText};\n` +
    `window.LINYU_VERSION = ${JSON.stringify(pkg.version)};\n` +
    `window.LINYU_CONTENT_HASH = ${JSON.stringify(hash)};\n`;
  await fs.writeFile(path.join(out, 'seed-data.js'), seedJs, 'utf8');
  // 仍然保留一份 seed.json，方便开发时手动 fetch 调试
  await copyFile(seedJsonPath, path.join(out, 'seed.json'));

  // 最后写一份 version.json 给 entry.js 用（可选）
  await fs.writeFile(path.join(out, 'version.json'), JSON.stringify({ version: pkg.version, name: pkg.name }, null, 2));

  await checkBundle();

  console.log('[build-mobile] www/ built at', out);
}

main().catch((err) => {
  console.error('[build-mobile] failed:', err);
  process.exit(1);
});
