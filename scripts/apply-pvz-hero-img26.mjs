// 配图质检后的收尾：只保留人工核过「图对得上角色」的图，重新连续编号，
// 生成 240 宽 thumb webp，并把 img / 配图来源 写回 src/core/lore-extra26.js。
// 用法：node scripts/apply-pvz-hero-img26.mjs <保留的编号,逗号分隔>
// 依据：evidence/pvz26-contact-sheet.png 人工抽检结果（张冠李戴的一律删掉，不用占位图凑）。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const IMG = path.join(ROOT, 'src/renderer/img');
const EVI = path.join(ROOT, 'evidence/pvz-hero-images26.json');
const KEEP = (process.argv[2] || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!KEEP.length) throw new Error('用法：node scripts/apply-pvz-hero-img26.mjs 949,950,...');

const evi = JSON.parse(fs.readFileSync(EVI, 'utf8'));
const byNum = new Map(evi.report.filter((r) => r.file).map((r) => [String(Number(r.file.match(/\d+/)[0])), r]));

const keepRows = KEEP.map((n) => {
  const r = byNum.get(String(Number(n)));
  if (!r) throw new Error('清单里没有编号 ' + n);
  return r;
});

// 删掉所有本轮生成但没保留的图（只删本轮 949+ 且不在保留名单里的）
const startNum = 949;
for (const r of evi.report) {
  if (!r.file) continue;
  const num = Number(r.file.match(/\d+/)[0]);
  if (num < startNum) continue;
  if (keepRows.some((k) => k.file === r.file)) continue;
  const p = path.join(IMG, r.file);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// 重新连续编号
let n = startNum;
const finalReport = [];
for (const r of keepRows) {
  const oldPath = path.join(IMG, r.file);
  const newName = `hero-${n}.png`;
  const newPath = path.join(IMG, newName);
  if (oldPath !== newPath) fs.renameSync(oldPath, newPath);
  // thumb：240 宽，WebP q75（与 scripts/optimize-images.py 一致）
  execFileSync(
    'python',
    [
      '-c',
      `from PIL import Image\nim=Image.open(r"${newPath}").convert("RGB")\nw,h=im.size\nim=im.resize((240,round(240*h/w)),Image.LANCZOS)\nim.save(r"${path.join(IMG, 'thumb', 'hero-' + n + '.webp')}","WEBP",quality=75,method=6)`,
    ],
    { stdio: 'pipe' }
  );
  finalReport.push({ ...r, file: newName, num: n, thumb: `img/thumb/hero-${n}.webp` });
  n += 1;
}

fs.writeFileSync(
  EVI,
  JSON.stringify({ generated: new Date().toISOString(), search: evi.search, note: '经联系表人工抽检，仅保留图能对上角色的条目', report: finalReport }, null, 1),
  'utf8'
);

// 写回 lore-extra26.js：img + links 里补「配图来源」（audit-hero-img-src.js 读的就是这个 label）
const lorePath = path.join(ROOT, 'src/core/lore-extra26.js');
const body = fs.readFileSync(lorePath, 'utf8');
const jsonStr = body.slice(body.indexOf('const __export = ') + 'const __export = '.length, body.indexOf('};\nconst mod'));
const data = JSON.parse(jsonStr);
const byName = new Map(finalReport.map((r) => [r.name, r]));
let hit = 0;
for (const h of data.heroes) {
  const r = byName.get(h.name);
  if (!r) continue;
  h.img = r.file;
  h.links = (h.links || []).filter((l) => !/配图来源/.test(String(l.label || '')));
  h.links.push({ label: '配图来源 · B站视频封面', url: r.src });
  h.links.push({ label: '封面出处 · ' + r.bvid, url: 'https://www.bilibili.com/video/' + r.bvid });
  hit += 1;
}
const head = body.slice(0, body.indexOf('const __export = '));
const tail = '};\nconst mod = typeof module !== \'undefined\' ? module : null;\nif (mod) mod.exports = __export;\n';
fs.writeFileSync(lorePath, head + 'const __export = ' + JSON.stringify(data) + tail, 'utf8');

console.log('保留并重编号', finalReport.length, '张 | 写回英雄', hit, '位');
for (const r of finalReport) console.log(' ', r.file, r.name, '←', r.bvid);
