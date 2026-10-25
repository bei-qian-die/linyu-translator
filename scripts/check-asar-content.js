'use strict';
// 核对打包出来的 app.asar 内部内容（asar 是自定义格式，用 @electron/asar 读）。
const fs = require('fs');
const os = require('os');
const path = require('path');
const asar = require('@electron/asar');

const ROOT = path.join(__dirname, '..');
const ASAR = process.argv[2] || path.join(ROOT, 'release-1160/win-unpacked/resources/app.asar');

const norm = (p) => p.replace(/\//g, path.sep).replace(/^\/*/, '');

// extractAll 最稳（asar 内部用平台分隔符，逐路径 extract 在 Windows 上容易对不上）
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'asarchk-'));
asar.extractAll(ASAR, TMP);
const readIn = (rel) => fs.readFileSync(path.join(TMP, rel), 'utf8');
const existsIn = (rel) => fs.existsSync(path.join(TMP, rel));

const pkgJson = JSON.parse(readIn('package.json'));
console.log('asar 内 package.json version:', pkgJson.version);

const seed = JSON.parse(readIn(path.join('src', 'core', 'seed.json')));
const srcSeed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
console.log(
  `asar 内 seed: 词库 ${seed.words.length} / 句式 ${seed.rules.length}；与 src/core/seed.json 一致:`,
  seed.words.length === srcSeed.words.length && seed.rules.length === srcSeed.rules.length ? '是' : '否'
);

const files = asar.listPackage(ASAR).map((f) => f.replace(/\//g, path.sep).replace(/^\\/, ''));
const png = files.filter((f) => /^src\\renderer\\img\\hero-\d+\.png$/.test(f));
const jpg = files.filter((f) => /^src\\renderer\\img\\hero-\d+\.jpg$/.test(f));
const webp = files.filter((f) => /^src\\renderer\\img\\thumb\\hero-\d+\.webp$/.test(f));
console.log(
  `asar 内人物图: PNG ${png.length} + JPG ${jpg.length} = ${png.length + jpg.length} | 缩略图 webp ${webp.length}`
);

for (const f of [
  'src/core/lore-extra11.js',
  'src/core/lore-extra12.js',
  'src/core/lore.js',
  'src/renderer/index.html',
]) {
  console.log(`  ${existsIn(f) ? '有' : '缺'} ${f}`);
}

const html = readIn(path.join('src', 'renderer', 'index.html'));
console.log('index.html 挂载 extra11:', html.includes('core/lore-extra11.js'));
console.log('index.html 挂载 extra12:', html.includes('core/lore-extra12.js'));

// 新人物配图是否都进了包
const NEW = [
  '罗玉凤', '英中啊英中', 'FLY组合', '张元英', '杨玉环', '孙尚香', '百里守约',
  '青行灯', '黑天鹅', '陈', '青子', '琴女', '本吧英雄绰号大科普', '聊赠一枝竹',
  '杯糕姐', '淋形针LinerClip',
];
const lore = require(path.join(ROOT, 'src/core/lore'));
let miss = 0;
for (const n of NEW) {
  const h = lore.heroes.find((x) => x.name === n);
  if (!h || !h.img) { console.log('  !! 缺人物或缺图:', n); miss++; continue; }
  // heroes[].img 存的是相对 src/renderer/ 的路径（'img/hero-N.png'）
  const p = norm(path.join('src', 'renderer', h.img));
  if (!existsIn(p)) { console.log('  !! 缺图文件:', p, n); miss++; }
}
console.log(`本轮 ${NEW.length} 位新人物配图入包检查: ${miss ? miss + ' 项缺失' : '全部在包内'}`);

// exe 版本号
const exe = ASAR.replace(/[\\/]resources[\\/]app\.asar$/, '');
console.log('\nasar 所在目录:', exe);
