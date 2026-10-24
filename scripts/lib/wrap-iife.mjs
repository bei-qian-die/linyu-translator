// 把目录下每个 .js 包进 IIFE（平级，不递归 —— 与 build-mobile.mjs 原实现一致）。
//
// 为什么需要：这些文件会在浏览器里作为普通 <script> 加载（Electron 渲染层与 Capacitor
// WebView 共用同一份 index.html 的脚本清单）。普通 script 共享同一个全局词法作用域，
// 而 core/*.js 里多个文件都在顶层声明了同名 const（cards / quotes / heroes …），
// 第二个文件开始直接 SyntaxError「Identifier 'cards' has already been declared」，
// 整个文件被丢弃。包 IIFE 后每个文件作用域隔离，只通过 window.XXX 全局交换数据。
// .call(window) 保住顶层 this === window，UMD 的
// `typeof self !== 'undefined' ? self : this` 行为不变。
//
// 幂等：已包装（头部带 __wrap 标记）的文件跳过，重复跑不会嵌套。

import fs from 'node:fs';
import path from 'node:path';

export async function wrapDirInIIFE(dir) {
  const names = (await fs.promises.readdir(dir)).filter((n) => n.endsWith('.js'));
  for (const name of names) {
    const p = path.join(dir, name);
    const code = await fs.promises.readFile(p, 'utf8');
    if (code.startsWith('(function () {\n\'use strict\';\n// __wrap')) continue;
    await fs.promises.writeFile(p, `(function () {\n'use strict';\n// __wrapped by scripts/lib/wrap-iife.mjs\n${code}\n}).call(window);\n`, 'utf8');
  }
  return names;
}
