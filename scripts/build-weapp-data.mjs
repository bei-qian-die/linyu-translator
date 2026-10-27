// 把桌面/移动端共用的翻译引擎与内容数据同步进微信小程序目录。
// 小程序没有构建链，require 只认 JS，所以 seed.json 会被转成一个导出对象的模块。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

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
  ['lore-extra19.js', 'data/lore-extra19.js'],
  ['lore-extra20.js', 'data/lore-extra20.js'],
  ['lore-extra21.js', 'data/lore-extra21.js'],
  ['lore-extra23.js', 'data/lore-extra23.js'],
  ['lore-extra24.js', 'data/lore-extra24.js'],
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

// ---- lore-extraN.js 走「列式编码」 ----
// 微信小程序主包有 2MB 硬上限。数据长到 1.23MB 的 lore 后，原样复制会直接超限。
// 这些文件都是纯数据，每条都重复写一遍 key 名（term/meaning/example/source…）非常浪费，
// 改成「列名表 + 值数组」后能省约 25% 体积；src/core/lore.js 里的 unpack() 负责还原，
// 上层代码完全感知不到差异。
// 列名不能写死：不同轮次的条目字段并不完全一致（有的带 detail / verify / rel，有的没有），
// 写死一份清单会把额外字段静默丢掉，导致「解码后深比较」必然失败。
// 改成按数组里实际出现过的 key 求并集，保持首次出现顺序。
const unionKeys = (arr) => {
  const keys = [];
  const seen = new Set();
  for (const x of arr) {
    for (const k of Object.keys(x)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  return keys;
};

// ---- 全局字符串表（SST）----
// 列式编码之后，剩下的体积几乎全是「重复出现的同一串字」：
// 同一条 BV 链接在几十条名言里重复、`淋威争锋 / 标题` 这个 scene 重复、卡片 source 与 verify 完全相同。
// 把全项目出现过的字符串去重成一张表，表格单元只存下标，实测能再省 ~200KB。
// 编码约定（只在 __sst=1 的模块里生效）：
//   null            → null
//   string          → 整数下标
//   number/boolean  → {n: 值}
//   array/object    → {a: 值}
const SST = [];
const SST_INDEX = new Map();
const sstPut = (s) => {
  let i = SST_INDEX.get(s);
  if (i === undefined) {
    i = SST.length;
    SST.push(s);
    SST_INDEX.set(s, i);
  }
  return i;
};
const encCell = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return sstPut(v);
  if (typeof v === 'number' || typeof v === 'boolean') return { n: v };
  return { a: v };
};
const packTable = (arr) => {
  const keys = unionKeys(arr);
  return { keys, rows: arr.map((x) => keys.map((kk) => encCell(x[kk]))) };
};

function packMod(mod) {
  // 先把所有非内容字段原样带过去（dropCards / dropQuotes / heroMerge / quoteMerge …），
  // 只把 cards / quotes / heroes 三张表转成列式——漏字段会让 lore.js 在聚合时直接崩。
  const out = { __col: 1, __sst: 1 };
  for (const [k, v] of Object.entries(mod)) {
    if (k === 'cards' || k === 'quotes' || k === 'heroes') continue;
    out[k] = v;
  }
  for (const k of ['cards', 'quotes', 'heroes']) {
    const arr = mod[k];
    if (!Array.isArray(arr)) continue;
    out[k] = packTable(arr);
  }
  return out;
}

const require_ = createRequire(import.meta.url);

// 清掉可能被 lore.js 聚合时 mutate 过的模块缓存：pack 必须是磁盘上的原始内容，
// 否则小程序端会带上 aliasMerge 在运行时追加的别名，与源文件永久对不上。
for (const k of Object.keys(require_.cache)) {
  if (/lore-extra\d+\.js$/.test(k)) delete require_.cache[k];
}

for (const [from, to] of FILES) {
  const src = path.join(SRC_CORE, from);
  const dst = path.join(OUT, to);
  if (/^lore-extra\d+\.js$/.test(from)) {
    delete require_.cache[require_.resolve(src)];
    const packed = packMod(require_(src));
    const banner =
      '// 由 scripts/build-weapp-data.mjs 从 src/core/' + from + ' 生成，勿手改。\n' +
      '// 列式编码（__col=1）：体积比重复 key 名小约 25%，由 src/core/lore.js 的 unpack() 还原。\n';
    if (writeIfChanged(dst, banner + 'module.exports = ' + JSON.stringify(packed) + ';\n')) changed += 1;
    continue;
  }
  let content = fs.readFileSync(src, 'utf8');
  // lore.js 里大段是「为什么这么写」的注释与归类表说明，主包吃紧时这些不参与运行。
  // 只在复制到小程序时裁掉「整行注释 + 纯空行」，主端 src/core/lore.js 保持原样。
  if (from === 'lore.js') {
    content = content
      .split('\n')
      .filter((line) => !/^\s*\/\//.test(line) && line.trim() !== '')
      .map((line) => line.replace(/^\s+/, ''))
      .join('\n');
  }
  if (writeIfChanged(dst, content)) changed += 1;
}

const seedPath = path.join(SRC_CORE, 'seed.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
if (!Array.isArray(seed.words) || !seed.words.length) throw new Error('seed.words 为空');
if (!Array.isArray(seed.rules) || !seed.rules.length) throw new Error('seed.rules 为空');

// seed 也做列式编码：词库 1889 条 + 句式 489 条，每条重复写 zh/linyu/alias/sense/source/pop/slot
// 这些 key 名本身就是大头。小程序端 services/content.js 的 decodeSeed() 负责还原。
// 与 lore-extra 共用同一张全局字符串表（SST），避免两套表各存一份。
const packSeed = (obj) => {
  const out = { __col: 1, __sst: 1 };
  for (const k of ['words', 'rules']) out[k] = packTable(obj[k]);
  return out;
};

const seedModule =
  '// 由 scripts/build-weapp-data.mjs 从 src/core/seed.json 生成，勿手改。\n' +
  '// 列式编码（__col=1）：由 services/content.js 的 decodeSeed() 还原。\n' +
  'module.exports = ' +
  JSON.stringify(packSeed(seed)) +
  ';\n';
if (writeIfChanged(path.join(OUT, 'data', 'seed.js'), seedModule)) changed += 1;

// 全局字符串表必须在所有 pack 之后落盘（下标是追加式的，先写会漏后面新增的串）。
// 单独一个模块，lore.js 与 services/content.js 解码时都 require 它。
const sstModule =
  '// 由 scripts/build-weapp-data.mjs 生成，勿手改。\n' +
  '// 全局字符串表：data/seed.js 与 data/lore-extraN.js 的表格单元存的是这张表的下标。\n' +
  'module.exports = ' +
  JSON.stringify(SST) +
  ';\n';
if (writeIfChanged(path.join(OUT, 'data', '_sst.js'), sstModule)) changed += 1;
console.log(`[weapp] 字符串表 ${SST.length} 条，${(sstModule.length / 1024).toFixed(0)}KB`);

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
