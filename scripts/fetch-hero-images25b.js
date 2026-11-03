'use strict';

// 第二十五轮配图补抓：fetch-hero-images25.js 漏掉的 4 位。
// 路由：B 站视频封面（view API 的 pic）→ 百度百科 → 百度图库换词。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CAND = path.join(ROOT, 'evidence', 'hero-cand25');
const DOC_PATH = path.join(ROOT, 'evidence', 'hero-images25.json');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const doc = JSON.parse(fs.readFileSync(DOC_PATH, 'utf8'));

async function grab(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' } });
    if (!r.ok) return null;
    if (!/^image\//.test(r.headers.get('content-type') || '')) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return b.length > 8000 ? b : null;
  } catch {
    return null;
  }
}

async function viewPic(bvid) {
  try {
    const r = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid, {
      headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
    });
    const j = await r.json();
    if (j.code !== 0) return null;
    const pic = j.data.pic;
    const buf = await grab(pic);
    return buf ? { buf, url: pic, title: 'B站视频封面：' + String(j.data.title).slice(0, 40), w: 0, h: 0, from: 'cover' } : null;
  } catch {
    return null;
  }
}

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
    const buf = await grab(url);
    return buf ? { buf, url, title: '百度百科词条图：' + key, w: 0, h: 0, from: 'baike' } : null;
  } catch {
    return null;
  }
}

async function baiduCand(word) {
  const u =
    'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592&is=&fp=result&word=' +
    encodeURIComponent(word) +
    '&pn=0&rn=40&gsm=1e';
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://image.baidu.com/' } });
    const j = JSON.parse((await r.text()).replace(/[\u0000-\u001f]/g, ' '));
    for (const x of (j.data || []).filter((v) => v && (v.middleURL || v.thumbURL))) {
      if (x.width && x.width < 300) continue;
      const title = String(x.fromPageTitle || '');
      if (/表情包|梗图|手绘|同人|绘画|教程|攻略|cos|ai生成|ai还原/i.test(title)) continue;
      const buf = await grab(x.middleURL || x.thumbURL);
      if (buf) {
        return { buf, url: x.middleURL || x.thumbURL, title: title.slice(0, 80), w: x.width || 0, h: x.height || 0, from: 'baidu' };
      }
      await sleep(60);
    }
    return null;
  } catch {
    return null;
  }
}

// 目标：4 位漏抓 + 每个都给出可信的先后顺序
const PLAN = [
  { name: '幻王龙', bvids: [], queries: ['奥奇传说 幻王龙', '幻王龙 奥奇'] },
  { name: '王龙源兽', bvids: [], queries: ['奥奇传说 王龙 源兽', '王龙 奥奇传说'] },
  { name: 'moligod', bvids: [], queries: ['moligod 三角洲行动', 'moligod'] },
  { name: 'kyle_waang', bvids: [], queries: ['kyle_waang', 'kyle waang'] },
];

(async () => {
  // 从 manifest 里补各人的 BV
  for (const f of fs.readdirSync(path.join(ROOT, 'evidence')).filter((x) => /^manifest-20261103/.test(x))) {
    const arr = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', f), 'utf8'));
    for (const v of Array.isArray(arr) ? arr : arr.items || []) {
      const p = PLAN.find((x) => x.name === v.up);
      if (p && p.bvids.length < 2 && !p.bvids.includes(v.bvid)) p.bvids.push(v.bvid);
    }
  }

  for (const p of PLAN) {
    const dir = path.join(CAND, p.name);
    fs.mkdirSync(dir, { recursive: true });
    const picks = [];
    for (const b of p.bvids) {
      const c = await viewPic(b);
      if (c) picks.push(c);
      if (picks.length >= 2) break;
    }
    if (!picks.length) {
      const b = await baikeImg(p.name);
      if (b) picks.push(b);
    }
    for (const q of p.queries) {
      if (picks.length) break;
      const c = await baiduCand(q);
      if (c) picks.push(c);
    }
    const files = [];
    for (let i = 0; i < picks.length; i++) {
      const f = `${picks[i].from}-${i + 1}.jpg`;
      fs.writeFileSync(path.join(dir, f), picks[i].buf);
      files.push({ file: f, url: picks[i].url, title: picks[i].title, w: picks[i].w, h: picks[i].h, from: picks[i].from });
    }
    const row = doc.rows.find((r) => r.name === p.name);
    if (row) row.files = files;
    else doc.rows.push({ name: p.name, zone: '未知', rank: '', files });
    console.log(p.name, '→', files.length, '张');
    await sleep(200);
  }
  fs.writeFileSync(DOC_PATH, JSON.stringify(doc, null, 1), 'utf8');
})();
