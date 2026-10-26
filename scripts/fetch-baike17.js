'use strict';

// 第十七轮质检 · 第二来源：百度百科词条主图。
//
// 为什么需要：百度图库对「洛克王国 X」这类词返回的多数是攻略截图、实机录屏、图鉴卡，
// 少数精灵连一张干净立绘都没有；而用户允许的另一个来源正是「该英雄的百度词条相关图」。
// 词条页 HTML 对脚本返回 403，但开放接口 BaikeLemmaCardApi 能直接拿到词条主图（bkimg CDN），
// 且主图就是官方立绘，比图库干净得多。
//
// 校验：返回的 abstract 必须提到「洛克」，否则说明词条抓串了（比如「鬼雾」会命中火影忍者、
// 「幽铃」会命中网络小说、「阿布」会命中年月日），这类必须丢弃，不能当配图。
//
// 产出 evidence/hero-baike17/<name>.jpg 与 evidence/hero-baike17.json
// 用法: node scripts/fetch-baike17.js [名字,名字,...]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence', 'hero-baike17');
const OUT_JSON = path.join(ROOT, 'evidence', 'hero-baike17.json');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HDR = { 'User-Agent': UA, Referer: 'https://baike.baidu.com/' };

// 键=词库里的名字，值=实际检索用的词条名（有几个名字在社区里被写错/写歪了）
const PLAN = process.argv[2]
  ? process.argv[2].split(',')
  : [
      ['魔力猫', '魔力猫'],
      ['瞌睡王', '瞌睡王'],
      ['喷火鸟', '喷火鸟'],
      ['龙希帕尔', '龙息帕尔'],
      ['圣羽翼王', '圣羽翼王'],
      ['幽颖树', '幽影树'],
      ['多灵主', '多灵主'],
      ['卡瓦重', '卡瓦重'],
      ['卷毛鸭', '卷毛鸭'],
      ['咔咔鸟', '咔咔鸟'],
      ['上岸蛙', '上岸蛙'],
      ['吸泥鸥', '吸泥鸥'],
    ].map(([name, key]) => ({ name, key }));

async function lemma(key) {
  const u =
    'https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key=' +
    encodeURIComponent(key) +
    '&bk_length=300';
  const r = await fetch(u, { headers: HDR });
  const j = JSON.parse(await r.text());
  return j;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const items = [];
  const rejected = [];
  for (const { name, key } of PLAN) {
    let j;
    try {
      j = await lemma(key);
    } catch (e) {
      rejected.push({ name, key, why: '接口失败 ' + e.message });
      continue;
    }
    const abs = String(j.abstract || '');
    if (!/洛克/.test(abs)) {
      rejected.push({ name, key, why: 'abstract 不含「洛克」，词条抓串：' + abs.slice(0, 30) });
      continue;
    }
    if (!j.image) {
      rejected.push({ name, key, why: '词条无主图' });
      continue;
    }
    const file = `${name}.jpg`;
    try {
      const r = await fetch(j.image, { headers: HDR });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 4000) throw new Error('too small');
      fs.writeFileSync(path.join(OUT_DIR, file), buf);
    } catch (e) {
      rejected.push({ name, key, why: '主图下载失败 ' + e.message });
      continue;
    }
    items.push({
      name,
      key,
      lemma: j.key || key,
      desc: abs.slice(0, 60),
      image: j.image,
      file,
      bytes: fs.statSync(path.join(OUT_DIR, file)).size,
    });
    console.error(`[OK] ${name} ← 词条「${j.key || key}」`);
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), items, rejected }, null, 2) + '\n', 'utf8');
  console.log(`词条主图 ${items.length} 张，丢弃 ${rejected.length} 个 -> ${OUT_JSON}`);
  for (const r of rejected) console.log(`  [丢弃] ${r.name}(${r.key})：${r.why}`);
})();
