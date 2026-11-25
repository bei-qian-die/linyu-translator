// 第二十七轮配图落位：把 .tmp/new27-img/raw 下的原图裁成 256x256，
// 同步写入五处 img 目录（PC / Web / Web 分享页 / 服务端 / 小程序分包），并生成联系表供人工核对。
// 只做裁剪与缩放，不做任何生成/绘制/美化。
// 用法：node scripts/apply-new27-hero-img.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const RAW = path.join(ROOT, '.tmp/new27-img/raw');
const PLAN = path.join(ROOT, 'scripts/curated-new27-hero-images.json');
const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));

const DIRS = [
  'src/renderer/img',
  'www/img',
  'www-web/img',
  'linyu-server/public/img',
  'miniprogram/pkg-hero/img',
];

const rows = plan.report.filter((r) => r.file && fs.existsSync(path.join(RAW, r.file)));
const missing = plan.report.filter((r) => !r.file || !fs.existsSync(path.join(RAW, r.file)));

let n = 0;
for (const r of rows) {
  const src = path.join(RAW, r.file);
  const buf = await sharp(src)
    .resize(256, 256, { fit: 'cover', position: 'attention' })
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toBuffer();
  for (const d of DIRS) {
    const out = path.join(ROOT, d, `hero-${r.num}.png`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buf);
  }
  // 缩略图（与 optimize-images.py 一致：240 宽 WebP q75）
  const thumb = await sharp(src).resize({ width: 240 }).webp({ quality: 75 }).toBuffer();
  for (const d of DIRS) {
    if (d === 'miniprogram/pkg-hero/img') continue; // 小程序分包不带 thumb
    const td = path.join(ROOT, d, 'thumb');
    fs.mkdirSync(td, { recursive: true });
    fs.writeFileSync(path.join(td, `hero-${r.num}.webp`), thumb);
  }
  r.cropped = true;
  r.bytes = buf.length;
  n += 1;
}

// 联系表：6 列，每格 180px，带序号与名字，人工核对用
const COLS = 6;
const TILE = 180;
const LABEL = 30;
const cellW = TILE;
const cellH = TILE + LABEL;
const width = COLS * cellW;
const height = Math.ceil(rows.length / COLS) * cellH;
const tiles = [];
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const x = (i % COLS) * cellW;
  const y = Math.floor(i / COLS) * cellH;
  const img = await sharp(path.join(RAW, r.file)).resize(TILE, TILE, { fit: 'cover', position: 'attention' }).png().toBuffer();
  tiles.push({ input: img, left: x, top: y });
  const svg = Buffer.from(
    `<svg width="${cellW}" height="${LABEL}"><rect width="100%" height="100%" fill="#ffffff"/><text x="4" y="20" font-size="15" fill="#111" font-family="sans-serif">${r.num} ${escapeXml(r.name)}</text></svg>`
  );
  tiles.push({ input: svg, left: x, top: y + TILE });
}
await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
  .composite(tiles)
  .png()
  .toFile(path.join(ROOT, 'evidence/new27-hero-contact-sheet.png'));

fs.writeFileSync(PLAN, JSON.stringify(plan, null, 1) + '\n', 'utf8');

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

console.log('已落位', n, '张 | 缺图', missing.length, missing.map((m) => m.num + ' ' + m.name).join(', '));
console.log('联系表 evidence/new27-hero-contact-sheet.png', width + 'x' + height);
