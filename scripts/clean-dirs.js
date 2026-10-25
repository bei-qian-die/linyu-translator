'use strict';
// 把要清理的目录逐个文件交给可恢复删除通道处理，最后再处理空目录。
//
// 为什么不用一条命令删目录：本机 mavis-trash 的 DeleteDirectory 对目录一律报
// "The system call level is not correct"（对文件是好的），所以改成
// 先按文件清空、再删空目录。
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TARGETS = process.argv.slice(2);

function rmOne(target) {
  const r = execFileSync(
    'mavis-trash',
    ['--', target],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return String(r).trim();
}

for (const rel of TARGETS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.log(`[skip] 不存在: ${rel}`);
    continue;
  }
  console.log(`\n[clean] ${rel}`);
  const files = [];
  const dirs = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        dirs.push(p);
        walk(p);
      } else {
        files.push(p);
      }
    }
  })(abs);

  let ok = 0;
  let bad = 0;
  for (const f of files) {
    try {
      rmOne(f);
      ok++;
    } catch (err) {
      bad++;
      if (bad <= 3) console.error(`  [fail] ${path.relative(ROOT, f)}: ${String(err.stderr || err.message).slice(0, 120)}`);
    }
  }
  console.log(`  文件：成功 ${ok} / 失败 ${bad}`);

  // 再从最深层往上删空目录
  for (const d of dirs.sort((a, b) => b.length - a.length)) {
    try {
      rmOne(d);
    } catch {
      /* 空目录也可能失败，留着也不影响交付 */
    }
  }
  try {
    rmOne(abs);
    console.log('  目录已移除');
  } catch (err) {
    console.log(`  目录移除失败（残留空目录）: ${String(err.stderr || err.message).slice(0, 100)}`);
  }
}
