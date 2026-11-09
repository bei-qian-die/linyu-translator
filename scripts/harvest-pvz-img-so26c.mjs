// 剩余 4 个角色（百度无「植物大战僵尸」专属词条）的定向补图：
// 360 图片多组关键词，各留 8 张候选，出联系表人工核。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence/pvz-raw26c');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PLAN = [
  ['樱桃炸弹', 'cherrybomb', ['樱桃炸弹 植物大战僵尸 图鉴', '樱桃炸弹 植物大战僵尸 立绘', '樱桃炸弹 pvz']],
  ['模仿者', 'imitater', ['模仿者 植物大战僵尸 图鉴', '模仿者 植物大战僵尸 灰色', 'Imitater pvz plant']],
  ['睡莲', 'lilypad', ['睡莲 植物大战僵尸 图鉴', '睡莲 植物大战僵尸 泳池', 'Lily Pad pvz']],
  ['香蒲', 'cattail', ['香蒲 植物大战僵尸 图鉴', '香蒲 猫尾草 植物大战僵尸', 'Cattail pvz']],
];

const BAN = [
  '玩具', '积木', '乐高', '拼图', '手工', '食谱', '美食', '蛋糕', '饼干', '简笔画', '涂色',
  '折纸', '壁纸', '头像', '陶艺', '黏土', '淘宝', '京东', '购买', '价格', '真人', '毛绒',
  '盆景', '花卉', '水果', '孕妇', '可以吃', '怎么养', '水培', '摄影',
];
const GAME = ['植物大战僵尸', 'pvz', '僵尸', '戴夫', '图鉴', '无尽', '杂交', '关卡', '植物'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(q, pn = 0) {
  const url = `https://image.so.com/j?q=${encodeURIComponent(q)}&pn=${pn}&rn=40`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://image.so.com/' } });
  if (!r.ok) throw new Error('http ' + r.status);
  return (await r.json()).list || [];
}

function sniff(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  return '';
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR)) fs.unlinkSync(path.join(OUT_DIR, f));

const report = [];
for (const [zh, slug, queries] of PLAN) {
  const seen = new Set();
  const cands = [];
  for (const q of queries) {
    let list = [];
    try {
      list = await search(q);
    } catch (e) {
      console.log(zh, '检索失败', e.message);
    }
    for (const it of list) {
      const url = it.img || it.thumb;
      if (!url || seen.has(url)) continue;
      const low = String(it.title || '').toLowerCase();
      if (BAN.some((b) => low.includes(b))) continue;
      if (!GAME.some((g) => low.includes(g))) continue;
      seen.add(url);
      cands.push({ url, title: it.title || '', link: it.link || '', w: Number(it.width) || 0, h: Number(it.height) || 0 });
    }
    await sleep(380);
  }

  const kept = [];
  for (let i = 0; i < cands.length && kept.length < 8; i++) {
    const c = cands[i];
    try {
      const r = await fetch(c.url, {
        headers: { 'User-Agent': UA, Referer: c.link || 'https://image.so.com/' },
        redirect: 'follow',
      });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      const kind = sniff(buf);
      if (!kind || buf.length < 9000) continue;
      const file = `${slug}-${i}.${kind}`;
      fs.writeFileSync(path.join(OUT_DIR, file), buf);
      kept.push({ ...c, file, bytes: buf.length });
    } catch {
      /* 忽略 */
    }
    await sleep(160);
  }
  report.push({ name: zh, slug, cands: kept });
  console.log(zh, '→', kept.length, '张');
}

fs.writeFileSync(
  path.join(ROOT, 'evidence/pvz-img-so26c.json'),
  JSON.stringify({ harvestedAt: new Date().toISOString(), report }, null, 1),
  'utf8'
);
console.log('合计', report.reduce((a, r) => a + r.cands.length, 0));
