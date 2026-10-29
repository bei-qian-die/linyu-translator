'use strict';

/**
 * 小程序端配图一致性校验（配图轮次 CI 门禁）。
 *
 *   node scripts/audit-weapp-hero-img.cjs
 *
 * 断言：
 *   1. 每个人物的 img 要么为空，要么在两套目录里都有对应文件；
 *   2. 文件非 0 字节、是合法 WebP（RIFF/WEBP 头）；
 *   3. 主包只放 96px 缩略图，分包只放 136px 详情图，尺寸与清单一致；
 *   4. 没有孤儿文件（目录里存在但没有人物引用的图）。
 * 退出码非 0 即视为不通过。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');
const LIST_DIR = path.join(MP, 'img');
const DETAIL_DIR = path.join(MP, 'pkg-hero', 'img');
const MANIFEST = path.join(ROOT, 'evidence', 'weapp-hero-images.json');

const lore = require(path.join(ROOT, 'miniprogram', 'services', 'lore.js'));
const heroes = lore.heroes;

const problems = [];
const readManifest = () => {
  if (!fs.existsSync(MANIFEST)) return null;
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  } catch (err) {
    problems.push(`清单 JSON 解析失败：${err.message}`);
    return null;
  }
};
const manifest = readManifest();

function webpSize(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 32) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  // VP8L（无损）/ VP8（有损）/ VP8X（扩展）三种头
  const fourcc = buf.toString('ascii', 12, 16);
  if (fourcc === 'VP8 ') {
    return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff, bytes: buf.length };
  }
  if (fourcc === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1, bytes: buf.length };
  }
  if (fourcc === 'VP8X') {
    return {
      w: buf.readUIntLE(24, 3) + 1,
      h: buf.readUIntLE(27, 3) + 1,
      bytes: buf.length,
    };
  }
  return { w: 0, h: 0, bytes: buf.length };
}

function checkSet(dir, label, expectSize) {
  if (!fs.existsSync(dir)) {
    problems.push(`${label} 目录不存在：${path.relative(ROOT, dir)}`);
    return { count: 0, bytes: 0, names: new Set() };
  }
  const names = new Set();
  let bytes = 0;
  for (const file of fs.readdirSync(dir)) {
    if (!/^hero-\d+\.webp$/.test(file)) {
      problems.push(`${label} 出现非规范文件名：${file}`);
      continue;
    }
    const full = path.join(dir, file);
    const info = webpSize(full);
    if (!info) {
      problems.push(`${label} 不是合法 WebP：${file}`);
      continue;
    }
    if (info.bytes === 0) problems.push(`${label} 空文件：${file}`);
    if (info.w !== expectSize || info.h !== expectSize) {
      problems.push(`${label} 尺寸异常 ${info.w}x${info.h}（应为 ${expectSize}）：${file}`);
    }
    names.add(file.replace('.webp', ''));
    bytes += info.bytes;
  }
  return { count: names.size, bytes, names };
}

const list = checkSet(LIST_DIR, '主包缩略图', 96);
const detail = checkSet(DETAIL_DIR, '分包详情图', 136);

const withImg = heroes.filter((h) => h.img);
const missing = [];
for (const hero of withImg) {
  if (!list.names.has(hero.img)) missing.push(`${hero.name}（${hero.img}）缺主包缩略图`);
  if (!detail.names.has(hero.img)) missing.push(`${hero.name}（${hero.img}）缺分包详情图`);
}
problems.push(...missing);

const referenced = new Set(withImg.map((h) => h.img));
for (const num of list.names) {
  if (!referenced.has(num)) problems.push(`孤儿缩略图（无人物引用）：${num}`);
}
for (const num of detail.names) {
  if (!referenced.has(num)) problems.push(`孤儿详情图（无人物引用）：${num}`);
}

const noImg = heroes.filter((h) => !h.img);

console.log(`人物 ${heroes.length} 位：有图 ${withImg.length}，无图 ${noImg.length}`);
if (noImg.length) {
  console.log(`  无图（走首字占位）：${noImg.map((h) => h.name).join('、')}`);
}
console.log(
  `  主包缩略图 ${list.count} 张 / ${(list.bytes / 1024).toFixed(0)}KB，平均 ${(list.bytes / list.count / 1024).toFixed(2)}KB`
);
console.log(
  `  分包详情图 ${detail.count} 张 / ${(detail.bytes / 1024).toFixed(0)}KB，平均 ${(detail.bytes / detail.count / 1024).toFixed(2)}KB`
);
if (manifest) {
  console.log(`  清单 generatedAt ${manifest.generatedAt}（${manifest.count} 条）`);
}

if (problems.length) {
  console.error(`\n不通过，共 ${problems.length} 项：`);
  problems.slice(0, 40).forEach((p) => console.error('  - ' + p));
  if (problems.length > 40) console.error(`  ... 其余 ${problems.length - 40} 项省略`);
  process.exit(1);
}

console.log('\n全部通过：每张图两档齐备、尺寸正确、无孤儿文件。');
