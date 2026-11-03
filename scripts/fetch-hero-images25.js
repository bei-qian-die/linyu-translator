'use strict';

// 第二十五轮配图抓取（四分区 245 位人物）。
//
// 来源路由（严格按 §9.1 的优先级，不跳序）：
//   1. baidu  百度图库，检索词锁定「官方全名 + 图鉴／立绘／干员」
//   2. baike  百度百科词条主图
//   3. user   B 站用户搜索 → owner.face 头像（UP 主首选，没露脸的一律用头像）
//
// 输出：evidence/hero-cand25/<名>/<src>-<n>.jpg + evidence/hero-images25.json
// 不做任何生成／改写：只下载与记录，裁切由 apply-hero-images25.py 负责。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence', 'hero-cand25');
const OUT_JSON = path.join(ROOT, 'evidence', 'hero-images25.json');
fs.mkdirSync(OUT_DIR, { recursive: true });

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const lore = require(path.join(ROOT, 'src/core/lore.js'));
const target = lore.heroes.filter((h) =>
  ['淋可梦', '奥奇淋说', '淋角洲行动', 'divatag', 'UP主'].some((z) => String(h.rank || '').startsWith(z))
);

// 只处理本轮新增的（img 为空且 rank 命中四分区）
const TODO = target.filter((h) => !h.img);

const BAD =
  /无畏契约|valorant|守望|王者荣耀|原神|明日方舟|表情包|梗图|手绘|同人|绘画|教程|攻略|cos|真人|ai还原|ai生成|aigc|壁纸|头像大全/i;
const BAD_REAL = /表情包|梗图|手绘|同人|绘画|教程|攻略|cos|福利|性感|泳装|内衣/i;

const ONLY = {
  淋可梦: /宝可梦|pokemon|poké|精灵宝可梦|图鉴|御三家|训练家|立绘/i,
  奥奇淋说: /奥奇传说|奥奇|aoqi|精灵|图鉴|属性|立绘/i,
  淋角洲行动: /三角洲行动|delta force|哈夫克|干员|行动|立绘/i,
  divatag: /官方|red carpet|award|舞台|巡演|concert|专辑|album|写真|立绘/i,
  UP主: null,
};

const zoneOf = (h) => {
  const r = String(h.rank || '');
  if (r.startsWith('UP主')) return 'UP主';
  return r.split('·')[0].trim();
};

// 检索词：必须能锁定到具体对象，不能用泛词
const queryOf = (h, zone) => {
  if (zone === '淋可梦') return h.name + ' 宝可梦 图鉴 官方';
  if (zone === '奥奇淋说') return h.name + ' 奥奇传说 精灵';
  if (zone === '淋角洲行动') return h.name + ' 三角洲行动 干员';
  if (zone === 'divatag') return h.name + ' 歌手 舞台';
  return h.name;
};

const usedUrls = new Set();
const RECORDS = [];

async function grab(url, referer) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: referer || url } });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (!/^image\//.test(ct)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 8000) return null;
    return buf;
  } catch {
    return null;
  }
}

// ---------- 1. 百度图库 ----------
async function baiduCand(word, zone, n = 3) {
  const u =
    'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592&is=&fp=result&word=' +
    encodeURIComponent(word) +
    '&pn=0&rn=40&gsm=1e';
  let j;
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://image.baidu.com/' } });
    j = JSON.parse((await r.text()).replace(/[\u0000-\u001f]/g, ' '));
  } catch {
    return [];
  }
  const only = ONLY[zone];
  const bad = zone === 'divatag' ? BAD_REAL : BAD;
  const out = [];
  for (const x of (j.data || []).filter((v) => v && (v.middleURL || v.thumbURL))) {
    const title = String(x.fromPageTitle || x.fromPageTitleEnc || '').replace(/<[^>]+>/g, '');
    if (bad.test(title)) continue;
    if (only && !only.test(title + ' ' + word)) continue;
    if (x.width && x.width < 300) continue;
    const url = x.middleURL || x.thumbURL;
    if (usedUrls.has(url)) continue;
    const buf = await grab(url, 'https://image.baidu.com/');
    if (!buf) continue;
    usedUrls.add(url);
    out.push({ buf, url, title: title.slice(0, 90), w: x.width || 0, h: x.height || 0, from: 'baidu' });
    if (out.length >= n) break;
    await sleep(60);
  }
  return out;
}

// ---------- 2. 百度百科 ----------
async function baikeImg(key) {
  const u =
    'https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key=' +
    encodeURIComponent(key) +
    '&bk_length=100';
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://baike.baidu.com/' } });
    const j = await r.json();
    const img = j.image || (j.card && j.card.image) || '';
    if (!img) return null;
    const url = img.startsWith('http') ? img : 'https://baike.baidu.com' + img;
    if (usedUrls.has(url)) return null;
    const buf = await grab(url, 'https://baike.baidu.com/');
    if (!buf) return null;
    usedUrls.add(url);
    return { buf, url, title: '百度百科词条图：' + key, from: 'baike' };
  } catch {
    return null;
  }
}

// ---------- 3. B 站头像 ----------
async function userAvatar(name) {
  try {
    const r = await fetch(
      'https://api.bilibili.com/x/web-interface/wbi/search/type?search_type=bili_user&keyword=' + encodeURIComponent(name),
      { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' } }
    );
    const j = await r.json();
    if (j.code !== 0 || !j.data || !j.data.result) return null;
    const pick = async (u) => {
      if (!u.upic || /noface\.jpg/.test(u.upic)) return null;
      const face = u.upic.startsWith('http') ? u.upic : 'https:' + u.upic;
      if (usedUrls.has(face)) return null;
      const buf = await grab(face, 'https://www.bilibili.com/');
      if (!buf) return null;
      usedUrls.add(face);
      return { buf, url: face, title: 'B 站头像：' + u.uname, from: 'user' };
    };
    const eq = (s) => String(s || '').replace(/[_\s]/g, '');
    for (const u of j.data.result) if (eq(u.uname) === eq(name)) {
      const r2 = await pick(u);
      if (r2) return r2;
    }
    for (const u of j.data.result) if (eq(u.uname).includes(eq(name)) || eq(name).includes(eq(u.uname))) {
      const r2 = await pick(u);
      if (r2) return r2;
    }
    return null;
  } catch {
    return null;
  }
}

(async () => {
  console.log('待配图人物', TODO.length);
  let i = 0;
  for (const h of TODO) {
    i++;
    const zone = zoneOf(h);
    const dir = path.join(OUT_DIR, h.name.replace(/[\\/:*?"<>|]/g, '_'));
    fs.mkdirSync(dir, { recursive: true });
    const picks = [];

    // UP 主：头像优先（§9.1 第 4 条），没拿到再退回图库
    if (zone === 'UP主') {
      const a = await userAvatar(h.name);
      if (a) picks.push(a);
    }

    if (!picks.length) {
      const cs = await baiduCand(queryOf(h, zone), zone, 2);
      picks.push(...cs);
    }
    if (!picks.length) {
      const b = await baikeImg(h.name);
      if (b) picks.push(b);
    }
    if (!picks.length && zone === 'divatag') {
      const cs = await baiduCand(h.name + ' 官方', 'UP主', 2);
      picks.push(...cs);
    }

    const files = [];
    for (let k = 0; k < picks.length; k++) {
      const p = picks[k];
      const file = `${p.from}-${k + 1}.jpg`;
      fs.writeFileSync(path.join(dir, file), p.buf);
      files.push({ file, url: p.url, title: p.title, w: p.w, h: p.h, from: p.from });
    }

    RECORDS.push({ name: h.name, zone, rank: h.rank, files });
    if (i % 10 === 0 || i === TODO.length) {
      console.log(`[${i}/${TODO.length}] ${h.name} → ${files.length} 张`);
      fs.writeFileSync(
        OUT_JSON,
        JSON.stringify({ generatedAt: new Date().toISOString(), rows: RECORDS }, null, 1),
        'utf8'
      );
    }
    await sleep(120);
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), rows: RECORDS }, null, 1), 'utf8');
  const got = RECORDS.filter((r) => r.files.length).length;
  console.log('完成：' + got + '/' + RECORDS.length + ' 位拿到候选图');
})();
