'use strict';

// 第二十四轮选图：从 evidence/hero-cand24/*.jpg 里给每位人物挑一张合规图。
//
// 评分口径（宁缺毋滥）：
//   + 标题含「决战平安京 / 平安京 / 立绘 / 官方 / 图鉴」→ 加分
//   + 竖构图（h/w >= 1.15，符合立绘）→ 加分；横幅 → 减分
//   + 分辨率够（短边 >= 500）→ 加分
//   - 标题含「阴阳师」且不含平安京标识 → 直接否决（同 IP 本体图）
//   - 短边 < 240 → 否决（糊图）
// UP 主头像（kind=up）不参与评分，直接采用。
//
// 产出 evidence/hero-images24.json：{ map: { 人物名: { file, url, title, w, h, crop, kind, score } }, pending: [...] }
// 用法: node scripts/pick-hero-images24.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CAND_JSON = path.join(ROOT, 'evidence', 'hero-cand24.json');
const CAND_DIR = path.join(ROOT, 'evidence', 'hero-cand24');
const OUT = path.join(ROOT, 'evidence', 'hero-images24.json');
const { HEROES } = require(path.join(ROOT, 'scripts/curated-heroes24.js'));

// 读图片尺寸：JPEG SOF 段 + PNG IHDR（图床经常把 PNG 存成 .jpg 后缀）
function jpegSize(file) {
  const buf = fs.readFileSync(file);
  // PNG
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // JPEG
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return { w: 0, h: 0 };
}

const ONLY_GAME = /决战平安京|决战！平安京|决战!平安京|Onmyoji Arena|onmyoji arena|平安京/;
const GOOD = [
  [/决战平安京|决战！平安京/, 6],
  [/平安京/, 4],
  [/立绘/, 4],
  [/官方/, 3],
  [/图鉴/, 3],
  [/原画|官方原画/, 3],
];
const BAD = [
  [/攻略|详解|教学|资讯|漫画|同人|Cosplay|cos|表情包|梗图|壁纸合集/, -8],
  [/皮肤展示|抽卡|十连|强度榜|战力/, -6],
  [/手游日报|新闻|预告/, -6],
];

const score = (title, w, h, name) => {
  let s = 0;
  for (const [re, v] of GOOD) if (re.test(title)) s += v;
  for (const [re, v] of BAD) if (re.test(title)) s += v;
  // 标题里直接点名 → 强加分；泛页（花瓣网「立绘采集」这种合集页）标题不含式神名 → 减分，
  // 否则会把合集页里的其他式神图张冠李戴。
  const bare = String(name).replace(/（淋安京）/g, '');
  if (title.includes(bare)) s += 7;
  else s -= 5;
  if (/百度百科/.test(title) && title.includes(bare)) s += 3;
  const ar = h / w;
  if (ar >= 1.15) s += 4;
  else if (ar < 0.9) s -= 3;
  if (Math.min(w, h) >= 500) s += 2;
  return s;
};

const raw = JSON.parse(fs.readFileSync(CAND_JSON, 'utf8'));
const items = raw.items || [];
const byName = new Map();
for (const it of items) {
  if (!byName.has(it.name)) byName.set(it.name, []);
  byName.get(it.name).push(it);
}

const map = {};
const pending = [];
for (const h of HEROES) {
  const cands = byName.get(h.name) || [];
  if (!cands.length) { pending.push({ name: h.name, reason: '无候选' }); continue; }

  let best = null;
  for (const c of cands) {
    const file = path.join(CAND_DIR, c.file);
    if (!fs.existsSync(file)) continue;
    const { w, h: hh } = jpegSize(file);
    const title = c.title || '';
    if (/阴阳师/.test(title) && !ONLY_GAME.test(title)) continue; // 同 IP 反向否决
    if (Math.min(w, hh) < 240) continue;
    const sc = c.kind === 'up' ? 99 : score(title, w, hh, h.name);
    if (!best || sc > best.sc) best = { sc, c, w, h: hh };
  }
  if (!best) { pending.push({ name: h.name, reason: '候选全被否决（同 IP 本体图 / 分辨率过低）' }); continue; }

  map[h.name] = {
    file: best.c.file,
    url: best.c.url,
    title: (best.c.title || '').slice(0, 90),
    source: best.c.source || '',
    w: best.w,
    h: best.h,
    crop: best.h / best.w >= 1.15 ? 'top' : 'center',
    kind: best.c.kind || 'bing',
    score: best.sc,
  };
}

fs.writeFileSync(
  OUT,
  JSON.stringify({ map, pending, generatedAt: new Date().toISOString() }, null, 2),
  'utf8'
);
console.log('选中', Object.keys(map).length, '/', HEROES.length, '| 待补', pending.length);
if (pending.length) console.log('  待补：', pending.map((p) => p.name).join('、'));
