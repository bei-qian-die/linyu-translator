'use strict';

// 第二十一轮配图第三轮：首轮/补抓仍不理想的英雄，换更「美术图」向的检索词再抓一遍。
//
// 目标名单是人工复核 pick21 复核册后列出来的（截图带 HUD、卡面带字、错图）。
// 只用必应（首轮百度给的多是视频缩略图），查三个变体，各取前几张，存成 {名}_v2N.jpg。
//
// 用法: node scripts/fetch-hero-images21-v2.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence/hero-cand21');
const { ROSTER } = require(path.join(ROOT, 'scripts/curated-heroes21.js'));

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safe = (s) => String(s).replace(/[\\/:*?"<>|·]/g, '_');
const clean = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// 人工复核后需要重抓的名单
const TARGETS = [
  '骇灾', '卡西迪', '托比昂', '探奇', '秩序之光', '弗蕾娅', '斩仇', '安燃',
  '埃姆雷', '西拉', '死怨', '金驭', 'D.Mon', '回声', '瑞稀', '飞天猫',
];

const BAD = /同人|手绘|绘画|二创|ai|AI|表情包|周边|雕像|键帽|攻略|配招|强度|打法|阵容|排行|推荐|怎么|如何|教学|获取|价格|报价|测评|讲解|实机|试玩|预告|威能|技能|集锦|录播|直播/;

async function grab(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.bing.com/' } });
    if (!r.ok) return null;
    if (!/^image\//.test(r.headers.get('content-type') || '')) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length > 9000 ? buf : null;
  } catch {
    return null;
  }
}

async function bing(word, need) {
  const u = 'https://www.bing.com/images/async?q=' + encodeURIComponent(word) + '&first=0&count=30&mkt=zh-CN&adlt=off';
  let h;
  try {
    h = await (await fetch(u, { headers: { 'User-Agent': UA } })).text();
  } catch {
    return [];
  }
  const out = [];
  for (const raw of [...h.matchAll(/m="([^"]+)"/g)].map((m) => m[1])) {
    let j;
    try {
      j = JSON.parse(raw.replace(/&quot;/g, '"'));
    } catch {
      continue;
    }
    if (!j || !j.murl) continue;
    const title = clean(j.t || '');
    if (BAD.test(title)) continue;
    const buf = await grab(j.murl);
    if (!buf) continue;
    out.push({ buf, url: j.murl, title: title.slice(0, 90) });
    if (out.length >= need) break;
    await sleep(110);
  }
  return out;
}

(async () => {
  let total = 0;
  for (const name of TARGETS) {
    const r = ROSTER.find((x) => x.name === name);
    const en = r ? String(r.en).split('/')[0].split('(')[0].trim() : '';
    const qs = [
      `overwatch ${en} hero full body render png`,
      `守望先锋 ${name} 英雄 全身 立绘`,
      `overwatch ${en} official art transparent`,
    ].filter((q) => !/^\s*overwatch\s+hero/.test(q));
    let idx = 0;
    for (const q of qs) {
      const cs = await bing(q, 4);
      for (const c of cs) {
        fs.writeFileSync(path.join(OUT_DIR, `${safe(name)}_v2${idx}.jpg`), c.buf);
        fs.writeFileSync(path.join(OUT_DIR, `${safe(name)}_v2${idx}.json`), JSON.stringify({ url: c.url, title: c.title }));
        idx += 1;
        total += 1;
      }
      await sleep(260);
      if (idx >= 10) break;
    }
    console.log(`  ${name} +${idx}`);
  }
  console.log(`[v2] 新增 ${total} 张`);
})();
