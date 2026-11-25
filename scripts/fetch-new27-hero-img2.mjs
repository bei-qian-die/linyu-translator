// 第二十七轮配图抓取（第二版）：百度百科主图张冠李戴率太高（花火→烟花、刃→书法、椒丘→文字卡），
// B 站检索接口被 412 限流，改用 360 图片检索（image.so.com/j 公开 JSON 接口）取候选，
// 只保留标题里同时出现「角色名 + 所属游戏」的图，下载后出联系表人工核对。
// 只下载真实网络图片，不生成、不绘制、不二次加工画面内容。
// 用法：node scripts/fetch-new27-hero-img2.mjs [只跑这些编号,逗号分隔]
import fs from 'node:fs';
import path from 'node:path';
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
  game: '崩坏：星穹铁道',
  must: /星穹|崩坏|铁道|米哈游/,
  q: [`${h.name} 崩坏星穹铁道 立绘`, `${h.name} 星穹铁道 角色`, `${h.name} 崩坏星穹铁道`],
}));

const legacy = [
  { num: 1011, name: '锤头鹳', game: '洛克王国', must: /洛克/, q: ['锤头鹳 洛克王国', '洛克王国 锤头鹳 宠物'] },
  { num: 1012, name: '夜枭', game: '洛克王国', must: /洛克/, q: ['夜枭 洛克王国', '洛克王国 夜枭 宠物'] },
  { num: 1013, name: '可丽希亚', game: '洛克王国', must: /洛克/, q: ['可丽希亚 洛克王国', '洛克王国 可丽希亚'] },
  { num: 1014, name: '阿洛', game: '洛克王国', must: /洛克/, q: ['阿洛 洛克王国', '洛克王国 阿洛 角色'] },
  { num: 1015, name: '奇乐的机器人', game: '无畏契约', must: /无畏契约|瓦罗兰特|VALORANT|奇乐/, q: ['无畏契约 奇乐 机器人', '奇乐 无畏契约 技能'] },
  { num: 1016, name: '黑梦的狗', game: '无畏契约', must: /无畏契约|瓦罗兰特|VALORANT|黑梦/, q: ['无畏契约 黑梦', '黑梦 无畏契约 技能'] },
];

const only = (process.argv[2] || '').split(',').map((s) => Number(s.trim())).filter(Boolean);
const all = targets.concat(legacy).filter((t) => !only.length || only.includes(t.num));

// 明显不是角色立绘的候选，先按标题剔除
const BAN = /简笔画|涂色|折纸|手工|积木|乐高|拼图|玩具|食谱|美食|蛋糕|壁纸|头像|表情包|淘宝|京东|购买|价格|多少钱|cosplay|真人|娃娃|毛绒|视频|攻略|抽卡|模拟器|下载|官网充值/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(q, pn = 0, rn = 60) {
  const r = await fetch(`https://image.so.com/j?q=${encodeURIComponent(q)}&pn=${pn}&rn=${rn}`, {
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

async function download(url, dstBase) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Referer: 'https://image.so.com/', Accept: 'image/*,*/*;q=0.8' },
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 8000) throw new Error('文件过小 ' + buf.length);
  const dst = `${dstBase}.${sniff(buf)}`;
  fs.writeFileSync(dst, buf);
  return { dst, size: buf.length };
}

const planPath = path.join(ROOT, 'scripts/curated-new27-hero-images.json');
const plan = fs.existsSync(planPath) ? JSON.parse(fs.readFileSync(planPath, 'utf8')) : { report: [] };
const byNum = new Map(plan.report.map((r) => [r.num, r]));

for (const t of all) {
  const row = byNum.get(t.num) || { num: t.num, name: t.name, fetchedAt: new Date().toISOString() };
  row.name = t.name;
  row.file = null;
  row.error = undefined;
  row.tried = [];

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
        if (BAN.test(title)) continue;
        if (cands.some((c) => c.img === img)) continue;
        cands.push({ img, title, href: x.href || x.link || q });
      }
      row.tried.push({ q, found: list.length, kept: cands.length });
    } catch (e) {
      row.tried.push({ q, error: e.message });
    }
    if (cands.length >= 3) break;
    await sleep(400);
  }

  for (const c of cands.slice(0, 3)) {
    try {
      const { dst, size } = await download(c.img, path.join(RAW, `hero-${t.num}`));
      row.file = path.basename(dst);
      row.url = c.img;
      row.page = c.href;
      row.type = '360 图片检索（公开结果，标题含角色名 + 所属游戏）';
      row.title = c.title;
      row.size = size;
      row.source = t.game;
      break;
    } catch (e) {
      row.error = '下载失败：' + e.message;
    }
    await sleep(200);
  }
  if (!row.file && !row.error) row.error = '未找到标题可核对的候选图';

  byNum.set(t.num, row);
  console.log(
    String(t.num).padEnd(5),
    t.name.padEnd(10),
    row.file ? '✔ ' + Math.round(row.size / 1024) + 'KB' : '✘ ' + row.error,
    row.title ? '| ' + row.title.slice(0, 40) : ''
  );
  await sleep(400);
}

plan.generated = new Date().toISOString();
plan.note =
  '全部为真实网络图片：360 图片检索公开结果（标题同时含角色名与所属游戏）。百度百科主图因张冠李戴已弃用；B 站接口本轮 412 限流。无 AI 生成图、无自绘、无占位图。';
plan.report = [...byNum.values()].sort((a, b) => a.num - b.num);
fs.writeFileSync(planPath, JSON.stringify(plan, null, 1) + '\n', 'utf8');

const ok = plan.report.filter((r) => r.file).length;
console.log('\n本轮有图', ok, '/', plan.report.length);
