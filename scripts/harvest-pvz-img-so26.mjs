// 第二十六轮补图：用 360 图片检索（image.so.com/j，公开 JSON 接口）抓缺图角色的候选图。
// 硬性约束：只下载真实网络图片，不生成、不绘制、不二次加工画面内容；
// 下载后统一出联系表人工核对，只保留确实是对应角色的官方立绘图。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence/pvz-raw26');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TARGETS = [
  ['豌豆射手', 'peashooter'],
  ['向日葵', 'sunflower'],
  ['坚果墙', 'wallnut'],
  ['樱桃炸弹', 'cherrybomb'],
  ['寒冰射手', 'snowpea'],
  ['大嘴花', 'chomper'],
  ['大喷菇', 'fumeshroom'],
  ['土豆雷', 'potatomine'],
  ['火爆辣椒', 'jalapeno'],
  ['地刺', 'spikeweed'],
  ['磁力菇', 'magnetshroom'],
  ['模仿者', 'imitater'],
  ['三线射手', 'threepeater'],
  ['杨桃', 'starfruit'],
  ['睡莲', 'lilypad'],
  ['墓碑吞噬者', 'gravebuster'],
  ['香蒲', 'cattail'],
  ['疯狂戴夫', 'crazydave'],
  ['撑杆跳僵尸', 'polevaulting'],
  ['蹦极僵尸', 'bungee'],
  ['矿工僵尸', 'digger'],
];

// 明显不是立绘的图（玩具、食物、手工、教程类），先按标题剔除，减少人工核对量
const BAN_TITLE = [
  '玩具', '积木', '乐高', '拼图', '手工', '食谱', '菜', '美食', '蛋糕', '饼干', '便当',
  '简笔画', '涂色', '折纸', '十字绣', '3d打印', '模型', '壁纸', '头像', '表情包',
  '淘宝', '京东', '购买', '价格', '多少钱', 'cos', 'cosplay', '真人', '娃娃', '毛绒',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(q, pn = 0, rn = 40) {
  const url = `https://image.so.com/j?q=${encodeURIComponent(q)}&pn=${pn}&rn=${rn}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://image.so.com/' } });
  if (!r.ok) throw new Error('http ' + r.status);
  const j = await r.json();
  return j.list || [];
}

function extOf(type) {
  const t = String(type || '').toUpperCase();
  if (t.includes('PNG')) return 'png';
  if (t.includes('WEBP')) return 'webp';
  if (t.includes('GIF')) return 'gif';
  return 'jpg';
}

function sniff(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF') return 'webp';
  if (buf.length > 4 && buf.toString('ascii', 0, 3) === 'GIF') return 'gif';
  return '';
}

function pngSize(buf) {
  if (buf.length < 24) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR)) fs.unlinkSync(path.join(OUT_DIR, f));

const report = [];

for (const [zh, slug] of TARGETS) {
  const seen = new Set();
  const cands = [];
  for (const q of [`${zh} 植物大战僵尸`, zh]) {
    let list = [];
    try {
      list = await search(q);
    } catch (e) {
      console.log(zh, '| 检索失败', e.message);
    }
    for (const it of list) {
      if (cands.length >= 6) break;
      const url = it.img || it.thumb;
      if (!url || seen.has(url)) continue;
      const title = String(it.title || '');
      if (BAN_TITLE.some((b) => title.toLowerCase().includes(b))) continue;
      const w = Number(it.width) || 0;
      const h = Number(it.height) || 0;
      if (w && h && (w < 150 || h < 150)) continue;
      seen.add(url);
      cands.push({ url, title, link: it.link || '', site: it.site || '', w, h });
    }
    await sleep(400);
  }

  const kept = [];
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    try {
      const r = await fetch(c.url, {
        headers: { 'User-Agent': UA, Referer: c.link || 'https://image.so.com/' },
        redirect: 'follow',
      });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 6000) continue;
      const kind = sniff(buf);
      if (!kind) continue;
      if (kind === 'png') {
        const s = pngSize(buf);
        if (s && (s.w < 150 || s.h < 150)) continue;
      }
      const file = `${slug}-${i}.${extOf(kind)}`;
      fs.writeFileSync(path.join(OUT_DIR, file), buf);
      kept.push({ ...c, file, bytes: buf.length, kind });
      console.log('  ok', file, Math.round(buf.length / 1024) + 'KB', c.title.slice(0, 26));
    } catch {
      /* 单张失败不影响整体 */
    }
    await sleep(180);
  }
  report.push({ name: zh, slug, cands: kept });
  console.log(zh, '→ 保存', kept.length, '/', cands.length);
}

fs.writeFileSync(
  path.join(ROOT, 'evidence/pvz-img-so26.json'),
  JSON.stringify({ harvestedAt: new Date().toISOString(), source: 'image.so.com', report }, null, 1),
  'utf8'
);
const total = report.reduce((a, r) => a + r.cands.length, 0);
console.log('\n合计下载', total, '张 | 角色', report.length);
for (const r of report) if (!r.cands.length) console.log('  零候选:', r.name);
