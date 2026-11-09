// 最后一轮补图：对仍不够理想的角色，多页抓 360 图片并按「四角纯色 + 主体居中」打分取前 6，
// 出联系表人工定夺。仍然只下载真实网络图片。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence/pvz-raw26d');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PLAN = [
  ['模仿者', 'imitater', ['模仿者 植物大战僵尸', '模仿者 植物大战僵尸 灰色 图鉴', 'Imitater plants vs zombies']],
  ['香蒲', 'cattail', ['香蒲 植物大战僵尸', '香蒲 植物大战僵尸 泳池 图鉴', 'Cattail plants vs zombies']],
  ['睡莲', 'lilypad', ['睡莲 植物大战僵尸', '睡莲 植物大战僵尸 泳池', 'Lily pad plants vs zombies']],
  ['坚果墙', 'wallnut', ['坚果墙 植物大战僵尸', '坚果墙 植物大战僵尸 图鉴', 'Wall-nut plants vs zombies']],
];

const BAN = ['玩具', '积木', '乐高', '手工', '食谱', '美食', '蛋糕', '简笔画', '涂色', '壁纸', '头像', '陶艺', '黏土', '淘宝', '京东', '价格', '真人', '毛绒', '盆景', '花卉', '摄影', '孕妇', '可以吃', '怎么养'];
const GAME = ['植物大战僵尸', 'pvz', '僵尸', '戴夫', '图鉴', '无尽', '杂交', '关卡', '植物'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.log('sharp 不可用');
}

async function search(q, pn) {
  const r = await fetch(`https://image.so.com/j?q=${encodeURIComponent(q)}&pn=${pn}&rn=40`, {
    headers: { 'User-Agent': UA, Referer: 'https://image.so.com/' },
  });
  if (!r.ok) throw new Error('http ' + r.status);
  return (await r.json()).list || [];
}

function sniff(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  return '';
}

async function cutout(file) {
  if (!sharp) return 0;
  try {
    const { data, info } = await sharp(file).resize(72, 72, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
    const ch = info.channels;
    const at = (x, y) => {
      const i = (y * info.width + x) * ch;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const cs = [at(1, 1), at(info.width - 2, 1), at(1, info.height - 2), at(info.width - 2, info.height - 2)];
    const df = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    let mx = 0;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) mx = Math.max(mx, df(cs[i], cs[j]));
    const cen = at(info.width >> 1, info.height >> 1);
    let cd = 0;
    for (const c of cs) cd = Math.max(cd, df(cen, c));
    return (mx <= 24 ? 60 : 0) + Math.min(cd, 200) / 4;
  } catch {
    return 0;
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR)) fs.unlinkSync(path.join(OUT_DIR, f));

const report = [];
for (const [zh, slug, queries] of PLAN) {
  const seen = new Set();
  const cands = [];
  for (const q of queries) {
    for (const pn of [0, 40]) {
      let list = [];
      try {
        list = await search(q, pn);
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
        cands.push({ url, title: it.title || '', link: it.link || '' });
      }
      await sleep(320);
    }
  }

  const scored = [];
  for (let i = 0; i < cands.length && scored.length < 24; i++) {
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
      const full = path.join(OUT_DIR, file);
      fs.writeFileSync(full, buf);
      scored.push({ ...c, file, score: Math.round(await cutout(full)), bytes: buf.length });
    } catch {
      /* ignore */
    }
    await sleep(140);
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 6);
  report.push({ name: zh, slug, top });
  console.log(zh, '→ 入表 6 | 分数', top.map((t) => t.score).join('/'));
}

fs.writeFileSync(
  path.join(ROOT, 'evidence/pvz-img-so26d.json'),
  JSON.stringify({ harvestedAt: new Date().toISOString(), report }, null, 1),
  'utf8'
);
console.log('合计', report.reduce((a, r) => a + r.top.length, 0));
