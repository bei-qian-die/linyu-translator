'use strict';

// 第十八轮附带的工程修复：把纯数据的 lore-extraN.js 重新序列化成紧凑格式。
//
// 为什么需要：微信小程序主包有 2MB 硬上限，而 build-weapp-data.mjs 是把 src/core 里的文件
// 原样复制过去的（这样「字节一致」的跨端同步测试才有意义）。所以真正省体积只能压缩源文件本身。
// 这些文件都是纯数据（cards/quotes/heroes），两空格缩进白占约 30% 体积，压成紧凑 JSON 不改变语义。
//
// 安全措施：写盘前后各 require 一次，深比较必须完全相等，否则回滚并报错。
//
// 用法: node scripts/compact-lore18.js [文件名...]   默认压缩 9/10/13/14/16/18
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEFAULTS = ['lore-extra9.js', 'lore-extra10.js', 'lore-extra13.js', 'lore-extra14.js', 'lore-extra16.js', 'lore-extra18.js'];
const files = process.argv.slice(2).filter((x) => !x.startsWith('--')).length
  ? process.argv.slice(2).filter((x) => !x.startsWith('--'))
  : DEFAULTS;

let saved = 0;
for (const name of files) {
  const p = path.join(ROOT, 'src/core', name);
  if (!fs.existsSync(p)) {
    console.error(`[跳过] ${name} 不存在`);
    continue;
  }
  const before = fs.readFileSync(p, 'utf8');
  const beforeBytes = Buffer.byteLength(before);

  // 从原文里找出浏览器端的全局名（window.LORE_EXTRA9 之类），压缩后要原样保留
  const g = before.match(/window\.(LORE_EXTRA\d+)\s*=/);
  const globalName = g ? g[1] : 'LORE_EXTRA' + (name.match(/(\d+)/) || [, ''])[1];

  delete require.cache[require.resolve(p)];
  const data = require(p);
  const snapshot = JSON.stringify(data);

  const body =
    '// @ts-check\n' +
    `'use strict';\n` +
    `// 纯数据文件（词卡 / 名言 / 人物）。由 scripts/compact-lore18.js 压成紧凑格式以压小程序主包体积，\n` +
    `// 内容与压缩前完全一致（脚本内置深比较校验）。原始生成器见同轮次的 apply-lore*.js。\n` +
    'const __export = ' +
    JSON.stringify(data) +
    ';\n' +
    "if (typeof module === 'object' && module.exports) module.exports = __export;\n" +
    `else if (typeof window !== 'undefined') window.${globalName} = __export;\n`;

  fs.writeFileSync(p, body, 'utf8');

  // 校验：重新加载必须与快照完全一致
  delete require.cache[require.resolve(p)];
  const after = JSON.stringify(require(p));
  if (after !== snapshot) {
    fs.writeFileSync(p, before, 'utf8');
    console.error(`[回滚] ${name} 压缩后数据不一致，已还原`);
    process.exitCode = 1;
    continue;
  }
  const afterBytes = Buffer.byteLength(body);
  saved += beforeBytes - afterBytes;
  console.error(`[ok] ${name} ${(beforeBytes / 1024).toFixed(0)}KB → ${(afterBytes / 1024).toFixed(0)}KB  (global=${globalName})`);
}
console.error(`[compact18] 合计省下 ${(saved / 1024).toFixed(0)}KB`);
