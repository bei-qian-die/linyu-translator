// 第二十六轮补图·第二轮：定向采集 + 自动排序。
// 思路：官方立绘多为「纯背景抠图」，四角颜色一致且居中主体 → 用角点纯度打分排序，
// 每个角色取前 3 张出联系表，人工再核一遍。仍然只下载真实网络图片，不做任何生成。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence/pvz-raw26b');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TARGETS = [
  ['豌豆射手', 'peashooter', 'Peashooter'],
  ['向日葵', 'sunflower', 'Sunflower'],
  ['坚果墙', 'wallnut', 'Wall-nut'],
  ['樱桃炸弹', 'cherrybomb', 'Cherry Bomb'],
  ['寒冰射手', 'snowpea', 'Snow Pea'],
  ['大嘴花', 'chomper', 'Chomper'],
  ['大喷菇', 'fumeshroom', 'Fume-shroom'],
  ['土豆雷', 'potatomine', 'Potato Mine'],
  ['火爆辣椒', 'jalapeno', 'Jalapeno'],
  ['地刺', 'spikeweed', 'Spikeweed'],
  ['磁力菇', 'magnetshroom', 'Magnet-shroom'],
  ['模仿者', 'imitater', 'Imitater'],
  ['三线射手', 'threepeater', 'Threepeater'],
  ['杨桃', 'starfruit', 'Starfruit'],
  ['睡莲', 'lilypad', 'Lily Pad'],
  ['墓碑吞噬者', 'gravebuster', 'Grave Buster'],
  ['香蒲', 'cattail', 'Cattail'],
  ['疯狂戴夫', 'crazydave', 'Crazy Dave'],
  ['撑杆跳僵尸', 'polevaulting', 'Pole Vaulting Zombie'],
  ['蹦极僵尸', 'bungee', 'Bungee Zombie'],
  ['矿工僵尸', 'digger', 'Digger Zombie'],
];

// 标题必须能看出是植物大战僵尸相关内容，挡掉同名杂物（真实杨桃、真实睡莲、音响等）
const GAME_WORDS = ['植物大战僵尸', 'pvz', '僵尸', '戴夫', '图鉴', '无尽', '杂交', '花园', '草坪', '关卡', '植物'];
const BAN_TITLE = [
  '玩具', '积木', '乐高', '拼图', '手工', '食谱', '美食', '蛋糕', '饼干', '便当',
  '简笔画', '涂色', '折纸', '十字绣', '3d打印', '壁纸', '头像', '陶艺', '黏土',
  '淘宝', '京东', '购买', '价格', '多少钱', '真人', '毛绒', '纹身', '美甲', '种植',
  '盆景', '花卉', '鲜切花', '水果店', '营养价值', '孕妇', '可以吃', '怎么养', '水培',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(q, pn, rn = 40) {
  const url = `https://image.so.com/j?q=${encodeURIComponent(q)}&pn=${pn}&rn=${rn}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://image.so.com/' } });
  if (!r.ok) throw new Error('http ' + r.status);
  return ((await r.json()).list || []);
}

function sniff(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF') return 'webp';
  return '';
}

// 用 sharp 做像素级角点纯度评估（项目已有 sharp 依赖）
let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.log('sharp 不可用，跳过自动排序');
}

async function cutoutScore(file) {
  if (!sharp) return 0;
  try {
    const img = sharp(file).resize(72, 72, { fit: 'inside' });
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const ch = info.channels;
    const px = (x, y) => {
      const i = (y * info.width + x) * ch;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const corners = [px(1, 1), px(info.width - 2, 1), px(1, info.height - 2), px(info.width - 2, info.height - 2)];
    const diff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    let maxD = 0;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) maxD = Math.max(maxD, diff(corners[i], corners[j]));
    // 中心与角落的差异（主体存在）
    const cen = px(info.width >> 1, info.height >> 1);
    let cenD = 0;
    for (const c of corners) cenD = Math.max(cenD, diff(cen, c));
    const pureCorners = maxD <= 24 ? 1 : 0;
    return pureCorners * 60 + Math.min(cenD, 200) / 4;
  } catch {
    return 0;
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR)) fs.unlinkSync(path.join(OUT_DIR, f));

const report = [];

for (const [zh, slug, en] of TARGETS) {
  const seen = new Set();
  const cands = [];
  const queries = [
    [`${zh} 植物大战僵尸`, 0],
    [`${zh} 植物大战僵尸 图鉴`, 0],
    [`${zh} 植物大战僵尸`, 40],
    [`${en} plants vs zombies`, 0],
  ];
  for (const [q, pn] of queries) {
    let list = [];
    try {
      list = await search(q, pn);
    } catch (e) {
      console.log(zh, '检索失败', e.message);
    }
    for (const it of list) {
      const url = it.img || it.thumb;
      if (!url || seen.has(url)) continue;
      const title = String(it.title || '');
      const low = title.toLowerCase();
      if (BAN_TITLE.some((b) => low.includes(b))) continue;
      if (!GAME_WORDS.some((g) => low.includes(g))) continue;
      const w = Number(it.width) || 0;
      const h = Number(it.height) || 0;
      if (w && h && (w < 160 || h < 160)) continue;
      seen.add(url);
      cands.push({ url, title, link: it.link || '', site: it.site || '', w, h });
    }
    await sleep(380);
  }

  const kept = [];
  for (let i = 0; i < cands.length && kept.length < 14; i++) {
    const c = cands[i];
    try {
      const r = await fetch(c.url, {
        headers: { 'User-Agent': UA, Referer: c.link || 'https://image.so.com/' },
        redirect: 'follow',
      });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 8000) continue;
      const kind = sniff(buf);
      if (!kind || kind === 'webp') continue;
      const file = `${slug}-${i}.${kind}`;
      const full = path.join(OUT_DIR, file);
      fs.writeFileSync(full, buf);
      const score = await cutoutScore(full);
      kept.push({ ...c, file, bytes: buf.length, kind, score: Math.round(score) });
    } catch {
      /* 忽略单张失败 */
    }
    await sleep(150);
  }

  kept.sort((a, b) => b.score - a.score);
  const top = kept.slice(0, 3);
  report.push({ name: zh, slug, picked: top, all: kept.length });
  console.log(zh, '→ 候选', kept.length, '| 前三得分', top.map((t) => t.score).join('/'));
}

fs.writeFileSync(
  path.join(ROOT, 'evidence/pvz-img-so26b.json'),
  JSON.stringify({ harvestedAt: new Date().toISOString(), source: 'image.so.com', report }, null, 1),
  'utf8'
);
console.log('\n合计入表', report.reduce((a, r) => a + r.picked.length, 0), '张 | 角色', report.length);
