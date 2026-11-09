// 为「淋物大战阴尸」新英雄抓配图：只用本轮已采集到的 B 站视频封面（不新增请求，
// 避免 B 站检索接口的 412 风控），按《淋语翻译器》规范裁 256x256 PNG，编号接现有最大序号。
// 用法：node scripts/fetch-pvz-hero-img26.mjs [--force]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const IMG = path.join(ROOT, 'src/renderer/img');
const RAW = path.join(ROOT, 'evidence/pvz-raw');
const EVI = path.join(ROOT, 'evidence/pvz-hero-images26.json');
const FORCE = process.argv.includes('--force');

const searchFile = fs
  .readdirSync(path.join(ROOT, 'evidence'))
  .filter((f) => /^bili-search-pvz-\d+\.json$/.test(f))
  .sort()
  .pop();
const RAWJSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', searchFile), 'utf8'));
const VIDS = new Map();
for (const kw of Object.keys(RAWJSON)) for (const v of RAWJSON[kw] || []) if (!VIDS.has(v.bvid)) VIDS.set(v.bvid, v);

const heroes = (() => {
  const body = fs.readFileSync(path.join(ROOT, 'scripts/curated-pvz26-heroes.js'), 'utf8');
  return JSON.parse(body.slice(body.indexOf('module.exports =') + 'module.exports ='.length).trim().replace(/;$/, ''));
})();

const nums = fs
  .readdirSync(IMG)
  .map((f) => (f.match(/^hero-(\d+)\.(png|jpg)$/) || [])[1])
  .filter(Boolean)
  .map(Number);
let next = Math.max(...nums) + 1;

fs.mkdirSync(RAW, { recursive: true });
let report = [];
if (fs.existsSync(EVI) && !FORCE) report = (JSON.parse(fs.readFileSync(EVI, 'utf8')).report || []).filter((r) => r.file);
const done = new Set(report.map((r) => r.name));

// 标题里必须出现英雄名，并且整体是植物大战僵尸相关内容，避免拿到「辣椒炒肉」「向日葵迪迦」这类无关封面
const OKCTX = /(植物大战僵尸|pvz|PVZ|淋物|阴尸|僵尸|杂交版|β版|五阶|天阶)/;

const cand = (h) =>
  [...VIDS.values()]
    .map((v) => ({ v, title: String(v.title || '') }))
    .filter(({ title }) => (title.includes(h.name) || (h.alias && title.includes(h.alias))) && OKCTX.test(title))
    .sort((a, b) => (b.v.play || 0) - (a.v.play || 0));

for (const h of heroes) {
  if (done.has(h.name)) {
    console.log('跳过（已有）', h.name);
    continue;
  }
  const list = cand(h);
  if (!list.length) {
    console.log('✗ 无候选', h.name);
    report.push({ name: h.name, file: '', how: '本轮语料里没有命中该角色名的视频封面' });
    continue;
  }
  const pick = list[0];
  let pic = String(pick.v.pic || '');
  if (pic.startsWith('//')) pic = 'https:' + pic;
  pic = pic.replace(/^http:/, 'https:');
  let buf;
  try {
    const r = await fetch(pic, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://www.bilibili.com/',
      },
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    buf = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    console.log('✗ 下载失败', h.name, e.message);
    report.push({ name: h.name, file: '', how: '封面下载失败：' + e.message });
    continue;
  }
  const rawFile = path.join(RAW, 'pvz-' + next + '.jpg');
  fs.writeFileSync(rawFile, buf);
  const file = `hero-${next}.png`;
  try {
    execFileSync('python', [path.join(ROOT, 'scripts/crop-hero.py'), rawFile, path.join(IMG, file), 'fit'], { stdio: 'pipe' });
  } catch (e) {
    console.log('✗ 裁切失败', h.name, String(e.message).slice(0, 60));
    report.push({ name: h.name, file: '', how: '裁切失败' });
    continue;
  }
  report.push({
    name: h.name,
    file,
    bvid: pick.v.bvid,
    title: pick.title.slice(0, 60),
    play: pick.v.play,
    src: pic,
    how: 'B站视频封面（' + pick.v.bvid + '）',
    at: new Date().toISOString().replace('T', ' ').slice(0, 19),
  });
  console.log('✓', h.name.padEnd(8), '→', file, '|', pick.title.slice(0, 30), '|', pick.v.play);
  next += 1;
}

fs.writeFileSync(EVI, JSON.stringify({ generated: new Date().toISOString(), search: searchFile, report }, null, 1), 'utf8');
const ok = report.filter((r) => r.file);
console.log(`\n成功 ${ok.length} / ${heroes.length}`);
const miss = report.filter((r) => !r.file).map((r) => r.name);
if (miss.length) console.log('缺图：', miss.join('、'));
