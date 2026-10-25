'use strict';
// 生成一批「字面量路径」的 rm 命令（可恢复删除通道只认字面量目标）。
// 用法: node scripts/emit-rm-cmd.js <dir> [out.txt] [batchSize]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const dir = path.resolve(ROOT, process.argv[2]);
const out = process.argv[3] || path.join(ROOT, 'cmd-rm.txt');
const batch = Number(process.argv[4] || 40);

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(p);
  }
})(dir);

const chunks = [];
for (let i = 0; i < files.length; i += batch) chunks.push(files.slice(i, i + batch));

const lines = chunks.map((c) => 'rm -- ' + c.map((p) => `"${p}"`).join(' '));
fs.writeFileSync(out, lines.join('\n'), 'utf8');
console.log(`${dir}: ${files.length} 个文件 -> ${chunks.length} 条命令，写入 ${out}`);
