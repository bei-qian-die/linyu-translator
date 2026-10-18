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
 *     core/               ← src/core/*.js（auth / db / translator / lore*）
 *     mobile/             ← src/mobile/*.js（fsAdapter / scrypt / api / entry）
 *     vendor/             ← sql-wasm.js, sql-wasm.wasm, scrypt.js, vue.global.prod.js
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

async function main() {
  await rimraf(out);
  await fs.mkdir(out, { recursive: true });

  // 渲染层
  await copyDir(path.join(root, 'src', 'renderer'), out);

  // 核心模块（排除 deprecated.js 已被合并到 db.js / lore.js；lore*.js / tokenizer / translator 全要）
  await copyDir(path.join(root, 'src', 'core'), path.join(out, 'core'));
  // 删除 deprecated 独立文件，避免影响 db.js 的 require('./deprecated') 在浏览器路径上读不到（db.js 走 window.LINYU_DEPRECATED）
  await rimraf(path.join(out, 'core', 'deprecated.js'));

  // 移动入口
  await copyDir(path.join(root, 'src', 'mobile'), path.join(out, 'mobile'));

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
  await copyFile(path.join(root, 'src', 'core', 'seed.json'), path.join(out, 'seed.json'));

  // 最后写一份 version.json 给 entry.js 用（可选）
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  await fs.writeFile(path.join(out, 'version.json'), JSON.stringify({ version: pkg.version, name: pkg.name }, null, 2));

  console.log('[build-mobile] www/ built at', out);
}

main().catch((err) => {
  console.error('[build-mobile] failed:', err);
  process.exit(1);
});
