'use strict';

// 第十七轮质检 · 第三来源：B 站视频封面。
//
// 为什么需要：瞌睡王 / 龙希帕尔 / 幽颖树 / 云梦豚 / 上岸蛙 这几位在百度图库里
// 全是攻略截图、实机录屏、图鉴卡，没有一张干净立绘；百度百科词条页又对脚本返回 403。
// 用户许可的图源里还剩「哔哩哔哩淋语相关视频封面」，于是走 B 站搜索接口取封面。
//
// 产出 evidence/hero-cover17/<name>_<idx>.jpg 与 evidence/hero-cover17.json
// 用法: node scripts/fetch-bili-cover17.js [名字,名字,...]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence', 'hero-cover17');
const OUT_JSON = path.join(ROOT, 'evidence', 'hero-cover17.json');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HDR = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PLAN = process.argv[2] ? process.argv[2].split(',') : ['瞌睡王', '龙希帕尔', '幽颖树', '云梦豚', '上岸蛙'];

// 多组关键词，扩大封面池（同一只精灵在不同 UP 手里的封面差别很大）
const kwList = (name) => [`洛克王国 ${name}`, `${name} 洛克王国 世界`, `洛克淋国 ${name}`];

async function search(keyword) {
  const u =
    'https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=' +
    encodeURIComponent(keyword) +
    '&page=1';
  const r = await fetch(u, { headers: HDR });
  const j = await r.json();
  if (j.code !== 0) throw new Error('code ' + j.code + ' ' + (j.message || ''));
  return (j.data && j.data.result) || [];
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const items = [];
  for (const name of PLAN) {
    let idx = 0;
    const seen = new Set();
    for (const kw of kwList(name)) {
      let list = [];
      try {
        list = await search(kw);
      } catch (e) {
        console.error(`[搜索失败] ${name} / ${kw}: ${e.message}`);
        continue;
      }
      for (const v of list.slice(0, 6)) {
        if (!v.pic || seen.has(v.bvid)) continue;
        seen.add(v.bvid);
        const url = v.pic.startsWith('http') ? v.pic : 'https:' + v.pic;
        const file = `${name}_${idx}.jpg`;
        try {
          const r = await fetch(url, { headers: HDR });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length < 5000) throw new Error('too small');
          fs.writeFileSync(path.join(OUT_DIR, file), buf);
        } catch {
          continue;
        }
        items.push({
          name,
          idx,
          bvid: v.bvid,
          title: String(v.title || '').replace(/<[^>]+>/g, '').slice(0, 70),
          author: v.author,
          url,
          file,
        });
        idx++;
        await sleep(100);
      }
      await sleep(500);
    }
    console.error(`[OK] ${name} 封面 ${idx}`);
    await sleep(400);
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 2) + '\n', 'utf8');
  console.log(`封面 ${items.length} 张 / ${new Set(items.map((x) => x.name)).size} 个对象 -> ${OUT_JSON}`);
})();
