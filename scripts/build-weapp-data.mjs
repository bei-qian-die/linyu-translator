// 把桌面/移动端共用的翻译引擎与内容数据同步进微信小程序目录。
// 小程序没有构建链，require 只认 JS，所以 seed.json 会被转成一个导出对象的模块。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_CORE = path.join(ROOT, 'src', 'core');
const OUT = path.join(ROOT, 'miniprogram');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const FILES = [
  ['tokenizer.js', 'core/tokenizer.js'],
  ['translator.js', 'core/translator.js'],
  ['lore.js', 'data/lore.js'],
  ['lore-extra3.js', 'data/lore-extra3.js'],
  ['lore-extra4.js', 'data/lore-extra4.js'],
  ['lore-extra5.js', 'data/lore-extra5.js'],
  ['lore-extra6.js', 'data/lore-extra6.js'],
  ['lore-extra7.js', 'data/lore-extra7.js'],
  ['lore-extra8.js', 'data/lore-extra8.js'],
  ['lore-extra9.js', 'data/lore-extra9.js'],
  ['lore-extra10.js', 'data/lore-extra10.js'],
  ['lore-extra11.js', 'data/lore-extra11.js'],
  ['lore-extra12.js', 'data/lore-extra12.js'],
  ['lore-extra13.js', 'data/lore-extra13.js'],
  ['lore-extra14.js', 'data/lore-extra14.js'],
  ['lore-extra16.js', 'data/lore-extra16.js'],
  ['lore-extra18.js', 'data/lore-extra18.js'],
  ['lore-extra15.js', 'data/lore-extra15.js'],
];

function writeIfChanged(file, content) {
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (old === content) return false;
  fs.writeFileSync(file, content, 'utf8');
  return true;
}

fs.mkdirSync(path.join(OUT, 'core'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });

let changed = 0;
for (const [from, to] of FILES) {
  const src = path.join(SRC_CORE, from);
  const dst = path.join(OUT, to);
  const content = fs.readFileSync(src, 'utf8');
  if (writeIfChanged(dst, content)) changed += 1;
}

const seedPath = path.join(SRC_CORE, 'seed.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
if (!Array.isArray(seed.words) || !seed.words.length) throw new Error('seed.words 为空');
if (!Array.isArray(seed.rules) || !seed.rules.length) throw new Error('seed.rules 为空');

const seedModule =
  '// 由 scripts/build-weapp-data.mjs 从 src/core/seed.json 生成，勿手改。\n' +
  'module.exports = ' +
  JSON.stringify(seed) +
  ';\n';
if (writeIfChanged(path.join(OUT, 'data', 'seed.js'), seedModule)) changed += 1;

const lore = await import(pathToFileURL(path.join(SRC_CORE, 'lore.js')).href);
const counts = {
  words: seed.words.length,
  rules: seed.rules.length,
  cards: lore.default.flashcards.length,
  quotes: lore.default.quotes.length,
  heroes: lore.default.heroes.length,
};
// 静态计数模块：app.js / 词库页 tab 计数不再需要 require 整个 lore（约 1.23MB）才能拿到数字。
const countsModule =
  '// 由 scripts/build-weapp-data.mjs 生成，勿手改。\n' +
  'module.exports = ' +
  JSON.stringify(counts, null, 2) +
  ';\n';
if (writeIfChanged(path.join(OUT, 'data', 'counts.js'), countsModule)) changed += 1;

// 版本号单一来源：about 页与 app.globalData.version 不再手写，避免数据升到 1.18 页面还显示 1.13
const versionModule =
  '// 由 scripts/build-weapp-data.mjs 从 package.json 生成，勿手改。\n' +
  'module.exports = ' +
  JSON.stringify(pkg.version) +
  ';\n';
if (writeIfChanged(path.join(OUT, 'data', 'version.js'), versionModule)) changed += 1;

console.log(`[weapp] 已同步 ${changed} 个文件`);
console.log(
  `[weapp] 词库 ${counts.words} / 句式 ${counts.rules} / 词卡 ${counts.cards} / 名言 ${counts.quotes} / 人物 ${counts.heroes}`
);
