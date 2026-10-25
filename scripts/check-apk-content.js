'use strict';
// 核对 APK 内 assets/public 的内容是否与当前数据一致（不装包也能验证）。
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const APK = process.argv[2] || path.join(ROOT, 'android/app/build/outputs/apk/debug/app-debug.apk');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'apkchk-'));

const ps = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z=[System.IO.Compression.ZipFile]::OpenRead('${APK.replace(/'/g, "''")}')
$z.Entries | Where-Object { $_.FullName -like 'assets/public/*' -and ($_.FullName -match 'seed-data\\.js|version\\.json|core/lore-extra1[12]\\.js|core/lore\\.js') } | ForEach-Object { $_.FullName }
$z.Dispose()
`;
const list = execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter((x) => x.trim());

console.log('APK 内相关文件:');
for (const f of list) console.log('  ' + f);

if (!list.some((f) => /seed-data\.js$/.test(f))) {
  console.error('!! APK 里没有 assets/public/seed-data.js');
  process.exit(1);
}

// 解出 seed-data.js 检查条数与版本
const ps2 = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z=[System.IO.Compression.ZipFile]::OpenRead('${APK.replace(/'/g, "''")}')
$e=$z.Entries | Where-Object { $_.FullName -eq 'assets/public/seed-data.js' }
$out='${TMP.replace(/'/g, "''")}\\seed-data.js'
[System.IO.Compression.ZipFileExtensions]::ExtractToFile($e,$out,$true)
$z.Dispose()
`;
execFileSync('powershell', ['-NoProfile', '-Command', ps2], { encoding: 'utf8' });
const txt = fs.readFileSync(path.join(TMP, 'seed-data.js'), 'utf8');
const words = (txt.match(/"zh":/g) || []).length;
const rules = (txt.match(/"pattern":/g) || []).length;
const ver = /window\.LINYU_VERSION = "([^"]+)"/.exec(txt);
const hash = /window\.LINYU_CONTENT_HASH = "([^"]+)"/.exec(txt);
console.log(`\nAPK 内 seed-data.js: 词库 ${words} / 句式 ${rules}`);
console.log('版本:', ver && ver[1], '| 内容指纹:', hash && hash[1]);

const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
console.log(
  '与 src/core/seed.json 一致:',
  words === seed.words.length && rules === seed.rules.length ? '是' : '否（源 ' + seed.words.length + '/' + seed.rules.length + '）'
);
console.log('临时目录:', TMP);
