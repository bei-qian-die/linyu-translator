// 第二十七轮配图抓取（第三版）：解决第二版的「攻略图/信息图/横幅」问题。
// 做法：查询词偏向「立绘 / 角色」，下载后用 sharp 读尺寸，把宽高比 > 1.6 的横幅图、
// 小于 280px 的小图直接丢弃（信息图、攻略图基本都是宽幅），再从下一个候选继续。
// 只下载真实网络图片，不生成、不绘制、不二次加工画面内容。
// 用法：node scripts/fetch-new27-hero-img3.mjs [只跑这些编号,逗号分隔]
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

const heroes = require('../scripts/curated-new27-heroes.js');
const targets = heroes.map((h) => ({
  num: Number(h.img.match(/hero-(\d+)/)[1]),
  name: h.name,
  must: /星穹|崩坏|铁道|米哈游/,
  q: [`${h.name} 立绘`, `${h.name} 崩坏星穹铁道 官方立绘`, `${h.name} 角色立绘 透明`],
}));

const legacy = [
  { num: 1011, name: '锤头鹳', must: /洛克/, q: ['锤头鹳 洛克王国 立绘', '洛克王国 锤头鹳'] },
  { num: 1012, name: '夜枭', must: /洛克/, q: ['夜枭 洛克王国 立绘', '洛克王国 夜枭 宠物'] },
  { num: 1013, name: '可丽希亚', must: /洛克/, q: ['可丽希亚 洛克王国 立绘', '洛克王国 可丽希亚'] },
  { num: 1014, name: '阿洛', must: /洛克/, q: ['阿洛 洛克王国 立绘', '洛克王国 阿洛'] },
  { num: 1015, name: '奇乐的机器人', must: /无畏契约|瓦罗兰特|VALORANT|奇乐/, q: ['奇乐的机器人', '无畏契约 奇乐 机器人 图片'] },
  { num: 1016, name: '黑梦的狗', must: /无畏契约|瓦罗兰特|VALORANT|黑梦/, q: ['黑梦的狗', '无畏契约 黑梦 狗'] },
];

const only = (process.argv[2] || '').split(',').map((s) => Number(s.trim())).filter(Boolean);
const all = targets.concat(legacy).filter((t) => !only.length || only.includes(t.num));

const BAN = /简笔画|涂色|折纸|手工|积木|乐高|拼图|玩具|食谱|美食|蛋糕|壁纸|头像|表情包|淘宝|京东|购买|价格|多少钱|cosplay|真人|娃娃|毛绒|攻略|配队|材料|遗器|词条|抽卡|培养|行迹|速刷|一览表|排行榜|对比|盘点|图鉴|技能介绍|效果介绍/i;
const PREFER = /立绘|原画|角色|官方|高清|透明|PNG/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(q, rn = 60) {
  const r = await fetch(`https://image.so.com/j?q=${encodeURIComponent(q)}&pn=0&rn=${rn}`, {
    headers: { 'User-Agent': UA, Referer: 'https://image.so.com/' },
  });
  if (!r.ok) throw new Error('http ' + r.status);
  const j = await r.json();
  return j.list || [];
}

function sniff(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF') return 'webp';
  return 'jpg';
}

async function fetchImage(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Referer: 'https://image.so.com/', Accept: 'image/*,*/*;q=0.8' },
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 8000) throw new Error('文件过小 ' + buf.length);
  return buf;
}

const planPath = path.join(ROOT, 'scripts/curated-new27-hero-images.json');
const plan = fs.existsSync(planPath) ? JSON.parse(fs.readFileSync(planPath, 'utf8')) : { report: [] };
const byNum = new Map(plan.report.map((r) => [r.num, r]));

for (const t of all) {
  const row = byNum.get(t.num) || { num: t.num, name: t.name };
  row.name = t.name;
  row.file = null;
  row.error = undefined;
  row.fetchedAt = new Date().toISOString();
  row.rejected = [];

  const cands = [];
  for (const q of t.q) {
    try {
      const list = await search(q);
      for (const x of list) {
        const title = String(x.title || '');
        const img = String(x.img || x.thumb || '');
        if (!img || !/^https?:/.test(img)) continue;
        if (!title.includes(t.name)) continue;
        if (!t.must.test(title)) continue;
        if (BAN.test(title) && !PREFER.test(title)) continue;
        if (cands.some((c) => c.img === img)) continue;
        cands.push({ img, title, href: x.href || q, prefer: PREFER.test(title) ? 1 : 0 });
      }
    } catch (e) {
      row.rejected.push({ q, error: e.message });
    }
    if (cands.length >= 8) break;
    await sleep(350);
  }
  cands.sort((a, b) => b.prefer - a.prefer);

  for (const c of cands.slice(0, 8)) {
    try {
      const buf = await fetchImage(c.img);
      const meta = await sharp(buf).metadata();
      const w = meta.width || 0;
      const h = meta.height || 0;
      const ratio = w / h;
      if (w < 280 || h < 280) {
        row.rejected.push({ title: c.title, why: `图太小 ${w}x${h}` });
        continue;
      }
      if (ratio > 1.6) {
        row.rejected.push({ title: c.title, why: `宽幅横图 ${w}x${h}（疑似信息图）` });
        continue;
      }
      const dst = path.join(RAW, `hero-${t.num}.${sniff(buf)}`);
      fs.writeFileSync(dst, buf);
      row.file = path.basename(dst);
      row.url = c.img;
      row.page = c.href;
      row.type = '360 图片检索（公开结果，标题含角色名 + 所属游戏，已按宽高比过滤信息图）';
      row.title = c.title;
      row.size = buf.length;
      row.dims = `${w}x${h}`;
      break;
    } catch (e) {
      row.rejected.push({ title: c.title, why: e.message });
    }
    await sleep(150);
  }
  if (!row.file && !row.error) row.error = '候选均被过滤或下载失败';

  byNum.set(t.num, row);
  console.log(
    String(t.num).padEnd(5),
    t.name.padEnd(10),
    row.file ? `✔ ${row.dims} ${Math.round(row.size / 1024)}KB` : '✘ ' + row.error,
    row.title ? '| ' + row.title.slice(0, 36) : ''
  );
  await sleep(350);
}

plan.generated = new Date().toISOString();
plan.note =
  '全部为真实网络图片：360 图片检索公开结果（标题同时含角色名与所属游戏，已按宽高比过滤横幅/信息图）。无 AI 生成图、无自绘、无占位图。';
plan.report = [...byNum.values()].sort((a, b) => a.num - b.num);
fs.writeFileSync(planPath, JSON.stringify(plan, null, 1) + '\n', 'utf8');
console.log('\n有图', plan.report.filter((r) => r.file).length, '/', plan.report.length);
