// 桌面端渲染层资源准备脚本
//
// 背景（1.12.4 引入的回归）：src/renderer/index.html 的 <script src> 是「www 自洽布局」
// 的相对路径（vendor/ seed-data.js core/ mobile/ app.js），这套布局只有 npm run
// mobile:build 生成的 www/ 才有。桌面端（npm start 和 electron-builder 打包）直接用
// src/renderer/ 目录，里面没有这些文件 → vendor/vue.global.prod.js 404 → app.js 里
// `const { createApp } = Vue` 抛 ReferenceError → Vue 永不挂载 → 窗口显示未渲染的
// {{ }} 模板，看起来像"卡死"。
//
// 本脚本把渲染层需要的资源铺进 src/renderer/，dev（npm start）与打包共用同一份：
//   vendor/     ← node_modules 的 vue / sql.js / scrypt-js
//   core/       ← src/core/*.js + seed.json（浏览器全局版，与 www/core 一致；不含 dist/）
//   mobile/     ← src/mobile/*.js
//   seed-data.js ← src/core/seed.json 生成（window.__SEED_DATA = ...）
//
// 全部是生成物，进 .gitignore；幂等，每次运行全量重建。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wrapDirInIIFE } from './lib/wrap-iife.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const renderer = path.join(root, 'src', 'renderer');

async function exists(p) {
  try { await fs.promises.access(p); return true; } catch { return false; }
}

async function copy(src, dest) {
  if (!(await exists(src))) throw new Error(`[prepare-desktop] 源文件不存在: ${src}`);
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.copyFile(src, dest);
}

async function copyDir(srcDir, destDir, filter) {
  const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
  await fs.promises.mkdir(destDir, { recursive: true });
  for (const e of entries) {
    if (filter && !filter(e.name)) continue;
    const s = path.join(srcDir, e.name);
    const d = path.join(destDir, e.name);
    if (e.isDirectory()) await copyDir(s, d, filter);
    else await copy(s, d);
  }
}

async function main() {
  // 0) 清掉旧的生成目录，保证没有陈旧文件残留
  for (const dir of ['vendor', 'core', 'mobile'].map((d) => path.join(renderer, d))) {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }

  // 1) vendor：vue / sql.js(wasm) / scrypt-js
  const vendor = path.join(renderer, 'vendor');
  await copy(path.join(root, 'node_modules', 'vue', 'dist', 'vue.global.prod.js'), path.join(vendor, 'vue.global.prod.js'));
  await copy(path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.js'), path.join(vendor, 'sql-wasm.js'));
  await copy(path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'), path.join(vendor, 'sql-wasm.wasm'));
  await copy(path.join(root, 'node_modules', 'scrypt-js', 'scrypt.js'), path.join(vendor, 'scrypt.js'));

  // 2) core：浏览器全局版（index.html 按文件名逐个 <script> 引用，必须铺平在 core/ 下）
  //    复制后每个 .js 包一层 IIFE —— 普通 <script> 共享全局词法作用域，而多个 lore-extra*.js
  //    都在顶层声明 const cards/quotes/heroes，不隔离的话第二个文件起直接 SyntaxError。
  const coreSrc = path.join(root, 'src', 'core');
  const coreDst = path.join(renderer, 'core');
  await copyDir(coreSrc, coreDst, (name) => /\.js$/.test(name) || name === 'seed.json');
  await wrapDirInIIFE(coreDst);

  // 3) mobile（同样包 IIFE）
  const mobileDst = path.join(renderer, 'mobile');
  await copyDir(path.join(root, 'src', 'mobile'), mobileDst);
  await wrapDirInIIFE(mobileDst);

  // 4) seed-data.js：与 build-mobile.mjs 生成格式保持一致
  const seedJson = await fs.promises.readFile(path.join(coreSrc, 'seed.json'), 'utf8');
  const seedJs = '// 由 scripts/prepare-desktop.mjs 自动生成；source: src/core/seed.json\n'
    + `window.__SEED_DATA = ${seedJson};\n`;
  await fs.promises.writeFile(path.join(renderer, 'seed-data.js'), seedJs, 'utf8');

  console.log('[prepare-desktop] renderer assets ready at', renderer);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
