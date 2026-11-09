#!/usr/bin/env node
/*
 * npm run weapp:size
 *
 * 上传前体检：按 app.json 的分包配置 + project.config.json 的 packOptions.ignore，
 * 统计主包与每个分包实际会被打进代码包的文件体积。
 *
 * 微信硬限：单个主包 / 单个分包 ≤ 2MB，所有包合计 ≤ 30MB。
 * 1.5MB 只是官方性能优化建议线，不拦截上传。
 *
 * 「源码」列是判定依据（保守口径，对应开发者工具里的编译后大小）；
 * 「压缩估算」只是传输体积参考，微信上传并不按 gzip 判定，别拿它当过关依据。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MP = path.join(ROOT, 'miniprogram');
const LIMIT = 2 * 1024 * 1024;
const WARN = 1.5 * 1024 * 1024;
const TOTAL_LIMIT = 30 * 1024 * 1024;

const app = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
const proj = JSON.parse(fs.readFileSync(path.join(MP, 'project.config.json'), 'utf8'));
const rules = (proj.packOptions && proj.packOptions.ignore) || [];
const roots = (app.subPackages || app.subpackages || []).map((p) => p.root.replace(/[\\/]+$/, ''));

const toUnix = (p) => p.split(path.sep).join('/');

function isIgnored(rel) {
  const unix = toUnix(rel);
  return rules.some((r) => {
    const v = toUnix(r.value).replace(/\/$/, '');
    if (r.type === 'file') return unix === v;
    if (r.type === 'folder') return unix === v || unix.startsWith(v + '/');
    if (r.type === 'suffix') return unix.endsWith(r.value);
    if (r.type === 'prefix') return path.basename(unix).startsWith(r.value);
    return false;
  });
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const all = walk(MP).map((abs) => ({ abs, rel: path.relative(MP, abs) }));
// 云函数由 cloudfunctionRoot 单独上传，不计入小程序代码包
const cloudRoot = toUnix(proj.cloudfunctionRoot || 'cloudfunctions/').replace(/\/$/, '');
const ignored = all.filter((f) => isIgnored(f.rel));
const code = all.filter(
  (f) => !toUnix(f.rel).startsWith(cloudRoot + '/') && !isIgnored(f.rel)
);

const compressed = (f) => {
  const buf = fs.readFileSync(f.abs);
  if (/\.(webp|png|jpe?g|gif|ico|mp3|wav)$/i.test(f.rel)) return buf.length;
  return zlib.gzipSync(buf, { level: 9 }).length;
};

const groups = [
  {
    name: '主包',
    files: code.filter((f) => !roots.some((r) => toUnix(f.rel).startsWith(r + '/'))),
  },
  ...roots.map((r) => ({
    name: r,
    files: code.filter((f) => toUnix(f.rel).startsWith(r + '/')),
  })),
];

const mb = (b) => (b / 1024 / 1024).toFixed(2) + 'MB';
const pad = (s, n) => String(s).padEnd(n, ' ');

console.log('微信小程序代码包体检（硬限：单包 2.00MB，合计 30MB；建议线 1.50MB）');
console.log(pad('包', 18) + pad('文件', 8) + pad('源码', 12) + pad('压缩估算', 12) + '判定');
console.log('-'.repeat(64));

let failed = false;
let total = 0;
for (const g of groups) {
  const raw = g.files.reduce((a, f) => a + fs.statSync(f.abs).size, 0);
  const zip = g.files.reduce((a, f) => a + compressed(f), 0);
  total += raw;
  const mark = raw > LIMIT ? '超限 ✗' : raw > WARN ? '过线 ⚠' : '合格 ✓';
  if (raw > LIMIT) failed = true;
  console.log(pad(g.name, 18) + pad(g.files.length, 8) + pad(mb(raw), 12) + pad(mb(zip), 12) + mark);
}
console.log('-'.repeat(64));
console.log(pad('合计', 18) + pad(code.length, 8) + pad(mb(total), 12) + '');
if (ignored.length) {
  const n = ignored.reduce((a, f) => a + fs.statSync(f.abs).size, 0);
  console.log(`packOptions.ignore 已排除 ${ignored.length} 个文件 / ${mb(n)}`);
}
if (total > TOTAL_LIMIT) {
  console.log('总包超过 30MB ✗');
  failed = true;
}
console.log('注：以微信开发者工具「上传」面板显示的大小为准；压缩估算仅供参考。');
process.exit(failed ? 1 : 0);
