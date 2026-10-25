#!/usr/bin/env node
/*
 * npm run web:build
 *
 * 把渲染层 + 核心 + Web 入口 + 第三方依赖拼成静态站（./www-web）。
 * 管线完全复制 build-mobile.mjs，仅替换以下元件：
 *   - mobile/entry.js → web/webEntry.js（IndexedDB 优先 + Web 特有适配）
 *   - 增加 web/idbAdapter.js（IndexedDB 文件适配器）
 *   - 产物目录改为 www-web
 *   - index.html 替换为 Web 版本（加载顺序微调 + 持久化警告条）
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { wrapDirInIIFE } from './lib/wrap-iife.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'www-web');

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

async function contentHash(files) {
  const h = createHash('sha256');
  for (const f of files.slice().sort()) {
    h.update(f);
    h.update(await fs.readFile(path.join(root, f), 'utf8'));
  }
  return h.digest('hex').slice(0, 16);
}

// 检查需跳过的脚本（entry 由 webEntry 替代；app.js 带 Vue，在 vm 里跑不了）
const SKIP_IN_CHECK = new Set(['web/entry.js', 'app.js', 'web/webEntry.js', 'web/patch-app.js']);
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
    throw new Error('[bundle-check] www-web 资源在共用作用域下加载失败：\n' +
      failed.map((f) => '  ' + f).join('\n') +
      (missing.length ? '\n  缺失全局: ' + missing.join(', ') : ''));
  }
  console.log(`[build-web] bundle check ok: ${stat.seed} 词条 / ${stat.cards} 词卡 / ${stat.quotes} 名言 / ${stat.heroes} 人物 @ ${stat.version} (${stat.hash})`);
}

async function main() {
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));

  await rimraf(out);
  await fs.mkdir(out, { recursive: true });

  // 渲染层：从 src/renderer/ 复制（需要做 Web 适配的改造）
  await copyDir(path.join(root, 'src', 'renderer'), out);

  // 核心模块
  await copyDir(path.join(root, 'src', 'core'), path.join(out, 'core'));

  // 移动入口（只用 fsAdapter + scrypt + api；entry 换成 webEntry）
  const mobileSrc = path.join(root, 'src', 'mobile');
  const mobileDst = path.join(out, 'mobile');
  await fs.mkdir(mobileDst, { recursive: true });
  // 只复制 fsAdapter、scrypt、api，跳过 entry
  for (const name of ['fsAdapter.js', 'scrypt.js', 'api.js']) {
    await copyFile(path.join(mobileSrc, name), path.join(mobileDst, name));
  }

  // Web 入口：web/idbAdapter.js + web/webEntry.js + web/patch-app.js + web/web.css 放进 web/ 目录
  const webSrc = path.join(root, 'src', 'web');
  const webDst = path.join(out, 'web');
  await fs.mkdir(webDst, { recursive: true });
  for (const name of ['idbAdapter.js', 'webEntry.js', 'patch-app.js', 'web.css']) {
    await copyFile(path.join(webSrc, name), path.join(webDst, name));
  }

  // 每个 core/ mobile/ web/ 文件包进 IIFE
  await wrapDirInIIFE(path.join(out, 'core'));
  await wrapDirInIIFE(path.join(out, 'mobile'));
  await wrapDirInIIFE(path.join(out, 'web'));

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
      console.warn('[build-web] missing dependency:', src);
      throw err;
    }
  }

  // seed-data.js + seed.json（与 build-mobile.mjs 一致）
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
  ];
  const hash = await contentHash(contentFiles);
  const seedJs = `// 由 scripts/build-web.mjs 自动生成；source: src/core/seed.json\n` +
    `window.__SEED_DATA = ${seedJsonText};\n` +
    `window.LINYU_VERSION = ${JSON.stringify(pkg.version)};\n` +
    `window.LINYU_CONTENT_HASH = ${JSON.stringify(hash)};\n`;
  await fs.writeFile(path.join(out, 'seed-data.js'), seedJs, 'utf8');
  await copyFile(seedJsonPath, path.join(out, 'seed.json'));

  // ---- Web 版 index.html：替换 <script> 加载顺序 ----
  // 用 src/renderer/index.html 作为基础，移除 Capacitor 特有脚本，加入 web/ 入口
  let html = await fs.readFile(path.join(out, 'index.html'), 'utf8');

  // 删除 mobile/entry.js 引用行，换成 web/ 的
  html = html.replace(
    /<script src="mobile\/entry\.js"><\/script>/,
    '<script src="web/idbAdapter.js"></script>\n  <script src="web/webEntry.js"></script>'
  );

  // 在 <body> 后立即插入持久化警告条（IndexedDB 不可用时显示）
  html = html.replace(
    /<body>/,
    `<body>\n  <div class="persistence-warning" id="persistence-warning" style="display:none">\n    <span>数据仅保留在当前会话，刷新页面后不保留</span>\n    <button class="pw-dismiss" onclick="this.parentElement.style.display='none'">知道了</button>\n  </div>`
  );

  // 在 index.html 的 <title> 后添加 OG meta 与 favicon
  html = html.replace(
    '</title>',
    '</title>\n  <meta name="description" content="中文转淋语在线翻译器，纯本地翻译，不上传任何数据。收录词库1178条、句式350条、词卡794张、人物传207位、名言2078条。" />\n' +
    '  <meta property="og:title" content="淋语翻译器" />\n' +
    '  <meta property="og:description" content="中文 → 淋语在线翻译器，纯本地、不联网、不传数据" />\n' +
    '  <meta property="og:type" content="website" />\n' +
    '  <link rel="icon" href="data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'><rect width=\'32\' height=\'32\' rx=\'8\' fill=\'%23e64fa2\'/><text x=\'16\' y=\'22\' text-anchor=\'middle\' font-size=\'18\' fill=\'white\'>淋</text></svg>" />'
  );

  // CSP 放宽 blink: 用于 IndexedDB（Blob URL 存储图片时需要）
  html = html.replace(
    /img-src 'self' data: blob: content:/,
    'img-src \'self\' data: blob: content:;'
  );

  // CSP 放宽 blink: 用于 IndexedDB（Blob URL 存储图片时需要）
  html = html.replace(
    /img-src 'self' data: blob: content:/,
    'img-src \'self\' data: blob: content:;'
  );

  // 在 style.css 后追加 web.css
  html = html.replace(
    /<link rel="stylesheet" href="style\.css" \/>/,
    '<link rel="stylesheet" href="style.css" />\n  <link rel="stylesheet" href="web/web.css" />'
  );

  // 在 app.js 之后追加 Web 适配脚本 patch-app.js
  html = html.replace(
    /<script src="app\.js"><\/script>/,
    '<script src="app.js"></script>\n  <script src="web/patch-app.js"></script>'
  );

  await fs.writeFile(path.join(out, 'index.html'), html, 'utf8');

  // 版本信息
  await fs.writeFile(path.join(out, 'version.json'), JSON.stringify({ version: pkg.version, name: pkg.name, target: 'web' }, null, 2));

  // 检查 bundle
  await checkBundle();

  console.log('[build-web] www-web/ built at', out);
}

main().catch((err) => {
  console.error('[build-web] failed:', err);
  process.exit(1);
});