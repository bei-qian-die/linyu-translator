// 第二十七轮配图抓取（第四版，最终采用）：改用 biligame《崩坏：星穹铁道》WIKI 的角色页，
// 直接取页面里的官方立绘图（文件名形如 `花火立绘.png`），这是最不容易张冠李戴的来源。
// 只下载真实网络图片，不生成、不绘制、不二次加工画面内容。
// 用法：node scripts/fetch-new27-hero-img4.mjs [只跑这些编号,逗号分隔]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const RAW = path.join(ROOT, '.tmp/new27-img/raw');
fs.mkdirSync(RAW, { recursive: true });

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const WIKI = 'https://wiki.biligame.com/sr/';

const heroes = require('../scripts/curated-new27-heroes.js');
const all = heroes.map((h) => ({ num: Number(h.img.match(/hero-(\d+)/)[1]), name: h.name }));
const only = (process.argv[2] || '').split(',').map((s) => Number(s.trim())).filter(Boolean);
const todo = all.filter((t) => !only.length || only.includes(t.num));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 把 MediaWiki 缩略图地址还原成原图地址 */
function toOriginal(thumbUrl) {
  const u = decodeURIComponent(thumbUrl);
  const m = u.match(/^(https:\/\/patchwiki\.biligame\.com\/images\/[^/]+)\/thumb(\/.*?)\/\d+px-[^/]+$/);
  if (!m) return u;
  return m[1] + m[2];
}

async function fetchImage(url, referer) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Referer: referer, Accept: 'image/*,*/*;q=0.8' },
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 6000) throw new Error('文件过小 ' + buf.length);
  return buf;
}

const planPath = path.join(ROOT, 'scripts/curated-new27-hero-images.json');
const plan = fs.existsSync(planPath) ? JSON.parse(fs.readFileSync(planPath, 'utf8')) : { report: [] };
const byNum = new Map(plan.report.map((r) => [r.num, r]));

for (const t of todo) {
  const page = WIKI + encodeURIComponent(t.name);
  const row = byNum.get(t.num) || { num: t.num, name: t.name };
  row.name = t.name;
  row.file = null;
  row.error = undefined;
  row.fetchedAt = new Date().toISOString();

  try {
    const r = await fetch(page, { headers: { 'User-Agent': UA, Referer: WIKI } });
    if (!r.ok) throw new Error('页面 HTTP ' + r.status);
    const html = await r.text();
    const urls = [...new Set([...html.matchAll(/https?:\/\/patchwiki\.biligame\.com\/images\/[^"'\\ )]+/g)].map((x) => x[0]))];

    // 1) 优先「<角色名>立绘」，取最大尺寸
    const li = urls
      .map((u) => {
        const d = decodeURIComponent(u);
        const m = d.match(/\/(\d+)px-(.+?)\.(png|jpg|jpeg)$/i);
        if (!m) return null;
        if (!/立绘/.test(m[2])) return null;
        if (!m[2].includes(t.name)) return null;
        return { u, px: Number(m[1]), name: m[2] };
      })
      .filter(Boolean)
      .sort((a, b) => b.px - a.px);

    // 2) 退一步：文件名含角色名的任意大图
    const alt = urls
      .map((u) => {
        const d = decodeURIComponent(u);
        const m = d.match(/\/(\d+)px-(.+?)\.(png|jpg|jpeg)$/i);
        if (!m) return null;
        if (!m[2].includes(t.name)) return null;
        if (/图标|icon|星|命途|量子|物理|火|冰|风|雷|虚数|同谐|毁灭|存护|丰饶|虚无|智识|巡猎|记忆|欢愉/i.test(m[2])) return null;
        return { u, px: Number(m[1]), name: m[2] };
      })
      .filter(Boolean)
      .sort((a, b) => b.px - a.px);

    const pick = li[0] || alt[0];
    if (!pick) throw new Error('页面里没有可用立绘图');

    const orig = toOriginal(pick.u);
    const buf = await fetchImage(orig, page);
    const meta = await sharp(buf).metadata();
    if ((meta.width || 0) < 300) throw new Error('原图过小 ' + meta.width + 'x' + meta.height);

    const ext = (orig.match(/\.(png|jpg|jpeg)$/i) || ['.png'])[0].toLowerCase();
    const dst = path.join(RAW, `hero-${t.num}${ext}`);
    fs.writeFileSync(dst, buf);
    row.file = path.basename(dst);
    row.url = orig;
    row.page = page;
    row.type = 'biligame《崩坏：星穹铁道》WIKI 官方立绘';
    row.title = pick.name;
    row.size = buf.length;
    row.dims = `${meta.width}x${meta.height}`;
  } catch (e) {
    row.error = e.message;
  }

  byNum.set(t.num, row);
  console.log(String(t.num).padEnd(5), t.name.padEnd(10), row.file ? `✔ ${row.dims} ${Math.round(row.size / 1024)}KB | ${row.title}` : '✘ ' + row.error);
  await sleep(350);
}

plan.generated = new Date().toISOString();
plan.note =
  '全部为真实网络图片：biligame《崩坏：星穹铁道》WIKI 角色页官方立绘（星淋铁道 32 位）/ 360 图片检索公开结果（历史缺图英雄）。无 AI 生成图、无自绘、无占位图。';
plan.report = [...byNum.values()].sort((a, b) => a.num - b.num);
fs.writeFileSync(planPath, JSON.stringify(plan, null, 1) + '\n', 'utf8');
console.log('\n有图', plan.report.filter((r) => r.file).length, '/', plan.report.length);
