'use strict';

// 第二十一轮配图抓取（守望淋锋 / 守望先锋）。
//
// 来源优先级（优化提示词：百度图库 / 该英雄百度词条相关图 / B站淋语视频封面；UP 用头像）：
//   1) 百度图库（image.baidu.com）—— 中文环境下「英雄名 + 官方立绘」最全
//   2) 必应图库（bing.com/images/async）—— 百度结果带大字标题时换这条路
//   3) B 站淋语视频封面 —— 本区的「专题区」条目（本身就是视频合集，没有单一角色立绘）
// 硬性淘汰：同人 / 手绘 / 绘画 / AI 生成 / 攻略截图 / 强度排行 / 二创拼贴
//
// 产出 evidence/hero-cand21/ + evidence/hero-cand21.json，
// 供 contact sheet 人工复核后由 scripts/apply-hero-images21.py 裁切落地。
//
// 用法：
//   node scripts/fetch-hero-images21.js              # 全部
//   node scripts/fetch-hero-images21.js 天使,源氏     # 只抓指定人物
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence/hero-cand21');
const OUT_JSON = path.join(ROOT, 'evidence/hero-cand21.json');
fs.mkdirSync(OUT_DIR, { recursive: true });

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { HEROES } = require(path.join(ROOT, 'scripts/curated-heroes21.js'));

// 专题区条目：没有单一角色立绘，用代表视频的封面
const IS_TOPIC = (h) => /专题区/.test(h.name);
const TOPIC_BVID = {
  '守望淋锋 · 阿三专题区': 'BV1rT4y68E51',
  '摩西女专题区': 'BV1iyn96eEsz',
};

// 检索词：默认「守望先锋 + 名 + 官方立绘」，个别英雄换更准的说法
const QUERY = {
  士兵: '守望先锋 士兵76 官方 立绘',
  'D.Va': '守望先锋 DVA 官方 立绘',
  美: '守望先锋 小美 官方 立绘',
  死神: '守望先锋 死神 莱耶斯 官方 立绘',
  卡西迪: '守望先锋 麦克雷 官方 立绘',
  生命之梭: '守望先锋 生命之梭 花男 官方 立绘',
  血律: '守望先锋 血律 官方 立绘',
  探奇: '守望先锋 探奇 官方 立绘',
  飞天猫: '守望先锋 飞天猫 官方',
  金驭: '守望先锋 金驭 官方',
  'D.Mon': '守望先锋 D.Mon 官方',
};

const GOOD = /立绘|图鉴|官方|原画|角色|形象|全身|海报|壁纸|设定|档案|英雄|皮肤|渲染/;
const BAD = /同人|手绘|绘画|二创|ai|AI|AI生成|表情包|周边|雕像|键帽|抽奖|攻略|配招|强度|打法|阵容|排行|推荐|怎么|如何|教学|获取|价格|报价|测评|讲解|实机|试玩|预告/;

const safe = (s) => String(s).replace(/[\\/:*?"<>|·]/g, '_');
const clean = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

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

// ---------- 百度图库 ----------
async function baiduCand(word) {
  const u =
    'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592&is=&fp=result&word=' +
    encodeURIComponent(word) +
    '&pn=0&rn=24&gsm=1e';
  let j;
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://image.baidu.com/' } });
    j = JSON.parse((await r.text()).replace(/[\u0000-\u001f]/g, ' '));
  } catch {
    return [];
  }
  const out = [];
  for (const x of (j.data || []).filter((v) => v && (v.middleURL || v.thumbURL))) {
    const title = clean(x.fromPageTitle || x.fromPageTitleEnc || '');
    if (BAD.test(title)) continue;
    if (x.width && x.width < 320) continue;
    const buf = await grab(x.middleURL || x.thumbURL, 'https://image.baidu.com/');
    if (!buf) continue;
    out.push({ buf, url: x.middleURL || x.thumbURL, title: title.slice(0, 90), w: x.width || 0, h: x.height || 0, good: GOOD.test(title), from: 'baidu' });
    if (out.length >= 3) break;
    await sleep(120);
  }
  return out;
}

// ---------- 必应图库 ----------
async function bingCand(word) {
  const u =
    'https://www.bing.com/images/async?q=' +
    encodeURIComponent(word) +
    '&first=0&count=24&mkt=zh-CN&adlt=off';
  let h;
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA } });
    h = await r.text();
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
    out.push({ buf, url: j.murl, title: title.slice(0, 90), w: 0, h: 0, good: GOOD.test(title), from: 'bing' });
    if (out.length >= 3) break;
    await sleep(120);
  }
  return out;
}

// ---------- B 站视频封面 ----------
async function biliCover(bvid) {
  try {
    const r = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid, {
      headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
    });
    const j = await r.json();
    const d = j && j.data;
    if (!d || !d.pic) return null;
    const pic = d.pic.startsWith('http') ? d.pic : 'https:' + d.pic;
    const buf = await grab(pic, 'https://www.bilibili.com/');
    if (!buf) return null;
    return { buf, url: pic, title: `B站封面：${d.title}`, w: 0, h: 0, good: true, from: 'bili-cover', bvid };
  } catch {
    return null;
  }
}

(async () => {
  const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
  const items = [];
  let n = 0;

  for (const h of HEROES) {
    if (only && !only.has(h.name)) continue;
    n += 1;

    if (IS_TOPIC(h)) {
      const c = await biliCover(TOPIC_BVID[h.name]);
      if (c) {
        const file = `topic_${safe(h.name)}.jpg`;
        fs.writeFileSync(path.join(OUT_DIR, file), c.buf);
        items.push({ name: h.name, kind: 'bili-cover', file, url: c.url, title: c.title, idx: 0, good: true, bvid: c.bvid });
        console.log(`[cover] ${h.name} ← ${c.bvid}`);
      } else {
        console.log(`[cover] ${h.name} 未取到封面`);
      }
      await sleep(400);
      continue;
    }

    const word = QUERY[h.name] || `守望先锋 ${h.name} 官方 立绘`;
    let cands = await baiduCand(word);
    if (!cands.length) {
      console.log(`[baidu] ${h.name} 0 张，切必应`);
      cands = await bingCand(word);
    }
    let idx = 0;
    for (const c of cands) {
      const file = `${safe(h.name)}_${idx}.jpg`;
      fs.writeFileSync(path.join(OUT_DIR, file), c.buf);
      items.push({ name: h.name, kind: c.from, file, url: c.url, title: c.title, idx, good: c.good });
      idx += 1;
    }
    console.log(`[${cands[0] ? cands[0].from : 'none'}] ${h.name} ${idx} 张`);
    await sleep(320);
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), total: items.length, items }, null, 2));
  console.log(`[done] 人物 ${n} 位，候选图 ${items.length} 张 → evidence/hero-cand21/`);
})();
