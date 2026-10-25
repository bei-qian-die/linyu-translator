'use strict';
// 把 release-1160/win-unpacked 的完整内容覆盖到 release/win-unpacked。
//
// 为什么需要这一步：release/win-unpacked 这个目录被某个进程占着（EBUSY），
// 既不能改名也不能删（mavis-trash 的 DeleteDirectory 也报 "system call level is not
// correct"），所以整目录替换走不通；但目录里的文件本身是可写的，
// 于是按文件覆盖，等效于「用新版本替换旧版本」。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'release-1160', 'win-unpacked');
const DST = path.join(ROOT, 'release', 'win-unpacked');

let copied = 0;
let failed = 0;

function walk(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) walk(s, d);
    else {
      try {
        fs.copyFileSync(s, d);
        copied++;
      } catch (err) {
        failed++;
        console.error(`  [fail] ${path.relative(ROOT, d)}: ${err.code}`);
      }
    }
  }
}

walk(SRC, DST);
console.log(`已覆盖 ${copied} 个文件，失败 ${failed} 个`);

// 核对覆盖结果
const asar = require('@electron/asar');
const A = path.join(DST, 'resources', 'app.asar');
const pkg = JSON.parse(asar.extractFile(A, 'package.json').toString('utf8'));
console.log('release/win-unpacked/resources/app.asar 的 package.json version:', pkg.version);

const exe = path.join(DST, '淋语翻译器.exe');
console.log('release/win-unpacked/淋语翻译器.exe 存在:', fs.existsSync(exe));
console.log(
  'release/win-unpacked 文件数:',
  (function count(d) {
    let n = 0;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      n += e.isDirectory() ? count(path.join(d, e.name)) : 1;
    }
    return n;
  })(DST)
);
