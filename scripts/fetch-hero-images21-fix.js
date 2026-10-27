'use strict';

// 第二十一轮配图补抓：首轮挑出来是横版视频缩略图（16:9）的英雄，
// 换「竖构图优先」的检索词再抓一轮，补到候选池里再重新挑。
//
// 触发条件：evidence/hero-images21.json 里 score < 5，或选中的是横图。
// 检索词改成英文全名 + full body render（fandom/wiki 上这类图是竖版透明 PNG，
// 也是官方美术资源，最贴近「英雄立绘」），中文侧用「立绘 全身」。
//
// 用法: node scripts/fetch-hero-images21-fix.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence/hero-cand21');
const PICK = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/hero-images21.json'), 'utf8'));
const { ROSTER } = require(path.join(ROOT, 'scripts/curated-heroes21.js'));

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safe = (s) => String(s).replace(/[\\/:*?"<>|·]/g, '_');
const clean = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const BAD = /同人|手绘|绘画|二创|ai|AI|表情包|周边|雕像|键帽|攻略|配招|强度|打法|阵容|排行|推荐|怎么|如何|教学|获取|价格|报价|测评|讲解|实机|试玩|预告|威能|技能/;

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
    const buf = await grab(j.murl, 'https://www.bing.com/');
    if (!buf) continue;
    out.push({ buf, url: j.murl, title: title.slice(0, 90), from: 'bing' });
    if (out.length >= need) break;
    await sleep(120);
  }
  return out;
}

(async () => {
  const weak = Object.entries(PICK.map).filter(([, v]) => v.score < 5 || (v.h / v.w) < 1.15);
  console.log(`[fix] 需要补抓 ${weak.length} 位：${weak.map(([k]) => k).join('、')}`);
  let added = 0;

  for (const [name] of weak) {
    const r = ROSTER.find((x) => x.name === name);
    const en = r ? String(r.en).split('/')[0].trim() : '';
    const queries = [en ? `overwatch ${en} full body render png` : '', `守望先锋 ${name} 立绘 全身`, `守望先锋 ${name} 原画`].filter(Boolean);
    let idx = 0;
    for (const q of queries) {
      const cands = await bing(q, 3);
      for (const c of cands) {
        const file = `${safe(name)}_fix${idx}.jpg`;
        fs.writeFileSync(path.join(OUT_DIR, file), c.buf);
        added += 1;
        idx += 1;
      }
      await sleep(300);
      if (idx >= 6) break;
    }
    console.log(`  ${name} +${idx}`);
  }
  console.log(`[fix] 新增候选 ${added} 张；下一步重跑 dims 统计 → pick-hero-images21.js`);
})();
