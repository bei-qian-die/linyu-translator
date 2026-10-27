'use strict';
// lore-extra 登记一致性闸门
//
// 背景（1.26.0 事故）：第 23 轮新增了 src/core/lore-extra23.js，
// lore.js 里也写了 `const extra23 = unpack(... window.LORE_EXTRA23 ...)`，
// 但 src/renderer/index.html 忘了登记 <script src="core/lore-extra23.js">。
//
// 后果是「静默半失效」：
//   - Node 端走 require 分支 → extra23 正常加载 → 串图闸门/单测全绿；
//   - 浏览器端走 window 分支 → window.LORE_EXTRA23 为 undefined
//     → unpack(undefined) 返回空表 → extra23.heroMerge（132 条换图映射）一条都没生效；
//   - 132 张新图躺在磁盘上，线上/桌面端配图仍是旧的。
// 换句话说：文件到位 ≠ 数据到位，而任何只校验「文件在不在」的闸门都查不出来。
//
// 本闸门交叉校验两侧，做的是「引用了但没登记」这种差集：
//   A = lore.js 里出现的 LORE_EXTRAxx
//   B = index.html 里登记的 <script src="core/lore-extraNN.js">
//   A \ B → 致命（数据静默丢失）
//   B \ A → 致命（脚本加载了但没人用，白占体积）
// 另外校验：登记的脚本文件必须真实存在于 src/core/ 下（避免 404）。
//
// 退出码：存在差集或文件缺失返回 1。

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LORE_JS = path.join(ROOT, 'src/core/lore.js');
const INDEX_HTML = path.join(ROOT, 'src/renderer/index.html');
const CORE_DIR = path.join(ROOT, 'src/core');

// ---- A: lore.js 引用的 LORE_EXTRAxx ----
const loreSrc = fs.readFileSync(LORE_JS, 'utf8');
const referenced = new Set();
for (const m of loreSrc.matchAll(/\bLORE_EXTRA(\d+)\b/g)) {
  referenced.add(m[1]);
}

// ---- B: index.html 登记的 lore-extraNN.js ----
const html = fs.readFileSync(INDEX_HTML, 'utf8');
const registered = new Map(); // NN -> 文件名
for (const m of html.matchAll(/<script\s+src="core\/lore-extra(\d+)\.js"\s*><\/script>/g)) {
  registered.set(m[1], `lore-extra${m[1]}.js`);
}

// ---- C: src/core 下实际存在的 lore-extra*.js ----
const onDisk = new Set();
for (const name of fs.readdirSync(CORE_DIR)) {
  const m = /^lore-extra(\d+)\.js$/.exec(name);
  if (m) onDisk.add(m[1]);
}

const missingReg = [...referenced].filter((n) => !registered.has(n)).sort();
const orphanReg = [...registered.keys()].filter((n) => !referenced.has(n)).sort();
const missingFile = [...registered.keys()].filter((n) => !onDisk.has(n)).sort();
const notRegistered = [...onDisk].filter((n) => !registered.has(n)).sort();

console.log('=== lore-extra 登记一致性检查 ===');
console.log(
  'lore.js 引用', referenced.size, '| index.html 登记', registered.size,
  '| src/core 实存', onDisk.size
);

// 引用了但没登记 —— 这类最致命：Node 端能跑，浏览器端静默丢数据
if (missingReg.length) {
  console.error('  [致命] lore.js 引用但 index.html 未登记：' + missingReg.map((n) => `LORE_EXTRA${n}`).join('、'));
  console.error('         → 浏览器端 window.LORE_EXTRA%s 为 undefined，该轮数据整轮丢失', missingReg[0]);
}

// 登记了但 lore.js 没用 —— 白加载，白占包体
if (orphanReg.length) {
  console.error('  [致命] index.html 登记但 lore.js 未引用：' + orphanReg.map((n) => `lore-extra${n}.js`).join('、'));
}

// 登记了但文件不存在 —— 浏览器 404
if (missingFile.length) {
  console.error('  [致命] index.html 登记但文件不存在：' + missingFile.map((n) => `lore-extra${n}.js`).join('、'));
}

// 文件在磁盘但没登记 —— 和 missingReg 同源，这类通常才是真正的漏网之鱼
if (notRegistered.length) {
  console.error('  [致命] src/core 下存在但 index.html 未登记：' + notRegistered.map((n) => `lore-extra${n}.js`).join('、'));
}

if (missingReg.length || orphanReg.length || missingFile.length || notRegistered.length) {
  console.error('存在登记不一致，退出码 1');
  process.exit(1);
}
console.log('全部通过：引用与登记完全一致（' + [...referenced].sort((a, b) => a - b).map((n) => 'extra' + n).join(' ') + '）');
